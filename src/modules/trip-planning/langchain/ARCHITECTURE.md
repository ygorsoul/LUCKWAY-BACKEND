# Arquitetura do Sistema LangChain

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                          USUÁRIO                                 │
│                    (Requisição HTTP)                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TripPlanningController                         │
│                                                                   │
│  POST /api/trip-planning/plan                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────┴────────────────┐
         │                                  │
         ▼                                  ▼
┌──────────────────┐              ┌──────────────────────┐
│ TripPlanning     │              │ LangChainPlanning    │
│ Service          │              │ Service              │
│ (Original)       │              │ (Com IA)             │
└──────────────────┘              └──────┬───────────────┘
                                          │
                          ┌───────────────┴───────────────┐
                          │                               │
                          ▼                               ▼
                  ┌──────────────┐              ┌──────────────┐
                  │   OpenAI     │              │    Tools     │
                  │   GPT-4      │              │   Registry   │
                  │              │              │              │
                  └──────┬───────┘              └──────┬───────┘
                         │                             │
                         │    ┌────────────────────────┘
                         │    │
                         ▼    ▼
                  ┌──────────────────┐
                  │ Agent Executor   │
                  │                  │
                  │ - Decide quais   │
                  │   tools usar     │
                  │ - Orquestra      │
                  │   execução       │
                  │ - Combina        │
                  │   resultados     │
                  └──────┬───────────┘
                         │
         ┌───────────────┼───────────────┬───────────────┐
         │               │               │               │
         ▼               ▼               ▼               ▼
  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │  Route    │  │   Toll    │  │   Fuel    │  │  Segment  │
  │Calculator │  │Calculator │  │Calculator │  │  Builder  │
  │   Tool    │  │   Tool    │  │   Tool    │  │   Tool    │
  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
        │              │              │              │
        ▼              ▼              ▼              │
  ┌───────────┐  ┌───────────┐  ┌───────────┐      │
  │  Route    │  │   Toll    │  │  Vehicle  │      │
  │ Provider  │  │ Provider  │  │   Data    │      │
  └───────────┘  └───────────┘  └───────────┘      │
                                                    │
                                                    ▼
                                            ┌───────────┐
                                            │ Segment   │
                                            │ Builder   │
                                            │ Logic     │
                                            └───────────┘
```

## Fluxo de Execução

### 1. Requisição Inicial
```
User → Controller → LangChainPlanningService
```

### 2. Preparação do Agente
```
LangChainPlanningService:
  1. Busca dados do veículo no DB
  2. Cria instâncias das tools
  3. Inicializa LLM (GPT-4)
  4. Prepara prompt com contexto
  5. Cria Agent Executor
```

### 3. Execução do Agente
```
Agent Executor:
  LOOP até obter resposta completa:
    1. LLM analisa o pedido
    2. Decide qual tool chamar
    3. Executa a tool
    4. Recebe resultado
    5. Analisa se precisa de mais dados
    6. Repete ou finaliza
  END LOOP
```

### 4. Exemplo de Sequência Real

```
Requisição: "Planejar viagem de SP para RJ"

Passo 1 - LLM decide:
  "Preciso calcular a rota primeiro"
  → Chama: calculate_route("São Paulo", "Rio de Janeiro")
  ← Retorno: { distanceKm: 450, durationMinutes: 360 }

Passo 2 - LLM decide:
  "Agora preciso dos pedágios"
  → Chama: calculate_tolls("SP", "RJ", 450, "CAR")
  ← Retorno: { totalCost: 45.50, tollCount: 3 }

Passo 3 - LLM decide:
  "Preciso calcular combustível"
  → Chama: calculate_fuel(450, 5.5)
  ← Retorno: { fuelCost: 206.25, fuelStopsCount: 0 }

Passo 4 - LLM decide:
  "Agora posso criar os segmentos"
  → Chama: build_trip_segments({...todos os dados})
  ← Retorno: { segments: [...], summary: {...} }

Passo 5 - LLM decide:
  "Tenho tudo que preciso"
  → Retorna: JSON estruturado com plano completo
