import { Controller, Get, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { StudentService } from './student.service';

@Controller('me')
@Roles(Role.STUDENT)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('groups')
  listMyGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.listMyGroups(user.id);
  }

  @Get('assistant-courses')
  listAssistantCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.listAssistantCourses(user.id);
  }

  @Get('contexts')
  getContexts(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.getContexts(user.id);
  }

  @Get('groups/:groupId')
  getMyGroup(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.studentService.getMyGroup(user.id, groupId);
  }
}
