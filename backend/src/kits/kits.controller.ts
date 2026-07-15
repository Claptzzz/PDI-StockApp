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
import { CourseOperateGuard } from '../courses/course-operate.guard';
import { KitsService } from './kits.service';
import { AssignKitDto } from './dto/assign-kit.dto';
import { UpdateKitDto } from './dto/update-kit.dto';
import { ReturnKitItemDto } from './dto/return-kit-item.dto';

@Controller('courses/:courseId/groups/:groupId/kits')
@UseGuards(CourseOperateGuard)
export class GroupKitsController {
  constructor(private readonly kitsService: KitsService) {}

  @Post()
  assign(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Body() dto: AssignKitDto,
  ) {
    return this.kitsService.assign(courseId, groupId, dto);
  }

  @Get()
  list(@Param('courseId') courseId: string, @Param('groupId') groupId: string) {
    return this.kitsService.listByGroup(courseId, groupId);
  }

  @Get(':kitId')
  getOne(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('kitId') kitId: string,
  ) {
    return this.kitsService.getOne(courseId, groupId, kitId);
  }

  @Patch(':kitId')
  updateCode(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('kitId') kitId: string,
    @Body() dto: UpdateKitDto,
  ) {
    return this.kitsService.updateCode(courseId, groupId, kitId, dto.code);
  }

  @Patch(':kitId/items/:kitItemId/return')
  returnItem(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('kitId') kitId: string,
    @Param('kitItemId') kitItemId: string,
    @Body() dto: ReturnKitItemDto,
  ) {
    return this.kitsService.returnItem(courseId, groupId, kitId, kitItemId, dto.quantity);
  }

  @Delete(':kitId')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('kitId') kitId: string,
  ) {
    return this.kitsService.remove(courseId, groupId, kitId);
  }
}

@Controller('courses/:courseId/kits')
@UseGuards(CourseOperateGuard)
export class CourseKitsController {
  constructor(private readonly kitsService: KitsService) {}

  @Get()
  list(@Param('courseId') courseId: string) {
    return this.kitsService.listByCourse(courseId);
  }
}

@Controller('courses/:courseId/groups/:groupId')
@UseGuards(CourseOperateGuard)
export class GroupReturnsController {
  constructor(private readonly kitsService: KitsService) {}

  @Get('returns-summary')
  summary(@Param('courseId') courseId: string, @Param('groupId') groupId: string) {
    return this.kitsService.returnsSummary(courseId, groupId);
  }
}
