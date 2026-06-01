// 个人中心增强层：只接管登录状态、我的页设置和账号相关功能。
const AUTH_TOKEN_KEY = 'travel_glow_token';
const LEGACY_TOKEN_KEY = 'travel-glow-token';

let currentUser = null;
let currentSettings = null;
let currentSessions = [];
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);

if (authToken && !localStorage.getItem(AUTH_TOKEN_KEY)) {
  localStorage.setItem(AUTH_TOKEN_KEY, authToken);
}

const settingLabels = {
  privacyVisibility: { private: '仅自己可见', friends: '好友可见', public: '公开' },
  mapTheme: { cyber: '赛博深邃', aurora: '极光微芒', classic: '经典暗色' },
  glowColor: { cyan: '极光青', emerald: '翡翠绿', amber: '星芒金', violet: '星云紫' },
  defaultHomeTab: { home: '首页', china: '中国', world: '世界', album: '相册', me: '我的' },
  photoViewMode: { timeline: '时间线', grid: '网格', compact: '紧凑' }
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, tone = 'info') {
  const palette = {
    info: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
    success: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
    warning: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
    error: 'border-rose-300/30 bg-rose-400/10 text-rose-100'
  };
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'fixed left-1/2 top-4 z-[80] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = `rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_50px_rgba(0,0,0,.35)] backdrop-blur-xl transition-all duration-300 ${palette[tone] || palette.info}`;
  toast.textContent = message;
  host.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    window.setTimeout(() => toast.remove(), 260);
  }, 2600);
}

function showRequestError(error, fallbackMessage = '操作失败') {
  if (error?.toastShown) return;
  showToast(error?.message || fallbackMessage, 'error');
  if (error) error.toastShown = true;
}

const AUTH_PUBLIC_PATHS = new Set(['/auth/login', '/auth/login/email', '/auth/register', '/auth/email/send']);
const REGISTER_PASSWORD_MESSAGE = '密码需至少 8 位，并且在大小写字母、数字、特殊符号中至少包含 3 类';

function shouldHandleAuthExpired(path, response) {
  return response.status === 401 && !AUTH_PUBLIC_PATHS.has(path);
}

function getApiErrorMessage(path, data, fallbackMessage) {
  if (data.code === 'EMAIL_IN_USE') return '该邮箱已被其他账号绑定';
  if (data.code === 'EMAIL_CODE_EXPIRED') return '验证码已过期，请重新获取';
  if (data.code === 'WEAK_PASSWORD') return REGISTER_PASSWORD_MESSAGE;

  const isEmailCodeError = (path === '/auth/login/email' || path === '/auth/register')
    && (
      data.code === 'EMAIL_CODE_INVALID'
      || (data.code === 'VALIDATION_ERROR' && data.details?.fieldErrors?.code)
    );
  if (isEmailCodeError) return '验证码输入有误~';
  return data.message || fallbackMessage;
}

