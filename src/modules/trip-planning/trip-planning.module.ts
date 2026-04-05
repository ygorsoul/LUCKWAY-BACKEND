import { Module } from '@nestjs/common';
import { TripPlanningController } from './trip-planning.controller';
import { TripPlanningService } from './trip-planning.service';
import { LangChainPlanningService } from './langchain/langchain-planning.service';
import { FuelPriceService } from './services/fuel-price.service';
import { RouteProvider } from './interfaces/route-provider.interface';
import { TollProvider } from './interfaces/toll-provider.interface';
import { MockRouteProvider } from './providers/mock-route.provider';
import { MockTollProvider } from './providers/mock-toll.provider';

@Module({
  controllers: [TripPlanningController],
  providers: [
    TripPlanningService,
    LangChainPlanningService,
    FuelPriceService,
    {
      provide: RouteProvider,
      useClass: MockRouteProvider,
    },
    {
      provide: TollProvider,
      useClass: MockTollProvider,
    },
  ],
  exports: [TripPlanningService, LangChainPlanningService, FuelPriceService],
})
export class TripPlanningModule {}
