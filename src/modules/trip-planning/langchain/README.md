# LangChain Trip Planning System

Este módulo implementa o sistema de planejamento de viagens usando LangChain, permitindo integração inteligente com LLMs e expansão fácil através de tools.

## Arquitetura

```
langchain/
├── agents/                 # Agentes especializados (futuro)
├── prompts/               # Templates de prompts
│   ├── trip-planner.prompts.ts
│   └── index.ts
├── tools/                 # Ferramentas do LangChain
│   ├── route-calculator.tool.ts
│   ├── toll-calculator.tool.ts
│   ├── fuel-calculator.tool.ts
│   ├── segment-builder.tool.ts
│   └── index.ts
├── langchain-planning.service.ts
└── README.md
```

## Tools Disponíveis

### 1. RouteCalculatorTool
Calcula distância e duração entre duas localidades.

**Parâmetros:**
- `origin`: string - Ponto de partida
- `destination`: string - Destino

**Retorna:**
```json
{
  "distanceKm": 450,
  "durationMinutes": 360,
  "durationHours": 6
}
```

### 2. TollCalculatorTool
Estima custos de pedágios para a rota.

**Parâmetros:**
- `origin`: string
- `destination`: string
- `distanceKm`: number
- `vehicleType`: string (CAR, MOTORCYCLE, TRUCK, BUS)

**Retorna:**
```json
{
  "totalCost": 45.50,
  "tollCount": 3,
  "details": [...]
}
```

### 3. FuelCalculatorTool
Calcula consumo, custos e paradas de combustível.

**Parâmetros:**
- `distanceKm`: number
- `fuelPricePerLiter`: number

**Retorna:**
```json
{
  "fuelNeededLiters": 37.5,
  "fuelCost": 206.25,
  "autonomyKm": 480,
  "fuelStopsCount": 0,
  "averageConsumption": 12
}
```

### 4. TripSegmentBuilderTool
Constrói segmentos detalhados da viagem.

**Parâmetros:**
- Vários parâmetros de configuração da viagem

**Retorna:**
```json
{
  "segments": [...],
  "summary": {
    "drivingDays": 1,
    "totalRestStops": 0,
    "totalMealStops": 1,
    "totalSleepStops": 0,
    "averageKmPerDay": 450
  }
}
```

## Como Adicionar uma Nova Tool

### Passo 1: Criar o arquivo da tool

Crie um novo arquivo em `tools/` seguindo o padrão:

```typescript
// tools/weather-checker.tool.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const createWeatherCheckerTool = (weatherService: WeatherService) => {
  return new DynamicStructuredTool({
    name: 'check_weather',
    description: `Check weather conditions for a location and date.
Use this tool when you need to:
- Verify weather conditions for the trip
- Check for rain or adverse conditions
- Plan according to weather forecasts

Input requires location and date.`,
    schema: z.object({
      location: z.string().describe('City or location to check weather'),
      date: z.string().describe('Date to check (ISO format)'),
    }),
    func: async ({ location, date }) => {
      const result = await weatherService.getWeather(location, date);

      return JSON.stringify({
        temperature: result.temperature,
        conditions: result.conditions,
        rainProbability: result.rainProbability,
        recommendation: result.recommendation,
      });
    },
  });
};
```

### Passo 2: Exportar a tool

Adicione a exportação em `tools/index.ts`:

```typescript
export { createWeatherCheckerTool } from './weather-checker.tool';
```

### Passo 3: Adicionar ao LangChainPlanningService

No arquivo `langchain-planning.service.ts`, adicione a tool ao array de tools:

```typescript
// Import
import {
  createRouteCalculatorTool,
  createTollCalculatorTool,
  createFuelCalculatorTool,
  createSegmentBuilderTool,
  createWeatherCheckerTool, // Nova tool
} from './tools';

// No construtor, adicione a dependência se necessário
constructor(
  private db: DatabaseService,
  private routeProvider: RouteProvider,
  private tollProvider: TollProvider,
  private weatherService: WeatherService, // Nova dependência
) {}

// No método planTrip, adicione a tool
const tools = [
  createRouteCalculatorTool(this.routeProvider),
  createTollCalculatorTool(this.tollProvider),
  createFuelCalculatorTool({
    averageConsumption: vehicle.averageConsumption,
    tankCapacity: vehicle.tankCapacity,
  }),
  createSegmentBuilderTool(),
  createWeatherCheckerTool(this.weatherService), // Nova tool
];
```

