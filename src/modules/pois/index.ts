/**
 * MÓDULO DE BUSCA DE INFRAESTRUTURA DE APOIO (POIs)
 *
 * Este módulo fornece busca de Points of Interest para viajantes
 * utilizando a Overpass API do OpenStreetMap.
 */

// Module
export { POIsModule } from './pois.module';

// Service
export { POIsService } from './pois.service';

// Controller
export { POIsController } from './pois.controller';

// DTOs
export { SearchPOIsDto } from './dto/search-pois.dto';

// Types
export {
  POI,
  POIServiceType,
  POICoordinates,
  POITags,
  SearchPOIsParams,
} from './types/poi.types';

// Provider
export { OverpassProvider } from './providers/overpass.provider';
