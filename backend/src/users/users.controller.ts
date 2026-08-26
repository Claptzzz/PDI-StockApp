import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth.types';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserActiveDto } from './dto/update-user-active.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Controller('users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  // Accesible también a PROFESSOR (para el combobox de ayudantes/alumnos).
  @Get('students/search')
  @Roles(Role.ADMIN, Role.PROFESSOR)
  searchStudents(@Query('q') q?: string) {
    return this.usersService.searchStudents(q ?? '');
  }

  @Patch(':id/roles')
  updateRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.usersService.updateRoles(user, id, dto.roles);
  }

  @Patch(':id/active')
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserActiveDto,
  ) {
    return this.usersService.setActive(user, id, dto.isActive);
  }
}
