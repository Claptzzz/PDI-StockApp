import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { GroupsModule } from '../groups/groups.module';
import { ComponentsModule } from '../components/components.module';
import { ReturnsModule } from '../returns/returns.module';
import {
  CourseKitsController,
  GroupKitsController,
  GroupReturnsController,
} from './kits.controller';
import { KitsService } from './kits.service';
import { DiscrepanciesService } from './discrepancies.service';

@Module({
  imports: [CoursesModule, GroupsModule, ComponentsModule, ReturnsModule],
  controllers: [GroupKitsController, CourseKitsController, GroupReturnsController],
  providers: [KitsService, DiscrepanciesService],
})
export class KitsModule {}
