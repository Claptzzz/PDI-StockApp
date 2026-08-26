import { Module } from '@nestjs/common';
import { TagsModule } from '../tags/tags.module';
import { ComponentsController } from './components.controller';
import { ComponentsService } from './components.service';
import { StockService } from './stock.service';

@Module({
  imports: [TagsModule],
  controllers: [ComponentsController],
  providers: [ComponentsService, StockService],
  exports: [StockService],
})
export class ComponentsModule {}
