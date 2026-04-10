export interface RouteEstimateInput {
  origin: string;
  destination: string;
}

export interface RouteEstimateOutput {
  distanceKm: number;
  durationMinutes: number;
  polyline?: string;
}

export abstract class RouteProvider {
  abstract estimateRoute(input: RouteEstimateInput): Promise<RouteEstimateOutput>;

  /**
   * Returns city names at fractional positions along the route.
   * fractions = [0.33, 0.67] means "1/3 and 2/3 of the way".
   * Defaults to generic labels if not overridden.
   */
  async getIntermediateCities(
    _origin: string,
    _destination: string,
    fractions: number[],
  ): Promise<string[]> {
    return fractions.map((_, i) => `Pernoite - Dia ${i + 1}`);
  }
}
