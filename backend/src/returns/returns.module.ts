import { Module } from '@nestjs/common';
import { ReturnEventsService } from './return-events.service';

@Module({
  providers: [ReturnEventsService],
  exports: [ReturnEventsService],
})
export class ReturnsModule {}
