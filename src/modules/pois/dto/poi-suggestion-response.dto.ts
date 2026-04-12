import { POI } from '../types/poi.types';

export interface POISuggestionPoint {
  lat: number;
  lng: number;
  cityName?: string;
  distanceFromStart: number; // em km
  dayNumber?: number;
  isDayEnd?: boolean;
  stopType?: 'MEAL' | 'REST' | 'SHOWER' | 'LAUNDRY';
  suggestedDuration?: number; // minutos
}

export interface POISuggestion {
  point: POISuggestionPoint;
  pois: POI[];
  category: 'sleep' | 'meal' | 'shower' | 'laundry' | 'water';
  priority: number; // 1-5, sendo 5 mais importante
  autoAccept?: boolean; // Se deve aceitar automaticamente
}

export class POISuggestionResponseDto {
  suggestions: POISuggestion[];
  totalSuggestions: number;
  sleepSuggestions: number;
  mealSuggestions: number;
  showerSuggestions: number;
  laundrySuggestions: number;
  waterSuggestions: number;
}
