import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createAgent } from 'langchain';
import { RouteProvider } from '../interfaces/route-provider.interface';
import { TollProvider } from '../interfaces/toll-provider.interface';
import { DatabaseService } from '@/database/database.service';
import { PlanTripDto } from '../dto';
import { TripPlanningResult } from '../types/planning.types';
import {
  createRouteCalculatorTool,
  createTollCalculatorTool,
  createFuelCalculatorTool,
  createSegmentBuilderTool,
} from './tools';
import { TRIP_PLANNER_SYSTEM_PROMPT, TRIP_PLANNER_HUMAN_TEMPLATE } from './prompts';

@Injectable()
export class LangChainPlanningService {
  private readonly logger = new Logger(LangChainPlanningService.name);

  constructor(
    private db: DatabaseService,
    private routeProvider: RouteProvider,
    private tollProvider: TollProvider,
  ) {}

  async planTrip(userId: string, dto: PlanTripDto): Promise<TripPlanningResult> {
    this.logger.log('Starting trip planning with LangChain');

    // Get vehicle data
    const vehicle = await this.db.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.userId !== userId) {
      throw new Error('You do not have access to this vehicle');
    }

    // Create tools with current context
    const tools = [
      createRouteCalculatorTool(this.routeProvider),
      createTollCalculatorTool(this.tollProvider),
      createFuelCalculatorTool({
        averageConsumption: vehicle.averageConsumption,
        tankCapacity: vehicle.tankCapacity,
      }),
      createSegmentBuilderTool(),
    ];

    // Initialize LLM (Gemini)
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-3-flash-preview',
      temperature: 0,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromMessages([['human', TRIP_PLANNER_HUMAN_TEMPLATE]]);

    const agent = createAgent({
      model: llm,
      tools,
      systemPrompt: TRIP_PLANNER_SYSTEM_PROMPT,
    });

    // Prepare input
    const maxDrivingHoursPerDay = dto.maxDrivingHoursPerDay || 8;
    const fuelPrice = dto.fuelPrice || 5.5;
    const mealBreakEnabled = dto.mealBreakEnabled !== false;

    const additionalContext = `
Vehicle Consumption: ${vehicle.averageConsumption} km/l
Tank Capacity: ${vehicle.tankCapacity} liters
${dto.departureDate ? `Departure Date: ${dto.departureDate}` : ''}
${dto.departurePreferredTime ? `Preferred Departure Time: ${dto.departurePreferredTime}` : ''}
${dto.travelersCount ? `Number of Travelers: ${dto.travelersCount}` : ''}
`.trim();

    const messages = await prompt.formatMessages({
      origin: dto.origin,
      destination: dto.destination,
      vehicleType: vehicle.type,
      maxDrivingHoursPerDay,
      fuelPrice,
      mealBreakEnabled: mealBreakEnabled ? 'Yes' : 'No',
      additionalContext,
    });

    const result = await agent.invoke({ messages } as any);
    const output = this.extractAgentOutput(result.messages);

    this.logger.log('LangChain agent execution completed');
    this.logger.debug('Agent output:', output);

    return this.parseAgentOutput(output);
  }

  private parseAgentOutput(output: string): TripPlanningResult {
    // Try to parse JSON from the output
    // The agent might return structured data or we might need to extract it
    try {
      // Look for JSON in the output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return data;
      }
    } catch (error) {
      this.logger.error('Failed to parse agent output as JSON', error);
    }

    // Fallback - this shouldn't happen in a well-configured agent
    throw new Error('Unable to parse trip planning result from agent output');
  }

  private extractAgentOutput(messages: BaseMessage[]): string {
    const lastAiMessage = [...messages].reverse().find((message) => AIMessage.isInstance(message));

    if (!lastAiMessage) {
      throw new Error('LangChain agent did not return an AI response');
    }

    if (typeof lastAiMessage.content === 'string') {
      return lastAiMessage.content;
    }

    return lastAiMessage.content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if ('text' in item && typeof item.text === 'string') {
          return item.text;
        }

        return '';
      })
      .join('\n')
      .trim();
  }
}
