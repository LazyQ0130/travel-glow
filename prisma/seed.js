const bcrypt = require('bcryptjs');
const prisma = require('../server/db');
const seedData = require('../data/seed-data');

const DEFAULT_EMAIL = '321167759@qq.com';
const DEFAULT_PASSWORD = '123456';
const DEFAULT_NOTE = '来自旅行相册的初始打卡记录';

function cityId(provinceId, cityName) {
  return `city:${provinceId}:${cityName}`;
}

function distributeCount(total, parts) {
  if (!parts) return [];
  const base = Math.floor(total / parts);
  const rest = total % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < rest ? 1 : 0));
}

async function createPhotos(userId, checkinId, count) {
  const photos = [];
  for (let index = 0; index < count; index += 1) {
    const imageUrl = seedData.samplePhotos[index % seedData.samplePhotos.length];
    photos.push({
      userId,
      checkinId,
      imageUrl,
      originalName: `seed-photo-${index + 1}.jpg`,
      mimeType: 'image/jpeg',
      size: 0
    });
  }
  if (photos.length) {
    await prisma.photo.createMany({ data: photos });
  }
}

async function createSeedUser({ username, nickname, email, passwordHash }) {
  return prisma.user.create({
    data: {
      username,
      nickname,
      email,
      emailVerifiedAt: email ? new Date() : null,
      passwordHash,
      bio: seedData.userProfile.bio,
      avatar: seedData.userProfile.avatar,
      level: seedData.userProfile.level,
      exp: seedData.userProfile.exp,
      settings: { create: {} }
    }
  });
}

async function createInitialCheckinsForUser(user) {
  for (const province of seedData.chinaRegions.filter((item) => item.checked)) {
    const counts = distributeCount(province.photoCount || 0, province.cities.length);
    for (const [index, cityName] of province.cities.entries()) {
      const checkin = await prisma.checkin.create({
        data: {
          userId: user.id,
          regionId: cityId(province.id, cityName),
          checkinDate: new Date('2026-05-16T00:00:00.000Z'),
          title: `${cityName}打卡`,
          note: DEFAULT_NOTE
        }
      });
      await createPhotos(user.id, checkin.id, counts[index] || 0);
    }
  }

  for (const group of seedData.worldRegions) {
    for (const country of group.countries.filter((item) => item.checked)) {
      const checkin = await prisma.checkin.create({
        data: {
          userId: user.id,
          regionId: country.id,
          checkinDate: new Date(`${country.date || '2025-01-01'}T00:00:00.000Z`),
          title: `${country.name}打卡`,
          note: DEFAULT_NOTE
        }
      });
      await createPhotos(user.id, checkin.id, country.photoCount || 0);
    }
  }
}

async function main() {
  await prisma.photo.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.emailVerificationCode.deleteMany();
  await prisma.loginSession.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.region.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const defaultUser = await createSeedUser({ username: 'qyf', nickname: 'QYF', email: DEFAULT_EMAIL, passwordHash });

  for (const [index, region] of seedData.chinaRegions.entries()) {
    await prisma.region.create({
      data: {
        id: region.id,
        name: region.name,
        shortName: region.short,
        type: 'province',
        totalCities: seedData.provinceCityCatalog[region.id]?.length || region.totalCities || 0,
        sortOrder: index
      }
    });
  }

  for (const province of seedData.chinaRegions) {
    const cities = [...new Set([...(seedData.provinceCityCatalog[province.id] || []), ...(province.cities || [])])];
    for (const [index, cityName] of cities.entries()) {
      await prisma.region.create({
        data: {
          id: cityId(province.id, cityName),
          name: cityName,
          type: 'city',
          parentId: province.id,
          sortOrder: index
        }
      });
    }
  }

  for (const [groupIndex, group] of seedData.worldRegions.entries()) {
    const continentId = `continent:${group.code}`;
    await prisma.region.create({
      data: {
        id: continentId,
        name: group.continent,
        type: 'continent',
        code: group.code,
        regionType: group.regionType || null,
        sortOrder: groupIndex
      }
    });

    for (const [countryIndex, country] of group.countries.entries()) {
      await prisma.region.create({
        data: {
          id: country.id,
          name: country.name,
          type: group.regionType === 'special' ? 'special' : 'country',
          parentId: continentId,
          code: group.code,
          regionType: group.regionType || null,
          sortOrder: countryIndex
        }
      });
    }
  }

  await createInitialCheckinsForUser(defaultUser);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed completed.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
