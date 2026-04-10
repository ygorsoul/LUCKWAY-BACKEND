/**
 * EXEMPLOS DE USO DO MÓDULO POIs
 *
 * Este arquivo demonstra diferentes formas de usar o módulo POIs
 * em diferentes contextos.
 */

import { POIsService } from '../pois.service';
import { POI, POIServiceType } from '../types/poi.types';

/**
 * EXEMPLO 1: Uso básico - Buscar POIs em uma localização
 */
async function example1BasicSearch(poisService: POIsService) {
  console.log('=== EXEMPLO 1: Busca Básica ===');

  // Coordenadas de São Paulo - Praça da Sé
  const lat = -23.5505;
  const lng = -46.6333;
  const radius = 5000; // 5km

  const pois = await poisService.searchPOIs({
    lat,
    lng,
    radiusInMeters: radius,
  });

  console.log(`Encontrados ${pois.length} POIs em ${radius}m de raio`);
  console.log('Primeiros 3 resultados:');
  pois.slice(0, 3).forEach((poi) => {
    console.log(`- ${poi.name} (${poi.serviceType}) - ${poi.distance}m`);
  });
}

/**
 * EXEMPLO 2: Buscar POIs no destino de uma viagem
 */
async function example2DestinationPOIs(poisService: POIsService) {
  console.log('\n=== EXEMPLO 2: POIs no Destino ===');

  // Destino: Rio de Janeiro - Cristo Redentor
  const destinationLat = -22.9519;
  const destinationLng = -43.2105;

  const pois = await poisService.searchPOIsAtDestination(
    destinationLat,
    destinationLng,
    10000, // 10km
  );

  console.log(`Infraestrutura disponível no destino: ${pois.length} POIs`);
}

/**
 * EXEMPLO 3: Filtrar POIs por tipo de serviço
 */
async function example3FilterByServiceType(poisService: POIsService) {
  console.log('\n=== EXEMPLO 3: Filtrar por Tipo de Serviço ===');

  const pois = await poisService.searchPOIs({
    lat: -27.6006, // Florianópolis
    lng: -48.4638,
    radiusInMeters: 8000,
  });

  // Filtrar apenas locais para dormir
  const sleepPOIs = pois.filter((poi) => poi.serviceType === POIServiceType.SLEEP);
  console.log(`Locais para pernoite: ${sleepPOIs.length}`);

  // Filtrar apenas locais para banho
  const showerPOIs = pois.filter((poi) => poi.serviceType === POIServiceType.SHOWER);
  console.log(`Locais para banho: ${showerPOIs.length}`);

  // Filtrar apenas lavanderias
  const laundryPOIs = pois.filter((poi) => poi.serviceType === POIServiceType.LAUNDRY);
  console.log(`Lavanderias: ${laundryPOIs.length}`);

  // Filtrar apenas pontos de água potável
  const waterPOIs = pois.filter((poi) => poi.serviceType === POIServiceType.WATER);
  console.log(`Pontos de água potável: ${waterPOIs.length}`);
}

/**
 * EXEMPLO 4: Agrupar POIs por tipo e ordenar por distância
 */
async function example4GroupAndSort(poisService: POIsService) {
  console.log('\n=== EXEMPLO 4: Agrupar e Ordenar ===');

  const pois = await poisService.searchPOIs({
    lat: -23.5505,
    lng: -46.6333,
    radiusInMeters: 10000,
  });

  // Agrupar por tipo de serviço
  const grouped = pois.reduce(
    (acc, poi) => {
      if (!acc[poi.serviceType]) {
        acc[poi.serviceType] = [];
      }
      acc[poi.serviceType].push(poi);
      return acc;
    },
    {} as Record<string, POI[]>,
  );

  // Ordenar cada grupo por distância e pegar os 3 mais próximos
  Object.entries(grouped).forEach(([serviceType, poisList]) => {
    const nearest3 = poisList
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 3);

    console.log(`\n${serviceType} (${poisList.length} encontrados):`);
    nearest3.forEach((poi, index) => {
      console.log(`  ${index + 1}. ${poi.name} - ${poi.distance}m`);
      if (poi.tags.opening_hours) {
        console.log(`     Horário: ${poi.tags.opening_hours}`);
      }
      if (poi.tags.phone) {
        console.log(`     Telefone: ${poi.tags.phone}`);
      }
    });
  });
}

/**
 * EXEMPLO 5: Encontrar o POI mais próximo de cada tipo
 */
