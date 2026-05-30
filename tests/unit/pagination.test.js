const test = require('node:test');
const assert = require('node:assert/strict');

const { getPagination, hasPagination, paginated } = require('../../server/pagination');

test('getPagination returns default page settings', () => {
  assert.deepEqual(getPagination({}), {
    page: 1,
    pageSize: 20,
    skip: 0,
    take: 20
  });
});

test('getPagination normalizes invalid values and caps page size', () => {
  assert.deepEqual(getPagination({ page: '-2', pageSize: '500' }), {
    page: 1,
    pageSize: 100,
    skip: 0,
    take: 100
  });
});

test('hasPagination detects supported query parameters', () => {
  assert.equal(hasPagination({}), false);
  assert.equal(hasPagination({ page: '1' }), true);
  assert.equal(hasPagination({ limit: '10' }), true);
});

test('paginated builds pagination metadata', () => {
  const response = paginated([{ id: 1 }], 45, { page: 2, pageSize: 20 });
  assert.deepEqual(response.pagination, {
    page: 2,
    pageSize: 20,
    total: 45,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: true
  });
});
