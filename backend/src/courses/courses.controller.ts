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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { CoursesService } from './courses.service';
import { CourseAccessGuard } from './course-access.guard';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses.query.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.PROFESSOR)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCoursesQueryDto) {
    return this.coursesService.list(user, query);
  }

  // Declarado antes de `:id` para que "terms" no sea capturado como parámetro.
  @Get('terms')
  @Roles(Role.ADMIN, Role.PROFESSOR)
  listTerms(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.listTerms(user);
  }

  @Get(':id')
  @UseGuards(CourseAccessGuard)
  getById(@Param('id') id: string) {
    return this.coursesService.getById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }
}
