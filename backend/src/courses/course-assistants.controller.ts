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
import { CoursesService } from './courses.service';
import { CourseAccessGuard } from './course-access.guard';
import { AddAssistantDto } from './dto/add-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';

// Gestión de ayudantes: solo ADMIN o PROFESSOR autorizado en el curso (manage).
@Controller('courses/:courseId/assistants')
@UseGuards(CourseAccessGuard)
export class CourseAssistantsController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(@Param('courseId') courseId: string) {
    return this.coursesService.listAssistants(courseId);
  }

  @Post()
  add(@Param('courseId') courseId: string, @Body() dto: AddAssistantDto) {
    return this.coursesService.addAssistant(courseId, dto.email);
  }

  @Patch(':assistantId')
  setActive(
    @Param('courseId') courseId: string,
    @Param('assistantId') assistantId: string,
    @Body() dto: UpdateAssistantDto,
  ) {
    return this.coursesService.setAssistantActive(courseId, assistantId, dto.active);
  }

  @Delete(':assistantId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('courseId') courseId: string, @Param('assistantId') assistantId: string) {
    return this.coursesService.removeAssistant(courseId, assistantId);
  }
}