function getRegisterPasswordClassCount(password) {
  return [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
}

function isRegisterPasswordStrong(password) {
  return String(password || '').length >= 8 && getRegisterPasswordClassCount(String(password || '')) >= 3;
}

function confirmAction(message, { title = '确认操作', danger = false } = {}) {
  return new Promise((resolve) => {
    openDrawer(`
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm ${danger ? 'text-rose-300' : 'text-[#06B6D4]'}">${danger ? 'Danger' : 'Confirm'}</p>
          <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${escapeHtml(title)}</h2>
          <p class="mt-2 text-sm leading-6 text-[#9CA3AF]">${escapeHtml(message)}</p>
        </div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-3">
        <button class="confirm-cancel rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-5 py-4 font-semibold text-[#9CA3AF]" type="button">取消</button>
        <button class="confirm-ok rounded-2xl ${danger ? 'bg-rose-500 text-white' : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#030712]'} px-5 py-4 font-semibold" type="button">确认</button>
      </div>
    `);
    const done = (value) => {
      closeDrawer();
      resolve(value);
    };
    document.querySelector('.confirm-cancel')?.addEventListener('click', () => done(false));
    document.querySelector('.confirm-ok')?.addEventListener('click', () => done(true));
    document.querySelector('.drawer-close')?.addEventListener('click', () => resolve(false), { once: true });
  });
}

function saveToken(token) {
  // 同时写入新旧 key，避免旧打卡上传代码读不到 token。
  authToken = token;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
}

function clearToken() {
  authToken = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  // 通用 API 请求封装：自动带 JWT，自动处理 JSON，401 时回到未登录态。
  const headers = { ...(options.headers || {}) };
  const isForm = options.body instanceof FormData;
  if (!isForm) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  const buildApiError = (fallbackMessage) => {
    const error = new Error(getApiErrorMessage(path, data, fallbackMessage));
    error.status = response.status;
    error.code = data.code;
    error.details = data.details;
    error.retryAfterSeconds = Number(response.headers.get('Retry-After') || data.details?.retryAfterSeconds || 0);
    return error;
  };
  if (shouldHandleAuthExpired(path, response)) {
    const error = buildApiError('登录状态已失效，请重新登录');
    clearToken();
    currentUser = null;
    currentSettings = null;
    currentSessions = [];
    renderLoginRequiredApp();
    setTab('me');
    showToast(error.message, 'warning');
    error.toastShown = true;
    openLoginDrawer();
    throw error;
  }
  if (!response.ok) {
    const error = buildApiError('Request failed');
    showToast(error.message, 'error');
    error.toastShown = true;
    throw error;
  }
  return data;
}

async function loadAuthMe() {
  if (!authToken) return false;
  const data = await apiRequest('/auth/me');
  currentUser = data.user;
  currentSettings = data.settings;
  currentSessions = data.sessions || [];
  Object.assign(userProfile, {
    nickname: currentUser.nickname,
    bio: currentUser.bio || '',
    avatar: currentUser.avatar || userProfile.avatar,
    level: currentUser.level || 1,
    exp: currentUser.exp || 0
  });
  return true;
}

async function loadProfile() {
  const profile = await apiRequest('/user/profile');
  currentUser = profile;
  currentSettings = profile.settings;
  Object.assign(userProfile, {
    nickname: profile.nickname,
    bio: profile.bio || '',
    avatar: profile.avatar || userProfile.avatar,
    level: profile.level || 1,
    exp: profile.exp || 0
  });
}

async function loadOverviewStats() {
  appStats = await apiRequest('/stats/overview');
}

async function loadChinaRegions() {
  const regions = await apiRequest('/regions/china/provinces');
  chinaRegions.splice(0, chinaRegions.length, ...regions.map((region) => ({
    ...region,
    short: region.short || region.shortName,
    cities: region.cities || [],
    checked: Boolean(region.checked),
    photoCount: region.photoCount || 0,
    totalCities: region.totalCities || (provinceCityCatalog[region.id] || []).length
  })));
  appChinaLit = await apiRequest('/map/china/lit-regions');
}

async function loadWorldRegions() {
  const groups = await apiRequest('/regions/continents');
  worldRegions.splice(0, worldRegions.length, ...groups.map((group) => ({
    continent: group.continent || group.name,
    code: group.code,
    regionType: group.regionType || undefined,
    countries: (group.countries || []).map((country) => ({
      ...country,
      checked: Boolean(country.checked),
      photoCount: country.photoCount || 0,
      date: country.date || ''
    }))
  })));
  appWorldLit = await apiRequest('/map/world/lit-regions');
}

async function loadPhotos() {
  appPhotos = await apiRequest('/photos');
}

async function loadCheckins() {
  appCheckins = await apiRequest('/checkins');
}

async function refreshAll() {
  if (!currentUser) {
    renderMePage();
    return;
  }
  await Promise.all([loadProfile(), loadOverviewStats(), loadChinaRegions(), loadWorldRegions(), loadPhotos(), loadCheckins()]);
  renderDerivedStats();
  renderChinaMap();
  renderWorldMap();
  renderAlbumPage();
  renderMePage();
  createIcons();
}

function settingsGroupsForRender() {
  return [
    {
      title: '账号安全',
      items: [
        { key: 'profile', name: '账号资料', icon: 'user-cog', hint: '头像、昵称、签名与绑定信息', action: 'profile' },
        { key: 'password', name: '修改密码', icon: 'lock-keyhole', hint: '验证身份后更新登录密码', action: 'password' },
        { key: 'email', name: '换绑邮箱', icon: 'mail', hint: currentUser?.email || '绑定新的安全邮箱', action: 'email' },
        { key: 'devices', name: '登录设备管理', icon: 'monitor', hint: `${currentSessions?.length || 0} 台活跃设备`, action: 'devices' }
      ]
    },
    {
      title: '其他',
      items: [
        { key: 'cache', name: '清除缓存', icon: 'trash-2', hint: '清理本地缓存状态', action: 'cache' },
        { key: 'logout', name: '退出登录', icon: 'log-out', hint: '结束当前会话', action: 'logout', tone: 'danger' }
      ]
    }
  ];
}

function renderLoggedOutMePage() {
  const root = document.getElementById('me-page-root');
  if (!root) return;
  root.innerHTML = `
    <section class="relative overflow-hidden rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-5 shadow-[0_0_42px_rgba(6,182,212,.14)] backdrop-blur-md">
      <div class="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"></div>
      <div class="relative">
        <p class="text-sm text-[#06B6D4]">Travel Glow Account</p>
        <h1 class="mt-2 text-3xl font-semibold text-[#F9FAFB]">旅光账号</h1>
        <p class="mt-2 text-sm leading-6 text-[#9CA3AF]">登录后同步你的足迹、照片和设置，刷新页面后仍然保留。</p>
        <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button class="login-entry rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 font-semibold text-[#030712]">登录</button>
          <button class="register-entry rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-[#06B6D4]">注册</button>
        </div>
      </div>
    </section>
  `;
  root.querySelector('.login-entry').addEventListener('click', openLoginDrawer);
  root.querySelector('.register-entry').addEventListener('click', openRegisterDrawer);
}

function renderLoggedInMePage() {
  const root = document.getElementById('me-page-root');
  if (!root) return;
  const stats = appStats || getOverviewStats();
  userStats = buildUserStats();
  const progress = Math.min(100, Math.round(((currentUser.exp || 0) / userProfile.nextExp) * 100));
  const joinDays = currentUser.createdAt ? Math.max(1, Math.ceil((Date.now() - new Date(currentUser.createdAt).getTime()) / 86400000)) : userProfile.joinDays;

  root.innerHTML = `
    <section class="relative overflow-hidden rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-5 shadow-[0_0_42px_rgba(6,182,212,.14)] backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]">
      <div class="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"></div>
      <div class="absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl"></div>
      <div class="relative flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative h-20 w-20 rounded-3xl border border-cyan-300/40 bg-[#030712] p-1 shadow-[0_0_30px_rgba(6,182,212,.32)]">
            <div class="absolute -right-1 -top-1 h-5 w-5 animate-soft-pulse rounded-full bg-[#06B6D4] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
            <img class="h-full w-full rounded-[1.25rem] object-cover" alt="用户头像" src="${escapeHtml(currentUser.avatar || userProfile.avatar)}">
          </div>
          <div>
            <p class="text-xs text-[#9CA3AF]">Lv. ${currentUser.level || 1} ${userProfile.levelName}</p>
            <h1 class="mt-1 text-3xl font-semibold text-[#F9FAFB]">${escapeHtml(currentUser.nickname)}</h1>
            <p class="mt-1 max-w-[15rem] text-sm leading-5 text-[#9CA3AF]">${escapeHtml(currentUser.bio || '还没有个性签名')}</p>
          </div>
        </div>
        <button class="me-edit-profile grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-[#06B6D4] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-105 hover:text-[#F9FAFB]" aria-label="编辑资料">
          <i data-lucide="pencil" class="h-4 w-4"></i>
        </button>
      </div>
      <div class="relative mt-5 flex flex-wrap gap-2">
        ${userProfile.tags.map((tag) => `<span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">${tag}</span>`).join('')}
        <span class="rounded-full border border-[#1F2937] bg-[#030712]/70 px-3 py-1 text-xs text-[#9CA3AF]">已加入 ${joinDays} 天</span>
      </div>
      <div class="relative mt-5">
        <div class="mb-2 flex items-center justify-between text-xs">
          <span class="text-[#9CA3AF]">等级经验 ${currentUser.exp || 0}/${userProfile.nextExp}</span>
          <span class="text-[#06B6D4]">${userProfile.nextLevelHint}</span>
        </div>
        <div class="h-2.5 overflow-hidden rounded-full bg-slate-800">
          <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" style="width:${progress}%"></div>
        </div>
      </div>
    </section>

    <section class="mt-5">
      ${renderSectionTitle('bar-chart-3', '旅行数据仪表盘')}
      <div class="grid grid-cols-2 gap-3">
        ${userStats.map((stat) => `
          <button class="me-stat rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-4 text-left shadow-[0_0_22px_rgba(6,182,212,.06)] backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:border-cyan-300/40" data-title="${escapeHtml(stat.label)}" data-desc="${escapeHtml(stat.hint)}" data-icon="${stat.icon}">
            <div class="mb-4 flex items-center justify-between">
              <i data-lucide="${stat.icon}" class="h-5 w-5 text-[#06B6D4]"></i>
              <span class="rounded-full bg-[#030712]/70 px-2 py-1 text-[10px] text-[#9CA3AF]">${escapeHtml(stat.hint)}</span>
            </div>
            <p class="text-2xl font-semibold text-[#F9FAFB]">${escapeHtml(stat.value)}</p>
            <p class="mt-1 text-xs text-[#9CA3AF]">${escapeHtml(stat.label)}</p>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="mt-5 space-y-4">
      ${renderSectionTitle('settings', '账号与设置')}
      ${settingsGroupsForRender().map((group) => `
        <div class="rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-3 backdrop-blur-md">
          <p class="mb-2 px-2 text-xs text-[#9CA3AF]">${group.title}</p>
          <div class="space-y-2">
            ${group.items.map((item) => `
              <button class="setting-entry flex w-full items-center justify-between rounded-2xl border border-transparent bg-[#030712]/40 px-3 py-3 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-cyan-400/10" data-action="${item.action}">
                <span class="flex items-center gap-3">
                  <span class="grid h-10 w-10 place-items-center rounded-2xl ${item.tone === 'danger' ? 'bg-rose-500/10 text-rose-300' : 'bg-cyan-400/10 text-[#06B6D4]'}">
                    <i data-lucide="${item.icon}" class="h-5 w-5"></i>
                  </span>
                  <span>
                    <span class="block text-sm font-medium ${item.tone === 'danger' ? 'text-rose-200' : 'text-[#F9FAFB]'}">${item.name}</span>
                    <span class="mt-0.5 block text-xs text-[#9CA3AF]">${item.hint}</span>
                  </span>
                </span>
                <i data-lucide="chevron-right" class="h-4 w-4 text-[#4B5563]"></i>
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </section>
  `;
  root.querySelector('.me-edit-profile').addEventListener('click', () => handleMeAction('profile'));
  root.querySelectorAll('.me-stat').forEach((button) => {
    button.addEventListener('click', () => openPrototypeDrawer(button.dataset.title, `当前指标：${button.dataset.desc}`, button.dataset.icon));
  });
  root.querySelectorAll('.setting-entry').forEach((button) => {
    button.addEventListener('click', () => handleMeAction(button.dataset.action));
  });
  createIcons();
}

renderMePage = function renderMePageByAuth() {
  if (!currentUser) return renderLoggedOutMePage();
  return renderLoggedInMePage();
};

function renderLoginRequiredPage(pageId, title, description, icon = 'lock-keyhole') {
  const page = document.getElementById(pageId);
  if (!page) return;
  page.innerHTML = `
    <section class="flex min-h-[70vh] items-center justify-center">
      <div class="w-full max-w-xl rounded-3xl border border-cyan-300/10 bg-[#111827]/70 p-6 text-center shadow-[0_0_42px_rgba(6,182,212,.12)] backdrop-blur-md">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-[#06B6D4]">
          <i data-lucide="${icon}" class="h-7 w-7"></i>
        </div>
        <p class="mt-5 text-sm text-[#06B6D4]">Travel Glow Account</p>
        <h1 class="mt-2 text-2xl font-semibold text-[#F9FAFB]">${escapeHtml(title)}</h1>
        <p class="mt-3 text-sm leading-6 text-[#9CA3AF]">${escapeHtml(description)}</p>
        <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button class="login-required-login rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="button">登录</button>
          <button class="login-required-register rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 font-semibold text-[#06B6D4]" type="button">注册</button>
        </div>
      </div>
    </section>
  `;
  page.querySelector('.login-required-login')?.addEventListener('click', openLoginDrawer);
  page.querySelector('.login-required-register')?.addEventListener('click', openRegisterDrawer);
}

function renderLoginRequiredApp() {
  appStats = null;
  appPhotos = [];
  appCheckins = [];
  appChinaLit = { litProvinceIds: [], litCityIds: [] };
  appWorldLit = { litCountryIds: [], litSpecialRegionIds: [] };
  renderLoginRequiredPage('page-home', '请先登录', '登录后才能查看你的旅行足迹、地图进度和最近照片。', 'shield');
  renderLoginRequiredPage('page-china', '请先登录中国足迹', '中国地图和省市打卡数据只展示当前登录用户的记录。', 'map');
  renderLoginRequiredPage('page-world', '请先登录世界足迹', '世界地图和国家打卡数据只展示当前登录用户的记录。', 'globe-2');
  renderLoginRequiredPage('page-album', '请先登录旅行相册', '相册会按省份、城市、国家整理当前用户上传的照片。', 'images');
  renderMePage();
  createIcons();
}

async function submitAuth(path, body) {
  const result = await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
  saveToken(result.token);
  await loadAuthenticatedApp();
  closeDrawer();
  showToast('登录状态已保存', 'success');
}

function startButtonCooldown(button, originalText, seconds = 60) {
  let remaining = Math.max(1, Math.ceil(Number(seconds) || 60));
  button.disabled = true;
  button.textContent = `\u7b49\u5f85 ${remaining}s`;
  const timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0 || !button.isConnected) {
      window.clearInterval(timer);
      if (button.isConnected) {
        button.textContent = originalText;
        button.disabled = false;
      }
      return;
    }
    button.textContent = `\u7b49\u5f85 ${remaining}s`;
  }, 1000);
}

async function sendEmailCode(email, purpose, targetButton) {
  if (!email) throw new Error('\u8bf7\u5148\u8f93\u5165\u90ae\u7bb1');
  const originalText = targetButton?.textContent || '';
  if (targetButton) {
    targetButton.disabled = true;
    targetButton.textContent = '\u53d1\u9001\u4e2d...';
  }

  try {
    const result = await apiRequest('/auth/email/send', {
      method: 'POST',
      body: JSON.stringify({ email, purpose })
    });
    if (targetButton) {
      targetButton.textContent = '\u5df2\u53d1\u9001';
      startButtonCooldown(targetButton, originalText, 60);
    }
    showToast('\u9a8c\u8bc1\u7801\u5df2\u53d1\u9001\uff0c\u8bf7\u67e5\u6536\u90ae\u7bb1', 'success');
    return result;
  } catch (error) {
    if (targetButton) {
      const retryAfter = Number(error.retryAfterSeconds || error.details?.retryAfterSeconds || 0);
      if (error.status === 429 && retryAfter > 0) {
        startButtonCooldown(targetButton, originalText, retryAfter);
      } else {
        targetButton.textContent = originalText;
        targetButton.disabled = false;
      }
    }
    throw error;
  }
}

function openLoginDrawer() {
  openDrawer(`
    <form id="login-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-[#06B6D4]">Sign in</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">登录旅光账号</h2></div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-1">
        <button type="button" class="login-mode rounded-xl bg-cyan-400/10 px-3 py-2 text-sm text-[#06B6D4]" data-mode="password">账号密码</button>
        <button type="button" class="login-mode rounded-xl px-3 py-2 text-sm text-[#9CA3AF]" data-mode="email">邮箱验证码</button>
      </div>
      <div class="mt-5 space-y-3">
        <div id="password-login-fields" class="space-y-3">
          <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">账号名 / 邮箱</span><input name="identifier" autocomplete="username" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
          <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">密码</span><input name="password" type="password" autocomplete="current-password" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        </div>
        <div id="email-login-fields" class="hidden space-y-3">
          <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">邮箱</span><input name="email" type="email" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
          <div class="grid grid-cols-[1fr_auto] gap-3">
            <input name="code" inputmode="numeric" placeholder="6 位验证码" class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
            <button type="button" class="send-login-code rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]">发送验证码</button>
          </div>
        </div>
      </div>
      <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">登录</button>
      <div class="mt-3">
        <button type="button" class="open-register w-full rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]">注册账号</button>
      </div>
    </form>
  `);
  const form = document.getElementById('login-form');
  let mode = 'password';
  let submitting = false;
  const submitButton = form.querySelector('button[type="submit"]');
  const passwordFields = form.querySelector('#password-login-fields');
  const emailFields = form.querySelector('#email-login-fields');
  const syncLoginMode = () => {
    const isEmailMode = mode === 'email';
    passwordFields.classList.toggle('hidden', isEmailMode);
    emailFields.classList.toggle('hidden', !isEmailMode);
    passwordFields.querySelectorAll('input').forEach((input) => {
      input.required = !isEmailMode;
      input.disabled = isEmailMode;
    });
    emailFields.querySelectorAll('input').forEach((input) => {
      input.required = isEmailMode;
      input.disabled = !isEmailMode;
    });
  };
  form.querySelectorAll('.login-mode').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      form.querySelectorAll('.login-mode').forEach((item) => {
        const active = item === button;
        item.classList.toggle('bg-cyan-400/10', active);
        item.classList.toggle('text-[#06B6D4]', active);
        item.classList.toggle('text-[#9CA3AF]', !active);
      });
      syncLoginMode();
    });
  });
  syncLoginMode();
  form.querySelector('.send-login-code').addEventListener('click', async (event) => {
    try {
      await sendEmailCode(form.email.value.trim(), 'login', event.currentTarget);
    } catch (error) {
      showRequestError(error, '验证码发送失败');
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    submitting = true;
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '登录中...';

    try {
      if (mode === 'email') {
        const email = form.email.value.trim();
        const code = form.code.value.trim();
        if (!/^\d{6}$/.test(code)) {
          showToast('验证码输入有误~', 'error');
          form.code.focus();
          return;
        }
        await submitAuth('/auth/login/email', { email, code });
        return;
      }
      await submitAuth('/auth/login', { identifier: form.identifier.value.trim(), password: form.password.value });
    } catch (error) {
      showRequestError(error, '登录失败');
    } finally {
      submitting = false;
      if (submitButton.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  });
  form.querySelector('.open-register').addEventListener('click', openRegisterDrawer);
}

function openRegisterDrawer() {
  openDrawer(`
    <form id="register-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-[#06B6D4]">Create Account</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">注册旅光账号</h2></div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-5 space-y-3">
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">自定义账号名</span><input name="username" required pattern="[A-Za-z0-9_]{3,24}" placeholder="例如 qyf_travel" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">昵称</span><input name="nickname" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">邮箱</span><input name="email" type="email" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <div class="grid grid-cols-[1fr_auto] gap-3">
          <input name="code" inputmode="numeric" required placeholder="邮箱验证码" class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
          <button type="button" class="send-register-code rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]">发送验证码</button>
        </div>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">密码</span><input name="password" type="password" minlength="8" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">确认密码</span><input name="confirmPassword" type="password" minlength="8" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
      </div>
      <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">注册</button>
      <button type="button" class="back-login mt-3 w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#9CA3AF]">返回登录</button>
    </form>
  `);
  const form = document.getElementById('register-form');
  let submitting = false;
  const submitButton = form.querySelector('button[type="submit"]');

  form.querySelector('.send-register-code').addEventListener('click', async (event) => {
    try {
      await sendEmailCode(form.email.value.trim(), 'register', event.currentTarget);
    } catch (error) {
      showRequestError(error, '验证码发送失败');
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    const body = Object.fromEntries(new FormData(form).entries());
    const code = String(body.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      showToast('验证码输入有误~', 'warning');
      form.code.focus();
      return;
    }
    if (!isRegisterPasswordStrong(body.password)) {
      showToast(REGISTER_PASSWORD_MESSAGE, 'warning');
      form.password.focus();
      return;
    }
    if (body.password !== body.confirmPassword) {
      showToast('两次输入的密码不一致', 'warning');
      form.confirmPassword.focus();
      return;
    }

    submitting = true;
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = '注册中...';

    try {
      delete body.confirmPassword;
      body.code = code;
      await submitAuth('/auth/register', body);
    } catch (error) {
      showRequestError(error, '注册失败');
    } finally {
      submitting = false;
      if (submitButton.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  });
  form.querySelector('.back-login').addEventListener('click', openLoginDrawer);
}

async function logout() {
  if (authToken) await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
  clearToken();
  currentUser = null;
  currentSettings = null;
  currentSessions = [];
  appStats = null;
  renderMePage();
  showToast('已退出登录', 'success');
  openLoginDrawer();
}

openEditProfileDrawer = function openProfileFormDrawer() {
  openDrawer(`
    <form id="profile-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-[#06B6D4]">Edit Profile</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">编辑资料</h2></div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-5 space-y-3">
        <div class="flex items-center gap-4 rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4">
          <img class="h-16 w-16 rounded-2xl object-cover" src="${escapeHtml(currentUser.avatar || userProfile.avatar)}" alt="头像预览">
          <label class="flex-1"><span class="mb-2 block text-sm text-[#9CA3AF]">上传头像</span><input name="avatar" type="file" accept="image/*" class="w-full text-sm text-[#F9FAFB]"></label>
        </div>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">账号名</span><input name="username" value="${escapeHtml(currentUser.username || '')}" pattern="[A-Za-z0-9_]{3,24}" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">绑定邮箱</span><input name="email" type="email" value="${escapeHtml(currentUser.email || '')}" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">昵称</span><input name="nickname" value="${escapeHtml(currentUser.nickname)}" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">个性签名</span><textarea name="bio" rows="4" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">${escapeHtml(currentUser.bio || '')}</textarea></label>
      </div>
      <div class="mt-5 grid grid-cols-2 gap-3">
        <button class="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">保存资料</button>
        <button type="button" class="drawer-close rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-5 py-4 font-semibold text-[#9CA3AF]">取消</button>
      </div>
    </form>
  `);
  const profileForm = document.getElementById('profile-form');
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const avatarFile = form.avatar.files[0];
    // 头像上传流程：先上传文件拿到 URL，再保存昵称和签名。
    if (avatarFile) {
      const avatarData = new FormData();
      avatarData.append('avatar', avatarFile);
      await apiRequest('/user/avatar', { method: 'POST', body: avatarData, headers: {} });
    }
    await apiRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({
        username: form.username.value.trim(),
        email: form.email.value.trim(),
        nickname: form.nickname.value.trim(),
        bio: form.bio.value.trim()
      })
    });
    await refreshAll();
    await loadAuthMe().catch(() => {});
    showToast('资料已保存', 'success');
    closeDrawer();
  });
};

async function saveSettings(patch) {
  // 设置保存流程：只提交本次变更字段，后端会保留其他设置。
  currentSettings = await apiRequest('/user/settings', { method: 'PUT', body: JSON.stringify(patch) });
  renderMePage();
  showToast('设置已保存', 'success');
}

function openPrivacySettingsDrawer() {
  openChoiceSettingDrawer('privacyVisibility', '隐私设置', [
    ['private', '仅自己可见'],
    ['friends', '好友可见'],
    ['public', '公开']
  ], '足迹可见范围');
}

function openChoiceSettingDrawer(key, title, options, label = title) {
  const currentValue = currentSettings?.[key];
  openDrawer(`
    <form id="choice-setting-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-[#06B6D4]">Settings</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${title}</h2></div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-5 space-y-2">
        <p class="mb-2 text-sm text-[#9CA3AF]">${label}</p>
        ${options.map(([value, text]) => `
          <label class="flex items-center justify-between rounded-2xl border ${currentValue === value ? 'border-cyan-300/40 bg-cyan-400/10' : 'border-[#1F2937] bg-[#030712]/70'} px-4 py-3 text-[#F9FAFB]">
            <span>${text}</span><input type="radio" name="value" value="${value}" ${currentValue === value ? 'checked' : ''}>
          </label>
        `).join('')}
      </div>
      <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">保存设置</button>
    </form>
  `);
  document.getElementById('choice-setting-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = new FormData(event.target).get('value');
    await saveSettings({ [key]: value });
    closeDrawer();
  });
}

