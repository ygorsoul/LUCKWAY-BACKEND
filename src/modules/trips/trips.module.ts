import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripPlanningModule } from '../trip-planning/trip-planning.module';

@Module({
  imports: [TripPlanningModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
