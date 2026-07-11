import { Module } from '@nestjs/common';
import { ComponentsController } from './components.controller';
import { ComponentsService } from './components.service';
import { StockService } from './stock.service';

@Module({
  controllers: [ComponentsController],
  providers: [ComponentsService, StockService],
  exports: [StockService],
})
export class ComponentsModule {}
