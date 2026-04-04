import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TripPlanningService } from './trip-planning.service';
import { PlanTripDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('trip-planning')
@UseGuards(JwtAuthGuard)
export class TripPlanningController {
  constructor(private readonly tripPlanningService: TripPlanningService) {}

  @Post('estimate')
  async estimate(@GetUser() user: any, @Body() dto: PlanTripDto) {
    return this.tripPlanningService.planTrip(user.id, dto);
  }

  @Post('build')
  async build(@GetUser() user: any, @Body() dto: PlanTripDto) {
    // Same as estimate for now - can add more rich data later
    const planning = await this.tripPlanningService.planTrip(user.id, dto);

    return {
      planning,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }
}
