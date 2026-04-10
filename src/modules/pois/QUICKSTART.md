# Guia Rápido - Módulo POIs

## Instalação Completa ✓

O módulo já está instalado e configurado! Aqui está o que foi feito:

1. ✅ Módulo POIs criado em `/api/src/modules/pois/`
2. ✅ Overpass API integrada
3. ✅ Módulo registrado no AppModule
4. ✅ Dependência `axios` instalada
5. ✅ TypeScript compilando sem erros

## Estrutura do Módulo

```
pois/
├── pois.module.ts              # Módulo NestJS
├── pois.service.ts             # Lógica de negócio
├── pois.controller.ts          # Endpoints HTTP
├── index.ts                    # Exports públicos
├── README.md                   # Documentação completa
├── QUICKSTART.md              # Este arquivo
├── /types
│   └── poi.types.ts            # Tipos TypeScript
├── /dto
│   └── search-pois.dto.ts      # DTOs de validação
├── /providers
│   └── overpass.provider.ts    # Integração Overpass API
└── /examples
    ├── trip-integration.example.ts   # Como integrar com Trip Planning
    ├── usage.example.ts              # Exemplos de uso
    └── test-request.http             # Testes HTTP
```

## Como Testar

### 1. Iniciar o Servidor

```bash
cd /Users/ygorsoul/Documents/luckway/apps/api
npm run start:dev
```

### 2. Fazer Login (obter JWT token)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-email@example.com","password":"sua-senha"}'
```

Copie o `access_token` da resposta.

### 3. Buscar POIs

```bash
curl -X POST http://localhost:3000/pois/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "lat": -23.5505,
    "lng": -46.6333,
    "radiusInMeters": 5000
  }'
```

### 4. Buscar POIs no Destino

```bash
curl -X POST http://localhost:3000/pois/search-at-destination \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "lat": -22.9519,
    "lng": -43.2105,
    "radiusInMeters": 10000
  }'
```

## Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/pois/search` | Busca POIs em qualquer localização |
| POST | `/pois/search-at-destination` | Busca POIs na região de destino |

## Parâmetros

```typescript
{
  lat: number;           // Latitude (-90 a 90)
  lng: number;           // Longitude (-180 a 180)
  radiusInMeters: number; // Raio de busca (100 a 50000)
}
```

## Tipos de POIs Retornados

1. **Pernoite** - Locais para dormir
   - Campings (`tourism=camp_site`)
   - Áreas para trailers (`tourism=caravan_site`)
   - Estacionamentos (`amenity=parking` com `access=yes`)

2. **Banho** - Locais para tomar banho
   - Chuveiros públicos (`amenity=shower`)
   - Postos com chuveiro (`amenity=fuel` com `shower=yes`)

3. **Lavar Roupa** - Lavanderias
   - Lavanderias (`shop=laundry`)
   - Máquinas de lavar (`amenity=washing_machine`)

4. **Abastecimento** - Água potável
   - Fontes de água potável (`amenity=drinking_water`)

## Exemplo de Resposta

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

## Integração com Trip Planning

Para integrar POIs ao planejamento de viagens, veja:
- `examples/trip-integration.example.ts` - Estratégias de integração
- `README.md` - Documentação completa

### Exemplo Rápido

```typescript
// No TripPlanningModule
import { POIsModule } from '../pois/pois.module';

@Module({
  imports: [POIsModule],
  // ...
})
export class TripPlanningModule {}

// No TripPlanningService
constructor(
  private poisService: POIsService,
  // ...
) {}

async planTrip(...) {
  // ... lógica de planejamento

  // Buscar POIs no destino
  const pois = await this.poisService.searchPOIsAtDestination(
    destinationLat,
    destinationLng,
    10000 // 10km
  );

  return { ...result, pois };
}
```

## Localizações de Teste

Use estas coordenadas para testar:

| Cidade | Latitude | Longitude | Descrição |
|--------|----------|-----------|-----------|
| São Paulo (Sé) | -23.5505 | -46.6333 | Centro de SP |
| Rio de Janeiro | -22.9519 | -43.2105 | Cristo Redentor |
| Florianópolis | -27.6006 | -48.4638 | Lagoa da Conceição |
| Brasília | -15.7942 | -47.8822 | Esplanada |
| Salvador | -12.9714 | -38.5014 | Pelourinho |

## Limitações

- **Rate Limit**: ~2 requisições/segundo na Overpass API
- **Timeout**: 30 segundos por requisição
- **Raio máximo**: 50km (configurado no DTO)

## Tratamento de Erros

O módulo retorna erros HTTP apropriados:

- `429 Too Many Requests` - Rate limit atingido
- `504 Gateway Timeout` - Timeout na requisição
- `503 Service Unavailable` - Erro genérico da API

## Próximos Passos

1. **Testar localmente** com as coordenadas acima
2. **Integrar com Trip Planning** usando os exemplos
3. **Criar interface no frontend** para exibir POIs
4. **Adicionar cache** para reduzir requisições (futuro)

## Suporte

- Documentação completa: `README.md`
- Exemplos de integração: `examples/trip-integration.example.ts`
- Exemplos de uso: `examples/usage.example.ts`
- Testes HTTP: `examples/test-request.http`

---

**Módulo pronto para uso! 🚀**