function openSecurityDrawer() {
  const sessions = currentSessions || [];
  openDrawer(`
    <form id="password-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-[#06B6D4]">Security</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">登录与安全</h2><p class="mt-2 text-sm text-[#9CA3AF]">${escapeHtml(currentUser.email || currentUser.username)}</p></div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-5 rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4 text-sm text-[#9CA3AF]">当前状态：已登录。JWT 保存在本地浏览器，并绑定服务端会话；退出登录后该 token 会立即失效。</div>
      <div class="mt-5 space-y-3">
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">旧密码</span><input name="oldPassword" type="password" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">新密码</span><input name="newPassword" type="password" minlength="6" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">确认新密码</span><input name="confirmPassword" type="password" minlength="6" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></label>
      </div>
      <div class="mt-5 rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <p class="text-sm font-medium text-[#F9FAFB]">最近登录设备</p>
          <button class="logout-others rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200" type="button">退出其他设备</button>
        </div>
        <div class="space-y-2">
          ${sessions.length ? sessions.map((session, index) => `
            <div class="flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/10 bg-[#111827]/60 px-3 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm text-[#F9FAFB]">${escapeHtml(session.deviceName || 'Unknown device')}${index === 0 ? ' · 当前/最近' : ''}</p>
                <p class="mt-1 truncate text-xs text-[#9CA3AF]">${escapeHtml(session.ipAddress || '')} · ${session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : ''}</p>
              </div>
              <button class="revoke-session rounded-full border border-rose-300/30 bg-rose-400/10 px-3 py-1 text-xs text-rose-200" type="button" data-session-id="${session.id}">退出</button>
            </div>
          `).join('') : '<p class="text-sm text-[#9CA3AF]">暂无会话记录</p>'}
        </div>
      </div>
      <div class="mt-5 grid grid-cols-2 gap-3">
        <button class="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">修改密码</button>
        <button class="security-logout rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 font-semibold text-rose-200" type="button">退出登录</button>
      </div>
    </form>
  `);
  const form = document.getElementById('password-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.newPassword.value !== form.confirmPassword.value) throw new Error('两次新密码不一致');
    await apiRequest('/user/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword: form.oldPassword.value, newPassword: form.newPassword.value })
    });
    showToast('密码已修改，其他设备已退出', 'success');
    closeDrawer();
  });
  form.querySelector('.security-logout').addEventListener('click', logout);
  form.querySelector('.logout-others').addEventListener('click', async () => {
    await apiRequest('/auth/sessions/others', { method: 'DELETE', body: JSON.stringify({}) });
    await loadAuthMe();
    showToast('其他设备已退出登录', 'success');
    openSecurityDrawer();
  });
  form.querySelectorAll('.revoke-session').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await confirmAction('确定退出这台设备吗？如果这是当前设备，你需要重新登录。', { title: '退出设备', danger: true });
      if (!ok) return;
      await apiRequest(`/auth/sessions/${button.dataset.sessionId}`, { method: 'DELETE', body: JSON.stringify({}) });
      await loadAuthMe().catch(() => {});
      showToast('设备已退出登录', 'success');
      if (currentUser) openSecurityDrawer();
    });
  });
}

