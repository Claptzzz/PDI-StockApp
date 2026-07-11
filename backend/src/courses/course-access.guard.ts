import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CoursesService } from './courses.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';

/**
 * Guard reutilizable de acceso por curso. Resuelve el `courseId` desde
 * `params.courseId ?? params.id` y delega la regla en `assertCourseAccess`.
 */
@Injectable()
export class CourseAccessGuard implements CanActivate {
  constructor(private readonly coursesService: CoursesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser; params: Record<string, string | undefined> }>();

    const courseId = request.params.courseId ?? request.params.id;
    if (!courseId) {
      throw new BadRequestException('Falta el identificador del curso');
    }

    await this.coursesService.assertCourseAccess(request.user, courseId);
    return true;
  }
}