### Passo 4: Atualizar o prompt (opcional)

Se a nova tool requer instruções específicas, atualize o prompt em `prompts/trip-planner.prompts.ts`:

```typescript
export const TRIP_PLANNER_SYSTEM_PROMPT = `You are an expert trip planning assistant...

You have access to several tools:
- calculate_route: Get distance and duration
- calculate_tolls: Estimate toll costs
- calculate_fuel: Calculate fuel consumption
- build_trip_segments: Create itinerary
- check_weather: Check weather conditions (NEW)

...`;
```

## Boas Práticas

### 1. Nomenclatura
- Nome da tool: verbo + substantivo (ex: `check_weather`, `find_hotels`)
- Arquivo: nome-descritivo.tool.ts
- Factory function: `create{Nome}Tool`

### 2. Descrição da Tool
Sempre inclua:
- O que a tool faz
- Quando usar (casos de uso)
- Formato dos inputs
- O que retorna

### 3. Schema Zod
- Use `.describe()` em todos os campos
- Seja específico sobre tipos e formatos
- Adicione validações quando necessário

### 4. Retorno
- SEMPRE retorne `JSON.stringify()` do resultado
- Use objetos estruturados
- Inclua apenas dados relevantes
- Mantenha consistência com outras tools

### 5. Tratamento de Erros
```typescript
func: async (input) => {
  try {
    const result = await service.doSomething(input);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error.message,
    });
  }
}
```

## Exemplos de Tools que Podem Ser Adicionadas

1. **HotelFinderTool** - Buscar hotéis no caminho
2. **RestaurantFinderTool** - Encontrar restaurantes
3. **WeatherCheckerTool** - Verificar condições climáticas
4. **TrafficAnalyzerTool** - Analisar trânsito em tempo real
5. **PoiFinderTool** - Encontrar pontos de interesse
6. **ParkingFinderTool** - Encontrar estacionamentos
7. **EmergencyServicesTool** - Localizar serviços de emergência
8. **CostOptimizerTool** - Otimizar custos da viagem
9. **AlternativeRouteTool** - Sugerir rotas alternativas
10. **RestAreaFinderTool** - Encontrar áreas de descanso

## Configuração

### Variáveis de Ambiente

Adicione no `.env`:

```env
OPENAI_API_KEY=sk-...
LANGCHAIN_TRACING_V2=true  # Opcional: para debug
LANGCHAIN_API_KEY=...      # Opcional: para LangSmith
```

## Uso

### Usar o Novo Serviço

```typescript
// No controller
constructor(
  private langchainService: LangChainPlanningService,
) {}

@Post('plan-with-ai')
async planWithAI(@GetUser() user, @Body() dto: PlanTripDto) {
  return this.langchainService.planTrip(user.id, dto);
}
```

### Fallback para Serviço Original

O serviço original (`TripPlanningService`) permanece disponível como fallback ou para casos onde o LLM não é necessário.

## Debug e Monitoramento

### Logs
O serviço usa o Logger do NestJS:
```typescript
this.logger.log('Starting trip planning with LangChain');
this.logger.debug('Agent output:', result.output);
```

### LangSmith (Opcional)
Para monitoramento avançado, configure o LangSmith:
1. Crie conta em https://smith.langchain.com
2. Configure as env vars acima
3. Visualize as execuções no dashboard

## Próximos Passos

1. **Criar Agentes Especializados**
   - Agent para viagens longas
   - Agent para viagens curtas
   - Agent para otimização de custos

2. **Adicionar Memory**
   - Lembrar preferências do usuário
   - Histórico de viagens
   - Aprendizado de padrões

3. **Streaming de Respostas**
   - Retornar informações incrementalmente
   - Melhor UX para o usuário

4. **Cache de Resultados**
   - Cachear cálculos de rotas
   - Evitar chamadas desnecessárias

## Referências

- [LangChain Documentation](https://js.langchain.com/docs/get_started/introduction)
- [LangChain Tools](https://js.langchain.com/docs/modules/agents/tools/)
- [OpenAI Functions](https://platform.openai.com/docs/guides/function-calling)
