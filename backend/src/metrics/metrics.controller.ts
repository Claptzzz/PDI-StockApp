import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { MetricsService } from './metrics.service';
import { MetricsQueryDto } from './dto/metrics-query.dto';

@Controller('metrics')
@Roles(Role.ADMIN)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('overview')
  overview(@Query() query: MetricsQueryDto) {
    return this.metricsService.overview(query);
  }

  @Get('stock')
  stock() {
    return this.metricsService.stock();
  }

  @Get('usage')
  usage(@Query() query: MetricsQueryDto) {
    return this.metricsService.usage(query);
  }

  @Get('pending-returns')
  pendingReturns(@Query() query: MetricsQueryDto) {
    return this.metricsService.pendingReturns(query);
  }
}
