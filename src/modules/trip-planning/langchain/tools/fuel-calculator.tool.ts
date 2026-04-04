import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

interface VehicleData {
  averageConsumption: number; // km/l
  tankCapacity: number; // liters
}

export const createFuelCalculatorTool = (vehicleData: VehicleData) => {
  return new DynamicStructuredTool({
    name: 'calculate_fuel',
    description: `Calculate fuel consumption, costs, and refueling stops for a trip.
Use this tool when you need to:
- Estimate fuel costs
- Calculate fuel consumption
- Determine number of fuel stops needed
- Calculate vehicle autonomy

Input requires distance in km and fuel price per liter.`,
    schema: z.object({
      distanceKm: z.number().describe('Total distance to travel in kilometers'),
      fuelPricePerLiter: z.number().describe('Current fuel price per liter in local currency'),
    }),
    func: async ({ distanceKm, fuelPricePerLiter }) => {
      const fuelNeeded = distanceKm / vehicleData.averageConsumption;
      const fuelCost = fuelNeeded * fuelPricePerLiter;
      const autonomyKm = vehicleData.tankCapacity * vehicleData.averageConsumption;
      const fuelStopsCount = Math.floor(distanceKm / autonomyKm);

      return JSON.stringify({
        fuelNeededLiters: Math.round(fuelNeeded * 10) / 10,
        fuelCost: Math.round(fuelCost * 100) / 100,
        autonomyKm: Math.round(autonomyKm),
        fuelStopsCount,
        averageConsumption: vehicleData.averageConsumption,
      });
    },
  });
};
