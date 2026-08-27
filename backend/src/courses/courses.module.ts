import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CourseProfessorsController } from './course-professors.controller';
import { CourseAssistantsController } from './course-assistants.controller';
import { CourseOverviewController } from './course-overview.controller';
import { CourseOverviewService } from './course-overview.service';
import { CourseAccessGuard } from './course-access.guard';
import { CourseOperateGuard } from './course-operate.guard';

@Module({
  controllers: [
    CoursesController,
    CourseProfessorsController,
    CourseAssistantsController,
    CourseOverviewController,
  ],
  providers: [CoursesService, CourseOverviewService, CourseAccessGuard, CourseOperateGuard],
  exports: [CoursesService, CourseAccessGuard, CourseOperateGuard],
})
export class CoursesModule {}
