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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CatalogReadGuard } from '../auth/guards/catalog-read.guard';
import { ComponentsService } from './components.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';
import { ListComponentsQueryDto } from './dto/list-components.query.dto';

@Controller('components')
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateComponentDto) {
    return this.componentsService.create(dto);
  }

  @Get()
  @UseGuards(CatalogReadGuard)
  list(@Query() query: ListComponentsQueryDto) {
    return this.componentsService.list(query);
  }

  @Get(':id')
  @UseGuards(CatalogReadGuard)
  getById(@Param('id') id: string) {
    return this.componentsService.getById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateComponentDto) {
    return this.componentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.componentsService.remove(id);
  }
}
