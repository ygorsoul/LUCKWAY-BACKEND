# Integração Automática de POIs no Planejamento de Viagem

Este documento explica como a integração de POIs funciona no sistema de planejamento de rotas.

## Fluxo de Integração

```
1. Usuário cria planejamento com preferências
   ↓
2. Sistema calcula rota (Google Maps)
   ↓
3. Sistema identifica pontos estratégicos
   ↓
4. Sistema busca POIs automaticamente (se autoSuggestPOIs = true)
   ↓
5. Sistema cruza dados: rota + POIs + preferências
   ↓
6. Sistema sugere POIs em cada ponto
   ↓
7. Usuário pode aceitar/rejeitar/substituir POIs
   ↓
8. Marcações do usuário viram destinos finais do dia
```

## Novas Funcionalidades

### 1. Preferências de Viagem

```typescript
{
  "mealPreference": "RESTAURANT" | "SELF_COOK" | "MIXED",
  "sleepPreference": "HOTEL" | "CAMPING" | "MOTORHOME" | "MIXED",
  "autoSuggestPOIs": true
}
```

### 2. Tipos de Parada com POIs

- **SLEEP** - Pernoite (final do dia)
- **MEAL** - Refeições (se preferência != SELF_COOK)
- **SHOWER** - Banho (~30-50km antes do pernoite)
- **LAUNDRY** - Lavanderia (sob demanda)

### 3. Marcações (Bookmarks)

Usuário pode marcar POIs favoritos que:
- São salvos no banco de dados
- Podem ter comentários e avaliações
- Podem virar paradas automáticas em viagens futuras
- Se marcado como "destino final do dia", vira ponto de pernoite

## Como Modificar o TripPlanningService

### Passo 1: Injetar os Serviços

```typescript
import { RoutePOIIntegrationService } from '../pois/route-poi-integration.service';
import { POIBookmarksService } from '../pois/poi-bookmarks.service';

@Injectable()
export class TripPlanningService {
  constructor(
    // ... providers existentes
    private readonly routePOIIntegration: RoutePOIIntegrationService,
    private readonly poiBookmarksService: POIBookmarksService,
  ) {}
}
```

### Passo 2: Modificar o método planTrip

```typescript
async planTrip(userId: string, dto: PlanTripDto): Promise<TripPlanningResult> {
  // 1. Calcular rota normalmente (código existente)
  const routeData = await this.routeProvider.computeRoute(/* ... */);

  // 2. SE autoSuggestPOIs for true, buscar POIs automaticamente
  let poiSuggestions = [];

  if (dto.autoSuggestPOIs !== false) {
    // Converter polyline da rota em pontos
    const routePoints = this.extractRoutePoints(routeData);

    // Identificar pontos estratégicos
    const { dayEndPoints, intermediateStops } =
      this.routePOIIntegration.identifyStrategicPoints(
        routePoints,
        totalDistanceKm,
        dto.maxDrivingHoursPerDay || 8
      );

    // Buscar POIs para cada ponto
    poiSuggestions = await this.routePOIIntegration.findPOIsForRoute(
      dayEndPoints,
      intermediateStops,
      dto.mealPreference || 'RESTAURANT',
      dto.sleepPreference || 'HOTEL'
    );
  }

  // 3. Verificar se usuário tem marcações (bookmarks) relevantes
  const userBookmarks = await this.poiBookmarksService.getUserBookmarks(userId);

  // 4. Construir segmentos com POIs vinculados
  const segments = await this.buildSegmentsWithPOIs(
    /* ... parâmetros existentes */,
    poiSuggestions,
    userBookmarks,
    dto
  );

  // 5. Salvar trip no banco com preferências
  const trip = await this.db.trip.create({
    data: {
      // ... campos existentes
      mealPreference: dto.mealPreference || 'RESTAURANT',
      sleepPreference: dto.sleepPreference || 'HOTEL',
      autoSuggestPOIs: dto.autoSuggestPOIs !== false,
    }
  });

  // 6. Retornar resultado com POI suggestions
  return {
    // ... campos existentes
    poiSuggestions, // Novo campo
    userBookmarksNearRoute: this.filterBookmarksNearRoute(
      userBookmarks,
      routePoints
    ),
  };
}
```

### Passo 3: Método auxiliar para extrair pontos da rota

