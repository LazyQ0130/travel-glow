// 个人中心增强层：只接管登录状态、我的页设置和账号相关功能。
const DEMO_LOGIN = { identifier: 'demo', password: '123456' };
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
  if (response.status === 401) {
    clearToken();
    currentUser = null;
    currentSettings = null;
    currentSessions = [];
    renderMePage();
    showToast(data.message || '登录状态已失效，请重新登录', 'warning');
    if (document.getElementById('page-me')?.classList.contains('active')) openLoginDrawer();
    throw new Error(data.message || '请重新登录');
  }
  if (!response.ok) {
    showToast(data.message || '请求失败', 'error');
    throw new Error(data.message || '请求失败');
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
  const s = currentSettings || {};
  return [
    {
      title: '账号与隐私',
      items: [
        { key: 'profile', name: '账号资料', icon: 'user-cog', hint: '昵称、头像、签名', action: 'profile' },
        { key: 'privacy', name: '隐私设置', icon: 'shield-check', hint: `足迹：${settingLabels.privacyVisibility[s.privacyVisibility] || '仅自己可见'}`, action: 'privacy' },
        { key: 'security', name: '登录与安全', icon: 'lock-keyhole', hint: '密码、登录状态、退出登录', action: 'security' }
      ]
    },
    {
      title: '显示与偏好',
      items: [
        { key: 'mapTheme', name: '地图主题', icon: 'map', hint: settingLabels.mapTheme[s.mapTheme] || '赛博深邃', action: 'mapTheme' },
        { key: 'glowColor', name: '点亮颜色', icon: 'sparkles', hint: settingLabels.glowColor[s.glowColor] || '极光青', action: 'glowColor' },
        { key: 'photoViewMode', name: '照片显示模式', icon: 'images', hint: settingLabels.photoViewMode[s.photoViewMode] || '时间线', action: 'photoViewMode' },
        { key: 'notifications', name: '通知偏好', icon: 'bell', hint: s.notificationEnabled ? '通知已开启' : '通知已关闭', action: 'notifications' }
      ]
    },
    {
      title: '数据与安全',
      items: [
        { key: 'storage', name: '照片存储', icon: 'hard-drive', hint: '查看照片和缓存占用', action: 'storage' },
        { key: 'export', name: '导出我的数据', icon: 'database', hint: '下载个人数据 JSON', action: 'export' },
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
        <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button class="login-entry rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 font-semibold text-[#030712]">登录</button>
          <button class="register-entry rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-[#06B6D4]">注册</button>
          <button class="demo-entry rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]">Demo 登录</button>
        </div>
      </div>
    </section>
  `;
  root.querySelector('.login-entry').addEventListener('click', openLoginDrawer);
  root.querySelector('.register-entry').addEventListener('click', openRegisterDrawer);
  root.querySelector('.demo-entry').addEventListener('click', loginDemoAccount);
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
      <div class="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-3 backdrop-blur-md">
        <button class="delete-account-entry flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-rose-100 transition-all duration-300 ease-out hover:bg-rose-500/10">
          <span class="flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-300"><i data-lucide="trash-2" class="h-5 w-5"></i></span><span><span class="block text-sm font-medium">注销账号</span><span class="mt-0.5 block text-xs text-rose-200/70">删除账号、打卡和照片记录</span></span></span>
          <i data-lucide="chevron-right" class="h-4 w-4 text-rose-300"></i>
        </button>
      </div>
    </section>
  `;
  root.querySelector('.me-edit-profile').addEventListener('click', openEditProfileDrawer);
  root.querySelectorAll('.me-stat').forEach((button) => {
    button.addEventListener('click', () => openPrototypeDrawer(button.dataset.title, `当前指标：${button.dataset.desc}`, button.dataset.icon));
  });
  root.querySelectorAll('.setting-entry').forEach((button) => {
    button.addEventListener('click', () => handleMeAction(button.dataset.action));
  });
  root.querySelector('.delete-account-entry').addEventListener('click', () => handleMeAction('deleteAccount'));
  createIcons();
}

renderMePage = function renderMePageByAuth() {
  if (!currentUser) return renderLoggedOutMePage();
  return renderLoggedInMePage();
};

async function submitAuth(path, body) {
  const result = await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
  saveToken(result.token);
  await loadAuthenticatedApp();
  closeDrawer();
  showToast('登录状态已保存', 'success');
}

async function sendSmsCode(phone, purpose, targetButton) {
  if (!phone) throw new Error('请先输入手机号');
  const result = await apiRequest('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, purpose })
  });
  if (targetButton) {
    const originalText = targetButton.textContent;
    targetButton.textContent = result.devCode ? `验证码 ${result.devCode}` : '已发送';
    targetButton.disabled = true;
    window.setTimeout(() => {
      targetButton.textContent = originalText;
      targetButton.disabled = false;
    }, 60000);
  }
  showToast(result.devCode ? `开发验证码：${result.devCode}` : '验证码已发送', 'success');
  return result;
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
        <button type="button" class="login-mode rounded-xl px-3 py-2 text-sm text-[#9CA3AF]" data-mode="phone">手机验证码</button>
      </div>
      <div class="mt-5 space-y-3">
        <div id="password-login-fields" class="space-y-3">
          <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">账号名 / 手机号 / 邮箱</span><input name="identifier" autocomplete="username" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
          <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">密码</span><input name="password" type="password" autocomplete="current-password" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        </div>
        <div id="phone-login-fields" class="hidden space-y-3">
          <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">手机号</span><input name="phone" inputmode="tel" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
          <div class="grid grid-cols-[1fr_auto] gap-3">
            <input name="code" inputmode="numeric" placeholder="6 位验证码" class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
            <button type="button" class="send-login-code rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]">发送验证码</button>
          </div>
        </div>
      </div>
      <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">登录</button>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <button type="button" class="open-register rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]">注册账号</button>
        <button type="button" class="demo-login rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#F9FAFB]">使用 Demo 账号</button>
      </div>
    </form>
  `);
  const form = document.getElementById('login-form');
  let mode = 'password';
  form.querySelectorAll('.login-mode').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      form.querySelectorAll('.login-mode').forEach((item) => {
        const active = item === button;
        item.classList.toggle('bg-cyan-400/10', active);
        item.classList.toggle('text-[#06B6D4]', active);
        item.classList.toggle('text-[#9CA3AF]', !active);
      });
      form.querySelector('#password-login-fields').classList.toggle('hidden', mode !== 'password');
      form.querySelector('#phone-login-fields').classList.toggle('hidden', mode !== 'phone');
    });
  });
  form.querySelector('.send-login-code').addEventListener('click', async (event) => {
    await sendSmsCode(form.phone.value.trim(), 'login', event.currentTarget);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (mode === 'phone') {
      await submitAuth('/auth/login/phone', { phone: form.phone.value.trim(), code: form.code.value.trim() });
      return;
    }
    await submitAuth('/auth/login', { identifier: form.identifier.value.trim(), password: form.password.value });
  });
  form.querySelector('.open-register').addEventListener('click', openRegisterDrawer);
  form.querySelector('.demo-login').addEventListener('click', loginDemoAccount);
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
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">绑定邮箱（可选）</span><input name="email" type="email" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">手机号</span><input name="phone" inputmode="tel" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <div class="grid grid-cols-[1fr_auto] gap-3">
          <input name="code" inputmode="numeric" required placeholder="短信验证码" class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
          <button type="button" class="send-register-code rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]">发送验证码</button>
        </div>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">密码</span><input name="password" type="password" minlength="6" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">确认密码</span><input name="confirmPassword" type="password" minlength="6" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
      </div>
      <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">注册</button>
      <button type="button" class="back-login mt-3 w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#9CA3AF]">返回登录</button>
    </form>
  `);
  const form = document.getElementById('register-form');
  form.querySelector('.send-register-code').addEventListener('click', async (event) => {
    await sendSmsCode(form.phone.value.trim(), 'register', event.currentTarget);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    if (body.password !== body.confirmPassword) throw new Error('两次输入的密码不一致');
    delete body.confirmPassword;
    await submitAuth('/auth/register', body);
  });
  form.querySelector('.back-login').addEventListener('click', openLoginDrawer);
}

