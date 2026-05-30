const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPagination(query = {}) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(toPositiveInt(query.pageSize || query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

function hasPagination(query = {}) {
  return query.page !== undefined || query.pageSize !== undefined || query.limit !== undefined;
}

function paginated(data, total, pagination) {
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  return {
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1
    }
  };
}

module.exports = { getPagination, hasPagination, paginated };
