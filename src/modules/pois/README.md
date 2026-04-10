# Módulo de Busca de Infraestrutura de Apoio (POIs)

Este módulo fornece busca de Points of Interest (POIs) para viajantes utilizando a **Overpass API** do OpenStreetMap.

## Funcionalidades

Busca infraestrutura de apoio em quatro categorias principais:

1. **Pernoite** (`tourism=camp_site`, `tourism=caravan_site`, `amenity=parking` com `access=yes`)
2. **Banho** (`amenity=shower`, `amenity=fuel` com `shower=yes`)
3. **Lavar Roupa** (`shop=laundry`, `amenity=washing_machine`)
4. **Abastecimento de Água** (`amenity=drinking_water`)

## Endpoints

### POST /pois/search

Busca POIs em uma localização específica.

**Request Body:**
```json
{
  "lat": -23.5505,
  "lng": -46.6333,
  "radiusInMeters": 5000
}
```

**Response:**
```json
[
  {
    "id": 123456789,
    "name": "Camping Municipal",
    "serviceType": "Pernoite",
    "coordinates": {
      "lat": -23.5510,
      "lng": -46.6340
    },
    "tags": {
      "name": "Camping Municipal",
      "phone": "+55 11 1234-5678",
      "opening_hours": "24/7",
      "fee": "yes",
      "capacity": "50"
    },
    "distance": 120
  }
]
```

### POST /pois/search-at-destination

Busca POIs especificamente na região de destino/chegada (endpoint específico para uso em planejamento de viagens).

**Request Body:** Igual ao `/search`

## Uso no Código

### Importar o Módulo

O módulo já está registrado no `AppModule`. Para usar em outros módulos:

```typescript
import { Module } from '@nestjs/common';
import { POIsModule } from '../pois/pois.module';

@Module({
  imports: [POIsModule],
})
export class MeuModule {}
```

### Injetar o Service

```typescript
import { Injectable } from '@nestjs/common';
import { POIsService } from '../pois/pois.service';

@Injectable()
export class MeuService {
  constructor(private readonly poisService: POIsService) {}

  async buscarInfraestruturaDestino(lat: number, lng: number) {
    const pois = await this.poisService.searchPOIsAtDestination(
      lat,
      lng,
      10000, // 10km de raio
    );
    return pois;
  }
}
```

## Integração com Trip Planning

### Exemplo: Buscar POIs no destino da viagem

```typescript
// No TripPlanningService
import { POIsService } from '../pois/pois.service';

@Injectable()
export class TripPlanningService {
  constructor(
    private readonly poisService: POIsService,
    // ... outros providers
  ) {}

  async planTripWithPOIs(planTripDto: PlanTripDto) {
    // 1. Calcular rota normalmente
    const route = await this.calculateRoute(planTripDto);

    // 2. Extrair coordenadas do destino
    const destination = route.legs[route.legs.length - 1].endLocation;

    // 3. Buscar POIs na região de chegada
    const poisAtDestination = await this.poisService.searchPOIsAtDestination(
      destination.lat,
      destination.lng,
      5000, // 5km
    );

    // 4. Retornar resultado com POIs
    return {
      route,
      poisAtDestination,
    };
  }
}
```

### Exemplo: Buscar POIs em pontos de parada

```typescript
async planTripWithStopPOIs(planTripDto: PlanTripDto) {
  const route = await this.calculateRoute(planTripDto);

  // Identificar pontos de parada a cada 200km
  const stopPoints = this.identifyStopPoints(route, 200); // a cada 200km

  // Buscar POIs em cada ponto de parada
  const poisByStop = await Promise.all(
    stopPoints.map(point =>
      this.poisService.searchPOIs({
        lat: point.lat,
        lng: point.lng,
        radiusInMeters: 5000,
      })
    )
  );

  return {
    route,
    stopPoints,
    poisByStop,
  };
}
```

## Tratamento de Erros

O módulo trata os seguintes erros da Overpass API:

- **429 Too Many Requests**: Rate limit atingido (retorna HTTP 429)
- **Timeout**: Timeout na requisição (retorna HTTP 504)
- **Outros erros**: Service Unavailable (retorna HTTP 503)

## Limitações da Overpass API

- **Rate Limit**: Máximo de ~2 requisições por segundo
- **Timeout**: 30 segundos por requisição
- **Raio máximo recomendado**: 50km (configurado no DTO)

## Formato da Query Overpass

A query é otimizada para buscar todos os tipos de POI em uma única requisição:

```overpass
[out:json][timeout:25];
(
  // Pernoite
  node["tourism"="camp_site"](around:5000,-23.5505,-46.6333);
  way["tourism"="camp_site"](around:5000,-23.5505,-46.6333);
  // ... outros critérios
);
out center tags;
```

## Estrutura de Dados

### POIServiceType (Enum)
- `Pernoite`
- `Banho`
- `Lavar Roupa`
- `Abastecimento`

### POI (Interface)
```typescript
interface POI {
  id: number | string;
  name: string;
  serviceType: POIServiceType;
  coordinates: { lat: number; lng: number };
  tags: POITags;
  distance?: number; // em metros
}
```

### POITags (Interface)
Tags adicionais extraídas do OSM:
- `name`: Nome do local
- `phone`: Telefone
- `website`: Website
- `opening_hours`: Horário de funcionamento
- `fee`: Se cobra taxa
- `capacity`: Capacidade
- `operator`: Operador
- `description`: Descrição

## Próximos Passos

1. **Cache**: Implementar cache para reduzir requisições à Overpass API
2. **Filtros**: Adicionar filtros por tipo de serviço específico
3. **Ranking**: Implementar sistema de ranking baseado em distância, rating, etc.
4. **Favoritos**: Permitir usuários salvarem POIs favoritos
5. **Reviews**: Integrar sistema de avaliações dos usuários
