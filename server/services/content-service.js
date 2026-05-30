const activeRecord = { deletedAt: null };

function activeWhere(where = {}) {
  return { ...where, ...activeRecord };
}

function activePhotosInclude() {
  return { where: activeRecord, orderBy: { createdAt: 'desc' } };
}

module.exports = { activeRecord, activeWhere, activePhotosInclude };
