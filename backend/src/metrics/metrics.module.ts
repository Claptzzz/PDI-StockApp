import { Module } from '@nestjs/common';
import { ComponentsModule } from '../components/components.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [ComponentsModule], // aporta StockService
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
