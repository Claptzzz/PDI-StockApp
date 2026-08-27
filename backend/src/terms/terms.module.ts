import { Module } from '@nestjs/common';
import { CourseTermsController, TermsController } from './terms.controller';
import { TermsService } from './terms.service';

@Module({
  controllers: [TermsController, CourseTermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
