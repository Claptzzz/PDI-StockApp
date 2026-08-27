import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { TermsService } from './terms.service';
import {
  CreateTermsDocumentDto,
  CreateTermsVersionDto,
  SetCourseTermsDto,
  UpdateTermsDocumentDto,
  UpdateTermsVersionDto,
} from './dto/terms.dto';

/**
 * Lectura de las condiciones vigentes. Autenticado (JwtAuthGuard global) pero sin
 * @Roles: cualquier rol necesita poder leerlas para firmarlas.
 */
@Controller('terms')
export class TermsController {
  constructor(private readonly terms: TermsService) {}

  /** Ojo con el orden: 'documents' debe declararse antes que cualquier ':param'. */
  @Get('documents')
  @Roles(Role.ADMIN)
  listDocuments() {
    return this.terms.listDocuments();
  }

  @Post('documents')
  @Roles(Role.ADMIN)
  createDocument(@Body() dto: CreateTermsDocumentDto) {
    return this.terms.createDocument(dto.name);
  }

  @Patch('documents/:id')
  @Roles(Role.ADMIN)
  updateDocument(@Param('id') id: string, @Body() dto: UpdateTermsDocumentDto) {
    return this.terms.updateDocument(id, dto);
  }

  @Delete('documents/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteDocument(@Param('id') id: string) {
    return this.terms.deleteDocument(id);
  }

  @Get('documents/:id/versions')
  @Roles(Role.ADMIN)
  listVersions(@Param('id') id: string) {
    return this.terms.listVersions(id);
  }

  @Post('documents/:id/versions')
  @Roles(Role.ADMIN)
  createVersion(
    @Param('id') id: string,
    @Body() dto: CreateTermsVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.terms.createVersion(id, dto, user.id);
  }

  @Patch('versions/:versionId')
  @Roles(Role.ADMIN)
  updateVersion(@Param('versionId') versionId: string, @Body() dto: UpdateTermsVersionDto) {
    return this.terms.updateVersion(versionId, dto);
  }

  @Post('versions/:versionId/publish')
  @Roles(Role.ADMIN)
  publishVersion(@Param('versionId') versionId: string) {
    return this.terms.publishVersion(versionId);
  }

  @Delete('versions/:versionId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteVersion(@Param('versionId') versionId: string) {
    return this.terms.deleteVersion(versionId);
  }

  /**
   * Condiciones vigentes. Con `courseId` devuelve las del documento asignado a ese
   * curso (o el global si no tiene); sin él, siempre el global.
   */
  @Get()
  async get(@Query('courseId') courseId?: string) {
    const resolved = courseId
      ? await this.terms.resolveForCourse(courseId)
      : await this.terms.resolveDefault();

    return {
      documentId: resolved.documentId,
      documentName: resolved.documentName,
      version: resolved.version,
      title: resolved.title,
      body: resolved.body,
      publishedAt: resolved.publishedAt,
    };
  }
}

/** Asignación del documento a un curso. */
@Controller('courses/:courseId/terms')
export class CourseTermsController {
  constructor(private readonly terms: TermsService) {}

  @Patch()
  @Roles(Role.ADMIN)
  setDocument(@Param('courseId') courseId: string, @Body() dto: SetCourseTermsDto) {
    return this.terms.setCourseDocument(courseId, dto.termsDocumentId);
  }
}