async function loginDemoAccount() {
  await submitAuth('/auth/login', DEMO_LOGIN);
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
        <div class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4">
          <p class="text-sm text-[#9CA3AF]">当前手机号</p>
          <p class="mt-1 text-sm text-[#F9FAFB]">${escapeHtml(currentUser.phone || '未绑定')}</p>
          <div class="mt-3 grid grid-cols-[1fr_auto] gap-3">
            <input name="phone" inputmode="tel" placeholder="新手机号" class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
            <button type="button" class="send-bind-code rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]">发送验证码</button>
          </div>
          <input name="phoneCode" inputmode="numeric" placeholder="验证码" class="mt-3 w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
        </div>
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
  profileForm.querySelector('.send-bind-code').addEventListener('click', async (event) => {
    await sendSmsCode(profileForm.phone.value.trim(), 'bind_phone', event.currentTarget);
  });
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
    if (form.phone.value.trim()) {
      await apiRequest('/user/phone', {
        method: 'PUT',
        body: JSON.stringify({ phone: form.phone.value.trim(), code: form.phoneCode.value.trim() })
      });
    }
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

function openNotificationSettingsDrawer() {
  const s = currentSettings || {};
  openDrawer(`
    <form id="notification-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-[#06B6D4]">Notifications</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">通知偏好</h2></div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-5 space-y-2">
        ${[
          ['notificationEnabled', '总通知'],
          ['checkinReminder', '打卡提醒'],
          ['yearlyReport', '年度报告']
        ].map(([key, label]) => `
          <label class="flex items-center justify-between rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]">
            <span>${label}</span><input type="checkbox" name="${key}" ${s[key] ? 'checked' : ''}>
          </label>
        `).join('')}
      </div>
      <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">保存通知设置</button>
    </form>
  `);
  document.getElementById('notification-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    await saveSettings({
      notificationEnabled: form.notificationEnabled.checked,
      checkinReminder: form.checkinReminder.checked,
      yearlyReport: form.yearlyReport.checked
    });
    closeDrawer();
  });
}

