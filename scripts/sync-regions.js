const prisma = require('../server/db');
const seedData = require('../data/seed-data');

function cityId(provinceId, cityName) {
  return `city:${provinceId}:${cityName}`;
}

async function upsertRegion(data) {
  await prisma.region.upsert({
    where: { id: data.id },
    create: data,
    update: {
      name: data.name,
      shortName: data.shortName,
      type: data.type,
      parentId: data.parentId,
      code: data.code,
      regionType: data.regionType,
      totalCities: data.totalCities,
      sortOrder: data.sortOrder
    }
  });
}

async function syncChinaRegions() {
  let provinces = 0;
  let cities = 0;

  for (const [index, region] of seedData.chinaRegions.entries()) {
    await upsertRegion({
      id: region.id,
      name: region.name,
      shortName: region.short,
      type: 'province',
      totalCities: seedData.provinceCityCatalog[region.id]?.length || region.totalCities || 0,
      sortOrder: index
    });
    provinces += 1;
  }

  for (const province of seedData.chinaRegions) {
    const provinceCities = seedData.provinceCityCatalog[province.id] || [];
    const checkedCities = province.cities || [];
    const cityNames = [...new Set([...provinceCities, ...checkedCities])];

    for (const [index, cityName] of cityNames.entries()) {
      await upsertRegion({
        id: cityId(province.id, cityName),
        name: cityName,
        type: 'city',
        parentId: province.id,
        sortOrder: index
      });
      cities += 1;
    }
  }

  return { provinces, cities };
}

async function syncWorldRegions() {
  let continents = 0;
  let countries = 0;
  let specialRegions = 0;

  for (const [groupIndex, group] of seedData.worldRegions.entries()) {
    const continentId = `continent:${group.code}`;
    await upsertRegion({
      id: continentId,
      name: group.continent,
      type: 'continent',
      code: group.code,
      regionType: group.regionType || null,
      sortOrder: groupIndex
    });
    continents += 1;

    for (const [countryIndex, country] of group.countries.entries()) {
      const type = group.regionType === 'special' ? 'special' : 'country';
      await upsertRegion({
        id: country.id,
        name: country.name,
        type,
        parentId: continentId,
        code: group.code,
        regionType: group.regionType || null,
        sortOrder: countryIndex
      });

      if (type === 'special') specialRegions += 1;
      else countries += 1;
    }
  }

  return { continents, countries, specialRegions };
}

async function main() {
  const china = await syncChinaRegions();
  const world = await syncWorldRegions();

  console.log(
    `Region catalog synced: ${china.provinces} provinces, ${china.cities} cities, ` +
    `${world.continents} continents, ${world.countries} countries, ${world.specialRegions} special regions.`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
