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
import { CoursesService } from './courses.service';
import { AddProfessorDto } from './dto/add-professor.dto';
import { UpdateProfessorDto } from './dto/update-professor.dto';

@Controller('courses/:courseId/professors')
@Roles(Role.ADMIN)
export class CourseProfessorsController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(@Param('courseId') courseId: string) {
    return this.coursesService.listProfessors(courseId);
  }

  @Post()
  add(@Param('courseId') courseId: string, @Body() dto: AddProfessorDto) {
    return this.coursesService.addProfessor(courseId, dto.email);
  }

  @Patch(':professorId')
  setAuthorization(
    @Param('courseId') courseId: string,
    @Param('professorId') professorId: string,
    @Body() dto: UpdateProfessorDto,
  ) {
    return this.coursesService.setProfessorAuthorization(courseId, professorId, dto.authorized);
  }

  @Delete(':professorId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('courseId') courseId: string, @Param('professorId') professorId: string) {
    return this.coursesService.removeProfessor(courseId, professorId);
  }
}
