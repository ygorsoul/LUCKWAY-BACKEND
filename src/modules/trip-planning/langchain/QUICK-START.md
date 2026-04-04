# Guia de Início Rápido - LangChain Trip Planning

## 🚀 Configuração em 5 Minutos

### Passo 1: Configurar API Key

Adicione no arquivo `.env` na raiz do projeto:
```bash
OPENAI_API_KEY=sk-your-key-here
```

**Como obter a key:**
1. Acesse: https://platform.openai.com/api-keys
2. Faça login ou crie uma conta
3. Clique em "Create new secret key"
4. Copie a key (começa com `sk-`)
5. Cole no `.env`

### Passo 2: Instalar Dependências (já feito ✅)

```bash
pnpm install
```

### Passo 3: Testar

Inicie o servidor:
```bash
pnpm dev:api
```

Faça uma requisição de teste:
```bash
curl -X POST http://localhost:3001/api/trip-planning/plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "origin": "São Paulo, SP",
    "destination": "Rio de Janeiro, RJ",
    "vehicleId": "uuid-do-veiculo",
    "maxDrivingHoursPerDay": 8,
    "fuelPrice": 5.5,
    "mealBreakEnabled": true
  }'
```

## 📝 Exemplo Completo de Requisição

```typescript
// Frontend
const response = await fetch('http://localhost:3001/api/trip-planning/plan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    origin: 'São Paulo, SP',
    destination: 'Belo Horizonte, MG',
    vehicleId: 'vehicle-uuid',
    maxDrivingHoursPerDay: 8,
    fuelPrice: 5.50,
    mealBreakEnabled: true,
    departureDate: '2024-05-15',
    departurePreferredTime: '08:00',
    travelersCount: 2,
  }),
});

const tripPlan = await response.json();
console.log(tripPlan);
```

## 🎯 Resposta Esperada

```json
{
  "totalDistanceKm": 586,
  "totalDurationMinutes": 480,
  "estimatedFuelCost": 268.18,
  "estimatedTollCost": 58.50,
  "totalEstimatedCost": 326.68,
  "autonomyKm": 480,
  "fuelStopsCount": 1,
  "segments": [
    {
      "order": 1,
      "type": "DRIVING",
      "startLocation": "São Paulo, SP",
      "endLocation": "Belo Horizonte, MG",
      "distance": 586,
      "estimatedTime": 480,
      "fuelCost": 268.18,
      "tollCost": 58.50
    },
    {
      "order": 2,
      "type": "MEAL",
      "startLocation": "Parada intermediária",
      "stopDuration": 60,
      "stopNote": "Parada para refeição"
    }
  ],
  "summary": {
    "drivingDays": 1,
    "totalRestStops": 0,
    "totalMealStops": 1,
    "totalSleepStops": 0,
    "averageKmPerDay": 586
  }
}
```

## 🔧 Adicionar Endpoint Específico para LangChain

Edite `trip-planning.controller.ts`:

```typescript
import { LangChainPlanningService } from './langchain/langchain-planning.service';

@Controller('trip-planning')
export class TripPlanningController {
  constructor(
    private tripPlanningService: TripPlanningService,
    private langchainService: LangChainPlanningService, // Adicionar
  ) {}

  // Endpoint original (sem IA)
  @Post('plan')
  @UseGuards(JwtAuthGuard)
  async plan(@GetUser() user: User, @Body() dto: PlanTripDto) {
    return this.tripPlanningService.planTrip(user.id, dto);
  }

  // Novo endpoint com IA
  @Post('plan-ai')
  @UseGuards(JwtAuthGuard)
  async planWithAI(@GetUser() user: User, @Body() dto: PlanTripDto) {
    return this.langchainService.planTrip(user.id, dto);
  }
}
```

## 🛠️ Adicionar Sua Primeira Tool

### 1. Criar o arquivo da tool

```bash
touch apps/api/src/modules/trip-planning/langchain/tools/weather-checker.tool.ts
```

