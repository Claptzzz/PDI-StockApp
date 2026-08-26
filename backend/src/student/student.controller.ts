import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { StudentService } from './student.service';
import { VerifyKitDto } from './dto/verify-kit.dto';
import { AcceptTermsDto } from './dto/accept-terms.dto';

@Controller('me')
@Roles(Role.STUDENT)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('groups')
  listMyGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.listMyGroups(user.id);
  }

  @Get('assistant-courses')
  listAssistantCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.listAssistantCourses(user.id);
  }

  @Get('contexts')
  getContexts(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.getContexts(user.id);
  }

  @Get('groups/:groupId')
  getMyGroup(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.studentService.getMyGroup(user.id, groupId);
  }

  /** Detalle del kit para verificar la entrega (403 si no eres del grupo). */
  @Get('kits/:kitId')
  getMyKit(@CurrentUser() user: AuthenticatedUser, @Param('kitId') kitId: string) {
    return this.studentService.getMyKit(user.id, kitId);
  }

  /** Verificación GRUPAL: un integrante marca ítem por ítem, una sola vez. */
  @Post('kits/:kitId/verify')
  verifyKit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kitId') kitId: string,
    @Body() dto: VerifyKitDto,
  ) {
    return this.studentService.verifyKit(user.id, kitId, dto);
  }

  /** Aceptación INDIVIDUAL de las condiciones de préstamo. */
  @Post('kits/:kitId/accept')
  acceptTerms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kitId') kitId: string,
    @Body() dto: AcceptTermsDto,
  ) {
    return this.studentService.acceptTerms(user.id, kitId, dto);
  }
}