```typescript
private extractRoutePoints(routeData: any): RoutePoint[] {
  const points: RoutePoint[] = [];
  let accumulatedDistance = 0;

  // Assumindo que routeData tem legs com polylines
  for (const leg of routeData.legs) {
    // Decodificar polyline
    const polylinePoints = this.decodePolyline(leg.polyline.encodedPolyline);

    for (const point of polylinePoints) {
      points.push({
        lat: point.lat,
        lng: point.lng,
        distanceFromStart: accumulatedDistance,
        cityName: leg.endLocation?.cityName, // se disponível
      });

      // Atualizar distância acumulada (aproximação)
      if (points.length > 1) {
        const prevPoint = points[points.length - 2];
        const distance = this.calculateDistance(
          prevPoint.lat,
          prevPoint.lng,
          point.lat,
          point.lng
        );
        accumulatedDistance += distance / 1000; // converter para km
      }
    }
  }

  return points;
}
```

### Passo 4: Construir segmentos com POIs

```typescript
private async buildSegmentsWithPOIs(
  /* ... parâmetros existentes */,
  poiSuggestions: POISuggestion[],
  userBookmarks: POIBookmark[],
  dto: PlanTripDto
): Promise<TripSegment[]> {
  const segments: TripSegment[] = [];

  // Para cada sugestão de POI
  for (const suggestion of poiSuggestions) {
    if (suggestion.category === 'sleep' && suggestion.pois.length > 0) {
      // Pegar o POI mais próximo (primeiro da lista, já ordenado por distância)
      const poi = suggestion.pois[0];

      // Verificar se usuário tem bookmark desse POI ou na mesma cidade
      const userBookmark = userBookmarks.find(
        b => b.poiId === poi.id.toString() ||
             this.isNearby(b.latitude, b.longitude, poi.coordinates.lat, poi.coordinates.lng, 5000)
      );

      // Se tem bookmark do usuário, usar esse
      const selectedPOI = userBookmark ?
        JSON.parse(userBookmark.poiData) : poi;

      // Converter POI para dados do segmento
      const poiSegmentData = await this.routePOIIntegration.convertPOIToSegmentData(
        selectedPOI
      );

      // Criar segmento de SLEEP com POI vinculado
      segments.push({
        type: 'SLEEP',
        startLocation: `${selectedPOI.coordinates.lat},${selectedPOI.coordinates.lng}`,
        endLocation: selectedPOI.name,
        ...poiSegmentData,
        isDayEndpoint: true, // Marca como final do dia
        stopDuration: 480, // 8h de sono
        stopNote: `Pernoite em ${selectedPOI.name}`,
      });
    }

    if (suggestion.category === 'shower' && suggestion.pois.length > 0) {
      const poi = suggestion.pois[0];
      const poiData = await this.routePOIIntegration.convertPOIToSegmentData(poi);

      segments.push({
        type: 'SHOWER',
        startLocation: `${poi.coordinates.lat},${poi.coordinates.lng}`,
        endLocation: poi.name,
        ...poiData,
        stopDuration: 30,
        stopNote: `Parada para banho`,
      });
    }

    // Similarmente para MEAL, LAUNDRY, etc...
  }

  return segments;
}
```

## Lógica de Cruzamento de Dados

### Cenário: Rio de Janeiro → Patagônia

```typescript
// Dia 1
Origem: Rio de Janeiro (-22.9068, -43.1729)
  ↓
  [430km, ~5h30]
  ↓
Almoço: São Paulo (-23.5505, -46.6333)
  → Busca automática: restaurantes bons e baratos
  → Preferência: RESTAURANT
  → Raio: 5km
  ↓
  [400km, ~5h]
  ↓
Banho: Região de Curitiba (~40km antes) (-25.3500, -49.2000)
  → Busca automática: amenity=shower, amenity=fuel com shower=yes
  → Raio: 5km
  ↓
  [40km, ~30min]
  ↓
Pernoite: Curitiba (-25.4284, -49.2733)
  → Busca automática: camping, estacionamento, hotel
  → Preferência: CAMPING
  → Raio: 15km
  → Se usuário marcou POI específico, usar esse
  → Este POI vira DESTINO FINAL DO DIA 1
```

### Como Marcações Funcionam

1. **Usuário marca um camping em Curitiba**
   ```typescript
   POST /poi-bookmarks
   {
     "poiId": "123456789",
     "poiName": "Camping do Bosque",
     "poiType": "Pernoite",
     "latitude": -25.4300,
     "longitude": -49.2750,
     "notes": "Ótimo camping, tem chuveiro quente",
     "rating": 5
   }
   ```