### 2. Implementar a tool

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const createWeatherCheckerTool = () => {
  return new DynamicStructuredTool({
    name: 'check_weather',
    description: 'Check weather conditions for a location',
    schema: z.object({
      location: z.string().describe('City to check weather'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
    }),
    func: async ({ location, date }) => {
      // Mock implementation - substituir com API real
      const mockWeather = {
        temperature: 25,
        condition: 'Sunny',
        rainProbability: 10,
      };

      return JSON.stringify(mockWeather);
    },
  });
};
```

### 3. Exportar

Em `tools/index.ts`:
```typescript
export { createWeatherCheckerTool } from './weather-checker.tool';
```

### 4. Adicionar ao serviço

Em `langchain-planning.service.ts`:
```typescript
import { createWeatherCheckerTool } from './tools';

// No método planTrip:
const tools = [
  createRouteCalculatorTool(this.routeProvider),
  createTollCalculatorTool(this.tollProvider),
  createFuelCalculatorTool({ ... }),
  createSegmentBuilderTool(),
  createWeatherCheckerTool(), // Nova tool
];
```

**Pronto!** O agente agora pode consultar o clima.

## 🐛 Debugging

### Habilitar logs detalhados

Em `langchain-planning.service.ts`:
```typescript
const executor = new AgentExecutor({
  agent,
  tools,
  verbose: true, // ← Já está ativado
});
```

### Ver saída do agente

Os logs aparecerão no console:
```
[LangChainPlanningService] Starting trip planning with LangChain
Calling tool: calculate_route with {"origin":"São Paulo","destination":"Rio"}
Tool returned: {"distanceKm":450,"durationMinutes":360}
Calling tool: calculate_tolls with {...}
...
[LangChainPlanningService] LangChain agent execution completed
```

### Usar LangSmith (Opcional)

Adicione no `.env`:
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-key
```

Acesse: https://smith.langchain.com para ver execuções visuais

## 📊 Monitorar Custos

### Estimar custo por requisição

Modelo: GPT-4 Turbo
- Input: ~$0.01 / 1K tokens
- Output: ~$0.03 / 1K tokens

Média por planejamento:
- Input: ~500 tokens = $0.005
- Output: ~200 tokens = $0.006
- **Total: ~$0.011 por planejamento**

### Ver uso real

1. Acesse: https://platform.openai.com/usage
2. Veja consumo de tokens
3. Configure limites de gasto

## ⚠️ Troubleshooting

### Erro: "Invalid API Key"
```
Verifique:
1. Key está no .env corretamente
2. Key começa com "sk-"
3. Reiniciou o servidor após adicionar
```

### Erro: "Unable to parse trip planning result"
```
Causa: Agent não retornou JSON válido
Solução:
1. Verifique logs do verbose
2. Ajuste o prompt em prompts/trip-planner.prompts.ts
3. Adicione mais exemplos no prompt
```

### Timeout
```
Causa: Agent está demorando muito
Solução:
1. Aumente maxExecutionTime
2. Reduza número de tools
3. Simplifique o prompt
```

## 🎓 Próximos Passos

1. **Testar com dados reais**
   - Usar sua própria API key
   - Fazer requisições de teste
   - Validar resultados

2. **Integrar com frontend**
   - Criar interface para /plan-ai
   - Mostrar resultados do agente
   - Adicionar loading states

3. **Adicionar mais tools**
   - WeatherChecker
   - HotelFinder
   - RestaurantFinder
   - Ver exemplos em `examples/example-tool.ts`

4. **Otimizar prompts**
   - Ajustar instruções
   - Adicionar exemplos
   - Testar diferentes abordagens

5. **Implementar cache**
   - Cachear rotas calculadas
   - Evitar chamadas duplicadas
   - Reduzir custos

## 📚 Recursos

- **README Completo:** `README.md`
- **Arquitetura:** `ARCHITECTURE.md`
- **Exemplos:** `examples/example-tool.ts`
- **Docs LangChain:** https://js.langchain.com
- **OpenAI Platform:** https://platform.openai.com

## 💬 Dúvidas Comuns

**Q: Preciso de API key para testar?**
A: Sim, o sistema usa OpenAI GPT-4.

**Q: Quanto custa?**
A: ~$0.01 por planejamento (estimativa).

**Q: Posso usar outro LLM?**
A: Sim! Troque `ChatOpenAI` por outro provider.

**Q: Como adiciono mais funcionalidades?**
A: Crie uma nova tool (ver seção acima).

**Q: O serviço antigo ainda funciona?**
A: Sim! Ambos coexistem no módulo.

---

**Pronto para começar! Qualquer dúvida, consulte o README completo. 🎉**
