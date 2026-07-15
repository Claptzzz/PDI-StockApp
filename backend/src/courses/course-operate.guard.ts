import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CoursesService } from './courses.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';

/**
 * Guard de OPERACIÓN por curso (ADMIN, PROFESSOR autorizado, o STUDENT ayudante
 * activo). Resuelve el `courseId` desde `params.courseId ?? params.id`.
 */
@Injectable()
export class CourseOperateGuard implements CanActivate {
  constructor(private readonly coursesService: CoursesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser; params: Record<string, string | undefined> }>();

    const courseId = request.params.courseId ?? request.params.id;
    if (!courseId) {
      throw new BadRequestException('Falta el identificador del curso');
    }

    await this.coursesService.assertCourseOperate(request.user, courseId);
    return true;
  }
}
