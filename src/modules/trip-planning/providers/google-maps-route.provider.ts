import { Injectable, Logger } from '@nestjs/common';
import {
  RouteProvider,
  RouteEstimateInput,
  RouteEstimateOutput,
} from '../interfaces/route-provider.interface';

@Injectable()
export class GoogleMapsRouteProvider implements RouteProvider {
  private readonly logger = new Logger(GoogleMapsRouteProvider.name);
  private readonly apiKey = process.env.GOOGLE_API_KEY;

  async estimateRoute(input: RouteEstimateInput): Promise<RouteEstimateOutput> {
    if (!this.apiKey) {
      this.logger.warn('No GOOGLE_API_KEY configured, using mock estimates');
      return this.mockEstimate(input);
    }

    try {
      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
          },
          body: JSON.stringify({
            origin: { address: input.origin },
            destination: { address: input.destination },
            travelMode: 'DRIVE',
            units: 'METRIC',
          }),
        },
      );

      const data = await response.json();

      if (data.routes?.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distanceMeters ?? 0) / 1000;
        const durationS = parseInt((route.duration ?? '0').replace('s', ''), 10);

        this.logger.log(
          `Route ${input.origin} → ${input.destination}: ${distanceKm.toFixed(0)} km`,
        );

        return {
          distanceKm,
          durationMinutes: Math.round(durationS / 60),
        };
      }

      this.logger.warn(`Routes API returned no routes. Response: ${JSON.stringify(data)}`);
    } catch (e) {
      this.logger.error('Routes API request failed', e);
    }

    this.logger.warn('Falling back to mock route estimate');
    return this.mockEstimate(input);
  }

  /**
   * Gets the polyline for the route, samples it at each fraction, then
   * reverse-geocodes each sampled point to a city name.
   */
  async getIntermediateCities(
    origin: string,
    destination: string,
    fractions: number[],
  ): Promise<string[]> {
    if (!this.apiKey || fractions.length === 0) {
      return fractions.map((_, i) => `Pernoite - Dia ${i + 1}`);
    }

    try {
      // 1. Fetch polyline
      const routeRes = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: { address: origin },
            destination: { address: destination },
            travelMode: 'DRIVE',
          }),
        },
      );

      const routeData = await routeRes.json();
      const encoded = routeData.routes?.[0]?.polyline?.encodedPolyline;

      if (!encoded) {
        this.logger.warn('No polyline returned from Routes API');
        return fractions.map((_, i) => `Pernoite - Dia ${i + 1}`);
      }

      const points = this.decodePolyline(encoded);

      this.logger.log(`Decoded polyline: ${points.length} points, first=${JSON.stringify(points[0])}, last=${JSON.stringify(points[points.length - 1])}`);

      // 2. Sample + reverse-geocode sequentially to avoid rate-limiting
      const cities: string[] = [];
      for (let i = 0; i < fractions.length; i++) {
        try {
          const point = this.samplePolyline(points, fractions[i]);
          this.logger.debug(`Fraction ${fractions[i].toFixed(3)} → (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`);
          const city = await this.reverseGeocodeCity(point.lat, point.lng);
          cities.push(city);
        } catch (err) {
          this.logger.warn(`Failed geocoding fraction ${fractions[i]}: ${err}`);
          cities.push(`Parada`);
        }
      }

      this.logger.log(`Intermediate cities: ${cities.join(', ')}`);
      return cities;
    } catch (e) {
      this.logger.warn(`getIntermediateCities failed: ${e}`);
      return fractions.map((_, i) => `Pernoite - Dia ${i + 1}`);
    }
  }

  // ---- private helpers -------------------------------------------------------

  /** Decode Google encoded polyline to array of {lat, lng} points */
  private decodePolyline(encoded: string): { lat: number; lng: number }[] {
    const points: { lat: number; lng: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  }

  /** Sample a polyline at a fractional position (0=start, 1=end) by arc length */
  private samplePolyline(
    points: { lat: number; lng: number }[],
    fraction: number,
  ): { lat: number; lng: number } {
    if (points.length === 0) return { lat: 0, lng: 0 };
    if (points.length === 1) return points[0];

    // Euclidean distance between consecutive points (close enough for sampling)
    const segLengths: number[] = [];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const d = Math.sqrt(
        Math.pow(points[i].lat - points[i - 1].lat, 2) +
          Math.pow(points[i].lng - points[i - 1].lng, 2),
      );
      segLengths.push(d);
      totalLength += d;
    }

    const target = totalLength * Math.max(0, Math.min(1, fraction));
    let cumLength = 0;

    for (let i = 0; i < segLengths.length; i++) {
      if (cumLength + segLengths[i] >= target) {
        const t = segLengths[i] === 0 ? 0 : (target - cumLength) / segLengths[i];
        return {
          lat: points[i].lat + t * (points[i + 1].lat - points[i].lat),
          lng: points[i].lng + t * (points[i + 1].lng - points[i].lng),
        };
      }
      cumLength += segLengths[i];
    }

    return points[points.length - 1];
  }

  /** Reverse geocode to the nearest city/municipality name.
   *  Tries Google Geocoding API first; falls back to Nominatim (OSM) if denied/unavailable.
   */
  private async reverseGeocodeCity(lat: number, lng: number): Promise<string> {
    // 1. Try Google Geocoding API
    if (this.apiKey) {
      try {
        const url =
          `https://maps.googleapis.com/maps/api/geocode/json` +
          `?latlng=${lat},${lng}` +
          `&key=${this.apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'OK' && data.results?.length) {
          const preferredTypes = ['locality', 'administrative_area_level_2', 'administrative_area_level_1'];
          for (const type of preferredTypes) {
            for (const result of data.results) {
              const comp = result.address_components?.find((c: any) => c.types.includes(type));
              if (comp) return comp.long_name;
            }
          }
          return data.results[0].formatted_address.split(',')[0].trim();
        }

        if (data.status !== 'OK') {
          this.logger.warn(`Google Geocoding ${data.status} for (${lat.toFixed(4)}, ${lng.toFixed(4)}) — trying Nominatim`);
        }
      } catch (e) {
        this.logger.warn(`Google Geocoding failed: ${e} — trying Nominatim`);
      }
    }

    // 2. Fallback: Nominatim (OpenStreetMap) — free, no API key required
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse` +
        `?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=pt-BR`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Luckway-TripPlanner/1.0' },
      });
      const data = await res.json();
      const addr = data.address;
      if (addr) {
        return (
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          addr.state ||
          data.display_name?.split(',')[0].trim()
        );
      }
    } catch (e) {
      this.logger.warn(`Nominatim geocoding failed: ${e}`);
    }

    return `Ponto de parada`;
  }

  private mockEstimate(input: RouteEstimateInput): RouteEstimateOutput {
    const hash = this.hashString(input.origin + input.destination);
    const distanceKm = 50 + (hash % 1450);
    return { distanceKm, durationMinutes: Math.round((distanceKm / 80) * 60) };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
