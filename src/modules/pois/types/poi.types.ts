export enum POIServiceType {
  SLEEP = 'Pernoite',
  SHOWER = 'Banho',
  LAUNDRY = 'Lavar Roupa',
  WATER = 'Abastecimento',
}

export interface POICoordinates {
  lat: number;
  lng: number;
}

export interface POITags {
  name?: string;
  phone?: string;
  website?: string;
  opening_hours?: string;
  fee?: string;
  shower?: string;
  access?: string;
  capacity?: string;
  [key: string]: string | undefined;
}

export interface POI {
  id: number | string;
  name: string;
  serviceType: POIServiceType;
  coordinates: POICoordinates;
  tags: POITags;
  distance?: number; // distância em metros do ponto de referência
}

export interface SearchPOIsParams {
  lat: number;
  lng: number;
  radiusInMeters: number;
}