function handleMeAction(action) {
  if (window.AccountSecurity?.open) {
    window.AccountSecurity.open(action);
    return;
  }
  switch (action) {
    case 'profile': openEditProfileDrawer(); break;
    case 'privacy': openPrivacySettingsDrawer(); break;
    case 'password':
    case 'email':
    case 'devices':
    case 'theme':
    case 'language':
    case 'cache':
    case 'security': openSecurityDrawer(); break;
    case 'logout': logout(); break;
  }
}

const originalOpenAddDrawer = openAddDrawer;
openAddDrawer = function guardedAddDrawer() {
  if (!currentUser) return openLoginDrawer();
  return originalOpenAddDrawer();
};

const originalSetTab = setTab;
setTab = function guardedSetTab(tab, options = {}) {
  if (!currentUser && tab !== 'me') {
    originalSetTab('me', options);
    openLoginDrawer();
    return;
  }
  originalSetTab(tab, options);
};

async function loadAuthenticatedApp() {
  await loadAuthMe();
  await refreshAll();
  bindAuthenticatedControls();
}

function bindAuthenticatedControls() {
  if (!currentUser || searchBound) return;
  bindSearchControls();
  searchBound = true;
}

window.TravelGlowAccount = {
  getUser: () => currentUser,
  setUser: (user) => { currentUser = user; },
  getSettings: () => currentSettings,
  getSessions: () => currentSessions,
  apiRequest,
  loadAuthMe,
  refreshAll,
  renderMePage,
  saveSettings,
  logout,
  openLoginDrawer,
  clearToken,
  showToast,
  escapeHtml,
  confirmAction,
  createIcons: () => createIcons()
};

async function initPersonalCenter() {
  createIcons();
  if (authToken) {
    try {
      await loadAuthenticatedApp();
    } catch (error) {
      clearToken();
      currentUser = null;
      currentSettings = null;
    }
  }
  if (!currentUser) {
    renderLoginRequiredApp();
    setTab('me');
    openLoginDrawer();
  } else {
    setTab(currentSettings?.defaultHomeTab || 'home');
  }
  bindAuthenticatedControls();
  document.getElementById('fab')?.addEventListener('click', openAddDrawer);
}

initPersonalCenter().catch((error) => {
  console.error(error);
  openPrototypeDrawer('加载失败', error.message || '请确认后端服务和数据库已启动。', 'database');
  createIcons();
});
