import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CourseProfessorsController } from './course-professors.controller';
import { CourseAccessGuard } from './course-access.guard';

@Module({
  controllers: [CoursesController, CourseProfessorsController],
  providers: [CoursesService, CourseAccessGuard],
  exports: [CoursesService],
})
export class CoursesModule {}
