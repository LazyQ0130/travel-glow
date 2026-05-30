const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { activeWhere, activePhotosInclude } = require('../services/content-service');

const router = express.Router();

async function checkinsForRegions(userId, regionIds) {
  if (!regionIds.length) return [];
  return prisma.checkin.findMany({
    where: activeWhere({ userId, regionId: { in: regionIds } }),
    include: { photos: activePhotosInclude(), region: { include: { parent: true } } },
    orderBy: { checkinDate: 'desc' }
  });
}

function latestDate(checkins) {
  return checkins[0]?.checkinDate?.toISOString().slice(0, 10) || '';
}

router.get('/china/provinces', auth, async (req, res, next) => {
  try {
    const provinces = await prisma.region.findMany({
      where: { type: 'province' },
      include: { children: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' }
    });
    const cityIds = provinces.flatMap((province) => province.children.map((city) => city.id));
    const checkins = await checkinsForRegions(req.user.id, cityIds);
    const checkedCityIds = new Set(checkins.map((item) => item.regionId));

    const result = provinces.map((province) => {
      const provinceCityIds = province.children.map((city) => city.id);
      const provinceCheckins = checkins.filter((item) => provinceCityIds.includes(item.regionId));
      const photoCount = provinceCheckins.reduce((sum, item) => sum + item.photos.length, 0);
      const checkedCityCount = province.children.filter((city) => checkedCityIds.has(city.id)).length;
      const cities = province.children.filter((city) => checkedCityIds.has(city.id)).map((city) => city.name);
      return {
        id: province.id,
        name: province.name,
        shortName: province.shortName,
        short: province.shortName,
        type: province.type,
        checked: checkedCityCount > 0,
        checkedCityCount,
        cities,
        totalCities: province.children.length || province.totalCities || 0,
        photoCount
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/provinces/:id/cities', auth, async (req, res, next) => {
  try {
    const cities = await prisma.region.findMany({
      where: { type: 'city', parentId: req.params.id },
      orderBy: { sortOrder: 'asc' }
    });
    const checkins = await checkinsForRegions(req.user.id, cities.map((city) => city.id));
    const checkedIds = new Set(checkins.map((item) => item.regionId));
    res.json(cities.map((city) => ({
      ...city,
      checked: checkedIds.has(city.id),
      photoCount: checkins.filter((item) => item.regionId === city.id).reduce((sum, item) => sum + item.photos.length, 0)
    })));
  } catch (error) {
    next(error);
  }
});

router.get('/continents', auth, async (req, res, next) => {
  try {
    const continents = await prisma.region.findMany({
      where: { type: 'continent' },
      include: { children: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' }
    });
    const childIds = continents.flatMap((continent) => continent.children.map((child) => child.id));
    const checkins = await checkinsForRegions(req.user.id, childIds);
    const checkedIds = new Set(checkins.map((item) => item.regionId));

    res.json(continents.map((continent) => ({
      id: continent.id,
      continent: continent.name,
      name: continent.name,
      code: continent.code,
      regionType: continent.regionType,
      countries: continent.children.map((country) => {
        const countryCheckins = checkins.filter((item) => item.regionId === country.id);
        return {
          id: country.id,
          name: country.name,
          type: country.type,
          checked: checkedIds.has(country.id),
          photoCount: countryCheckins.reduce((sum, item) => sum + item.photos.length, 0),
          date: latestDate(countryCheckins)
        };
      })
    })));
  } catch (error) {
    next(error);
  }
});

router.get('/continents/:id/countries', auth, async (req, res, next) => {
  try {
    const countries = await prisma.region.findMany({
      where: { parentId: req.params.id, type: { in: ['country', 'special'] } },
      orderBy: { sortOrder: 'asc' }
    });
    const checkins = await checkinsForRegions(req.user.id, countries.map((country) => country.id));
    const checkedIds = new Set(checkins.map((item) => item.regionId));
    res.json(countries.map((country) => {
      const countryCheckins = checkins.filter((item) => item.regionId === country.id);
      return {
        ...country,
        checked: checkedIds.has(country.id),
        photoCount: countryCheckins.reduce((sum, item) => sum + item.photos.length, 0),
        date: latestDate(countryCheckins)
      };
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/search', auth, async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    if (!keyword) return res.json([]);

    const regions = await prisma.region.findMany({
      where: {
        OR: [
          { name: { contains: keyword } },
          { shortName: { contains: keyword } }
        ]
      },
      include: { parent: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      take: 20
    });

    const checkins = await checkinsForRegions(req.user.id, regions.map((region) => region.id));
    const checkedIds = new Set(checkins.map((item) => item.regionId));

    res.json(regions.map((region) => ({
      id: region.id,
      name: region.name,
      type: region.type,
      parentId: region.parentId,
      parentName: region.parent?.name || '',
      checked: checkedIds.has(region.id),
      photoCount: checkins.filter((item) => item.regionId === region.id).reduce((sum, item) => sum + item.photos.length, 0)
    })));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/checkins', auth, async (req, res, next) => {
  try {
    const region = await prisma.region.findUnique({
      where: { id: req.params.id },
      include: { children: true }
    });
    if (!region) return res.status(404).json({ message: '地区不存在' });

    const regionIds = region.type === 'province'
      ? region.children.map((child) => child.id)
      : [region.id];
    const checkins = await prisma.checkin.findMany({
      where: activeWhere({ userId: req.user.id, regionId: { in: regionIds } }),
      include: { region: { include: { parent: true } }, photos: activePhotosInclude() },
      orderBy: { checkinDate: 'desc' }
    });
    res.json(checkins);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
