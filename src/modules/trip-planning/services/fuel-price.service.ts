import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface FuelPriceSuggestion {
  country: string;
  pricePerLiter: number;
  priceInBrl: number;
  currency: string;
  exchangeRate: number;
  fuelType: string;
  source: string;
  note?: string;
}

@Injectable()
export class FuelPriceService {
  private readonly logger = new Logger(FuelPriceService.name);

  private get model() {
    return new ChatGoogleGenerativeAI({
      model: 'gemini-3-flash-preview',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0,
    });
  }

  async suggestFuelPrices(
    origin: string,
    destination: string,
    waypoints: string[] = [],
  ): Promise<FuelPriceSuggestion[]> {
    const locations = [origin, ...waypoints, destination].filter(Boolean);

    // Step 1: Extract unique countries from locations
    const countries = await this.extractCountries(locations);
    this.logger.log(`Countries detected: ${countries.join(', ')}`);

    if (!countries.length) return [];

    // Step 2: Search prices for each country in parallel
    const results = await Promise.allSettled(
      countries.map((country) => this.fetchFuelPriceForCountry(country)),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<FuelPriceSuggestion> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter(Boolean);
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

  private async fetchFuelPriceForCountry(country: string): Promise<FuelPriceSuggestion> {
    const searchQuery = `preço gasolina ${country} 2025 por litro`;
    const searchResults = await this.googleSearch(searchQuery);

    return this.extractPriceFromSearchResults(country, searchResults, searchQuery);
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
  ): Promise<FuelPriceSuggestion> {
    const systemPrompt = `Você é um assistente especializado em preços de combustíveis e câmbio de moedas.
Analise os resultados de busca fornecidos e extraia o preço atual da gasolina/combustível mais comum.
Retorne APENAS um JSON válido no formato:
{
  "pricePerLiter": número_decimal (preço em moeda LOCAL do país),
  "currency": "código_moeda (ex: BRL, ARS, USD, EUR, CLP, PYG, UYU, PEN, BOB, COP)",
  "exchangeRate": número_decimal (taxa de câmbio: 1 unidade da moeda local = X reais BRL),
  "priceInBrl": número_decimal (preço convertido para BRL = pricePerLiter * exchangeRate),
  "fuelType": "nome do combustível em português (ex: Gasolina Comum, Gasolina Premium, Diesel)",
  "note": "observação breve opcional"
}
Use a taxa de câmbio atual aproximada. Se o país for Brasil, exchangeRate = 1.
Se não encontrar um preço confiável, use os valores médios conhecidos para o país.`;

    const humanPrompt = `País: ${country}
Busca realizada: "${query}"

Resultados da busca:
${searchText || '(sem resultados de busca disponíveis)'}

Extraia o preço atual do combustível mais comum para ${country}.`;

    const response = await this.model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const content = String(response.content).trim();

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || content);
      const pricePerLiter = Number(parsed.pricePerLiter);
      const currency = parsed.currency || 'BRL';
      const exchangeRate = Number(parsed.exchangeRate) || 1;
      const priceInBrl = Number(parsed.priceInBrl) || pricePerLiter * exchangeRate;
      return {
        country,
        pricePerLiter,
        priceInBrl,
        currency,
        exchangeRate,
        fuelType: parsed.fuelType || 'Gasolina',
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
        fuelType: 'Gasolina',
        source: 'Estimativa IA',
        note: 'Não foi possível obter preço atualizado',
      };
    }
  }
}
