import { Module } from '@nestjs/common';
import { TripPlanningController } from './trip-planning.controller';
import { TripPlanningService } from './trip-planning.service';
import { LangChainPlanningService } from './langchain/langchain-planning.service';
import { RouteProvider } from './interfaces/route-provider.interface';
import { TollProvider } from './interfaces/toll-provider.interface';
import { MockRouteProvider } from './providers/mock-route.provider';
import { MockTollProvider } from './providers/mock-toll.provider';

@Module({
  controllers: [TripPlanningController],
  providers: [
    // Original service (keep for backward compatibility or fallback)
    TripPlanningService,
    // New LangChain-based service
    LangChainPlanningService,
    {
      provide: RouteProvider,
      useClass: MockRouteProvider,
    },
    {
      provide: TollProvider,
      useClass: MockTollProvider,
    },
  ],
  exports: [TripPlanningService, LangChainPlanningService],
})
export class TripPlanningModule {}
