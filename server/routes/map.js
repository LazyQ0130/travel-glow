const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');
const { activeWhere } = require('../services/content-service');

const router = express.Router();

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

router.get('/china/lit-regions', auth, async (req, res, next) => {
  try {
    const checkins = await prisma.checkin.findMany({
      where: activeWhere({ userId: req.user.id, region: { type: 'city' } }),
      include: { region: true }
    });
    res.json({
      litProvinceIds: unique(checkins.map((item) => item.region.parentId)),
      litCityIds: unique(checkins.map((item) => item.regionId))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/world/lit-regions', auth, async (req, res, next) => {
  try {
    const checkins = await prisma.checkin.findMany({
      where: activeWhere({ userId: req.user.id, region: { type: { in: ['country', 'special'] } } }),
      include: { region: true }
    });
    res.json({
      litCountryIds: unique(checkins.filter((item) => item.region.type === 'country').map((item) => item.regionId)),
      litSpecialRegionIds: unique(checkins.filter((item) => item.region.type === 'special').map((item) => item.regionId))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
