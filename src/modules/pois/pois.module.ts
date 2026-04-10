import { Module } from '@nestjs/common';
import { POIsController } from './pois.controller';
import { POIBookmarksController } from './poi-bookmarks.controller';
import { POIsService } from './pois.service';
import { POIBookmarksService } from './poi-bookmarks.service';
import { RoutePOIIntegrationService } from './route-poi-integration.service';
import { OverpassProvider } from './providers/overpass.provider';

@Module({
  controllers: [POIsController, POIBookmarksController],
  providers: [
    POIsService,
    POIBookmarksService,
    RoutePOIIntegrationService,
    OverpassProvider,
  ],
  exports: [POIsService, POIBookmarksService, RoutePOIIntegrationService],
})
export class POIsModule {}
