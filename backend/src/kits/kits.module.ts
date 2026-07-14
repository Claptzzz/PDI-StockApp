import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { GroupsModule } from '../groups/groups.module';
import { ComponentsModule } from '../components/components.module';
import {
  CourseKitsController,
  GroupKitsController,
  GroupReturnsController,
} from './kits.controller';
import { KitsService } from './kits.service';

@Module({
  imports: [CoursesModule, GroupsModule, ComponentsModule],
  controllers: [GroupKitsController, CourseKitsController, GroupReturnsController],
  providers: [KitsService],
})
export class KitsModule {}
