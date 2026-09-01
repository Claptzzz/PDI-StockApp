import { INestApplication } from '@nestjs/common';
import { Course, Group, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './support/app';
import { as } from './support/auth';
import {
  createAdmin,
  createComponent,
  createCourse,
  createDefaultTerms,
  createGroup,
  createKit,
  createStudent,
  createTermsDocument,
  uniqueSuffix,
} from './support/fixtures';

describe('Verificación del kit y aceptación de condiciones', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: User;
  let curso: Course;
  let grupo: Group;
  let ana: User;
  let bruno: User;
  let ajena: User;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    admin = await createAdmin(prisma);
    curso = await createCourse(prisma);
    ana = await createStudent(prisma, { name: 'Ana' });
    bruno = await createStudent(prisma, { name: 'Bruno' });
    ajena = await createStudent(prisma, { name: 'Ajena' });
    grupo = await createGroup(prisma, curso, { members: [ana, bruno] });
    // Documento global con una versión publicada: sin él no se puede firmar.
    await createDefaultTerms(prisma, admin, [{ version: '1.0', published: true }]);
  });

  /** Kit de dos ítems asignado al grupo de Ana y Bruno. */
  const kitDelGrupo = async () => {
    const sufijo = uniqueSuffix();
    const a = await createComponent(prisma, { name: `Arduino ${sufijo}`, totalStock: 10 });
    const b = await createComponent(prisma, { name: `Protoboard ${sufijo}`, totalStock: 10 });
    return createKit(prisma, curso, grupo, {
      items: [
        { component: a, quantity: 1 },
        { component: b, quantity: 1 },
      ],
    });
  };

  const verificar = (usuario: User, kitId: string, body: object) =>
    as(app, usuario).post(`/api/me/kits/${kitId}/verify`).send(body);

  const todosConformes = (items: { id: string }[]) => ({
    items: items.map((it) => ({ kitItemId: it.id, verified: true })),
  });

  describe('la verificación es GRUPAL y ocurre una sola vez', () => {
    it('un integrante verifica el kit en nombre de todo el grupo', async () => {
      const kit = await kitDelGrupo();

      const res = await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      expect(res.body).toMatchObject({ isVerified: true, verifiedBy: { id: ana.id } });
      const enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      expect(enDb.verifiedAt).not.toBeNull();
      expect(enDb.verifiedById).toBe(ana.id);
    });

    it('el segundo integrante ya no puede volver a verificarlo', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      const res = await verificar(bruno, kit.id, todosConformes(kit.items)).expect(409);

      expect(res.body.message).toContain('Ana');
      const enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      // Sigue registrado el primero: la verificación no se sobrescribe.
      expect(enDb.verifiedById).toBe(ana.id);
    });

    it('quien no pertenece al grupo no puede ni ver ni verificar el kit', async () => {
      const kit = await kitDelGrupo();

      await as(app, ajena).get(`/api/me/kits/${kit.id}`).expect(403);
      await verificar(ajena, kit.id, todosConformes(kit.items)).expect(403);

      const enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      expect(enDb.verifiedAt).toBeNull();
    });

    it('las discrepancias quedan registradas sin tocar cantidades ni stock', async () => {
      const kit = await kitDelGrupo();
      const [item1, item2] = kit.items;

      await verificar(ana, kit.id, {
        items: [
          { kitItemId: item1.id, verified: true },
          { kitItemId: item2.id, verified: false, note: 'Llegó partida en dos' },
        ],
      }).expect(201);

      const items = await prisma.kitItem.findMany({
        where: { kitId: kit.id },
        orderBy: { componentName: 'asc' },
      });
      expect(items[0]).toMatchObject({ verified: true, verificationNote: null, quantity: 1 });
      expect(items[1]).toMatchObject({
        verified: false,
        verificationNote: 'Llegó partida en dos',
        quantity: 1,
      });
      // El stock no se movió: la discrepancia solo se registra.
      const componente = await prisma.component.findUniqueOrThrow({
        where: { id: items[1].componentId! },
      });
      expect(componente.totalStock).toBe(10);
    });

    it('hay que verificar TODOS los ítems: uno ausente no se interpreta como "no recibido"', async () => {
      const kit = await kitDelGrupo();

      const res = await verificar(ana, kit.id, {
        items: [{ kitItemId: kit.items[0].id, verified: true }],
      }).expect(400);

      expect(res.body.message).toContain('Falta verificar');
      const enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      expect(enDb.verifiedAt).toBeNull();
    });

    it('no se aceptan ítems de otro kit en el formulario', async () => {
      const kit = await kitDelGrupo();
      const otroKit = await kitDelGrupo();

      await verificar(ana, kit.id, {
        items: [
          ...todosConformes(kit.items).items,
          { kitItemId: otroKit.items[0].id, verified: true },
        ],
      }).expect(400);
    });

    it('no se aceptan ítems repetidos', async () => {
      const kit = await kitDelGrupo();

      await verificar(ana, kit.id, {
        items: [
          { kitItemId: kit.items[0].id, verified: true },
          { kitItemId: kit.items[0].id, verified: false },
          { kitItemId: kit.items[1].id, verified: true },
        ],
      }).expect(400);
    });
  });

  describe('la aceptación de condiciones es INDIVIDUAL', () => {
    const aceptar = (usuario: User, kitId: string, termsVersion: string) =>
      as(app, usuario).post(`/api/me/kits/${kitId}/accept`).send({ termsVersion });

    it('no se puede firmar antes de verificar el kit', async () => {
      const kit = await kitDelGrupo();

      const res = await aceptar(ana, kit.id, '1.0').expect(409);

      expect(res.body.message).toContain('verificar');
      expect(await prisma.kitAcceptance.count()).toBe(0);
    });

    it('cada integrante firma por su cuenta: la firma de uno no cubre al otro', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      const res = await aceptar(ana, kit.id, '1.0').expect(201);

      expect(res.body.acceptances ?? res.body.members).toBeDefined();
      expect(res.body.hasAccepted).toBe(true);
      expect(res.body.allAccepted).toBe(false);

      const firmas = await prisma.kitAcceptance.findMany({ where: { kitId: kit.id } });
      expect(firmas).toHaveLength(1);
      expect(firmas[0]).toMatchObject({ studentId: ana.id, termsVersion: '1.0' });
    });

    it('cuando firman todos los integrantes el kit queda completo', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      await aceptar(ana, kit.id, '1.0').expect(201);
      const res = await aceptar(bruno, kit.id, '1.0').expect(201);

      expect(res.body.allAccepted).toBe(true);
      expect(await prisma.kitAcceptance.count({ where: { kitId: kit.id } })).toBe(2);
    });

    it('nadie puede firmar dos veces el mismo kit', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);
      await aceptar(ana, kit.id, '1.0').expect(201);

      const res = await aceptar(ana, kit.id, '1.0').expect(409);

      expect(res.body.message).toContain('Ya aceptaste');
      expect(await prisma.kitAcceptance.count({ where: { kitId: kit.id } })).toBe(1);
    });

    it('firmar una versión que ya no es la vigente se rechaza', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      const res = await aceptar(ana, kit.id, '0.9').expect(409);

      expect(res.body.message).toContain('condiciones cambiaron');
      expect(await prisma.kitAcceptance.count()).toBe(0);
    });

    it('quien no pertenece al grupo no puede firmar', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      await aceptar(ajena, kit.id, '1.0').expect(403);
    });

    it('la firma guarda la versión vigente, no la que envíe el cliente', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);
      await aceptar(ana, kit.id, '1.0').expect(201);

      const firma = await prisma.kitAcceptance.findFirstOrThrow();
      const vigente = await prisma.termsVersion.findFirstOrThrow({
        where: { publishedAt: { not: null } },
      });
      expect(firma.termsVersion).toBe(vigente.version);
    });
  });

  describe('la versión vigente se resuelve POR CURSO', () => {
    it('sin documento propio, el curso usa el documento por defecto', async () => {
      const res = await as(app, ana).get(`/api/terms?courseId=${curso.id}`).expect(200);

      expect(res.body).toMatchObject({ version: '1.0', documentName: 'Condiciones generales' });
    });

    it('con documento propio, manda el asignado al curso', async () => {
      const propio = await createTermsDocument(prisma, admin, {
        name: 'Condiciones de Robótica',
        versions: [{ version: '3.1', published: true }],
      });
      await as(app, admin)
        .patch(`/api/courses/${curso.id}/terms`)
        .send({ termsDocumentId: propio.id })
        .expect(200);

      const res = await as(app, ana).get(`/api/terms?courseId=${curso.id}`).expect(200);

      expect(res.body).toMatchObject({ version: '3.1', documentName: 'Condiciones de Robótica' });
    });

    it('el alumno firma la versión del documento de SU curso', async () => {
      const propio = await createTermsDocument(prisma, admin, {
        name: 'Condiciones de Robótica',
        versions: [{ version: '3.1', published: true }],
      });
      await prisma.course.update({
        where: { id: curso.id },
        data: { termsDocumentId: propio.id },
      });

      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      // La versión global (1.0) ya no sirve para este curso.
      await as(app, ana)
        .post(`/api/me/kits/${kit.id}/accept`)
        .send({ termsVersion: '1.0' })
        .expect(409);
      await as(app, ana)
        .post(`/api/me/kits/${kit.id}/accept`)
        .send({ termsVersion: '3.1' })
        .expect(201);

      const firma = await prisma.kitAcceptance.findFirstOrThrow();
      expect(firma.termsVersion).toBe('3.1');
    });

    it('la vigente es la PUBLICADA más reciente; los borradores no cuentan', async () => {
      const doc = await prisma.termsDocument.findFirstOrThrow({ where: { isDefault: true } });
      await prisma.termsVersion.create({
        data: {
          documentId: doc.id,
          version: '2.0-borrador',
          title: 'Aún no publicada',
          body: 'Texto en revisión',
          publishedAt: null,
          createdById: admin.id,
        },
      });

      const res = await as(app, ana).get('/api/terms').expect(200);
      expect(res.body.version).toBe('1.0');
    });

    it('publicar una versión nueva la convierte en la vigente', async () => {
      const doc = await prisma.termsDocument.findFirstOrThrow({ where: { isDefault: true } });
      const nueva = await prisma.termsVersion.create({
        data: {
          documentId: doc.id,
          version: '2.0',
          title: 'Condiciones 2.0',
          body: 'Texto nuevo',
          publishedAt: null,
          createdById: admin.id,
        },
      });

      await as(app, admin).post(`/api/terms/versions/${nueva.id}/publish`).expect(201);

      const res = await as(app, ana).get('/api/terms').expect(200);
      expect(res.body.version).toBe('2.0');
    });

    it('un curso apuntando a un documento sin versiones publicadas avisa en vez de caer al global', async () => {
      const vacio = await createTermsDocument(prisma, admin, {
        name: 'Sin publicar',
        versions: [{ version: '0.1', published: false }],
      });
      await prisma.course.update({
        where: { id: curso.id },
        data: { termsDocumentId: vacio.id },
      });

      await as(app, ana).get(`/api/terms?courseId=${curso.id}`).expect(409);
    });
  });

  describe('ver el kit no depende de que haya condiciones publicadas', () => {
    /** Deja el curso sin ninguna versión vigente que firmar. */
    const sinCondicionesVigentes = async () => {
      await prisma.termsVersion.deleteMany({});
    };

    it('el alumno puede ver su kit aunque el curso aún no tenga condiciones', async () => {
      const kit = await kitDelGrupo();
      await sinCondicionesVigentes();

      const res = await as(app, ana).get(`/api/me/kits/${kit.id}`).expect(200);

      expect(res.body.id).toBe(kit.id);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.termsVersion).toBeNull();
      expect(res.body.canAccept).toBe(false);
      expect(res.body.acceptBlockedReason).toContain('todavía no están disponibles');
      // El motivo es para el alumno: no lo manda a un panel que no puede abrir.
      expect(res.body.acceptBlockedReason).not.toContain('Administración');
    });

    it('con condiciones vigentes el detalle las expone y habilita la firma', async () => {
      const kit = await kitDelGrupo();

      const res = await as(app, ana).get(`/api/me/kits/${kit.id}`).expect(200);

      expect(res.body).toMatchObject({
        termsVersion: '1.0',
        canAccept: true,
        acceptBlockedReason: null,
      });
    });

    it('también se puede verificar el kit sin condiciones publicadas', async () => {
      const kit = await kitDelGrupo();
      await sinCondicionesVigentes();

      const res = await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);

      expect(res.body.isVerified).toBe(true);
      expect(res.body.canAccept).toBe(false);
      const enDb = await prisma.kit.findUniqueOrThrow({ where: { id: kit.id } });
      expect(enDb.verifiedById).toBe(ana.id);
    });

    it('firmar SÍ se bloquea, con un mensaje dirigido al alumno', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);
      await sinCondicionesVigentes();

      const res = await as(app, ana)
        .post(`/api/me/kits/${kit.id}/accept`)
        .send({ termsVersion: '1.0' })
        .expect(409);

      expect(res.body.message).toContain('todavía no están disponibles');
      expect(res.body.message).not.toContain('Administración');
      expect(await prisma.kitAcceptance.count()).toBe(0);
    });

    it('publicar las condiciones desbloquea la firma sin más cambios', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);
      await sinCondicionesVigentes();
      await as(app, ana)
        .post(`/api/me/kits/${kit.id}/accept`)
        .send({ termsVersion: '2.0' })
        .expect(409);

      const doc = await prisma.termsDocument.findFirstOrThrow({ where: { isDefault: true } });
      await prisma.termsVersion.create({
        data: {
          documentId: doc.id,
          version: '2.0',
          title: 'Condiciones 2.0',
          body: 'Texto',
          publishedAt: new Date(),
          createdById: admin.id,
        },
      });

      const detalle = await as(app, ana).get(`/api/me/kits/${kit.id}`).expect(200);
      expect(detalle.body).toMatchObject({ termsVersion: '2.0', canAccept: true });

      await as(app, ana)
        .post(`/api/me/kits/${kit.id}/accept`)
        .send({ termsVersion: '2.0' })
        .expect(201);
      expect(await prisma.kitAcceptance.count()).toBe(1);
    });
  });

  describe('inmutabilidad de las versiones publicadas', () => {
    it('una versión publicada no se puede editar', async () => {
      const version = await prisma.termsVersion.findFirstOrThrow({
        where: { publishedAt: { not: null } },
      });

      const res = await as(app, admin)
        .patch(`/api/terms/versions/${version.id}`)
        .send({ body: 'Texto reescrito a posteriori' })
        .expect(409);

      expect(res.body.message).toContain('inmutables');
      const enDb = await prisma.termsVersion.findUniqueOrThrow({ where: { id: version.id } });
      expect(enDb.body).not.toContain('reescrito');
    });

    it('un borrador sí se puede editar y luego publicar', async () => {
      const doc = await prisma.termsDocument.findFirstOrThrow({ where: { isDefault: true } });
      const res = await as(app, admin)
        .post(`/api/terms/documents/${doc.id}/versions`)
        .send({ version: '2.0', title: 'Borrador', body: 'Primera redacción' })
        .expect(201);

      await as(app, admin)
        .patch(`/api/terms/versions/${res.body.id}`)
        .send({ body: 'Redacción corregida' })
        .expect(200);

      const enDb = await prisma.termsVersion.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(enDb.body).toBe('Redacción corregida');
      expect(enDb.publishedAt).toBeNull();
    });

    it('no se puede borrar una versión que ya tiene firmas', async () => {
      const kit = await kitDelGrupo();
      await verificar(ana, kit.id, todosConformes(kit.items)).expect(201);
      await as(app, ana).post(`/api/me/kits/${kit.id}/accept`).send({ termsVersion: '1.0' });

      const version = await prisma.termsVersion.findFirstOrThrow({ where: { version: '1.0' } });
      await as(app, admin).delete(`/api/terms/versions/${version.id}`).expect(409);

      expect(await prisma.termsVersion.count({ where: { id: version.id } })).toBe(1);
    });

    it('solo el admin administra los documentos de condiciones', async () => {
      await as(app, ana).get('/api/terms/documents').expect(403);
      await as(app, admin).get('/api/terms/documents').expect(200);
    });
  });
});
