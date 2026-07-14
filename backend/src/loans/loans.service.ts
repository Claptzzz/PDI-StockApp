import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Loan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { StockService } from '../components/stock.service';
import { StorageService } from '../storage/storage.service';
import { CreateLoanDto } from './dto/create-loan.dto';

export type LoanStatus = 'PENDIENTE' | 'PARCIAL' | 'DEVUELTO';

export function deriveLoanStatus(quantity: number, returnedQuantity: number): LoanStatus {
  if (returnedQuantity <= 0) return 'PENDIENTE';
  if (returnedQuantity >= quantity) return 'DEVUELTO';
  return 'PARCIAL';
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
    private readonly stock: StockService,
    private readonly storage: StorageService,
  ) {}

  async create(
    courseId: string,
    groupId: string,
    dto: CreateLoanDto,
    userId: string,
    file?: Express.Multer.File,
  ) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);

    const quantity = dto.quantity ?? 1;

    let component: { id: string; name: string; totalStock: number } | null = null;
    if (dto.componentId) {
      component = await this.prisma.component.findUnique({
        where: { id: dto.componentId },
        select: { id: true, name: true, totalStock: true },
      });
      if (!component) {
        throw new BadRequestException('El componente no existe');
      }
    }

    const componentName = dto.componentName?.trim() || component?.name;
    if (!componentName) {
      throw new BadRequestException('componentName es requerido');
    }

    // Sube la foto ANTES de crear el préstamo; si algo falla después, se borra.
    let photoPath: string | null = null;
    if (file) {
      photoPath = await this.storage.uploadLoanPhoto(file.buffer, file.mimetype, file.originalname);
    }

    try {
      const loan = await this.prisma.$transaction(async (tx) => {
        // Solo se valida stock si el préstamo consume bodega (tiene componentId).
        if (component) {
          const commitment = (await this.stock.getCommitments([component.id], tx)).get(
            component.id,
          ) ?? { inKits: 0, inLoans: 0 };
          const available = this.stock.available(component.totalStock, commitment);
          if (available < quantity) {
            throw new BadRequestException({
              statusCode: 400,
              error: 'Bad Request',
              message: 'Stock insuficiente para el préstamo',
              shortage: {
                componentId: component.id,
                name: component.name,
                requested: quantity,
                available,
              },
            });
          }
        }

        return tx.loan.create({
          data: {
            groupId,
            componentId: component?.id ?? null,
            componentName,
            quantity,
            returnedQuantity: 0,
            note: dto.note?.trim() || null,
            photoUrl: photoPath,
            loanedById: userId,
          },
        });
      });

      return this.toResponse(loan);
    } catch (error) {
      // Evita fotos huérfanas si la creación del préstamo falla.
      if (photoPath) {
        await this.storage.deleteLoanPhoto(photoPath);
      }
      throw error;
    }
  }

  async list(courseId: string, groupId: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    const loans = await this.prisma.loan.findMany({
      where: { groupId },
      orderBy: { loanedAt: 'desc' },
    });
    return Promise.all(loans.map((loan) => this.toResponse(loan)));
  }

  async getOne(courseId: string, groupId: string, loanId: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    const loan = await this.assertLoanInGroup(loanId, groupId);
    return this.toResponse(loan);
  }

  async returnPartial(courseId: string, groupId: string, loanId: string, quantity: number) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    const loan = await this.assertLoanInGroup(loanId, groupId);

    const pending = loan.quantity - loan.returnedQuantity;
    if (quantity > pending) {
      throw new BadRequestException(
        `No puedes devolver ${quantity}: solo hay ${pending} unidad(es) pendiente(s)`,
      );
    }

    const newReturned = loan.returnedQuantity + quantity;
    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        returnedQuantity: newReturned,
        // Marca la fecha de devolución solo cuando se completa el total.
        ...(newReturned >= loan.quantity && !loan.returnedAt ? { returnedAt: new Date() } : {}),
      },
    });

    return this.toResponse(updated);
  }

  async remove(courseId: string, groupId: string, loanId: string) {
    await this.groupsService.ensureGroupInCourse(courseId, groupId);
    const loan = await this.assertLoanInGroup(loanId, groupId);

    await this.prisma.loan.delete({ where: { id: loanId } });
    if (loan.photoUrl) {
      await this.storage.deleteLoanPhoto(loan.photoUrl);
    }
    return { deleted: true };
  }

  // --- Helpers -----------------------------------------------------------

  private async assertLoanInGroup(loanId: string, groupId: string): Promise<Loan> {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan || loan.groupId !== groupId) {
      throw new NotFoundException('Préstamo no encontrado en este grupo');
    }
    return loan;
  }

  private async toResponse(loan: Loan) {
    const signedUrl = loan.photoUrl ? await this.storage.getSignedUrl(loan.photoUrl) : null;
    return {
      id: loan.id,
      componentId: loan.componentId,
      componentName: loan.componentName,
      quantity: loan.quantity,
      returnedQuantity: loan.returnedQuantity,
      pending: loan.quantity - loan.returnedQuantity,
      status: deriveLoanStatus(loan.quantity, loan.returnedQuantity),
      note: loan.note,
      hasPhoto: Boolean(loan.photoUrl),
      signedUrl,
      loanedById: loan.loanedById,
      loanedAt: loan.loanedAt,
      returnedAt: loan.returnedAt,
    };
  }
}
