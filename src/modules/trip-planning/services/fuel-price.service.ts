import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export type VehicleFuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'FLEX' | 'ELECTRIC' | 'HYBRID' | 'GNV';

export const FUEL_UNIT: Record<VehicleFuelType, string> = {
  GASOLINE: 'L',
  ETHANOL: 'L',
  DIESEL: 'L',
  FLEX: 'L',
  ELECTRIC: 'kWh',
  HYBRID: 'L',
  GNV: 'm³',
};

export const FUEL_LABEL_PT: Record<VehicleFuelType, string> = {
  GASOLINE: 'Gasolina',
  ETHANOL: 'Etanol',
  DIESEL: 'Diesel',
  FLEX: 'Gasolina (Flex)',
  ELECTRIC: 'Energia Elétrica (kWh)',
  HYBRID: 'Gasolina (Híbrido)',
  GNV: 'GNV (m³)',
};

export interface FuelPriceSuggestion {
  country: string;
  pricePerLiter: number;
  priceInBrl: number;
  currency: string;
  exchangeRate: number;
  fuelType: string;
  unit: string;
  source: string;
  note?: string;
}

@Injectable()
export class FuelPriceService {
  private readonly logger = new Logger(FuelPriceService.name);

  private get model() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return new ChatGoogleGenerativeAI({
      model: process.env.GEMINI_MODEL,
      apiKey,
      temperature: 0,
    });
  }

  async suggestFuelPrices(
    origin: string,
    destination: string,
    waypoints: string[] = [],
    vehicleFuelType: VehicleFuelType = 'GASOLINE',
  ): Promise<FuelPriceSuggestion[]> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      this.logger.warn('No Gemini API key configured, skipping fuel price suggestions');
      return [];
    }

    try {
      const locations = [origin, ...waypoints, destination].filter(Boolean);

      // Step 1: Extract unique countries from locations
      const countries = await this.extractCountries(locations);
      this.logger.log(`Countries detected: ${countries.join(', ')}`);

      if (!countries.length) return [];

      // Step 2: Search prices for each country in parallel
      const results = await Promise.allSettled(
        countries.map((country) => this.fetchFuelPriceForCountry(country, vehicleFuelType)),
      );

      return results
        .filter((r): r is PromiseFulfilledResult<FuelPriceSuggestion> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter(Boolean);
    } catch (err: any) {
      this.logger.warn(`Fuel price suggestion unavailable: ${err?.message ?? err}`);
      return [];
    }
  }

  async extractCountries(locations: string[]): Promise<string[]> {
    const prompt = `Extraia os PAÍSES (não cidades) das seguintes localidades.
Retorne apenas os nomes dos países únicos em português, separados por vírgula, sem explicações.
Exemplo de resposta: "Brasil, Argentina, Chile"

Localidades: ${locations.join(', ')}`;

    const response = await this.model.invoke([new HumanMessage(prompt)]);
    const content = String(response.content).trim();

    return [
      ...new Set(
        content
          .split(',')
          .map((c) => c.trim())
          .filter((c) => c.length > 0),
      ),
    ];
  }

  private async fetchFuelPriceForCountry(
    country: string,
    vehicleFuelType: VehicleFuelType = 'GASOLINE',
  ): Promise<FuelPriceSuggestion> {
    const fuelTerms: Record<VehicleFuelType, string> = {
      GASOLINE: 'gasolina',
      ETHANOL: 'etanol álcool',
      DIESEL: 'diesel',
      FLEX: 'gasolina',
      ELECTRIC: 'energia elétrica kWh recarga veículo elétrico',
      HYBRID: 'gasolina',
      GNV: 'GNV gás natural veicular m3',
    };
    const unit = FUEL_UNIT[vehicleFuelType];
    const term = fuelTerms[vehicleFuelType];
    const searchQuery = `preço ${term} ${country} 2025 por ${unit}`;
    const searchResults = await this.googleSearch(searchQuery);

    return this.extractPriceFromSearchResults(country, searchResults, searchQuery, vehicleFuelType);
  }

  private async googleSearch(query: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !cx) {
      this.logger.warn('Google Search API key or Engine ID not configured');
      return '';
    }

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '5');
    url.searchParams.set('hl', 'pt');

    const response = await fetch(url.toString());

    if (!response.ok) {
      this.logger.warn(`Google Search failed: ${response.status} ${response.statusText}`);
      return '';
    }

    const data = await response.json();
    const items = data.items || [];

    // Concatenate snippet + title from top results
    return items
      .slice(0, 5)
      .map((item: any) => `${item.title}\n${item.snippet}`)
      .join('\n\n');
  }

  private async extractPriceFromSearchResults(
    country: string,
    searchText: string,
    query: string,
    vehicleFuelType: VehicleFuelType = 'GASOLINE',
  ): Promise<FuelPriceSuggestion> {
    const unit = FUEL_UNIT[vehicleFuelType];
    const fuelLabelPt = FUEL_LABEL_PT[vehicleFuelType];

    const systemPrompt = `Você é um assistente especializado em preços de combustíveis e câmbio de moedas.
Analise os resultados de busca e extraia o preço atual de "${fuelLabelPt}" no país solicitado.
A unidade de medida é ${unit}.
Retorne APENAS um JSON válido no formato:
{
  "pricePerUnit": número_decimal (preço em moeda LOCAL do país por ${unit}),
  "currency": "código_moeda (ex: BRL, ARS, USD, EUR, CLP, PYG, UYU, PEN, BOB, COP)",
  "exchangeRate": número_decimal (taxa de câmbio: 1 unidade da moeda local = X reais BRL),
  "priceInBrl": número_decimal (preço convertido para BRL = pricePerUnit * exchangeRate),
  "fuelType": "nome exato do combustível em português",
  "note": "observação breve opcional"
}
Use a taxa de câmbio atual aproximada. Se o país for Brasil, exchangeRate = 1.
Se não encontrar preço confiável, use valores médios conhecidos para o país.`;

    const humanPrompt = `País: ${country}
Combustível buscado: ${fuelLabelPt}
Busca realizada: "${query}"

Resultados da busca:
${searchText || '(sem resultados de busca disponíveis)'}

Extraia o preço atual de ${fuelLabelPt} para ${country}.`;

    const response = await this.model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const content = String(response.content).trim();

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || content);
      const pricePerLiter = Number(parsed.pricePerUnit ?? parsed.pricePerLiter);
      const currency = parsed.currency || 'BRL';
      const exchangeRate = Number(parsed.exchangeRate) || 1;
      const priceInBrl = Number(parsed.priceInBrl) || pricePerLiter * exchangeRate;
      return {
        country,
        pricePerLiter,
        priceInBrl,
        currency,
        exchangeRate,
        fuelType: parsed.fuelType || fuelLabelPt,
        unit,
        source: searchText ? 'Google Search + IA' : 'Estimativa IA',
        note: parsed.note,
      };
    } catch {
      this.logger.warn(`Could not parse fuel price for ${country}`);
      return {
        country,
        pricePerLiter: 0,
        priceInBrl: 0,
        currency: 'BRL',
        exchangeRate: 1,
        fuelType: fuelLabelPt,
        unit,
        source: 'Estimativa IA',
        note: 'Não foi possível obter preço atualizado',
      };
    }
  }
}
