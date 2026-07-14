import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { GroupsModule } from '../groups/groups.module';
import { ComponentsModule } from '../components/components.module';
import { StorageModule } from '../storage/storage.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [CoursesModule, GroupsModule, ComponentsModule, StorageModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
