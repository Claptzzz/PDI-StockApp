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
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { KitTemplatesService } from './kit-templates.service';
import { CreateKitTemplateDto } from './dto/create-kit-template.dto';
import { UpdateKitTemplateDto } from './dto/update-kit-template.dto';

@Controller('kit-templates')
@Roles(Role.ADMIN, Role.PROFESSOR)
export class KitTemplatesController {
  constructor(private readonly kitTemplatesService: KitTemplatesService) {}

  @Post()
  create(@Body() dto: CreateKitTemplateDto) {
    return this.kitTemplatesService.create(dto);
  }

  @Get()
  list() {
    return this.kitTemplatesService.list();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.kitTemplatesService.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKitTemplateDto) {
    return this.kitTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.kitTemplatesService.remove(id);
  }
}
