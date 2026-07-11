import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [CoursesModule], // aporta CourseAccessGuard (y CoursesService)
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
