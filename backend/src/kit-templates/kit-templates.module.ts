import { Module } from '@nestjs/common';
import { KitTemplatesController } from './kit-templates.controller';
import { KitTemplatesService } from './kit-templates.service';

@Module({
  controllers: [KitTemplatesController],
  providers: [KitTemplatesService],
})
export class KitTemplatesModule {}
