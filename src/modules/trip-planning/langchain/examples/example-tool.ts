/**
 * EXEMPLO: Como criar uma nova tool para o sistema LangChain
 *
 * Este arquivo demonstra como criar uma tool para encontrar hotéis
 * ao longo da rota da viagem.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// 1. Interface para o serviço que a tool vai usar
interface HotelService {
  findHotels(params: {
    location: string;
    checkIn: string;
    checkOut: string;
    maxPrice?: number;
  }): Promise<{
    hotels: Array<{
      name: string;
      price: number;
      rating: number;
      address: string;
    }>;
  }>;
}

// 2. Factory function para criar a tool
export const createHotelFinderTool = (hotelService: HotelService) => {
  return new DynamicStructuredTool({
    // Nome da tool (snake_case, descritivo)
    name: 'find_hotels',

    // Descrição detalhada para o LLM entender quando usar
    description: `Find hotels near a location within a price range.
Use this tool when you need to:
- Find accommodation for overnight stops
- Get hotel recommendations along the route
- Check hotel prices and availability
- Find hotels within budget constraints

The tool returns a list of hotels with prices, ratings, and addresses.`,

    // Schema Zod definindo os parâmetros
    schema: z.object({
      location: z.string().describe('City or location to search for hotels'),
      checkIn: z.string().describe('Check-in date (YYYY-MM-DD format)'),
      checkOut: z.string().describe('Check-out date (YYYY-MM-DD format)'),
      maxPrice: z
        .number()
        .optional()
        .describe('Maximum price per night in local currency'),
    }),

    // Função que executa a lógica da tool
    func: async ({ location, checkIn, checkOut, maxPrice }) => {
      try {
        // Chama o serviço real
        const result = await hotelService.findHotels({
          location,
          checkIn,
          checkOut,
          maxPrice,
        });

        // IMPORTANTE: Sempre retornar JSON.stringify()
        return JSON.stringify({
          success: true,
          location,
          hotelCount: result.hotels.length,
          hotels: result.hotels.map((hotel) => ({
            name: hotel.name,
            pricePerNight: hotel.price,
            rating: hotel.rating,
            address: hotel.address,
          })),
          averagePrice:
            result.hotels.reduce((sum, h) => sum + h.price, 0) /
            result.hotels.length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Tratamento de erro
        return JSON.stringify({
          success: false,
          error: errorMessage,
          location,
        });
      }
    },
  });
};

/**
 * COMO USAR ESTA TOOL:
 *
 * 1. Adicione a exportação em tools/index.ts:
 *    export { createHotelFinderTool } from './hotel-finder.tool';
 *
 * 2. No langchain-planning.service.ts, adicione a dependência:
 *    constructor(
 *      private hotelService: HotelService,
 *      ...
 *    ) {}
 *
 * 3. Adicione a tool ao array de tools:
 *    const tools = [
 *      ...outrasTools,
 *      createHotelFinderTool(this.hotelService),
 *    ];
 *
 * 4. (Opcional) Atualize o prompt em prompts/trip-planner.prompts.ts
 *    para mencionar a nova funcionalidade.
 *
 * 5. Teste a tool fazendo uma requisição ao endpoint de planejamento.
 */

/**
 * EXEMPLO DE USO PELO LLM:
 *
 * Input do usuário:
 * "Preciso de um hotel em São Paulo para 15/04/2024 até 16/04/2024"
 *
 * O LLM vai chamar:
 * find_hotels({
 *   location: "São Paulo, SP",
 *   checkIn: "2024-04-15",
 *   checkOut: "2024-04-16",
 *   maxPrice: undefined
 * })
 *
 * Retorno:
 * {
 *   "success": true,
 *   "location": "São Paulo, SP",
 *   "hotelCount": 5,
 *   "hotels": [...],
 *   "averagePrice": 250.50
 * }
 */