async function example5NearestOfEachType(poisService: POIsService) {
  console.log('\n=== EXEMPLO 5: POI Mais Próximo de Cada Tipo ===');

  const pois = await poisService.searchPOIs({
    lat: -23.5505,
    lng: -46.6333,
    radiusInMeters: 15000,
  });

  // Encontrar o mais próximo de cada tipo
  const serviceTypes = [
    POIServiceType.SLEEP,
    POIServiceType.SHOWER,
    POIServiceType.LAUNDRY,
    POIServiceType.WATER,
  ];

  serviceTypes.forEach((type) => {
    const poisOfType = pois
      .filter((poi) => poi.serviceType === type)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));

    if (poisOfType.length > 0) {
      const nearest = poisOfType[0];
      console.log(`\n${type}:`);
      console.log(`  Nome: ${nearest.name}`);
      console.log(`  Distância: ${nearest.distance}m`);
      console.log(`  Coordenadas: ${nearest.coordinates.lat}, ${nearest.coordinates.lng}`);
    } else {
      console.log(`\n${type}: Nenhum encontrado`);
    }
  });
}

/**
 * EXEMPLO 6: Buscar POIs com raios diferentes (estratégia em cascata)
 */
async function example6CascadeSearch(poisService: POIsService) {
  console.log('\n=== EXEMPLO 6: Busca em Cascata ===');

  const location = { lat: -23.5505, lng: -46.6333 };
  const radii = [2000, 5000, 10000, 20000]; // 2km, 5km, 10km, 20km

  for (const radius of radii) {
    const pois = await poisService.searchPOIs({
      lat: location.lat,
      lng: location.lng,
      radiusInMeters: radius,
    });

    console.log(`Raio ${radius / 1000}km: ${pois.length} POIs encontrados`);

    // Se encontrou POIs suficientes, parar
    if (pois.length >= 10) {
      console.log('Quantidade suficiente encontrada, parando busca.');
      break;
    }
  }
}

/**
 * EXEMPLO 7: Formatar resposta para o frontend
 */
async function example7FormatForFrontend(poisService: POIsService) {
  console.log('\n=== EXEMPLO 7: Formato para Frontend ===');

  const pois = await poisService.searchPOIs({
    lat: -23.5505,
    lng: -46.6333,
    radiusInMeters: 5000,
  });

  // Formatar resposta agrupada e simplificada
  const response = {
    totalFound: pois.length,
    byServiceType: {
      pernoite: pois
        .filter((p) => p.serviceType === POIServiceType.SLEEP)
        .map((p) => ({
          id: p.id,
          name: p.name,
          coordinates: p.coordinates,
          distance: p.distance,
          hasPhone: !!p.tags.phone,
          hasWebsite: !!p.tags.website,
          isFree: p.tags.fee === 'no',
        })),
      banho: pois
        .filter((p) => p.serviceType === POIServiceType.SHOWER)
        .map((p) => ({
          id: p.id,
          name: p.name,
          coordinates: p.coordinates,
          distance: p.distance,
        })),
      lavanderia: pois
        .filter((p) => p.serviceType === POIServiceType.LAUNDRY)
        .map((p) => ({
          id: p.id,
          name: p.name,
          coordinates: p.coordinates,
          distance: p.distance,
        })),
      agua: pois
        .filter((p) => p.serviceType === POIServiceType.WATER)
        .map((p) => ({
          id: p.id,
          name: p.name,
          coordinates: p.coordinates,
          distance: p.distance,
        })),
    },
  };

  console.log(JSON.stringify(response, null, 2));
}

/**
 * EXEMPLO 8: Verificar disponibilidade de infraestrutura completa
 */
async function example8CheckCompleteInfrastructure(poisService: POIsService) {
  console.log('\n=== EXEMPLO 8: Infraestrutura Completa ===');

  const pois = await poisService.searchPOIs({
    lat: -23.5505,
    lng: -46.6333,
    radiusInMeters: 10000,
  });

  const hasSleep = pois.some((p) => p.serviceType === POIServiceType.SLEEP);
  const hasShower = pois.some((p) => p.serviceType === POIServiceType.SHOWER);
  const hasLaundry = pois.some((p) => p.serviceType === POIServiceType.LAUNDRY);
  const hasWater = pois.some((p) => p.serviceType === POIServiceType.WATER);

  console.log('Infraestrutura disponível:');
  console.log(`  Pernoite: ${hasSleep ? '✓' : '✗'}`);
  console.log(`  Banho: ${hasShower ? '✓' : '✗'}`);
  console.log(`  Lavanderia: ${hasLaundry ? '✓' : '✗'}`);
  console.log(`  Água Potável: ${hasWater ? '✓' : '✗'}`);

  const isCompleteInfrastructure = hasSleep && hasShower && hasLaundry && hasWater;
  console.log(
    `\nInfraestrutura completa: ${isCompleteInfrastructure ? 'SIM' : 'NÃO'}`,
  );
}

// Export para uso em testes
export {
  example1BasicSearch,
  example2DestinationPOIs,
  example3FilterByServiceType,
  example4GroupAndSort,
  example5NearestOfEachType,
  example6CascadeSearch,
  example7FormatForFrontend,
  example8CheckCompleteInfrastructure,
};