function openSecurityDrawer() {
  const sessions = currentSessions || [];
  openDrawer(`
    <form id="password-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-[#06B6D4]">Security</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">登录与安全</h2><p class="mt-2 text-sm text-[#9CA3AF]">${escapeHtml(currentUser.email || currentUser.phone || currentUser.username)}</p></div>
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

async function openStorageDrawer() {
  const storage = await apiRequest('/user/storage');
  openDrawer(`
    <div class="flex items-start justify-between gap-4">
      <div><p class="text-sm text-[#06B6D4]">Storage</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">照片存储</h2></div>
      <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
    </div>
    <div class="mt-5 grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4"><p class="text-2xl font-semibold text-[#F9FAFB]">${storage.photoCount}</p><p class="mt-1 text-xs text-[#9CA3AF]">照片数量</p></div>
      <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4"><p class="text-2xl font-semibold text-[#F9FAFB]">${storage.checkinCount}</p><p class="mt-1 text-xs text-[#9CA3AF]">打卡数量</p></div>
      <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4"><p class="text-2xl font-semibold text-[#06B6D4]">${storage.estimatedStorage}</p><p class="mt-1 text-xs text-[#9CA3AF]">估算空间</p></div>
      <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4"><p class="text-2xl font-semibold text-[#F9FAFB]">${storage.uploadFolderSize}</p><p class="mt-1 text-xs text-[#9CA3AF]">上传目录字节</p></div>
    </div>
    <button class="clear-cache mt-5 w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-5 py-4 font-semibold text-[#FACC15]">清除本地缓存</button>
  `);
  document.querySelector('.clear-cache').addEventListener('click', async () => {
    await apiRequest('/user/cache', { method: 'DELETE', body: JSON.stringify({}) });
    showToast('本地缓存已清理', 'success');
    closeDrawer();
  });
}

async function exportMyData() {
  const data = await apiRequest('/user/export', { method: 'POST', body: JSON.stringify({}) });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'travel-glow-export.json';
  link.click();
  URL.revokeObjectURL(url);
  showToast('数据导出已开始下载', 'success');
}

function openDeleteAccountDrawer() {
  openDrawer(`
    <form id="delete-account-form">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-sm text-rose-300">Danger Zone</p><h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">注销账号</h2><p class="mt-2 text-sm text-rose-200/80">此操作会删除你的账号、打卡、照片和设置。</p></div>
        <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]"><i data-lucide="x" class="h-5 w-5"></i></button>
      </div>
      <div class="mt-5 space-y-3">
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">密码</span><input name="password" type="password" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></label>
        <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">输入 DELETE 确认</span><input name="confirmText" required class="w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-rose-100"></label>
      </div>
      <button class="mt-5 w-full rounded-2xl bg-rose-500 px-5 py-4 font-semibold text-white" type="submit">确认注销账号</button>
    </form>
  `);
  document.getElementById('delete-account-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await apiRequest('/user/account', { method: 'DELETE', body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())) });
    clearToken();
    currentUser = null;
    currentSettings = null;
    currentSessions = [];
    closeDrawer();
    renderMePage();
    showToast('账号已注销', 'success');
  });
}

function handleMeAction(action) {
  switch (action) {
    case 'profile': openEditProfileDrawer(); break;
    case 'privacy': openPrivacySettingsDrawer(); break;
    case 'security': openSecurityDrawer(); break;
    case 'mapTheme': openChoiceSettingDrawer('mapTheme', '地图主题', [['cyber', '赛博深邃'], ['aurora', '极光微芒'], ['classic', '经典暗色']]); break;
    case 'glowColor': openChoiceSettingDrawer('glowColor', '点亮颜色', [['cyan', '极光青'], ['emerald', '翡翠绿'], ['amber', '星芒金'], ['violet', '星云紫']]); break;
    case 'photoViewMode': openChoiceSettingDrawer('photoViewMode', '照片显示模式', [['timeline', '时间线'], ['grid', '网格'], ['compact', '紧凑']]); break;
    case 'notifications': openNotificationSettingsDrawer(); break;
    case 'storage': openStorageDrawer(); break;
    case 'export': exportMyData(); break;
    case 'logout': logout(); break;
    case 'deleteAccount': openDeleteAccountDrawer(); break;
  }
}

const originalOpenAddDrawer = openAddDrawer;
openAddDrawer = function guardedAddDrawer() {
  if (!currentUser) return openLoginDrawer();
  return originalOpenAddDrawer();
};

async function loadAuthenticatedApp() {
  await loadAuthMe();
  await refreshAll();
}

async function initPersonalCenter() {
  setTab('home');
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
    validateMockData();
    renderDerivedStats();
    renderChinaMap();
    renderWorldMap();
    renderMePage();
  }
  if (!searchBound) {
    bindSearchControls();
    searchBound = true;
  }
  document.getElementById('fab').addEventListener('click', openAddDrawer);
}

initPersonalCenter().catch((error) => {
  console.error(error);
  openPrototypeDrawer('加载失败', error.message || '请确认后端服务和数据库已启动。', 'database');
  createIcons();
});
