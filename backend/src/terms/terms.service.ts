import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Versión tal como la consume el alumno al firmar. */
export interface ResolvedTerms {
  documentId: string;
  documentName: string;
  versionId: string;
  version: string;
  title: string;
  body: string;
  publishedAt: Date;
}

/** La vigente de un documento es la PUBLICADA más reciente. */
const CURRENT_VERSION_QUERY = {
  where: { publishedAt: { not: null } },
  orderBy: { publishedAt: 'desc' },
  take: 1,
} satisfies Prisma.TermsDocument$versionsArgs;

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Resolución del texto vigente --------------------------------------

  /**
   * Documento que rige para un curso: el suyo si lo tiene, si no el global.
   * Devuelve su versión publicada más reciente.
   */
  async resolveForCourse(courseId: string): Promise<ResolvedTerms> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { termsDocumentId: true },
    });
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    if (course.termsDocumentId) {
      const own = await this.loadCurrent(course.termsDocumentId);
      if (own) return own;
      // El curso apunta a un documento sin versiones publicadas: se avisa en vez de
      // caer al global en silencio, porque sería firmar un texto que nadie asignó.
      throw new ConflictException(
        'El documento de condiciones asignado a este curso no tiene ninguna versión publicada',
      );
    }

    return this.resolveDefault();
  }

  /** Versión vigente del documento por defecto (global). */
  async resolveDefault(): Promise<ResolvedTerms> {
    const doc = await this.prisma.termsDocument.findFirst({ where: { isDefault: true } });
    if (!doc) {
      throw new ConflictException(
        'No hay un documento de condiciones por defecto. Créalo en Administración → Documentos.',
      );
    }
    const current = await this.loadCurrent(doc.id);
    if (!current) {
      throw new ConflictException(
        `El documento por defecto ("${doc.name}") no tiene ninguna versión publicada.`,
      );
    }
    return current;
  }

  private async loadCurrent(documentId: string): Promise<ResolvedTerms | null> {
    const doc = await this.prisma.termsDocument.findUnique({
      where: { id: documentId },
      include: { versions: CURRENT_VERSION_QUERY },
    });
    const version = doc?.versions[0];
    if (!doc || !version) return null;

    return {
      documentId: doc.id,
      documentName: doc.name,
      versionId: version.id,
      version: version.version,
      title: version.title,
      body: version.body,
      publishedAt: version.publishedAt!,
    };
  }

  // --- Documentos ---------------------------------------------------------

  async listDocuments() {
    const docs = await this.prisma.termsDocument.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { versions: true, courses: true } },
        versions: CURRENT_VERSION_QUERY,
      },
    });

    return docs.map((d) => ({
      id: d.id,
      name: d.name,
      isDefault: d.isDefault,
      createdAt: d.createdAt,
      versionCount: d._count.versions,
      coursesUsing: d._count.courses,
      currentVersion: d.versions[0]
        ? {
            version: d.versions[0].version,
            title: d.versions[0].title,
            publishedAt: d.versions[0].publishedAt,
          }
        : null,
    }));
  }

  async createDocument(name: string) {
    return this.prisma.termsDocument.create({ data: { name } });
  }

  /** Cambiar el nombre y/o designarlo por defecto (solo uno puede serlo). */
  async updateDocument(id: string, data: { name?: string; isDefault?: boolean }) {
    await this.assertDocumentExists(id);

    if (data.isDefault === false) {
      throw new BadRequestException(
        'No se puede quitar el documento por defecto: marca otro como predeterminado',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        // Solo uno puede ser el global: se desmarca el anterior en la misma transacción.
        await tx.termsDocument.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.termsDocument.update({
        where: { id },
        data: { name: data.name, isDefault: data.isDefault },
      });
    });
  }

  async deleteDocument(id: string) {
    const doc = await this.prisma.termsDocument.findUnique({
      where: { id },
      include: { _count: { select: { courses: true } }, versions: { select: { version: true } } },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
    if (doc.isDefault) {
      throw new ConflictException(
        'No puedes eliminar el documento por defecto: marca otro como predeterminado primero',
      );
    }
    if (doc._count.courses > 0) {
      throw new ConflictException(
        `No puedes eliminarlo: ${doc._count.courses} curso(s) lo están usando`,
      );
    }

    const signatures = await this.countSignatures(doc.versions.map((v) => v.version));
    if (signatures > 0) {
      throw new ConflictException(
        `No puedes eliminarlo: hay ${signatures} firma(s) registradas sobre sus versiones`,
      );
    }

    await this.prisma.termsDocument.delete({ where: { id } });
    return { deleted: true };
  }

  // --- Versiones ----------------------------------------------------------

  async listVersions(documentId: string) {
    await this.assertDocumentExists(documentId);

    const versions = await this.prisma.termsVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    // Las firmas guardan la ETIQUETA de versión, no el id: se cuentan en lote.
    const counts = await this.signatureCounts(versions.map((v) => v.version));

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      title: v.title,
      body: v.body,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      isDraft: v.publishedAt === null,
      signatureCount: counts.get(v.version) ?? 0,
    }));
  }

  async createVersion(
    documentId: string,
    data: { version: string; title: string; body: string; publish?: boolean },
    createdById: string,
  ) {
    await this.assertDocumentExists(documentId);

    try {
      return await this.prisma.termsVersion.create({
        data: {
          documentId,
          version: data.version,
          title: data.title,
          body: data.body,
          publishedAt: data.publish ? new Date() : null,
          createdById,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `Ya existe una versión "${data.version}" en este documento; usa otra etiqueta`,
        );
      }
      throw error;
    }
  }

  /** Solo borradores: una versión publicada es inmutable. */
  async updateVersion(
    versionId: string,
    data: { version?: string; title?: string; body?: string },
  ) {
    const version = await this.loadVersion(versionId);
    this.assertDraft(version.publishedAt);

    try {
      return await this.prisma.termsVersion.update({ where: { id: versionId }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `Ya existe una versión "${data.version}" en este documento; usa otra etiqueta`,
        );
      }
      throw error;
    }
  }

  /** Publicar la vuelve inmutable y vigente (la publicada más reciente gana). */
  async publishVersion(versionId: string) {
    const version = await this.loadVersion(versionId);
    if (version.publishedAt !== null) {
      throw new ConflictException('Esta versión ya está publicada');
    }
    return this.prisma.termsVersion.update({
      where: { id: versionId },
      data: { publishedAt: new Date() },
    });
  }

  async deleteVersion(versionId: string) {
    const version = await this.loadVersion(versionId);
    this.assertDraft(version.publishedAt);

    const signatures = await this.countSignatures([version.version]);
    if (signatures > 0) {
      throw new ConflictException(
        `No puedes eliminarla: hay ${signatures} firma(s) con la etiqueta "${version.version}"`,
      );
    }

    await this.prisma.termsVersion.delete({ where: { id: versionId } });
    return { deleted: true };
  }

  // --- Asignación por curso -----------------------------------------------

  async setCourseDocument(courseId: string, termsDocumentId: string | null) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }
    if (termsDocumentId) {
      await this.assertDocumentExists(termsDocumentId);
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data: { termsDocumentId },
      select: { id: true, name: true, termsDocumentId: true },
    });
  }

  // --- Helpers ------------------------------------------------------------

  private assertDraft(publishedAt: Date | null): void {
    if (publishedAt !== null) {
      throw new ConflictException(
        'Las versiones publicadas son inmutables; crea una nueva versión',
      );
    }
  }

  private async assertDocumentExists(id: string): Promise<void> {
    const doc = await this.prisma.termsDocument.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }
  }

  private async loadVersion(versionId: string) {
    const version = await this.prisma.termsVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException('Versión no encontrada');
    }
    return version;
  }

  /**
   * KitAcceptance guarda la ETIQUETA de versión (texto), no una FK. Es una
   * limitación heredada: el conteo por etiqueta puede mezclar dos documentos que
   * usen la misma etiqueta (p. ej. "1.0"). Se asume conservador: contar de más
   * solo hace que el borrado sea MÁS estricto, nunca menos.
   */
  private async signatureCounts(versionLabels: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (versionLabels.length === 0) return result;

    const rows = await this.prisma.kitAcceptance.groupBy({
      by: ['termsVersion'],
      where: { termsVersion: { in: versionLabels } },
      _count: true,
    });
    for (const r of rows) result.set(r.termsVersion, r._count);
    return result;
  }

  private async countSignatures(versionLabels: string[]): Promise<number> {
    if (versionLabels.length === 0) return 0;
    return this.prisma.kitAcceptance.count({
      where: { termsVersion: { in: versionLabels } },
    });
  }
}
