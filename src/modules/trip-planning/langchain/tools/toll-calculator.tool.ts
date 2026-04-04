import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { TollProvider } from '../../interfaces/toll-provider.interface';

export const createTollCalculatorTool = (tollProvider: TollProvider) => {
  return new DynamicStructuredTool({
    name: 'calculate_tolls',
    description: `Calculate toll costs for a trip.
Use this tool when you need to:
- Estimate toll expenses
- Get toll booth count
- Calculate total toll costs

Input requires origin, destination, distance in km, and vehicle type.`,
    schema: z.object({
      origin: z.string().describe('Starting point of the trip'),
      destination: z.string().describe('End point of the trip'),
      distanceKm: z.number().describe('Total distance in kilometers'),
      vehicleType: z.string().describe('Type of vehicle (CAR, MOTORCYCLE, TRUCK, BUS)'),
    }),
    func: async ({ origin, destination, distanceKm, vehicleType }) => {
      const result = await tollProvider.estimateTolls({
        origin,
        destination,
        distanceKm,
        vehicleType,
      });

      return JSON.stringify({
        totalCost: result.totalCost,
        tollCount: result.tollCount,
        details: result.details || [],
      });
    },
  });
};
