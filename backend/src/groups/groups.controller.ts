import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CourseAccessGuard } from '../courses/course-access.guard';
import { CourseOperateGuard } from '../courses/course-operate.guard';
import { GroupsService } from './groups.service';
import { MulterExceptionFilter } from './multer-exception.filter';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMemberDto } from './dto/add-member.dto';

const TWO_MB = 2 * 1024 * 1024;

@Controller('courses/:courseId/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @UseGuards(CourseAccessGuard)
  create(@Param('courseId') courseId: string, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(courseId, dto.name);
  }

  @Get()
  @UseGuards(CourseOperateGuard)
  list(@Param('courseId') courseId: string) {
    return this.groupsService.list(courseId);
  }

  @Post('import')
  @UseGuards(CourseAccessGuard)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: TWO_MB },
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.csv')) {
          cb(new BadRequestException('El archivo debe tener extensión .csv'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  importCsv(@Param('courseId') courseId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Falta el archivo en el campo "file"');
    }
    return this.groupsService.importCsv(courseId, file);
  }

  @Get(':groupId')
  @UseGuards(CourseOperateGuard)
  getById(@Param('courseId') courseId: string, @Param('groupId') groupId: string) {
    return this.groupsService.getById(courseId, groupId);
  }

  @Patch(':groupId')
  @UseGuards(CourseAccessGuard)
  rename(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.rename(courseId, groupId, dto.name);
  }

  @Delete(':groupId')
  @UseGuards(CourseAccessGuard)
  @HttpCode(HttpStatus.OK)
  remove(@Param('courseId') courseId: string, @Param('groupId') groupId: string) {
    return this.groupsService.remove(courseId, groupId);
  }

  @Post(':groupId/members')
  @UseGuards(CourseAccessGuard)
  addMember(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.groupsService.addMember(courseId, groupId, dto.email);
  }

  @Delete(':groupId/members/:studentId')
  @UseGuards(CourseAccessGuard)
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.groupsService.removeMember(courseId, groupId, studentId);
  }
}