```

## Componentes Detalhados

### Tools (Ferramentas)

```typescript
Tool {
  name: string           // Nome único da ferramenta
  description: string    // Quando e como usar
  schema: ZodSchema     // Parâmetros esperados
  func: async function  // Lógica de execução
}
```

**Características:**
- Independentes entre si
- Retornam JSON stringificado
- Tratam seus próprios erros
- Têm descrição clara para o LLM

### Agent Executor

```typescript
AgentExecutor {
  agent: OpenAIFunctionsAgent  // Agente que decide
  tools: Tool[]                // Ferramentas disponíveis
  verbose: boolean             // Logs detalhados
}
```

**Responsabilidades:**
- Gerenciar loop de execução
- Passar contexto entre chamadas
- Combinar resultados das tools
- Retornar resposta final

### Prompts

```typescript
Prompt {
  system: string        // Instruções para o agente
  human: string         // Template da pergunta
  variables: object     // Variáveis do contexto
}
```

**Estrutura:**
- System: Define papel e regras do agente
- Human: Template com placeholders
- Variables: Dados específicos da requisição

## Padrões de Design

### 1. Factory Pattern
Cada tool usa factory function:
```typescript
createXxxTool(dependencies) → Tool
```
**Vantagem:** Injeção de dependências limpa

### 2. Strategy Pattern
Tools são estratégias intercambiáveis:
```typescript
const tools = [
  createRouteCalculatorTool(provider1),  // Estratégia A
  // ou
  createRouteCalculatorTool(provider2),  // Estratégia B
];
```
**Vantagem:** Trocar implementações facilmente

### 3. Chain of Responsibility
Agent executa tools em cadeia:
```typescript
Tool1 → Result1 → Tool2 → Result2 → ... → FinalResult
```
**Vantagem:** Flexibilidade na ordem de execução

## Extensibilidade

### Adicionar Nova Tool

```typescript
// 1. Criar a tool
export const createNewTool = (service) => {
  return new DynamicStructuredTool({
    name: 'new_tool',
    description: '...',
    schema: z.object({...}),
    func: async (input) => {...}
  });
};

// 2. Registrar
const tools = [
  ...existingTools,
  createNewTool(newService),  // ← Adicionar aqui
];
```

**Sem modificar:**
- Código existente
- Outras tools
- Lógica do agente

### Trocar LLM

```typescript
// De:
const llm = new ChatOpenAI({ model: 'gpt-4' });

// Para:
const llm = new ChatAnthropic({ model: 'claude-3' });
// ou
const llm = new ChatGoogleGenerativeAI({ model: 'gemini-pro' });
```

### Customizar Prompts

```typescript
// Alterar apenas o arquivo de prompts
// Sem modificar código do serviço
export const CUSTOM_PROMPT = `
  Your custom instructions here...
`;
```

## Vantagens da Arquitetura

### 1. Separação de Responsabilidades
```
Controller → Routing
Service → Orquestração
Tools → Funcionalidades específicas
Providers → Integrações externas
```

### 2. Testabilidade
```typescript
// Testar tool isoladamente
const tool = createRouteTool(mockProvider);
const result = await tool.func({ origin: 'A', destination: 'B' });
expect(result).toContain('distanceKm');
```

### 3. Manutenibilidade
- Cada arquivo tem uma responsabilidade
- Fácil localizar bugs
- Documentação próxima ao código

### 4. Escalabilidade
```
Hoje: 4 tools
Amanhã: 20 tools
Impacto: Adicionar arquivos, não modificar existentes
```

## Fluxo de Dados

```
┌──────────────┐
│ Requisição   │
│ {origin,     │
│  destination,│
│  vehicleId}  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Buscar       │
│ Vehicle no   │──┐
│ Database     │  │
└──────┬───────┘  │
       │          │ Context
       ▼          │
┌──────────────┐  │
│ Criar Tools  │  │
│ com contexto │◄─┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Executar     │
│ Agent        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Tool 1       │─┐
│ Result 1     │ │
└──────────────┘ │
       │         │
       ▼         │
┌──────────────┐ │
│ Tool 2       │ │ Agent
│ Result 2     │ │ Loop
└──────────────┘ │
       │         │
       ▼         │
┌──────────────┐ │
│ Tool N       │ │
│ Result N     │◄┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Combinar     │
│ Resultados   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Retornar     │
│ JSON         │
│ estruturado  │
└──────────────┘
```

## Considerações de Performance

### Cache de Tools
```typescript
// Tools são criadas a cada requisição
// Considerar cache se houver overhead
private toolCache = new Map();
```

### Timeout do Agente
```typescript
const executor = new AgentExecutor({
  agent,
  tools,
  maxIterations: 10,        // Máximo de iterações
  maxExecutionTime: 30000,  // 30 segundos
});
```

### Streaming (Futuro)
```typescript
// Retornar resultados incrementalmente
for await (const chunk of executor.stream(input)) {
  yield chunk;
}
```

## Segurança

### Validação de Entrada
```typescript
// Tools usam Zod para validação
schema: z.object({
  origin: z.string().min(2).max(100),
  destination: z.string().min(2).max(100),
})
```

### Rate Limiting
```typescript
// Considerar limitar chamadas ao OpenAI
@Throttle(5, 60)  // 5 req/min
async planTrip() {...}
```

### Sanitização
```typescript
// Evitar injection em prompts
const sanitizedInput = input.replace(/[<>]/g, '');
```

## Monitoramento

### Logs
```typescript
this.logger.log('Starting trip planning');
this.logger.debug('Agent output:', result);
this.logger.error('Failed to parse output', error);
```

### Métricas (Sugerido)
- Tempo de execução total
- Número de tools chamadas
- Taxa de sucesso
- Custos de API (tokens)

### LangSmith (Opcional)
```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
```
→ Dashboard visual de execuções

---

**Esta arquitetura foi projetada para crescer de forma sustentável! 🏗️**
