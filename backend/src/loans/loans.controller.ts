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
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CourseOperateGuard } from '../courses/course-operate.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { MulterExceptionFilter } from '../groups/multer-exception.filter';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { ReturnLoanDto } from './dto/return-loan.dto';

const FIVE_MB = 5 * 1024 * 1024;

@Controller('courses/:courseId/groups/:groupId/loans')
@UseGuards(CourseOperateGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: FIVE_MB },
    }),
  )
  create(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Body() dto: CreateLoanDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.loansService.create(courseId, groupId, dto, user.id, file);
  }

  @Get()
  list(@Param('courseId') courseId: string, @Param('groupId') groupId: string) {
    return this.loansService.list(courseId, groupId);
  }

  @Get(':loanId')
  getOne(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('loanId') loanId: string,
  ) {
    return this.loansService.getOne(courseId, groupId, loanId);
  }

  @Patch(':loanId/return')
  returnPartial(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('loanId') loanId: string,
    @Body() dto: ReturnLoanDto,
  ) {
    return this.loansService.returnPartial(courseId, groupId, loanId, dto.quantity);
  }

  @Delete(':loanId')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @Param('loanId') loanId: string,
  ) {
    return this.loansService.remove(courseId, groupId, loanId);
  }
}
