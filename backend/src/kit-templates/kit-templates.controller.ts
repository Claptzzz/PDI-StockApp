import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CatalogReadGuard } from '../auth/guards/catalog-read.guard';
import { KitTemplatesService } from './kit-templates.service';
import { CreateKitTemplateDto } from './dto/create-kit-template.dto';
import { UpdateKitTemplateDto } from './dto/update-kit-template.dto';

@Controller('kit-templates')
export class KitTemplatesController {
  constructor(private readonly kitTemplatesService: KitTemplatesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.PROFESSOR)
  create(@Body() dto: CreateKitTemplateDto) {
    return this.kitTemplatesService.create(dto);
  }

  @Get()
  @UseGuards(CatalogReadGuard)
  list() {
    return this.kitTemplatesService.list();
  }

  @Get(':id')
  @UseGuards(CatalogReadGuard)
  getById(@Param('id') id: string) {
    return this.kitTemplatesService.getById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.PROFESSOR)
  update(@Param('id') id: string, @Body() dto: UpdateKitTemplateDto) {
    return this.kitTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.PROFESSOR)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.kitTemplatesService.remove(id);
  }
}
