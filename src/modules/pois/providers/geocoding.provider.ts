import { Injectable, Logger } from '@nestjs/common';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

@Injectable()
export class GeocodingProvider {
  private readonly logger = new Logger(GeocodingProvider.name);
  private readonly apiKey = process.env.GOOGLE_API_KEY;

  /**
   * Converte endereço em coordenadas usando Google Geocoding API
   * Fallback para Nominatim (OpenStreetMap) se Google falhar
   */
  async geocode(address: string): Promise<GeocodeResult> {
    // 1. Tenta Google Geocoding API primeiro
    if (this.apiKey) {
      try {
        const url =
          `https://maps.googleapis.com/maps/api/geocode/json` +
          `?address=${encodeURIComponent(address)}` +
          `&key=${this.apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results?.length > 0) {
          const result = data.results[0];
          this.logger.log(`Geocoded "${address}" → ${result.formatted_address}`);

          return {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
            formattedAddress: result.formatted_address,
          };
        }

        if (data.status !== 'OK') {
          this.logger.warn(
            `Google Geocoding returned ${data.status} for "${address}" — trying Nominatim`,
          );
        }
      } catch (error) {
        this.logger.warn(`Google Geocoding failed: ${error} — trying Nominatim`);
      }
    }

    // 2. Fallback: Nominatim (OpenStreetMap) — free, no API key required
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=pt-BR`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Luckway-POIApp/1.0' },
      });
      const data = await response.json();

      if (data.length > 0) {
        const result = data[0];
        this.logger.log(`Geocoded via Nominatim: "${address}" → ${result.display_name}`);

        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formattedAddress: result.display_name,
        };
      }
    } catch (error) {
      this.logger.error(`Nominatim geocoding failed: ${error}`);
    }

    throw new Error(`Não foi possível geocodificar o endereço: ${address}`);
  }
}
