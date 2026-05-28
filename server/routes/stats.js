const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function formatPercent(value, digits = 1) {
  const fixed = Number(value).toFixed(digits);
  return fixed.replace(/\.0$/, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function calculateStreakDays(checkins) {
  const days = new Set(checkins.map((item) => dateKey(item.checkinDate)));
  if (!days.size) return 0;
  let cursor = new Date(Math.max(...checkins.map((item) => item.checkinDate.getTime())));
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function buildStats(userId) {
  const [regions, checkins] = await Promise.all([
    prisma.region.findMany({ include: { parent: true } }),
    prisma.checkin.findMany({
      where: { userId },
      include: { region: { include: { parent: true } }, photos: true },
      orderBy: { checkinDate: 'desc' }
    })
  ]);

  const provinceCount = regions.filter((region) => region.type === 'province').length;
  const cityCount = regions.filter((region) => region.type === 'city').length;
  const countryCount = regions.filter((region) => region.type === 'country').length;
  const specialCount = regions.filter((region) => region.type === 'special').length;

  const chinaCheckins = checkins.filter((item) => item.region.type === 'city');
  const countryCheckins = checkins.filter((item) => item.region.type === 'country');
  const specialCheckins = checkins.filter((item) => item.region.type === 'special');
  const worldCheckins = [...countryCheckins, ...specialCheckins];

  const checkedCityIds = unique(chinaCheckins.map((item) => item.regionId));
  const checkedProvinceIds = unique(chinaCheckins.map((item) => item.region.parentId));
  const checkedCountryIds = unique(countryCheckins.map((item) => item.regionId));
  const checkedSpecialIds = unique(specialCheckins.map((item) => item.regionId));
  const exploredContinentIds = unique(countryCheckins.map((item) => item.region.parentId));

  const chinaProgress = provinceCount ? (checkedProvinceIds.length / provinceCount) * 100 : 0;
  const worldProgress = countryCount ? (checkedCountryIds.length / countryCount) * 100 : 0;
  const totalPhotoCount = checkins.reduce((sum, item) => sum + item.photos.length, 0);
  const currentYear = new Date().getFullYear();

  return {
    china: {
      checkedProvinceCount: checkedProvinceIds.length,
      totalProvinceCount: provinceCount,
      checkedCityCount: checkedCityIds.length,
      totalCityCount: cityCount,
      photoCount: chinaCheckins.reduce((sum, item) => sum + item.photos.length, 0),
      progress: chinaProgress,
      progressText: `${formatPercent(chinaProgress)}%`
    },
    world: {
      checkedCountryCount: checkedCountryIds.length,
      totalCountryCount: countryCount,
      checkedSpecialRegionCount: checkedSpecialIds.length,
      totalSpecialRegionCount: specialCount,
      exploredContinentCount: exploredContinentIds.length,
      photoCount: worldCheckins.reduce((sum, item) => sum + item.photos.length, 0),
      progress: worldProgress,
      progressText: `${formatPercent(worldProgress, 2)}%`
    },
    totalPhotoCount,
    totalCheckins: checkins.length,
    recentPlace: checkins[0]?.region.name || '暂无',
    streakDays: calculateStreakDays(checkins),
    thisYearNewPlaces: unique(checkins.filter((item) => item.checkinDate.getFullYear() === currentYear).map((item) => item.regionId)).length
  };
}

router.get('/overview', auth, async (req, res, next) => {
  try {
    res.json(await buildStats(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.get('/china', auth, async (req, res, next) => {
  try {
    const stats = await buildStats(req.user.id);
    res.json(stats.china);
  } catch (error) {
    next(error);
  }
});

router.get('/world', auth, async (req, res, next) => {
  try {
    const stats = await buildStats(req.user.id);
    res.json(stats.world);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.buildStats = buildStats;
