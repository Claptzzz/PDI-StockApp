import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { GroupsModule } from './groups/groups.module';
import { ComponentsModule } from './components/components.module';
import { KitTemplatesModule } from './kit-templates/kit-templates.module';
import { KitsModule } from './kits/kits.module';
import { LoansModule } from './loans/loans.module';
import { StorageModule } from './storage/storage.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    GroupsModule,
    ComponentsModule,
    KitTemplatesModule,
    KitsModule,
    LoansModule,
    StorageModule,
    HealthModule,
  ],
  providers: [
    // Orden importante: primero autentica (setea request.user), luego roles.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