2. **Ao planejar viagem, sistema detecta marcação**
   - Sistema vê que rota passa por Curitiba
   - Sistema encontra marcação do usuário nessa região
   - **Sistema usa marcação como destino final do dia automaticamente**

3. **Marcação vira waypoint obrigatório**
   ```typescript
   // No planejamento, adiciona automaticamente:
   {
     type: 'SLEEP',
     endLocation: 'Camping do Bosque',
     linkedPoiId: '123456789',
     isDayEndpoint: true,
     coordinates: { lat: -25.4300, lng: -49.2750 }
   }
   ```

## Estrutura do Banco de Dados

### TripSegment com POI

```sql
SELECT
  id,
  type,           -- 'SLEEP', 'SHOWER', 'MEAL', etc
  end_location,   -- Nome do POI
  linked_poi_id,  -- ID do OSM
  poi_data,       -- JSON com dados completos
  is_day_endpoint -- true se é destino final do dia
FROM trip_segments
WHERE trip_id = 'xxx'
ORDER BY order;
```

### Exemplo de dados:

```json
{
  "id": "seg_123",
  "type": "SLEEP",
  "endLocation": "Camping do Bosque",
  "linkedPoiId": "123456789",
  "isDayEndpoint": true,
  "poiData": {
    "id": 123456789,
    "name": "Camping do Bosque",
    "serviceType": "Pernoite",
    "coordinates": { "lat": -25.4300, "lng": -49.2750 },
    "tags": {
      "amenity": "camping",
      "fee": "yes",
      "shower": "yes",
      "capacity": "50"
    }
  }
}
```

## Endpoints do Frontend

### 1. Buscar POIs manualmente

```typescript
POST /pois/search
{
  "lat": -25.4284,
  "lng": -49.2733,
  "radiusInMeters": 10000
}
```

### 2. Marcar POI como favorito

```typescript
POST /poi-bookmarks
{
  "poiId": "123456789",
  "poiName": "Camping do Bosque",
  "poiType": "Pernoite",
  "latitude": -25.4300,
  "longitude": -49.2750,
  "tags": ["curitiba", "favorito"],
  "notes": "Melhor camping da região",
  "rating": 5
}
```

### 3. Adicionar comentário

```typescript
POST /poi-bookmarks/comments
{
  "poiId": "123456789",
  "poiName": "Camping do Bosque",
  "comment": "Excelente! Chuveiro quente, Wi-Fi grátis",
  "rating": 5,
  "visitDate": "2025-03-15"
}
```

### 4. Planejar viagem com POIs

```typescript
POST /trip-planning/plan
{
  "origin": "Rio de Janeiro",
  "destination": "Patagônia, Argentina",
  "vehicleId": "vehicle_123",
  "mealPreference": "SELF_COOK",  // Vai cozinhar
  "sleepPreference": "CAMPING",    // Prefere camping
  "autoSuggestPOIs": true          // Buscar POIs automaticamente
}
```

## Próximos Passos

1. ✅ Schema do banco atualizado
2. ✅ Módulo de POIs criado
3. ✅ Serviço de integração criado
4. ⏳ Modificar TripPlanningService (use este documento)
5. ⏳ Criar interface no frontend para exibir POIs
6. ⏳ Criar mapa interativo mostrando POIs na rota
7. ⏳ Permitir arrastar e soltar POIs no planejamento

## Interface Sugerida (Frontend)

```
┌─────────────────────────────────────────────┐
│ Planejamento: Rio → Patagônia               │
├─────────────────────────────────────────────┤
│                                             │
│ Dia 1: Rio de Janeiro → Curitiba (870km)   │
│ ├─ Partida: 08:00 - Rio de Janeiro         │
│ ├─ 🍽️ Almoço: 13:30 - São Paulo            │
│ │   └─ 3 restaurantes sugeridos            │
│ ├─ 🚿 Banho: 18:00 - Estrada (antes CWB)   │
│ │   └─ Posto Shell com chuveiro (5km)      │
│ └─ 🏕️ Pernoite: 19:00 - Curitiba           │
│     └─ ⭐ Camping do Bosque (marcado)       │
│                                             │
│ [Aceitar POIs] [Modificar] [Ignorar]       │
└─────────────────────────────────────────────┘
```

