import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CourseOperateGuard } from './course-operate.guard';
import { CourseOverviewService } from './course-overview.service';

/**
 * Resumen agregado del curso. `CourseOperateGuard` porque también lo consultan los
 * ayudantes del curso: es información, no gestión.
 */
@Controller('courses/:courseId/overview')
@UseGuards(CourseOperateGuard)
export class CourseOverviewController {
  constructor(private readonly overview: CourseOverviewService) {}

  @Get()
  get(@Param('courseId') courseId: string) {
    return this.overview.getOverview(courseId);
  }
}
