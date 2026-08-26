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
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  /** Lectura del catálogo: ADMIN, PROFESSOR y ayudantes activos. */
  @Get()
  @UseGuards(CatalogReadGuard)
  list() {
    return this.tagsService.list();
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
