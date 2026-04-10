import { Module } from '@nestjs/common';
import { TripPlanningController } from './trip-planning.controller';
import { TripPlanningService } from './trip-planning.service';
import { LangChainPlanningService } from './langchain/langchain-planning.service';
import { FuelPriceService } from './services/fuel-price.service';
import { RouteProvider } from './interfaces/route-provider.interface';
import { TollProvider } from './interfaces/toll-provider.interface';
import { GoogleMapsRouteProvider } from './providers/google-maps-route.provider';
import { MockTollProvider } from './providers/mock-toll.provider';
import { POIsModule } from '../pois/pois.module';

@Module({
  imports: [POIsModule],
  controllers: [TripPlanningController],
  providers: [
    TripPlanningService,
    LangChainPlanningService,
    FuelPriceService,
    {
      provide: RouteProvider,
      useClass: GoogleMapsRouteProvider,
    },
    {
      provide: TollProvider,
      useClass: MockTollProvider,
    },
  ],
  exports: [TripPlanningService, LangChainPlanningService, FuelPriceService],
})
export class TripPlanningModule {}
