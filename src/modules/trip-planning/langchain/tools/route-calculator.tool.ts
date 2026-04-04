import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { RouteProvider } from '../../interfaces/route-provider.interface';

export const createRouteCalculatorTool = (routeProvider: RouteProvider) => {
  return new DynamicStructuredTool({
    name: 'calculate_route',
    description: `Calculate route distance and duration between two locations.
Use this tool when you need to:
- Estimate travel distance
- Calculate travel time
- Get route information between origin and destination

Input should include origin and destination addresses.`,
    schema: z.object({
      origin: z.string().describe('Starting point of the trip'),
      destination: z.string().describe('End point of the trip'),
    }),
    func: async ({ origin, destination }) => {
      const result = await routeProvider.estimateRoute({
        origin,
        destination,
      });

      return JSON.stringify({
        distanceKm: result.distanceKm,
        durationMinutes: result.durationMinutes,
        durationHours: Math.round((result.durationMinutes / 60) * 10) / 10,
      });
    },
  });
};
