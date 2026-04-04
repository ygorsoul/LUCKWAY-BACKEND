import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { TripSegment } from '../../types/planning.types';

export const createSegmentBuilderTool = () => {
  return new DynamicStructuredTool({
    name: 'build_trip_segments',
    description: `Build detailed trip segments including driving, rest, meal, fuel, and sleep stops.
Use this tool when you need to:
- Create a day-by-day trip itinerary
- Calculate rest and meal breaks
- Plan overnight stops for multi-day trips
- Schedule fuel stops

Input requires trip details like distance, duration, preferences, and costs.`,
    schema: z.object({
      origin: z.string().describe('Starting point'),
      destination: z.string().describe('End point'),
      totalDistanceKm: z.number().describe('Total distance in km'),
      totalDurationMinutes: z.number().describe('Total driving time in minutes'),
      maxDrivingMinutesPerDay: z.number().describe('Maximum driving minutes per day'),
      mealBreakEnabled: z.boolean().describe('Whether to include meal breaks'),
      fuelStopsCount: z.number().describe('Number of fuel stops needed'),
      autonomyKm: z.number().describe('Vehicle autonomy in km'),
      fuelCost: z.number().describe('Total fuel cost'),
      tollCost: z.number().describe('Total toll cost'),
    }),
    func: async (config) => {
      const segments: TripSegment[] = [];
      let order = 1;

      // Check if trip can be done in one day
      if (config.totalDurationMinutes <= config.maxDrivingMinutesPerDay) {
        // Single day trip
        segments.push({
          order: order++,
          type: 'DRIVING',
          startLocation: config.origin,
          endLocation: config.destination,
          distance: config.totalDistanceKm,
          estimatedTime: config.totalDurationMinutes,
          fuelCost: config.fuelCost,
          tollCost: config.tollCost,
        });

        // Add meal break if enabled and trip is long enough (> 4 hours)
        if (config.mealBreakEnabled && config.totalDurationMinutes > 240) {
          segments.push({
            order: order++,
            type: 'MEAL',
            startLocation: 'Parada intermediária',
            stopDuration: 60,
            stopNote: 'Parada para refeição',
          });
        }
      } else {
        // Multi-day trip - split into segments
        const numberOfDays = Math.ceil(config.totalDurationMinutes / config.maxDrivingMinutesPerDay);
        const kmPerDay = config.totalDistanceKm / numberOfDays;
        const minutesPerDay = config.totalDurationMinutes / numberOfDays;
        const fuelCostPerDay = config.fuelCost / numberOfDays;
        const tollCostPerDay = config.tollCost / numberOfDays;

        for (let day = 0; day < numberOfDays; day++) {
          const isFirstDay = day === 0;
          const isLastDay = day === numberOfDays - 1;

          // Driving segment for the day
          segments.push({
            order: order++,
            type: 'DRIVING',
            startLocation: isFirstDay ? config.origin : `Trecho ${day + 1}`,
            endLocation: isLastDay ? config.destination : `Fim do dia ${day + 1}`,
            distance: kmPerDay,
            estimatedTime: minutesPerDay,
            fuelCost: fuelCostPerDay,
            tollCost: tollCostPerDay,
          });

          // Meal break
          if (config.mealBreakEnabled) {
            segments.push({
              order: order++,
              type: 'MEAL',
              startLocation: `Parada - Dia ${day + 1}`,
              stopDuration: 60,
              stopNote: 'Parada para almoço',
            });
          }

          // Sleep stop (except on last day)
          if (!isLastDay) {
            segments.push({
              order: order++,
              type: 'SLEEP',
              startLocation: `Pernoite - Dia ${day + 1}`,
              stopDuration: 480, // 8 hours
              stopNote: 'Parada para pernoite',
            });
          }
        }
      }

      // Add fuel stops if needed
      if (config.fuelStopsCount > 0) {
        for (let i = 0; i < config.fuelStopsCount; i++) {
          segments.push({
            order: order++,
            type: 'FUEL',
            startLocation: `Posto de combustível ${i + 1}`,
            stopDuration: 15,
            stopNote: 'Parada para abastecimento',
          });
        }
      }

      const sortedSegments = segments.sort((a, b) => a.order - b.order);

      // Calculate summary
      const drivingSegments = sortedSegments.filter((s) => s.type === 'DRIVING');
      const restStops = sortedSegments.filter((s) => s.type === 'REST').length;
      const mealStops = sortedSegments.filter((s) => s.type === 'MEAL').length;
      const sleepStops = sortedSegments.filter((s) => s.type === 'SLEEP').length;
      const drivingDays = sleepStops + 1;
      const averageKmPerDay = config.totalDistanceKm / drivingDays;

      return JSON.stringify({
        segments: sortedSegments,
        summary: {
          drivingDays,
          totalRestStops: restStops,
          totalMealStops: mealStops,
          totalSleepStops: sleepStops,
          averageKmPerDay: Math.round(averageKmPerDay * 10) / 10,
        },
      });
    },
  });
};
