import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

@Module({
  imports: [StorageModule],
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}
