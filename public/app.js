    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');
    const drawer = document.getElementById('drawer');
    const drawerContent = document.getElementById('drawer-content');
    const addTemplate = document.getElementById('add-template');
    const authenticatedPageTemplates = new Map(
      ['home', 'china', 'world', 'album'].map((name) => {
        const page = document.getElementById(`page-${name}`);
        return [name, page?.innerHTML || ''];
      })
    );

    document.addEventListener('error', (event) => {
      if (event.target instanceof HTMLImageElement) {
        event.target.style.display = 'none';
      }
    }, true);

    function imagePlaceholder(label = '旅光照片') {
      const text = String(label || '旅光照片').slice(0, 18);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#064e5f"/>
              <stop offset="0.52" stop-color="#0f766e"/>
              <stop offset="1" stop-color="#1e293b"/>
            </linearGradient>
            <radialGradient id="glow" cx="28%" cy="24%" r="70%">
              <stop offset="0" stop-color="#67e8f9" stop-opacity="0.55"/>
              <stop offset="1" stop-color="#67e8f9" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="640" height="420" fill="url(#bg)"/>
          <rect width="640" height="420" fill="url(#glow)"/>
          <circle cx="500" cy="92" r="46" fill="#facc15" opacity="0.82"/>
          <path d="M0 316 126 210l96 72 94-120 154 154 74-66 96 92v78H0Z" fill="#020617" opacity="0.58"/>
          <path d="M0 342 144 248l86 62 86-92 136 124 68-52 120 82v48H0Z" fill="#022c22" opacity="0.55"/>
          <text x="42" y="70" fill="#ecfeff" font-size="30" font-family="system-ui, sans-serif" font-weight="700">Travel Glow</text>
          <text x="42" y="112" fill="#cffafe" font-size="22" font-family="system-ui, sans-serif">${text}</text>
        </svg>
      `;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function isAllowedImageUrl(value = '') {
      const url = String(value || '').trim();
      if (!url) return false;
      if (url.startsWith('/') || url.startsWith('data:')) return true;
      try {
        const parsed = new URL(url, window.location.origin);
        return parsed.origin === window.location.origin || parsed.hostname.endsWith('.example.com');
      } catch (error) {
        return false;
      }
    }

    function safeImageUrl(value = '', label = '旅光照片') {
      return isAllowedImageUrl(value) ? String(value).trim() : imagePlaceholder(label);
    }

    function escapeHtml(value = '') {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const samplePhotos = [
      imagePlaceholder('城市湖畔'),
      imagePlaceholder('古城街巷'),
      imagePlaceholder('城市夜景')
    ];

    const userProfile = {
      nickname: 'QYF',
      bio: '用旅光记录去过的地方，也记录每一次出发时的光。',
      avatar: imagePlaceholder('QYF'),
      level: 6,
      levelName: '旅光探索者',
      exp: 760
    };

    function syncHomeProfile(profile = userProfile) {
      const nickname = String(profile.nickname || userProfile.nickname || '旅行者').trim() || '旅行者';
      const avatar = safeImageUrl(profile.avatar || userProfile.avatar, `${nickname}头像`);
      document.querySelectorAll('[data-profile="home-greeting"]').forEach((item) => {
        item.textContent = `你好，旅行者 ${nickname}`;
      });
      document.querySelectorAll('[data-profile="home-avatar"]').forEach((item) => {
        if (avatar) item.src = avatar;
      });
    }

    let userStats = [];

    const settingsGroups = [
      {
        title: '账号与隐私',
        items: [
          { name: '账号资料', icon: 'user-cog', hint: '昵称、头像、签名', tone: 'cyan' },
          { name: '隐私设置', icon: 'shield-check', hint: '照片与足迹可见范围', tone: 'cyan' },
          { name: '登录与安全', icon: 'lock-keyhole', hint: '邮箱、密码、设备管理', tone: 'cyan' },
          { name: '退出登录', icon: 'log-out', hint: '结束当前账号会话', tone: 'danger' }
        ]
      }
    ];

    function fallbackIconSvg(name) {
      const icons = {
        home: '<path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10.5V20h13v-9.5"></path>',
        map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2Z"></path><path d="M9 4v14"></path><path d="M15 6v14"></path>',
        'map-pin': '<path d="M12 21s7-5.3 7-12a7 7 0 0 0-14 0c0 6.7 7 12 7 12Z"></path><circle cx="12" cy="9" r="2.2"></circle>',
        'globe-2': '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a13 13 0 0 1 0 18"></path><path d="M12 3a13 13 0 0 0 0 18"></path>',
        images: '<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M8 13l2.5-2.5L15 15l2-2 3 3"></path><circle cx="9" cy="9" r="1"></circle>',
        user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.6-4 14.4-4 16 0"></path>',
        plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
        x: '<path d="M6 6l12 12"></path><path d="M18 6 6 18"></path>',
        search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>',
        'image-plus': '<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M9 13l2-2 4 4"></path><path d="M16 8v5"></path><path d="M13.5 10.5h5"></path>',
        sparkles: '<path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z"></path><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"></path>',
        'arrow-right': '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
        'chevron-right': '<path d="m9 6 6 6-6 6"></path>',
        pencil: '<path d="M4 20h4l11-11-4-4L4 16Z"></path><path d="M13 7l4 4"></path>',
        'trash-2': '<path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path>',
        'calendar-days': '<rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4"></path><path d="M16 3v4"></path><path d="M4 10h16"></path>',
        'list-tree': '<path d="M7 6h13"></path><path d="M7 12h13"></path><path d="M7 18h13"></path><path d="M4 6h.01"></path><path d="M4 12h.01"></path><path d="M4 18h.01"></path>',
        radar: '<circle cx="12" cy="12" r="9"></circle><path d="M12 12l6-5"></path><path d="M8 12a4 4 0 0 0 4 4"></path>',
        'badge-check': '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path>',
        navigation: '<path d="M12 3l7 18-7-4-7 4Z"></path>',
        flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 0 3-2 4-3 5 0-4-2-7-5-9 0 5-3 7-3 11 0 4 4 7 8 7Z"></path>',
        'scan-line': '<path d="M4 7V5a1 1 0 0 1 1-1h2"></path><path d="M17 4h2a1 1 0 0 1 1 1v2"></path><path d="M20 17v2a1 1 0 0 1-1 1h-2"></path><path d="M7 20H5a1 1 0 0 1-1-1v-2"></path><path d="M6 12h12"></path>',
        'id-card': '<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="11" r="2"></circle><path d="M13 10h5"></path><path d="M13 14h4"></path>',
        'bar-chart-3': '<path d="M5 20V10"></path><path d="M12 20V4"></path><path d="M19 20v-7"></path>',
        settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"></path>',
        'user-cog': '<circle cx="9" cy="8" r="4"></circle><path d="M3 21c1-4 9-4 10-1"></path><circle cx="17" cy="17" r="2"></circle><path d="M17 13v1"></path><path d="M17 20v1"></path><path d="M13 17h1"></path><path d="M20 17h1"></path>',
        'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="m8.5 12 2 2 5-5"></path>',
        'lock-keyhole': '<rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><path d="M12 14v2"></path>',
        database: '<ellipse cx="12" cy="5" rx="7" ry="3"></ellipse><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5"></path><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"></path>',
        'hard-drive': '<rect x="4" y="6" width="16" height="12" rx="2"></rect><path d="M7 15h.01"></path><path d="M11 15h6"></path>',
        bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
        'log-out': '<path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M21 4v16"></path>'
      };
      const content = icons[name] || '<circle cx="12" cy="12" r="8"></circle><path d="M8 12h8"></path>';
      return `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
    }

    function renderFallbackIcons() {
      document.querySelectorAll('i[data-lucide]').forEach((icon) => {
        if (icon.dataset.fallbackIcon === 'true') return;
        icon.style.display = 'inline-block';
        icon.style.lineHeight = '0';
        icon.style.flexShrink = '0';
        icon.innerHTML = fallbackIconSvg(icon.dataset.lucide);
        icon.dataset.fallbackIcon = 'true';
      });
    }

    function createIcons() {
      if (window.lucide) {
        window.lucide.createIcons();
        return;
      }
      renderFallbackIcons();
    }

    function restoreAuthenticatedPages() {
      authenticatedPageTemplates.forEach((html, name) => {
        const page = document.getElementById(`page-${name}`);
        if (page && html) page.innerHTML = html;
      });
    }

    function setTab(tab, options = {}) {
      const shouldScrollTop = options.scrollTop !== false;
      pages.forEach((page) => page.classList.toggle('active', page.id === `page-${tab}`));
      navItems.forEach((item) => {
        const active = item.dataset.tab === tab;
        item.classList.toggle('active', active);
        item.classList.toggle('text-[#06B6D4]', active);
        item.classList.toggle('bg-cyan-400/10', active);
        item.classList.toggle('drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]', active);
        item.classList.toggle('text-[#9CA3AF]', !active);
      });
      if (shouldScrollTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    function openDrawer(html) {
      drawerContent.innerHTML = html;
      drawer.classList.remove('pointer-events-none', 'opacity-0');
      drawer.classList.add('pointer-events-auto', 'opacity-100', 'drawer-open');
      drawer.setAttribute('aria-hidden', 'false');
      createIcons();
      document.querySelectorAll('.drawer-close').forEach((button) => {
        button.addEventListener('click', closeDrawer);
      });
    }

    function closeDrawer() {
      drawer.classList.add('pointer-events-none', 'opacity-0');
      drawer.classList.remove('pointer-events-auto', 'opacity-100', 'drawer-open');
      drawer.setAttribute('aria-hidden', 'true');
    }

    function openAddDrawer() {
      openDrawer(addTemplate.innerHTML);
    }

    function openPlaceDrawer(title, meta, note, isLit) {
      const litLabel = isLit ? '已有打卡' : '暂无打卡';
      const litClass = isLit ? 'text-[#06B6D4]' : 'text-[#4B5563]';
      const html = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm ${litClass}">${litLabel}</p>
            <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${title}</h2>
            <p class="mt-2 text-sm text-[#9CA3AF]">${meta}</p>
          </div>
          <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>
        <div class="mt-5 grid grid-cols-3 gap-3">
          ${samplePhotos.map((src, index) => `
            <div class="photo-fallback relative h-28 overflow-hidden rounded-2xl border border-[#1F2937] sm:h-36">
              <img class="h-full w-full object-cover" alt="${title}照片${index + 1}" src="${src}">
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
          `).join('')}
        </div>
        <div class="mt-5 rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4">
          <div class="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <i data-lucide="calendar-days" class="h-4 w-4 text-[#06B6D4]"></i>
            最近打卡日期：2026-05-16
          </div>
          <p class="mt-3 text-sm leading-6 text-[#F9FAFB]">${note}</p>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#F9FAFB] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan-400/40">
            <span class="inline-flex items-center gap-2"><i data-lucide="pencil" class="h-4 w-4 text-[#06B6D4]"></i>编辑记录</span>
          </button>
          <button class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#FACC15] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-yellow-300/40">
            <span class="inline-flex items-center gap-2"><i data-lucide="trash-2" class="h-4 w-4"></i>删除记录</span>
          </button>
        </div>
      `;
      openDrawer(html);
    }

    function openPrototypeDrawer(title, description, icon = 'sparkles') {
      openDrawer(`
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-[#06B6D4]">
              <i data-lucide="${icon}" class="h-5 w-5"></i>
            </div>
            <div>
              <p class="text-sm text-[#06B6D4]">Travel Glow</p>
              <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${title}</h2>
              <p class="mt-2 text-sm leading-6 text-[#9CA3AF]">${description}</p>
            </div>
          </div>
          <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>
        <div class="mt-5 rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4">
          <p class="text-sm font-semibold text-[#F9FAFB]">功能提示</p>
          <p class="mt-2 text-sm leading-6 text-[#9CA3AF]">该操作需要登录后使用真实账号数据。</p>
        </div>
      `);
    }

    function openEditProfileDrawer() {
      openDrawer(`
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm text-[#06B6D4]">Edit Profile</p>
            <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">编辑资料</h2>
            <p class="mt-2 text-sm text-[#9CA3AF]">登录后可以修改账号资料。</p>
          </div>
          <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>
        <div class="mt-5 space-y-3">
          <div class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3">
            <p class="text-xs text-[#9CA3AF]">昵称</p>
            <p class="mt-1 text-sm text-[#F9FAFB]">${userProfile.nickname}</p>
          </div>
          <div class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3">
            <p class="text-xs text-[#9CA3AF]">个性签名</p>
            <p class="mt-1 text-sm text-[#F9FAFB]">${userProfile.bio}</p>
          </div>
          <div class="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
            <p class="text-sm text-[#06B6D4]">后续可接入头像上传、昵称校验、签名保存接口。</p>
          </div>
        </div>
      `);
    }

    function openNotFoundDrawer(keyword, scope) {
      openPrototypeDrawer('未找到结果', `没有在${scope}中找到“${keyword}”。请尝试输入完整名称，例如“浙江”“杭州”“日本”“法国”。`, 'search');
    }

    function renderSectionTitle(icon, title, actionText = '') {
      return `
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="${icon}" class="h-4 w-4 text-[#06B6D4]"></i>
            <h2 class="text-base font-semibold text-[#F9FAFB]">${title}</h2>
          </div>
          ${actionText ? `<button class="me-action text-xs text-[#06B6D4] transition-all duration-300 ease-out hover:text-[#F9FAFB]" data-title="${actionText}" data-icon="arrow-right">${actionText}</button>` : ''}
        </div>
      `;
    }

    function renderMePage() {
      const root = document.getElementById('me-page-root');
      if (!root) return;
      root.innerHTML = `
        <section class="relative overflow-hidden rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-5 shadow-[0_0_42px_rgba(6,182,212,.14)] backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]">
          <div class="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"></div>
          <div class="absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl"></div>
          <div class="relative flex items-start justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="relative h-20 w-20 rounded-3xl border border-cyan-300/40 bg-[#030712] p-1 shadow-[0_0_30px_rgba(6,182,212,.32)]">
                <div class="absolute -right-1 -top-1 h-5 w-5 animate-soft-pulse rounded-full bg-[#06B6D4] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                <img class="h-full w-full rounded-[1.25rem] object-cover" alt="用户头像" src="${userProfile.avatar}">
              </div>
              <div>
                <p class="text-xs text-[#9CA3AF]">Lv. ${userProfile.level} ${userProfile.levelName}</p>
                <h1 class="mt-1 text-3xl font-semibold text-[#F9FAFB]">${userProfile.nickname}</h1>
                <p class="mt-1 max-w-[15rem] text-sm leading-5 text-[#9CA3AF]">${userProfile.bio}</p>
              </div>
            </div>
            <button class="me-edit-profile grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-[#06B6D4] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-105 hover:text-[#F9FAFB]" aria-label="编辑资料">
              <i data-lucide="pencil" class="h-4 w-4"></i>
            </button>
          </div>
        </section>

        <section class="mt-5">
          ${renderSectionTitle('bar-chart-3', '旅行数据仪表盘')}
          <div class="grid grid-cols-2 gap-3">
            ${userStats.map((stat) => `
              <button class="me-stat rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-4 text-left shadow-[0_0_22px_rgba(6,182,212,.06)] backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:border-cyan-300/40 hover:shadow-[0_0_32px_rgba(6,182,212,.16)]" data-title="${stat.label}" data-desc="${stat.hint}" data-icon="${stat.icon}">
                <div class="mb-4 flex items-center justify-between">
                  <i data-lucide="${stat.icon}" class="h-5 w-5 text-[#06B6D4]"></i>
                  <span class="rounded-full bg-[#030712]/70 px-2 py-1 text-[10px] text-[#9CA3AF]">${stat.hint}</span>
                </div>
                <p class="text-2xl font-semibold text-[#F9FAFB]">${stat.value}</p>
                <p class="mt-1 text-xs text-[#9CA3AF]">${stat.label}</p>
              </button>
            `).join('')}
          </div>
        </section>

        <section class="mt-5 space-y-4">
          ${renderSectionTitle('settings', '账号与设置')}
          ${settingsGroups.map((group) => `
            <div class="rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-3 backdrop-blur-md">
              <p class="mb-2 px-2 text-xs text-[#9CA3AF]">${group.title}</p>
              <div class="space-y-2">
                ${group.items.map((item) => `
                  <button class="setting-entry flex w-full items-center justify-between rounded-2xl border border-transparent bg-[#030712]/40 px-3 py-3 text-left transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-cyan-400/10" data-title="${item.name}" data-desc="${item.hint}" data-icon="${item.icon}">
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

      root.querySelector('.me-edit-profile').addEventListener('click', openEditProfileDrawer);
      root.querySelectorAll('.me-stat').forEach((button) => {
        button.addEventListener('click', () => openPrototypeDrawer(button.dataset.title, `当前指标：${button.dataset.desc}。`, button.dataset.icon));
      });
      root.querySelectorAll('.setting-entry').forEach((button) => {
        button.addEventListener('click', () => openPrototypeDrawer(`设置 · ${button.dataset.title}`, button.dataset.desc, button.dataset.icon));
      });
      root.querySelectorAll('.me-action').forEach((button) => {
        button.addEventListener('click', () => openPrototypeDrawer(button.dataset.title, '请登录后使用完整功能。', button.dataset.icon || 'sparkles'));
      });
      createIcons();
    }

    const chinaRegions = [
      { id: 'xinjiang', name: '新疆', short: '新', x: 1, y: 2, w: 2, h: 2, checked: false, cities: [], totalCities: 14, photoCount: 0 },
      { id: 'xizang', name: '西藏', short: '藏', x: 1, y: 5, w: 2, h: 2, checked: false, cities: [], totalCities: 7, photoCount: 0 },
      { id: 'qinghai', name: '青海', short: '青', x: 3, y: 4, w: 2, h: 1, checked: false, cities: [], totalCities: 8, photoCount: 0 },
      { id: 'gansu', name: '甘肃', short: '甘', x: 4, y: 3, w: 2, h: 1, checked: false, cities: [], totalCities: 14, photoCount: 0 },
      { id: 'ningxia', name: '宁夏', short: '宁', x: 5, y: 4, w: 1, h: 1, checked: false, cities: [], totalCities: 5, photoCount: 0 },
      { id: 'neimenggu', name: '内蒙古', short: '蒙', x: 4, y: 1, w: 4, h: 1, checked: false, cities: [], totalCities: 12, photoCount: 0 },
      { id: 'heilongjiang', name: '黑龙江', short: '黑', x: 9, y: 1, w: 2, h: 1, checked: false, cities: [], totalCities: 13, photoCount: 0 },
      { id: 'jilin', name: '吉林', short: '吉', x: 9, y: 2, w: 1, h: 1, checked: false, cities: [], totalCities: 9, photoCount: 0 },
      { id: 'liaoning', name: '辽宁', short: '辽', x: 8, y: 2, w: 1, h: 1, checked: false, cities: [], totalCities: 14, photoCount: 0 },
      { id: 'beijing', name: '北京', short: '京', x: 7, y: 2, w: 1, h: 1, checked: true, cities: ['北京'], totalCities: 1, photoCount: 9 },
      { id: 'tianjin', name: '天津', short: '津', x: 8, y: 3, w: 1, h: 1, checked: false, cities: [], totalCities: 1, photoCount: 0 },
      { id: 'hebei', name: '河北', short: '冀', x: 7, y: 3, w: 1, h: 1, checked: false, cities: [], totalCities: 11, photoCount: 0 },
      { id: 'shanxi', name: '山西', short: '晋', x: 6, y: 3, w: 1, h: 1, checked: false, cities: [], totalCities: 11, photoCount: 0 },
      { id: 'shaanxi', name: '陕西', short: '陕', x: 5, y: 5, w: 1, h: 1, checked: false, cities: [], totalCities: 10, photoCount: 0 },
      { id: 'shandong', name: '山东', short: '鲁', x: 8, y: 4, w: 1, h: 1, checked: false, cities: [], totalCities: 16, photoCount: 0 },
      { id: 'henan', name: '河南', short: '豫', x: 6, y: 4, w: 1, h: 1, checked: false, cities: [], totalCities: 17, photoCount: 0 },
      { id: 'jiangsu', name: '江苏', short: '苏', x: 9, y: 4, w: 1, h: 1, checked: false, cities: [], totalCities: 13, photoCount: 0 },
      { id: 'shanghai', name: '上海', short: '沪', x: 10, y: 5, w: 1, h: 1, checked: false, cities: [], totalCities: 1, photoCount: 0 },
      { id: 'anhui', name: '安徽', short: '皖', x: 8, y: 5, w: 1, h: 1, checked: false, cities: [], totalCities: 16, photoCount: 0 },
      { id: 'hubei', name: '湖北', short: '鄂', x: 6, y: 5, w: 1, h: 1, checked: true, cities: ['武汉', '宜昌'], totalCities: 17, photoCount: 14 },
      { id: 'sichuan', name: '四川', short: '川', x: 4, y: 6, w: 2, h: 1, checked: true, cities: ['成都', '乐山', '都江堰', '绵阳'], totalCities: 21, photoCount: 31 },
      { id: 'chongqing', name: '重庆', short: '渝', x: 6, y: 6, w: 1, h: 1, checked: true, cities: ['重庆'], totalCities: 1, photoCount: 12 },
      { id: 'hunan', name: '湖南', short: '湘', x: 7, y: 6, w: 1, h: 1, checked: false, cities: [], totalCities: 14, photoCount: 0 },
      { id: 'jiangxi', name: '江西', short: '赣', x: 8, y: 6, w: 1, h: 1, checked: false, cities: [], totalCities: 11, photoCount: 0 },
      { id: 'zhejiang', name: '浙江', short: '浙', x: 9, y: 6, w: 1, h: 1, checked: true, cities: ['杭州', '宁波', '绍兴'], totalCities: 11, photoCount: 28 },
      { id: 'fujian', name: '福建', short: '闽', x: 9, y: 7, w: 1, h: 1, checked: true, cities: ['厦门'], totalCities: 9, photoCount: 10 },
      { id: 'guizhou', name: '贵州', short: '贵', x: 5, y: 7, w: 1, h: 1, checked: false, cities: [], totalCities: 9, photoCount: 0 },
      { id: 'yunnan', name: '云南', short: '云', x: 4, y: 8, w: 2, h: 1, checked: false, cities: [], totalCities: 16, photoCount: 0 },
      { id: 'guangxi', name: '广西', short: '桂', x: 6, y: 8, w: 1, h: 1, checked: false, cities: [], totalCities: 14, photoCount: 0 },
      { id: 'guangdong', name: '广东', short: '粤', x: 7, y: 8, w: 2, h: 1, checked: true, cities: ['广州', '深圳', '珠海'], totalCities: 21, photoCount: 24 },
      { id: 'hainan', name: '海南', short: '琼', x: 9, y: 8, w: 1, h: 1, checked: true, cities: ['海口'], totalCities: 4, photoCount: 7 },
      { id: 'taiwan', name: '台湾', short: '台', x: 10, y: 7, w: 1, h: 1, checked: false, cities: [], totalCities: 1, photoCount: 0 },
      { id: 'hongkong', name: '香港', short: '港', x: 9, y: 8, w: 1, h: 1, checked: false, cities: [], totalCities: 18, photoCount: 0 },
      { id: 'macau', name: '澳门', short: '澳', x: 9, y: 8, w: 1, h: 1, checked: false, cities: [], totalCities: 7, photoCount: 0 }
    ];

    const chinaRegionGroups = [
      { name: '西北', code: 'NW', ids: ['xinjiang', 'qinghai', 'gansu', 'ningxia', 'shaanxi'] },
      { name: '西南', code: 'SW', ids: ['xizang', 'sichuan', 'chongqing', 'guizhou', 'yunnan'] },
      { name: '华北', code: 'NC', ids: ['beijing', 'tianjin', 'hebei', 'shanxi', 'neimenggu'] },
      { name: '东北', code: 'NE', ids: ['heilongjiang', 'jilin', 'liaoning'] },
      { name: '华东', code: 'EC', ids: ['shandong', 'jiangsu', 'shanghai', 'anhui', 'zhejiang', 'fujian', 'taiwan'] },
      { name: '华中 / 华南', code: 'CS', ids: ['henan', 'hubei', 'hunan', 'jiangxi', 'guangdong', 'guangxi', 'hainan', 'hongkong', 'macau'] }
    ];

    const provinceCityCatalog = {
      xinjiang: ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '阿克苏', '喀什', '和田', '塔城', '阿勒泰', '昌吉', '博尔塔拉', '巴音郭楞', '克孜勒苏', '伊犁'],
      xizang: ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里'],
      qinghai: ['西宁', '海东', '海北', '黄南', '海南', '果洛', '玉树', '海西'],
      gansu: ['兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南', '临夏', '甘南'],
      ningxia: ['银川', '吴忠', '中卫', '石嘴山', '固原'],
      neimenggu: ['呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
      heilongjiang: ['哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化', '大兴安岭'],
      jilin: ['长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'],
      liaoning: ['沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'],
      beijing: ['北京'],
      tianjin: ['天津'],
      hebei: ['石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'],
      shanxi: ['太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'],
      shaanxi: ['西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'],
      shandong: ['济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'],
      henan: ['郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'],
      jiangsu: ['南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'],
      shanghai: ['上海'],
      anhui: ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'],
      hubei: ['武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施', '仙桃', '潜江', '天门', '神农架'],
      sichuan: ['成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳', '阿坝', '甘孜', '凉山'],
      chongqing: ['重庆'],
      hunan: ['长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'],
      jiangxi: ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'],
      zhejiang: ['杭州', '宁波', '绍兴', '温州', '嘉兴', '湖州', '金华', '衢州', '舟山', '台州', '丽水'],
      fujian: ['福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'],
      guizhou: ['贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'],
      yunnan: ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆'],
      guangxi: ['南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'],
      guangdong: ['广州', '韶关', '深圳', '珠海', '汕头', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'],
      hainan: ['海口', '三亚', '三沙', '儋州'],
      taiwan: ['台北市', '新北市', '桃园市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '嘉义市', '新竹县', '苗栗县', '彰化县', '南投县', '云林县', '嘉义县', '屏东县', '宜兰县', '花莲县', '台东县', '澎湖县', '金门县', '连江县'],
      hongkong: ['中西区', '湾仔区', '东区', '南区', '油尖旺区', '深水埗区', '九龙城区', '黄大仙区', '观塘区', '葵青区', '荃湾区', '屯门区', '元朗区', '北区', '大埔区', '沙田区', '西贡区', '离岛区'],
      macau: ['花地玛堂区', '圣安多尼堂区', '大堂区', '望德堂区', '风顺堂区', '嘉模堂区', '圣方济各堂区']
    };

    chinaRegions.forEach((region) => {
      const catalog = provinceCityCatalog[region.id];
      if (catalog) {
        region.totalCities = catalog.length;
        region.checked = region.cities.length > 0;
      }
    });

    const checkedCountryMeta = {
      日本: { photoCount: 18, date: '2025-11-18' },
      新加坡: { photoCount: 9, date: '2025-08-06' },
      法国: { photoCount: 16, date: '2025-11-12' },
      埃及: { photoCount: 8, date: '2024-10-03' },
      美国: { photoCount: 15, date: '2024-06-21' }
    };

    function makeCountries(names) {
      return names.map((name) => {
        const meta = checkedCountryMeta[name] || {};
        return {
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          checked: Boolean(checkedCountryMeta[name]),
          photoCount: meta.photoCount || 0,
          date: meta.date || ''
        };
      });
    }

    const worldRegions = [
      {
        continent: '亚洲',
        code: 'AS',
        countries: makeCountries([
          '阿富汗', '亚美尼亚', '阿塞拜疆', '巴林', '孟加拉国', '不丹', '文莱', '柬埔寨',
          '中国', '塞浦路斯', '格鲁吉亚', '印度', '印度尼西亚', '伊朗', '伊拉克', '以色列',
          '日本', '约旦', '哈萨克斯坦', '科威特', '吉尔吉斯斯坦', '老挝', '黎巴嫩', '马来西亚',
          '马尔代夫', '蒙古', '缅甸', '尼泊尔', '朝鲜', '阿曼', '巴基斯坦', '巴勒斯坦',
          '菲律宾', '卡塔尔', '沙特阿拉伯', '新加坡', '韩国', '斯里兰卡', '叙利亚', '塔吉克斯坦',
          '泰国', '东帝汶', '土耳其', '土库曼斯坦', '阿联酋', '乌兹别克斯坦', '越南', '也门'
        ])
      },
      {
        continent: '欧洲',
        code: 'EU',
        countries: makeCountries([
          '阿尔巴尼亚', '安道尔', '奥地利', '白俄罗斯', '比利时', '波黑', '保加利亚', '克罗地亚',
          '捷克', '丹麦', '爱沙尼亚', '芬兰', '法国', '德国', '希腊', '匈牙利',
          '冰岛', '爱尔兰', '意大利', '拉脱维亚', '列支敦士登', '立陶宛', '卢森堡', '马耳他',
          '摩尔多瓦', '摩纳哥', '黑山', '荷兰', '北马其顿', '挪威', '波兰', '葡萄牙',
          '罗马尼亚', '俄罗斯', '圣马力诺', '塞尔维亚', '斯洛伐克', '斯洛文尼亚', '西班牙', '瑞典',
          '瑞士', '乌克兰', '英国', '梵蒂冈'
        ])
      },
      {
        continent: '非洲',
        code: 'AF',
        countries: makeCountries([
          '阿尔及利亚', '安哥拉', '贝宁', '博茨瓦纳', '布基纳法索', '布隆迪', '佛得角', '喀麦隆',
          '中非', '乍得', '科摩罗', '刚果共和国', '刚果民主共和国', '科特迪瓦', '吉布提', '埃及',
          '赤道几内亚', '厄立特里亚', '斯威士兰', '埃塞俄比亚', '加蓬', '冈比亚', '加纳', '几内亚',
          '几内亚比绍', '肯尼亚', '莱索托', '利比里亚', '利比亚', '马达加斯加', '马拉维', '马里',
          '毛里塔尼亚', '毛里求斯', '摩洛哥', '莫桑比克', '纳米比亚', '尼日尔', '尼日利亚', '卢旺达',
          '圣多美和普林西比', '塞内加尔', '塞舌尔', '塞拉利昂', '索马里', '南非', '南苏丹', '苏丹',
          '坦桑尼亚', '多哥', '突尼斯', '乌干达', '赞比亚', '津巴布韦'
        ])
      },
      {
        continent: '北美洲',
        code: 'NA',
        countries: makeCountries([
          '安提瓜和巴布达', '巴哈马', '巴巴多斯', '伯利兹', '加拿大', '哥斯达黎加', '古巴', '多米尼克',
          '多米尼加', '萨尔瓦多', '格林纳达', '危地马拉', '海地', '洪都拉斯', '牙买加', '墨西哥',
          '尼加拉瓜', '巴拿马', '圣基茨和尼维斯', '圣卢西亚', '圣文森特和格林纳丁斯', '特立尼达和多巴哥', '美国'
        ])
      },
      {
        continent: '南美洲',
        code: 'SA',
        countries: makeCountries([
          '阿根廷', '玻利维亚', '巴西', '智利', '哥伦比亚', '厄瓜多尔',
          '圭亚那', '巴拉圭', '秘鲁', '苏里南', '乌拉圭', '委内瑞拉'
        ])
      },
      {
        continent: '大洋洲',
        code: 'OC',
        countries: makeCountries([
          '澳大利亚', '斐济', '基里巴斯', '马绍尔群岛', '密克罗尼西亚', '瑙鲁', '新西兰',
          '帕劳', '巴布亚新几内亚', '萨摩亚', '所罗门群岛', '汤加', '图瓦卢', '瓦努阿图'
        ])
      },
      {
        continent: '极地',
        code: 'PO',
        regionType: 'special',
        countries: makeCountries(['南极洲', '北极地区'])
      }
    ];

    function formatPercent(value, digits = 1) {
      const fixed = Number(value).toFixed(digits);
      return fixed.replace(/\.0$/, '');
    }

    function getRegularWorldGroups() {
      return worldRegions.filter((group) => group.regionType !== 'special');
    }

    function getSpecialWorldGroups() {
      return worldRegions.filter((group) => group.regionType === 'special');
    }

    function getChinaStats() {
      const totalProvinceCount = chinaRegions.length;
      const checkedProvinceCount = chinaRegions.filter((region) => region.checked).length;
      const checkedCityCount = chinaRegions.reduce((sum, region) => sum + region.cities.length, 0);
      const totalCityCount = chinaRegions.reduce((sum, region) => sum + (region.totalCities || getProvinceCities(region).length), 0);
      const photoCount = chinaRegions.reduce((sum, region) => sum + (region.photoCount || 0), 0);
      const progress = totalProvinceCount ? (checkedProvinceCount / totalProvinceCount) * 100 : 0;

      return {
        checkedProvinceCount,
        totalProvinceCount,
        checkedCityCount,
        totalCityCount,
        photoCount,
        progress,
        progressText: `${formatPercent(progress)}%`
      };
    }

    function getWorldStats() {
      const regularGroups = getRegularWorldGroups();
      const specialGroups = getSpecialWorldGroups();
      const regularCountries = regularGroups.flatMap((group) => group.countries);
      const specialRegions = specialGroups.flatMap((group) => group.countries);
      const checkedCountries = regularCountries.filter((country) => country.checked);
      const checkedSpecialRegions = specialRegions.filter((country) => country.checked);
      const exploredContinentCount = regularGroups.filter((group) => group.countries.some((country) => country.checked)).length;
      const progress = regularCountries.length ? (checkedCountries.length / regularCountries.length) * 100 : 0;
      const photoCount = [...regularCountries, ...specialRegions].reduce((sum, country) => sum + (country.photoCount || 0), 0);

      return {
        checkedCountryCount: checkedCountries.length,
        totalCountryCount: regularCountries.length,
        checkedSpecialRegionCount: checkedSpecialRegions.length,
        totalSpecialRegionCount: specialRegions.length,
        exploredContinentCount,
        photoCount,
        progress,
        progressText: `${formatPercent(progress, 2)}%`
      };
    }

    function getOverviewStats() {
      const china = getChinaStats();
      const world = getWorldStats();
      const totalPhotoCount = china.photoCount + world.photoCount;
      const totalCheckins = china.checkedCityCount + world.checkedCountryCount + world.checkedSpecialRegionCount;

      return {
        china,
        world,
        totalPhotoCount,
        totalCheckins,
        recentPlace: '杭州',
        streakDays: 7,
        thisYearNewPlaces: totalCheckins
      };
    }

    function buildUserStats() {
      const stats = getOverviewStats();
      return [
        { label: '已打卡省份', value: `${stats.china.checkedProvinceCount}/${stats.china.totalProvinceCount}`, icon: 'map', hint: `中国探索 ${stats.china.progressText}` },
        { label: '已打卡城市/地区', value: String(stats.china.checkedCityCount), icon: 'map-pin', hint: `总收录 ${stats.china.totalCityCount}` },
        { label: '已打卡国家', value: `${stats.world.checkedCountryCount}/${stats.world.totalCountryCount}`, icon: 'globe-2', hint: `世界探索 ${stats.world.progressText}` },
        { label: '旅行照片', value: String(stats.totalPhotoCount), icon: 'images', hint: `中国 ${stats.china.photoCount} · 世界 ${stats.world.photoCount}` },
        { label: '总打卡', value: String(stats.totalCheckins), icon: 'badge-check', hint: '按已点亮地点统计' },
        { label: '最近打卡', value: stats.recentPlace, icon: 'navigation', hint: '3 天前' },
        { label: '连续记录', value: `${stats.streakDays} 天`, icon: 'flame', hint: '保持节奏' },
        { label: '今年新增', value: `${stats.thisYearNewPlaces} 地`, icon: 'sparkles', hint: '2026' }
      ];
    }

    function setStatText(name, value) {
      document.querySelectorAll(`[data-stat="${name}"]`).forEach((item) => {
        item.textContent = value;
      });
    }

    function setStatBar(name, progress) {
      document.querySelectorAll(`[data-stat-bar="${name}"]`).forEach((item) => {
        item.style.width = `${Math.max(progress, progress > 0 ? 3 : 0)}%`;
      });
    }

    function renderDerivedStats() {
      const stats = getOverviewStats();
      userStats = buildUserStats();

      setStatText('home-total-checkins', `${stats.totalCheckins} 次打卡`);
      setStatText('home-china-provinces', `${stats.china.checkedProvinceCount} / ${stats.china.totalProvinceCount}`);
      setStatText('home-china-cities', `已打卡 ${stats.china.checkedCityCount} 个城市/地区`);
      setStatText('home-china-progress', stats.china.progressText);
      setStatBar('home-china-progress', stats.china.progress);
      setStatText('home-world-countries', `${stats.world.checkedCountryCount} / ${stats.world.totalCountryCount}`);
      setStatText('home-world-count', `已打卡 ${stats.world.checkedCountryCount} 个国家`);
      setStatText('home-world-progress', stats.world.progressText);
      setStatBar('home-world-progress', stats.world.progress);
      setStatText('home-province-count', String(stats.china.checkedProvinceCount));
      setStatText('home-province-total', `/ ${stats.china.totalProvinceCount}`);
      setStatText('home-city-count', String(stats.china.checkedCityCount));
      setStatText('home-photo-count', String(stats.totalPhotoCount));
      setStatText('china-header-count', `已打卡 ${stats.china.checkedProvinceCount} 个省级地区`);
      setStatText('china-header-progress', `探索度 ${stats.china.progressText}`);
      setStatText('world-header-country-count', String(stats.world.checkedCountryCount));
      setStatText('world-header-progress', stats.world.progressText);
      setStatText('world-header-continent-count', String(stats.world.exploredContinentCount));
    }

    function validateMockData() {
      const warnings = [];
      const chinaStats = getChinaStats();
      const worldStats = getWorldStats();
      const chinaIds = new Set();
      const countryIds = new Set();

      chinaRegions.forEach((region) => {
        if (chinaIds.has(region.id)) {
          warnings.push(`重复的中国地区 id: ${region.id}`);
        }
        chinaIds.add(region.id);

        const catalog = provinceCityCatalog[region.id] || [];
        region.cities.forEach((city) => {
          if (!catalog.includes(city)) {
            warnings.push(`${region.name} 的已打卡城市/地区不在目录中: ${city}`);
          }
        });
      });

      worldRegions.forEach((group) => {
        group.countries.forEach((country) => {
          if (countryIds.has(country.id)) {
            warnings.push(`重复的世界地区 id: ${country.id}`);
          }
          countryIds.add(country.id);
        });
      });

      if (chinaStats.totalProvinceCount !== 34) warnings.push(`中国省级地区数量应为 34，当前为 ${chinaStats.totalProvinceCount}`);
      if ((provinceCityCatalog.taiwan || []).length !== 22) warnings.push(`台湾县市数量应为 22，当前为 ${(provinceCityCatalog.taiwan || []).length}`);
      if (worldStats.totalCountryCount !== 195) warnings.push(`世界常规国家数量应为 195，当前为 ${worldStats.totalCountryCount}`);
      if (worldStats.totalSpecialRegionCount !== 2) warnings.push(`极地特殊地区数量应为 2，当前为 ${worldStats.totalSpecialRegionCount}`);

      if (warnings.length) {
        console.warn('[Travel Glow mock data warnings]', warnings);
      } else {
        console.info('[Travel Glow mock data ok]', {
          chinaProvinceCount: chinaStats.totalProvinceCount,
          taiwanCityCount: provinceCityCatalog.taiwan.length,
          worldCountryCount: worldStats.totalCountryCount,
          polarRegionCount: worldStats.totalSpecialRegionCount
        });
      }
    }

    let selectedChinaRegionId = '';
    let selectedCountryId = '';

    function provinceTileClasses(region) {
      if (region.id === selectedChinaRegionId) {
        return 'province-tile is-selected border-yellow-300 bg-yellow-300/20 text-yellow-100 shadow-[0_0_26px_rgba(250,204,21,.30)]';
      }
      if (region.checked) {
        return 'province-tile is-lit border-cyan-300/70 bg-cyan-400/20 text-cyan-100 shadow-[0_0_26px_rgba(6,182,212,.28)]';
      }
      return 'province-tile border-slate-700 bg-slate-800/70 text-slate-500 opacity-80';
    }

    function countryTileClasses(country) {
      if (country.id === selectedCountryId) {
        return 'country-tile is-selected border-yellow-300 bg-yellow-300/20 text-yellow-100 shadow-[0_0_24px_rgba(250,204,21,.28)]';
      }
      if (country.checked) {
        return 'country-tile is-lit border-cyan-300/70 bg-cyan-400/20 text-cyan-100 shadow-[0_0_24px_rgba(6,182,212,.28)]';
      }
      return 'country-tile border-slate-700 bg-slate-800/70 text-slate-500';
    }

    function cityTileClasses(checked) {
      if (checked) {
        return 'country-tile is-lit border-cyan-300/70 bg-cyan-400/20 text-cyan-100 shadow-[0_0_22px_rgba(6,182,212,.24)]';
      }
      return 'country-tile border-slate-700 bg-slate-800/70 text-slate-500';
    }

    function getProvinceCities(region) {
      const catalog = provinceCityCatalog[region.id] || region.cities;
      const names = [...new Set([...region.cities, ...catalog])];
      return names.map((name) => ({
        name,
        checked: region.cities.includes(name)
      }));
    }

    function getProvinceProgress(region) {
      const completed = region.cities.length;
      const visibleTotal = getProvinceCities(region).length;
      const total = Math.max(region.totalCities || 0, visibleTotal, completed, 1);
      return {
        completed,
        total,
        progress: Math.round((completed / total) * 100)
      };
    }

    function openProvinceDrawer(region) {
      const cityItems = getProvinceCities(region);
      const { completed, total, progress } = getProvinceProgress(region);
      const cities = completed ? region.cities.join('、') : '暂无打卡城市/地区';
      const regionNote = region.id === 'macau' ? '<p class="mt-2 text-xs text-[#FACC15]">澳门当前按堂区/主要区域作为可打卡地区。</p>' : '';
      const html = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm ${region.checked ? 'text-[#06B6D4]' : 'text-[#4B5563]'}">${region.checked ? '已有打卡记录' : '暂无打卡记录'}</p>
            <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">省份详情 · ${region.name}</h2>
            <p class="mt-2 text-sm text-[#9CA3AF]">已打卡城市/地区：${cities}</p>
            ${regionNote}
          </div>
          <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>
        <div class="mt-5 grid grid-cols-3 gap-3">
          <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4">
            <p class="text-2xl font-semibold text-[#F9FAFB]">${completed}</p>
            <p class="mt-1 text-xs text-[#9CA3AF]">已打卡城市/地区</p>
          </div>
          <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4">
            <p class="text-2xl font-semibold text-[#F9FAFB]">${region.photoCount}</p>
            <p class="mt-1 text-xs text-[#9CA3AF]">照片数量</p>
          </div>
          <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4">
            <p class="text-2xl font-semibold text-[#06B6D4]">${progress}%</p>
            <p class="mt-1 text-xs text-[#9CA3AF]">完成度</p>
          </div>
        </div>
        <div class="mt-5 rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4">
          <div class="mb-3 flex items-center justify-between text-sm">
            <span class="text-[#9CA3AF]">城市/地区进度</span>
            <span class="text-[#F9FAFB]">${completed} / ${total}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-slate-800">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" style="width:${Math.max(progress, region.checked ? 8 : 0)}%"></div>
          </div>
        </div>
        <div class="mt-5 rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-[#F9FAFB]">城市/地区列表</p>
              <p class="mt-1 text-xs text-[#9CA3AF]">已打卡城市/地区为青蓝色，未打卡城市/地区为暗灰色</p>
            </div>
            <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-[#06B6D4]">${completed}/${total}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            ${cityItems.map((city) => `
              <button class="${cityTileClasses(city.checked)} min-h-[54px] rounded-2xl border px-3 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03]">
                <span class="block text-sm font-semibold">${city.name}</span>
                <span class="mt-1 block text-[11px] opacity-75">${city.checked ? '已打卡' : '未打卡'}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      openDrawer(html);
    }

    function openCountryDrawer(country, continent, regionType = 'country') {
      const detailTitle = regionType === 'special' ? '特殊地区详情' : '国家详情';
      const statusLabel = regionType === 'special' ? '地区状态' : '打卡状态';
      const specialNote = regionType === 'special'
        ? '<p class="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-100">这是世界探索中的特殊地区，不计入 195 个国家总数。</p>'
        : '';
      const html = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm ${country.checked ? 'text-[#06B6D4]' : 'text-[#4B5563]'}">${country.checked ? '已有打卡记录' : '暂无打卡记录'}</p>
            <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${detailTitle} · ${country.name}</h2>
            <p class="mt-2 text-sm text-[#9CA3AF]">${continent} · ${country.checked ? `打卡日期 ${country.date}` : '尚未添加打卡'}</p>
          </div>
          <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4">
            <p class="text-2xl font-semibold text-[#F9FAFB]">${country.photoCount}</p>
            <p class="mt-1 text-xs text-[#9CA3AF]">照片数量</p>
          </div>
          <div class="rounded-2xl border border-cyan-300/10 bg-[#030712]/70 p-4">
            <p class="text-2xl font-semibold ${country.checked ? 'text-[#06B6D4]' : 'text-[#4B5563]'}">${country.checked ? '已完成' : '待打卡'}</p>
            <p class="mt-1 text-xs text-[#9CA3AF]">${statusLabel}</p>
          </div>
        </div>
        ${specialNote}
      `;
      openDrawer(html);
    }

    function renderChinaMap() {
      const grid = document.getElementById('china-region-grid');
      if (!grid) return;
      grid.innerHTML = chinaRegionGroups.map((group) => {
        const regions = group.ids.map((id) => chinaRegions.find((region) => region.id === id)).filter(Boolean);
        const checkedCount = regions.filter((region) => region.checked).length;
        return `
          <section id="continent-${group.code}" class="continent-panel scroll-mt-24 rounded-3xl border border-cyan-300/10 p-4 shadow-[0_0_28px_rgba(6,182,212,.08)] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-xs text-[#4B5563]">${group.code}</p>
                <h3 class="text-lg font-semibold text-[#F9FAFB]">${group.name}</h3>
              </div>
              <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-[#06B6D4]">${checkedCount}/${regions.length}</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${regions.map((region) => {
                const { completed, total, progress } = getProvinceProgress(region);
                return `
                  <button
                    class="${provinceTileClasses(region)} min-h-[92px] rounded-2xl border px-3 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03]"
                    data-province-id="${region.id}">
                    <span class="flex items-start justify-between gap-2">
                      <span>
                        <span class="block text-sm font-semibold">${region.name}</span>
                        <span class="mt-1 block text-[11px] opacity-75">${region.checked ? `${completed} 城 · ${region.photoCount} 图` : '未打卡'}</span>
                      </span>
                      <span class="text-[11px] font-semibold opacity-90">${progress}%</span>
                    </span>
                    <span class="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-900/70">
                      <span class="block h-full rounded-full ${region.checked ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-slate-700'}" style="width:${Math.max(progress, region.checked ? 8 : 4)}%"></span>
                    </span>
                <span class="mt-2 block text-[10px] opacity-60">${completed}/${total} 城市/地区</span>
                  </button>
                `;
              }).join('')}
            </div>
          </section>
        `;
      }).join('');
      grid.querySelectorAll('[data-province-id]').forEach((tile) => {
        tile.addEventListener('click', () => {
          selectedChinaRegionId = tile.dataset.provinceId;
          const region = chinaRegions.find((item) => item.id === selectedChinaRegionId);
          renderChinaMap();
          openProvinceDrawer(region);
        });
      });
    }

    function renderWorldMap() {
      const grid = document.getElementById('world-region-grid');
      if (!grid) return;
      grid.innerHTML = worldRegions.map((group) => {
        const checkedCount = group.countries.filter((country) => country.checked).length;
        const groupLabel = group.regionType === 'special' ? '特殊地区' : '国家';
        return `
          <section id="continent-${group.code}" data-continent-code="${group.code}" class="continent-panel scroll-mt-24 rounded-3xl border border-cyan-300/10 p-4 shadow-[0_0_28px_rgba(6,182,212,.08)] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-xs text-[#4B5563]">${group.code}</p>
                <h3 class="text-lg font-semibold text-[#F9FAFB]">${group.continent}</h3>
              </div>
              <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-[#06B6D4]">${checkedCount}/${group.countries.length} ${groupLabel}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              ${group.countries.map((country) => `
                <button
                  class="${countryTileClasses(country)} min-h-[54px] rounded-2xl border px-3 py-2 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03]"
                  data-country-id="${country.id}"
                  data-continent="${group.continent}">
                  <span class="block text-sm font-semibold">${country.name}</span>
                  <span class="mt-1 block text-[11px] opacity-75">${country.checked ? `${country.photoCount} 图` : groupLabel}</span>
                </button>
              `).join('')}
            </div>
          </section>
        `;
      }).join('');
      grid.querySelectorAll('[data-country-id]').forEach((tile) => {
        tile.addEventListener('click', () => {
          selectedCountryId = tile.dataset.countryId;
          const group = worldRegions.find((item) => item.continent === tile.dataset.continent);
          const country = group.countries.find((item) => item.id === selectedCountryId);
          renderWorldMap();
          openCountryDrawer(country, group.continent, group.regionType);
        });
      });
    }

    navItems.forEach((item) => {
      item.addEventListener('click', () => setTab(item.dataset.tab));
    });

    function bindTabTargetControls() {
      document.querySelectorAll('[data-tab-target]').forEach((item) => {
        if (item.dataset.tabTargetBound === 'true') return;
        item.addEventListener('click', () => setTab(item.dataset.tabTarget));
        item.dataset.tabTargetBound = 'true';
      });
    }

    bindTabTargetControls();

    function scrollToSection(targetId) {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }
      const fixedOffset = 92;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - fixedOffset);
      window.scrollTo({ top, behavior: 'smooth' });
    }

    function scrollToElement(element) {
      if (!element) return;
      const fixedOffset = 92;
      const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - fixedOffset);
      window.scrollTo({ top, behavior: 'smooth' });
    }

    function bindSearchControls() {
      const chinaInput = document.getElementById('china-search-input');
      const chinaButton = document.getElementById('china-search-button');
      const chinaClear = document.getElementById('china-search-clear');
      const chinaResults = document.getElementById('china-search-results');
      const worldInput = document.getElementById('world-search-input');
      const worldButton = document.getElementById('world-search-button');
      const worldClear = document.getElementById('world-search-clear');
      const worldResults = document.getElementById('world-search-results');
      if (!chinaInput || !chinaButton || !chinaClear || !chinaResults || !worldInput || !worldButton || !worldClear || !worldResults) return;

      function hideResults(results) {
        results.classList.add('hidden');
        results.innerHTML = '';
      }

      function toggleClearButton(input, button) {
        button.classList.toggle('hidden', !input.value.trim());
      }

      function clearSearch(input, results, button) {
        input.value = '';
        hideResults(results);
        toggleClearButton(input, button);
        input.focus();
      }

      function pulseElement(element) {
        if (!element) return;
        element.classList.remove('target-flash');
        void element.offsetWidth;
        element.classList.add('target-flash');
      }

      function renderSearchResults(results, matches, onSelect) {
        if (!matches.length) {
          results.innerHTML = '<div class="px-3 py-2 text-sm text-[#9CA3AF]">没有匹配结果</div>';
          results.classList.remove('hidden');
          return;
        }
        results.innerHTML = matches.map((match, index) => `
          <button class="search-result-item flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all duration-300 ease-out hover:bg-cyan-400/10" data-index="${index}">
            <span>
              <span class="block text-sm font-medium text-[#F9FAFB]">${match.title}</span>
              <span class="mt-0.5 block text-xs text-[#9CA3AF]">${match.subtitle}</span>
            </span>
            <i data-lucide="arrow-right" class="h-4 w-4 text-[#06B6D4]"></i>
          </button>
        `).join('');
        results.classList.remove('hidden');
        createIcons();
        results.querySelectorAll('.search-result-item').forEach((button) => {
          button.addEventListener('click', () => {
            hideResults(results);
            onSelect(matches[Number(button.dataset.index)]);
          });
        });
      }

      function getChinaMatches(keyword) {
        if (!keyword) return [];
        const matches = [];
        chinaRegions.forEach((region) => {
          if (region.name.includes(keyword) || region.short === keyword) {
            matches.push({ type: 'province', title: region.name, subtitle: `省级地区 · ${region.cities.length}/${getProvinceProgress(region).total} 城市/地区`, region });
          }
          getProvinceCities(region).forEach((city) => {
            if (city.name.includes(keyword)) {
              matches.push({ type: 'city', title: city.name, subtitle: `${region.name} · ${city.checked ? '已打卡' : '未打卡'}`, region, city });
            }
          });
        });
        return matches.slice(0, 8);
      }

      function getWorldMatches(keyword) {
        if (!keyword) return [];
        const matches = [];
        worldRegions.forEach((group) => {
          group.countries.forEach((country) => {
            if (country.name.includes(keyword)) {
              matches.push({ title: country.name, subtitle: `${group.continent} · ${country.checked ? '已打卡' : '未打卡'}`, group, country });
            }
          });
        });
        return matches.slice(0, 10);
      }

      function selectChinaMatch(match) {
        const region = match.region;
        chinaInput.value = match.title;
        setTab('china', { scrollTop: false });
        selectedChinaRegionId = region.id;
        renderChinaMap();
        requestAnimationFrame(() => {
          const tile = document.querySelector(`[data-province-id="${region.id}"]`);
          scrollToElement(tile);
          pulseElement(tile);
          window.setTimeout(() => openProvinceDrawer(region), 260);
        });
      }

      function selectWorldMatch(match) {
        worldInput.value = match.title;
        setTab('world', { scrollTop: false });
        selectedCountryId = match.country.id;
        renderWorldMap();
        requestAnimationFrame(() => {
          const tile = document.querySelector(`[data-country-id="${match.country.id}"]`);
          scrollToElement(tile);
          pulseElement(tile);
          window.setTimeout(() => openCountryDrawer(match.country, match.group.continent, match.group.regionType), 260);
        });
      }

      function runChinaSearch() {
        const keyword = chinaInput.value.trim();
        if (!keyword) return;
        const matches = getChinaMatches(keyword);
        if (!matches.length) {
          openNotFoundDrawer(keyword, '中国地区');
          return;
        }
        selectChinaMatch(matches[0]);
      }

      function runWorldSearch() {
        const keyword = worldInput.value.trim();
        if (!keyword) return;
        const matches = getWorldMatches(keyword);
        if (!matches.length) {
          openNotFoundDrawer(keyword, '世界国家');
          return;
        }
        selectWorldMatch(matches[0]);
      }

      if (chinaInput.dataset.searchControlsBound !== 'true') {
        chinaInput.addEventListener('input', () => {
          const keyword = chinaInput.value.trim();
          toggleClearButton(chinaInput, chinaClear);
          if (!keyword) {
            hideResults(chinaResults);
            return;
          }
          renderSearchResults(chinaResults, getChinaMatches(keyword), selectChinaMatch);
        });
        chinaClear.addEventListener('click', () => clearSearch(chinaInput, chinaResults, chinaClear));
        chinaButton.addEventListener('click', runChinaSearch);
        chinaInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            hideResults(chinaResults);
            runChinaSearch();
          } else if (event.key === 'Escape') {
            clearSearch(chinaInput, chinaResults, chinaClear);
          }
        });
        chinaInput.dataset.searchControlsBound = 'true';
      }

      if (worldInput.dataset.searchControlsBound !== 'true') {
        worldInput.addEventListener('input', () => {
          const keyword = worldInput.value.trim();
          toggleClearButton(worldInput, worldClear);
          if (!keyword) {
            hideResults(worldResults);
            return;
          }
          renderSearchResults(worldResults, getWorldMatches(keyword), selectWorldMatch);
        });
        worldClear.addEventListener('click', () => clearSearch(worldInput, worldResults, worldClear));
        worldButton.addEventListener('click', runWorldSearch);
        worldInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            hideResults(worldResults);
            runWorldSearch();
          } else if (event.key === 'Escape') {
            clearSearch(worldInput, worldResults, worldClear);
          }
        });
        worldInput.dataset.searchControlsBound = 'true';
      }

      if (!documentSearchDismissBound) {
        document.addEventListener('click', (event) => {
          const currentChinaInput = document.getElementById('china-search-input');
          const currentChinaResults = document.getElementById('china-search-results');
          const currentWorldInput = document.getElementById('world-search-input');
          const currentWorldResults = document.getElementById('world-search-results');
          const chinaWrapper = currentChinaInput?.closest('.relative');
          const worldWrapper = currentWorldInput?.closest('.relative');
          if (currentChinaResults && chinaWrapper && !chinaWrapper.contains(event.target)) hideResults(currentChinaResults);
          if (currentWorldResults && worldWrapper && !worldWrapper.contains(event.target)) hideResults(currentWorldResults);
        });
        documentSearchDismissBound = true;
      }
    }

    function setPillActive(button, selector) {
      document.querySelectorAll(selector).forEach((item) => {
        const active = item === button;
        item.classList.toggle('bg-cyan-400/10', active);
        item.classList.toggle('border-cyan-400/20', active);
        item.classList.toggle('text-[#06B6D4]', active);
        item.classList.toggle('drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]', active);
        item.classList.toggle('bg-[#030712]/60', !active);
        item.classList.toggle('border-[#1F2937]', !active);
        item.classList.toggle('text-[#9CA3AF]', !active);
      });
    }

    function bindWorldJumps() {
      document.querySelectorAll('.world-jump').forEach((button) => {
        if (button.dataset.worldJumpBound === 'true') return;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          setPillActive(button, '.world-jump');
          setTab('world', { scrollTop: false });
          requestAnimationFrame(() => {
            scrollToSection(button.dataset.continentTarget);
          });
        });
        button.dataset.worldJumpBound = 'true';
      });
    }

    bindWorldJumps();

    document.querySelectorAll('.album-jump').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        setPillActive(button, '.album-jump');
        setTab('album', { scrollTop: false });
        requestAnimationFrame(() => {
          scrollToSection(button.dataset.albumTarget);
        });
      });
    });

    document.getElementById('fab').addEventListener('click', openAddDrawer);
    document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);

    document.querySelectorAll('[data-drawer="place"]').forEach((item) => {
      item.addEventListener('click', () => {
        openPlaceDrawer(item.dataset.title, item.dataset.meta, item.dataset.note, item.dataset.lit !== 'false');
      });
    });

    document.querySelectorAll('.world-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        openPlaceDrawer(`国家详情 · ${chip.dataset.title}`, chip.dataset.meta, chip.dataset.note, true);
      });
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    });

    const API_BASE = '/api';
    const TOKEN_KEY = 'travel-glow-token';

    let appStats = null;
    let appPhotos = [];
    let appCheckins = [];
    let appChinaLit = { litProvinceIds: [], litCityIds: [] };
    let appWorldLit = { litCountryIds: [], litSpecialRegionIds: [] };
    let documentSearchDismissBound = false;

    function getToken() {
      return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
      localStorage.setItem(TOKEN_KEY, token);
    }

    async function apiFetch(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      await window.TravelGlowCsrf?.apply?.(headers, options);

      const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      window.TravelGlowCsrf?.capture?.(response);
      if (response.status === 401 && path !== '/auth/login') {
        localStorage.removeItem(TOKEN_KEY);
        window.TravelGlowAccount?.clearToken?.();
        window.TravelGlowAccount?.openLoginDrawer?.();
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || '请求失败');
      }
      return data;
    }

    async function ensureLogin() {
      if (getToken()) return true;
      window.TravelGlowAccount?.openLoginDrawer?.();
      throw new Error('请先登录');
    }

    async function loadProfile() {
      const profile = await apiFetch('/user/profile');
      Object.assign(userProfile, {
        nickname: profile.nickname,
        bio: profile.bio || '',
        avatar: profile.avatar || userProfile.avatar,
        level: profile.level || 1,
        exp: profile.exp || 0
      });
      syncHomeProfile();
    }

    async function loadOverviewStats() {
      appStats = await apiFetch('/stats/overview');
    }

    async function loadChinaRegions() {
      const regions = await apiFetch('/regions/china/provinces');
      chinaRegions.splice(0, chinaRegions.length, ...regions.map((region) => ({
        ...region,
        short: region.short || region.shortName,
        cities: region.cities || [],
        checked: Boolean(region.checked),
        photoCount: region.photoCount || 0,
        totalCities: region.totalCities || (provinceCityCatalog[region.id] || []).length
      })));
      appChinaLit = await apiFetch('/map/china/lit-regions');
    }

    async function loadWorldRegions() {
      const groups = await apiFetch('/regions/continents');
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
      appWorldLit = await apiFetch('/map/world/lit-regions');
    }

    async function loadPhotos() {
      appPhotos = await apiFetch('/photos');
    }

    async function loadCheckins() {
      appCheckins = await apiFetch('/checkins');
    }

    function escapeHome(value = '') {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function checkinRegion(checkin) {
      return checkin.region || {};
    }

    function checkinParentRegion(checkin) {
      const region = checkinRegion(checkin);
      return region.parent || {};
    }

    function checkinPlace(checkin) {
      const region = checkinRegion(checkin);
      const parent = checkinParentRegion(checkin);
      if (checkin.title) return checkin.title;
      if (region.type === 'city') return `${parent.name || ''} · ${region.name || ''}`.trim();
      return region.name || '未命名打卡';
    }

    function checkinMeta(checkin) {
      const region = checkinRegion(checkin);
      const parent = checkinParentRegion(checkin);
      const area = region.type === 'city' ? parent.name : (parent.name || region.type);
      return [area, formatDate(checkin.checkinDate)].filter(Boolean).join(' · ');
    }

    function renderHomeRecentCheckins() {
      const root = document.getElementById('home-recent-checkins');
      if (!root) return;

      const recent = [...appCheckins]
        .sort((a, b) => new Date(b.checkinDate).getTime() - new Date(a.checkinDate).getTime())
        .slice(0, 3);

      if (!recent.length) {
        root.innerHTML = `
          <div class="col-span-2 flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[#1F2937] bg-[#030712]/55 p-5 text-center">
            <i data-lucide="map-pin-plus" class="h-8 w-8 text-[#4B5563]"></i>
            <p class="mt-3 text-sm font-medium text-[#F9FAFB]">暂无最近打卡</p>
            <p class="mt-1 text-xs text-[#9CA3AF]">添加第一条旅行记录后会显示在这里</p>
          </div>
        `;
        return;
      }

      root.innerHTML = recent.map((checkin, index) => {
        const cover = checkin.photos?.[0] || {};
        const large = index === 0;
        const buttonClass = large ? 'col-span-2 h-44' : 'h-32';
        const titleClass = large ? 'text-base' : 'text-sm';
        const subtitle = checkinMeta(checkin) || '已有打卡';
        return `
          <button class="photo-fallback group relative ${buttonClass} overflow-hidden rounded-2xl text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]"
            data-home-photo-id="${escapeHome(cover.id || '')}"
            data-home-checkin-id="${escapeHome(checkin.id)}">
            ${cover.imageUrl ? `<img class="h-full w-full object-cover transition-all duration-300 ease-out group-hover:scale-105" alt="${escapeHome(checkinPlace(checkin))}" src="${escapeHome(safeImageUrl(cover.imageUrl, checkinPlace(checkin)))}">` : ''}
            <div class="absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-transparent"></div>
            <div class="absolute bottom-4 left-4 right-4">
              <p class="${titleClass} font-semibold text-white">${escapeHome(checkinPlace(checkin))}</p>
              <p class="mt-1 text-xs text-[#9CA3AF]">${escapeHome(subtitle)}</p>
            </div>
          </button>
        `;
      }).join('');

      root.querySelectorAll('[data-home-checkin-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const checkin = appCheckins.find((item) => item.id === button.dataset.homeCheckinId);
          const coverId = button.dataset.homePhotoId;
          const photo = appPhotos.find((item) => item.id === coverId) || checkin?.photos?.[0];
          if (!checkin || !photo) return;
          openPhotoDrawer({
            ...photo,
            checkin,
            region: checkin.region,
            parentRegion: checkin.region?.parent
          });
        });
      });
    }

    function renderHomeProvincePills() {
      const root = document.getElementById('home-province-pills');
      if (!root) return;

      const checked = chinaRegions.filter((region) => region.checked);
      if (!checked.length) {
        root.innerHTML = '<span class="rounded-full border border-[#1F2937] bg-[#030712]/60 px-3 py-1 text-sm text-[#9CA3AF]">暂无已打卡省级地区</span>';
        return;
      }

      root.innerHTML = checked.slice(0, 8).map((region) => `
        <span class="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-[#06B6D4]">${escapeHome(region.name)}</span>
      `).join('');
    }

    function renderHomeRecords() {
      renderHomeRecentCheckins();
      renderHomeProvincePills();
    }

    buildUserStats = function buildUserStatsFromApi() {
      const stats = appStats || getOverviewStats();
      return [
        { label: '已打卡省份', value: `${stats.china.checkedProvinceCount}/${stats.china.totalProvinceCount}`, icon: 'map', hint: `中国探索 ${stats.china.progressText}` },
        { label: '已打卡城市/地区', value: String(stats.china.checkedCityCount), icon: 'map-pin', hint: `总收录 ${stats.china.totalCityCount}` },
        { label: '已打卡国家', value: `${stats.world.checkedCountryCount}/${stats.world.totalCountryCount}`, icon: 'globe-2', hint: `世界探索 ${stats.world.progressText}` },
        { label: '旅行照片', value: String(stats.totalPhotoCount), icon: 'images', hint: `中国 ${stats.china.photoCount} · 世界 ${stats.world.photoCount}` },
        { label: '总打卡', value: String(stats.totalCheckins), icon: 'badge-check', hint: '数据库实时统计' },
        { label: '最近打卡', value: stats.recentPlace, icon: 'navigation', hint: '最近一条记录' },
        { label: '连续记录', value: `${stats.streakDays} 天`, icon: 'flame', hint: '按日期计算' },
        { label: '今年新增', value: `${stats.thisYearNewPlaces} 地`, icon: 'sparkles', hint: String(new Date().getFullYear()) }
      ];
    };

    renderDerivedStats = function renderDerivedStatsFromApi() {
      const stats = appStats || getOverviewStats();
      userStats = buildUserStats();
      setStatText('home-total-checkins', `${stats.totalCheckins} 次打卡`);
      setStatText('home-china-provinces', `${stats.china.checkedProvinceCount} / ${stats.china.totalProvinceCount}`);
      setStatText('home-china-cities', `已打卡 ${stats.china.checkedCityCount} 个城市/地区`);
      setStatText('home-china-progress', stats.china.progressText);
      setStatBar('home-china-progress', stats.china.progress);
      setStatText('home-world-countries', `${stats.world.checkedCountryCount} / ${stats.world.totalCountryCount}`);
      setStatText('home-world-count', `已打卡 ${stats.world.checkedCountryCount} 个国家`);
      setStatText('home-world-progress', stats.world.progressText);
      setStatBar('home-world-progress', stats.world.progress);
      setStatText('home-province-count', String(stats.china.checkedProvinceCount));
      setStatText('home-province-total', `/ ${stats.china.totalProvinceCount}`);
      setStatText('home-city-count', String(stats.china.checkedCityCount));
      setStatText('home-photo-count', String(stats.totalPhotoCount));
      setStatText('china-header-count', `已打卡 ${stats.china.checkedProvinceCount} 个省级地区`);
      setStatText('china-header-progress', `探索度 ${stats.china.progressText}`);
      setStatText('world-header-country-count', String(stats.world.checkedCountryCount));
      setStatText('world-header-progress', stats.world.progressText);
      setStatText('world-header-continent-count', String(stats.world.exploredContinentCount));
      renderHomeRecords();
    };

    function formatDate(dateValue) {
      if (!dateValue) return '';
      return new Date(dateValue).toISOString().slice(0, 10);
    }

    function photoPlace(photo) {
      const region = photo.region || photo.checkin?.region || {};
      const parent = photo.parentRegion || region.parent || {};
      return region.type === 'city' ? `${parent.name || ''} · ${region.name}` : `${parent.name || ''} · ${region.name}`;
    }

    function renderAlbumPage() {
      const page = document.getElementById('page-album');
      if (!page) return;
      const chinaPhotos = appPhotos.filter((photo) => (photo.region || photo.checkin?.region)?.type === 'city');
      const worldPhotos = appPhotos.filter((photo) => ['country', 'special'].includes((photo.region || photo.checkin?.region)?.type));

      function escapeAlbum(value = '') {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function getPhotoRegion(photo) {
        return photo.region || photo.checkin?.region || {};
      }

      function getPhotoParent(photo) {
        const region = getPhotoRegion(photo);
        return photo.parentRegion || region.parent || {};
      }

      function photoTime(photo) {
        const value = photo.date || photo.checkin?.checkinDate || photo.createdAt;
        return value ? new Date(value).getTime() || 0 : 0;
      }

      function sortByLatest(items) {
        return items.sort((a, b) => {
          const left = Array.isArray(a.photos) ? photoTime(a.photos[0]) : photoTime(a);
          const right = Array.isArray(b.photos) ? photoTime(b.photos[0]) : photoTime(b);
          return right - left;
        });
      }

      function buildChinaAlbumGroups(photos) {
        const provinceMap = new Map();
        photos.forEach((photo) => {
          const region = getPhotoRegion(photo);
          const parent = getPhotoParent(photo);
          const provinceName = parent.name || '未归属省份';
          const provinceKey = parent.id || provinceName;
          if (!provinceMap.has(provinceKey)) {
            provinceMap.set(provinceKey, {
              key: provinceKey,
              name: provinceName,
              photos: [],
              cityMap: new Map()
            });
          }
          const province = provinceMap.get(provinceKey);
          province.photos.push(photo);

          const cityName = region.name || '未命名城市';
          const cityKey = region.id || cityName;
          if (!province.cityMap.has(cityKey)) {
            province.cityMap.set(cityKey, { key: cityKey, name: cityName, photos: [] });
          }
          province.cityMap.get(cityKey).photos.push(photo);
        });

        return Array.from(provinceMap.values()).map((province) => {
          province.photos = sortByLatest(province.photos);
          province.cities = sortByLatest(Array.from(province.cityMap.values()).map((city) => ({
            ...city,
            photos: sortByLatest(city.photos)
          })));
          delete province.cityMap;
          return province;
        }).sort((a, b) => photoTime(b.photos[0]) - photoTime(a.photos[0]));
      }

      function buildWorldAlbumGroups(photos) {
        const countryMap = new Map();
        photos.forEach((photo) => {
          const region = getPhotoRegion(photo);
          const parent = getPhotoParent(photo);
          const countryName = region.name || '未命名国家';
          const countryKey = region.id || countryName;
          if (!countryMap.has(countryKey)) {
            countryMap.set(countryKey, {
              key: countryKey,
              name: countryName,
              continent: parent.name || '世界',
              type: region.type,
              photos: []
            });
          }
          countryMap.get(countryKey).photos.push(photo);
        });

        return Array.from(countryMap.values()).map((country) => ({
          ...country,
          photos: sortByLatest(country.photos)
        })).sort((a, b) => photoTime(b.photos[0]) - photoTime(a.photos[0]));
      }

      const chinaGroups = buildChinaAlbumGroups(chinaPhotos);
      const worldGroups = buildWorldAlbumGroups(worldPhotos);

      function normalizeAlbumSearch(value = '') {
        return String(value).trim().toLowerCase().replace(/\s+/g, '');
      }

      function fuzzyAlbumMatch(value, keyword) {
        const text = normalizeAlbumSearch(value);
        const query = normalizeAlbumSearch(keyword);
        if (!query) return false;
        if (text.includes(query)) return true;
        let cursor = 0;
        for (const char of text) {
          if (char === query[cursor]) cursor += 1;
          if (cursor === query.length) return true;
        }
        return false;
      }

      function albumSearchMatches(keyword) {
        const matches = [];
        chinaGroups.forEach((group) => {
          if (fuzzyAlbumMatch(group.name, keyword)) {
            matches.push({ mode: 'china', group, title: group.name, subtitle: `中国 · ${group.cities.length} 个城市/地区 · ${group.photos.length} 张` });
          }
          group.cities.forEach((city) => {
            if (fuzzyAlbumMatch(city.name, keyword)) {
              matches.push({ mode: 'china', group, city, title: city.name, subtitle: `${group.name} · ${city.photos.length} 张` });
            }
          });
        });
        worldGroups.forEach((group) => {
          if (fuzzyAlbumMatch(group.name, keyword) || fuzzyAlbumMatch(group.continent, keyword)) {
            matches.push({ mode: 'world', group, title: group.name, subtitle: `${group.type === 'special' ? '特殊地区' : group.continent} · ${group.photos.length} 张` });
          }
        });
        return matches.slice(0, 8);
      }

      function photoGrid(photos, emptyText) {
        if (!photos.length) {
          return `<div class="rounded-3xl border border-[#1F2937] bg-[#111827]/60 p-6 text-center text-sm text-[#9CA3AF]">${emptyText}</div>`;
        }
        return `<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          ${photos.map((photo, index) => `
            <button class="photo-fallback group relative ${index % 3 === 0 ? 'h-52 sm:h-64' : 'h-44 sm:h-56'} overflow-hidden rounded-2xl text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]" data-photo-id="${photo.id}">
              <img class="h-full w-full object-cover brightness-75 saturate-75 transition-all duration-300 ease-out group-hover:scale-105 group-hover:brightness-100 group-hover:saturate-100" alt="${escapeAlbum(photoPlace(photo))}" src="${escapeAlbum(safeImageUrl(photo.imageUrl, photoPlace(photo)))}">
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 to-transparent p-4">
                <p class="text-sm font-semibold text-white">${escapeAlbum(photoPlace(photo))}</p>
                <p class="text-xs text-[#9CA3AF]">${formatDate(photo.date || photo.checkin?.checkinDate)}</p>
              </div>
            </button>
          `).join('')}
        </div>`;
      }

      function albumGroupCard(group, mode) {
        const cover = group.photos[0] || {};
        const detailText = mode === 'china'
          ? `${group.cities.length} 个城市/地区 · ${group.photos.length} 张`
          : `${group.type === 'special' ? '特殊地区' : group.continent} · ${group.photos.length} 张`;
        return `
          <button class="photo-fallback group relative h-56 overflow-hidden rounded-2xl border border-cyan-300/10 bg-[#111827]/60 text-left shadow-[0_0_22px_rgba(6,182,212,.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:border-cyan-300/40 sm:h-64"
            data-album-group="${mode}"
            data-group-key="${escapeAlbum(group.key)}">
            <img class="h-full w-full object-cover brightness-75 saturate-75 transition-all duration-300 ease-out group-hover:scale-105 group-hover:brightness-100 group-hover:saturate-100" alt="${escapeAlbum(group.name)}" src="${escapeAlbum(safeImageUrl(cover.imageUrl || '', group.name))}">
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent"></div>
            <div class="absolute inset-x-0 bottom-0 p-4">
              <div class="mb-3 inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">
                <i data-lucide="${mode === 'china' ? 'map-pin' : 'globe-2'}" class="h-3.5 w-3.5"></i>
                <span>${escapeAlbum(detailText)}</span>
              </div>
              <p class="text-xl font-semibold text-white">${escapeAlbum(group.name)}</p>
              <p class="mt-1 text-xs text-[#9CA3AF]">最近更新 ${formatDate(cover.date || cover.checkin?.checkinDate || cover.createdAt) || '-'}</p>
            </div>
          </button>
        `;
      }

      function albumGroupGrid(groups, emptyText, mode) {
        if (!groups.length) {
          return `<div class="rounded-3xl border border-[#1F2937] bg-[#111827]/60 p-6 text-center text-sm text-[#9CA3AF]">${emptyText}</div>`;
        }
        return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">${groups.map((group) => albumGroupCard(group, mode)).join('')}</div>`;
      }

      function bindPhotoButtons(root = document) {
        root.querySelectorAll('[data-photo-id]').forEach((button) => {
          button.addEventListener('click', () => openPhotoDrawer(appPhotos.find((photo) => photo.id === button.dataset.photoId)));
        });
      }

      function highlightElement(element) {
        if (!element) return;
        element.classList.add('ring-2', 'ring-cyan-300', 'ring-offset-2', 'ring-offset-[#030712]');
        window.setTimeout(() => element.classList.remove('ring-2', 'ring-cyan-300', 'ring-offset-2', 'ring-offset-[#030712]'), 1800);
      }

      function openChinaAlbumGroup(group, focusCityKey = '') {
        openDrawer(`
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-[#06B6D4]">Province Album</p>
              <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${escapeAlbum(group.name)}相册</h2>
              <p class="mt-2 text-sm text-[#9CA3AF]">${group.cities.length} 个城市/地区 · ${group.photos.length} 张照片</p>
            </div>
            <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
              <i data-lucide="x" class="h-5 w-5"></i>
            </button>
          </div>
          <div class="mt-5 space-y-6">
            ${group.cities.map((city) => `
              <section data-city-section="${escapeAlbum(city.key)}" class="rounded-3xl border border-transparent p-1 transition-all duration-300">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-[#F9FAFB]">${escapeAlbum(city.name)}</p>
                    <p class="mt-1 text-xs text-[#9CA3AF]">${city.photos.length} 张 · 最近 ${formatDate(city.photos[0]?.date || city.photos[0]?.checkin?.checkinDate || city.photos[0]?.createdAt) || '-'}</p>
                  </div>
                </div>
                ${photoGrid(city.photos, '这个城市还没有照片')}
              </section>
            `).join('')}
          </div>
        `);
        bindPhotoButtons(drawerContent);
        if (focusCityKey) {
          const citySection = drawerContent.querySelector(`[data-city-section="${CSS.escape(focusCityKey)}"]`);
          citySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          highlightElement(citySection);
        }
      }

      function openWorldAlbumGroup(group) {
        openDrawer(`
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-[#06B6D4]">Country Album</p>
              <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${escapeAlbum(group.name)}相册</h2>
              <p class="mt-2 text-sm text-[#9CA3AF]">${escapeAlbum(group.type === 'special' ? '特殊地区' : group.continent)} · ${group.photos.length} 张照片</p>
            </div>
            <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
              <i data-lucide="x" class="h-5 w-5"></i>
            </button>
          </div>
          <div class="mt-5">
            ${photoGrid(group.photos, '这个国家还没有照片')}
          </div>
        `);
        bindPhotoButtons(drawerContent);
      }

      page.innerHTML = `
        <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-sm text-[#9CA3AF]">Album</p>
            <h1 class="mt-1 text-3xl font-semibold text-[#F9FAFB]">旅行相册</h1>
          </div>
          <div class="flex rounded-full border border-[#1F2937] bg-[#111827]/60 p-1 backdrop-blur-md">
            <button class="album-jump rounded-full bg-cyan-400/10 px-4 py-2 text-sm text-[#06B6D4]" data-album-target="album-all">全部</button>
            <button class="album-jump rounded-full px-4 py-2 text-sm text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" data-album-target="album-china">中国</button>
            <button class="album-jump rounded-full px-4 py-2 text-sm text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" data-album-target="album-world">世界</button>
          </div>
        </div>
        <div class="relative mb-6 rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-3 shadow-[0_0_22px_rgba(6,182,212,.06)] backdrop-blur-md">
          <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-3 py-2">
            <i data-lucide="search" class="h-5 w-5 text-[#06B6D4]"></i>
            <input id="album-search-input" type="search" autocomplete="off" placeholder="搜索省份、城市、国家/地区" class="min-w-0 bg-transparent py-2 text-sm text-[#F9FAFB] outline-none placeholder:text-[#4B5563]">
            <button id="album-search-button" class="rounded-xl bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-[#06B6D4] transition-all duration-300 hover:bg-cyan-400/20" type="button">定位</button>
          </div>
          <div id="album-search-results" class="absolute inset-x-3 top-[4.8rem] z-20 hidden overflow-hidden rounded-2xl border border-[#1F2937] bg-[#030712]/95 shadow-[0_20px_60px_rgba(0,0,0,.45)] backdrop-blur-md"></div>
        </div>
        <div id="album-all" class="h-1"></div>
        <div id="album-china" class="mb-4 flex items-center gap-3 scroll-mt-24">
          <div class="h-px flex-1 bg-[#1F2937]"></div><p class="text-sm text-[#9CA3AF]">中国 · ${chinaGroups.length} 个省份 · ${chinaPhotos.length} 张</p><div class="h-px flex-1 bg-[#1F2937]"></div>
        </div>
        ${albumGroupGrid(chinaGroups, '还没有中国照片', 'china')}
        <div id="album-world" class="mb-4 mt-8 flex items-center gap-3 scroll-mt-24">
          <div class="h-px flex-1 bg-[#1F2937]"></div><p class="text-sm text-[#9CA3AF]">世界 · ${worldGroups.length} 个国家/地区 · ${worldPhotos.length} 张</p><div class="h-px flex-1 bg-[#1F2937]"></div>
        </div>
        ${albumGroupGrid(worldGroups, '还没有世界照片', 'world')}
      `;
      page.querySelectorAll('[data-album-group]').forEach((button) => {
        button.addEventListener('click', () => {
          const groups = button.dataset.albumGroup === 'china' ? chinaGroups : worldGroups;
          const group = groups.find((item) => item.key === button.dataset.groupKey);
          if (!group) return;
          if (button.dataset.albumGroup === 'china') openChinaAlbumGroup(group);
          else openWorldAlbumGroup(group);
        });
      });
      const albumSearchInput = page.querySelector('#album-search-input');
      const albumSearchButton = page.querySelector('#album-search-button');
      const albumSearchResults = page.querySelector('#album-search-results');

      function hideAlbumSearchResults() {
        albumSearchResults.classList.add('hidden');
        albumSearchResults.innerHTML = '';
      }

      function locateAlbumMatch(match) {
        hideAlbumSearchResults();
        albumSearchInput.value = match.title;
        const card = page.querySelector(`[data-album-group="${match.mode}"][data-group-key="${CSS.escape(match.group.key)}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightElement(card);
        window.setTimeout(() => {
          if (match.mode === 'china') openChinaAlbumGroup(match.group, match.city?.key || '');
          if (match.mode === 'world') openWorldAlbumGroup(match.group);
        }, 320);
      }

      function renderAlbumSearchResults() {
        const keyword = albumSearchInput.value.trim();
        const matches = albumSearchMatches(keyword);
        if (!keyword) return hideAlbumSearchResults();
        if (!matches.length) {
          albumSearchResults.innerHTML = '<div class="px-4 py-3 text-sm text-[#9CA3AF]">没有找到匹配地区</div>';
          albumSearchResults.classList.remove('hidden');
          return;
        }
        albumSearchResults.innerHTML = matches.map((match, index) => `
          <button type="button" class="album-search-result flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-cyan-400/10" data-match-index="${index}">
            <span>
              <span class="block text-sm font-semibold text-[#F9FAFB]">${escapeAlbum(match.title)}</span>
              <span class="mt-1 block text-xs text-[#9CA3AF]">${escapeAlbum(match.subtitle)}</span>
            </span>
            <i data-lucide="${match.mode === 'china' ? 'map-pin' : 'globe-2'}" class="h-4 w-4 shrink-0 text-[#06B6D4]"></i>
          </button>
        `).join('');
        albumSearchResults.querySelectorAll('.album-search-result').forEach((button) => {
          button.addEventListener('click', () => locateAlbumMatch(matches[Number(button.dataset.matchIndex)]));
        });
        albumSearchResults.classList.remove('hidden');
        createIcons();
      }

      function locateFirstAlbumMatch() {
        const matches = albumSearchMatches(albumSearchInput.value.trim());
        if (matches.length) locateAlbumMatch(matches[0]);
        else renderAlbumSearchResults();
      }

      albumSearchInput.addEventListener('input', renderAlbumSearchResults);
      albumSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          locateFirstAlbumMatch();
        }
        if (event.key === 'Escape') hideAlbumSearchResults();
      });
      albumSearchButton.addEventListener('click', locateFirstAlbumMatch);
      document.addEventListener('click', (event) => {
        if (!page.contains(event.target) || event.target === albumSearchInput || albumSearchResults.contains(event.target)) return;
        hideAlbumSearchResults();
      }, { once: true });
      bindAlbumJumps();
      createIcons();
    }

    function bindAlbumJumps() {
      document.querySelectorAll('.album-jump').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          setPillActive(button, '.album-jump');
          setTab('album', { scrollTop: false });
          requestAnimationFrame(() => scrollToSection(button.dataset.albumTarget));
        });
      });
    }

    function bindAuthenticatedPageControls() {
      bindTabTargetControls();
      bindWorldJumps();
      bindSearchControls();
    }

    function openPhotoDrawer(photo) {
      if (!photo) return;
      const checkin = photo.checkin || {};
      const place = photoPlace(photo);
      const imageUrl = safeImageUrl(photo.imageUrl, place);
      const note = photo.note || checkin.note || '暂无备注';
      openDrawer(`
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm text-[#06B6D4]">Photo Detail</p>
            <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">${escapeHtml(place)}</h2>
            <p class="mt-2 text-sm text-[#9CA3AF]">${formatDate(photo.date || checkin.checkinDate)}</p>
          </div>
          <button class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
            <i data-lucide="x" class="h-5 w-5"></i>
          </button>
        </div>
        <div class="mt-5 overflow-hidden rounded-3xl border border-[#1F2937]">
          <img class="max-h-[52vh] w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(place)}">
        </div>
        <div class="mt-5 rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4">
          <p class="text-sm leading-6 text-[#F9FAFB]">${escapeHtml(note)}</p>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button class="edit-checkin rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#F9FAFB] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan-400/40" data-checkin-id="${escapeHtml(checkin.id || '')}">
            <span class="inline-flex items-center gap-2"><i data-lucide="pencil" class="h-4 w-4 text-[#06B6D4]"></i>编辑记录</span>
          </button>
          <button class="delete-photo rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#FACC15] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-yellow-300/40" data-photo-id="${escapeHtml(photo.id || '')}">
            <span class="inline-flex items-center gap-2"><i data-lucide="trash-2" class="h-4 w-4"></i>删除照片</span>
          </button>
        </div>
      `);
      document.querySelector('.edit-checkin')?.addEventListener('click', () => openEditCheckinDrawer(checkin.id));
      document.querySelector('.delete-photo')?.addEventListener('click', async () => {
        if (!(await confirmAction('确定删除这张照片吗？', { title: '删除照片', danger: true }))) return;
        await apiFetch(`/photos/${photo.id}`, { method: 'DELETE' });
        await refreshAll();
        closeDrawer();
      });
    }

    function findCheckin(id) {
      return appCheckins.find((item) => item.id === id);
    }

    function openEditCheckinDrawer(checkinId) {
      const checkin = findCheckin(checkinId);
      if (!checkin) return;
      openDrawer(`
        <form id="edit-checkin-form">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-[#06B6D4]">Edit Check-in</p>
              <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">编辑打卡</h2>
            </div>
            <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF] transition-all duration-300 ease-out hover:text-[#F9FAFB]" aria-label="关闭">
              <i data-lucide="x" class="h-5 w-5"></i>
            </button>
          </div>
          <div class="mt-5 space-y-3">
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">标题</span><input name="title" value="${escapeHtml(checkin.title || '')}" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">打卡日期</span><input type="date" name="checkinDate" value="${formatDate(checkin.checkinDate)}" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">备注</span><textarea name="note" rows="4" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">${escapeHtml(checkin.note || '')}</textarea></label>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button class="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">保存修改</button>
            <button class="delete-checkin rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-5 py-4 font-semibold text-[#FACC15]" type="button">删除打卡</button>
          </div>
        </form>
      `);
      const form = document.getElementById('edit-checkin-form');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(form).entries());
        await apiFetch(`/checkins/${checkin.id}`, { method: 'PUT', body: JSON.stringify(body) });
        await refreshAll();
        closeDrawer();
      });
      form.querySelector('.delete-checkin').addEventListener('click', async () => {
        if (!(await confirmAction('确定删除这条打卡和关联照片吗？', { title: '删除打卡', danger: true }))) return;
        await apiFetch(`/checkins/${checkin.id}`, { method: 'DELETE' });
        await refreshAll();
        closeDrawer();
      });
    }

    openEditProfileDrawer = function openRealEditProfileDrawer() {
      openDrawer(`
        <form id="profile-form">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-[#06B6D4]">Edit Profile</p>
              <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">编辑资料</h2>
            </div>
            <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]" aria-label="关闭"><i data-lucide="x" class="h-5 w-5"></i></button>
          </div>
          <div class="mt-5 space-y-3">
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">昵称</span><input name="nickname" value="${escapeHtml(userProfile.nickname)}" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">头像 URL</span><input name="avatar" value="${escapeHtml(userProfile.avatar)}" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">个性签名</span><textarea name="bio" rows="4" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">${escapeHtml(userProfile.bio)}</textarea></label>
          </div>
          <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">保存资料</button>
        </form>
      `);
      document.getElementById('profile-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.target;
        await apiFetch('/user/profile', {
          method: 'PUT',
          body: JSON.stringify({
            nickname: form.nickname.value.trim(),
            bio: form.bio.value.trim()
          })
        });
        await loadProfile();
        renderMePage();
        closeDrawer();
      });
    };

    openAddDrawer = function openRealAddDrawer() {
      const today = new Date().toISOString().slice(0, 10);
      openDrawer(`
        <form id="add-checkin-form">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-[#06B6D4]">Add Check-in</p>
              <h2 class="mt-1 text-2xl font-semibold text-[#F9FAFB]">添加旅行打卡</h2>
            </div>
            <button type="button" class="drawer-close rounded-full border border-[#1F2937] bg-[#030712]/70 p-2 text-[#9CA3AF]" aria-label="关闭"><i data-lucide="x" class="h-5 w-5"></i></button>
          </div>
          <div class="mt-5 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <label class="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-left"><input class="mr-2" type="radio" name="scope" value="china" checked>中国城市</label>
              <label class="rounded-2xl border border-[#1F2937] bg-[#030712]/70 p-4 text-left"><input class="mr-2" type="radio" name="scope" value="world">世界国家</label>
            </div>
            <div id="china-fields" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">省份</span><select id="add-province" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></select></label>
              <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">城市/地区</span><select id="add-city" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></select></label>
            </div>
            <div id="world-fields" class="hidden grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">大洲</span><select id="add-continent" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></select></label>
              <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">国家/特殊地区</span><select id="add-country" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></select></label>
            </div>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">标题</span><input name="title" placeholder="例如：杭州西湖打卡" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></label>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">打卡日期</span><input name="checkinDate" type="date" value="${today}" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB]"></label>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">备注</span><textarea name="note" rows="4" placeholder="记录这一束旅光" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50"></textarea></label>
            <label class="block"><span class="mb-2 block text-sm text-[#9CA3AF]">打卡照片</span><input name="photos" type="file" accept="image/*" multiple required class="w-full rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/5 px-4 py-6 text-sm text-[#F9FAFB]"></label>
          </div>
          <button class="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 font-semibold text-[#030712]" type="submit">保存打卡</button>
        </form>
      `);

      const form = document.getElementById('add-checkin-form');
      const provinceSelect = document.getElementById('add-province');
      const citySelect = document.getElementById('add-city');
      const continentSelect = document.getElementById('add-continent');
      const countrySelect = document.getElementById('add-country');
      provinceSelect.innerHTML = chinaRegions.map((region) => `<option value="${escapeHtml(region.id)}">${escapeHtml(region.name)}</option>`).join('');
      continentSelect.innerHTML = worldRegions.map((group, index) => `<option value="${index}">${escapeHtml(group.continent)}</option>`).join('');

      function syncCities() {
        const cityNames = provinceCityCatalog[provinceSelect.value] || [];
        citySelect.innerHTML = cityNames.map((name) => `<option value="${escapeHtml(`city:${provinceSelect.value}:${name}`)}">${escapeHtml(name)}</option>`).join('');
      }
      function syncCountries() {
        const group = worldRegions[Number(continentSelect.value)] || worldRegions[0];
        countrySelect.innerHTML = (group?.countries || []).map((country) => `<option value="${escapeHtml(country.id)}">${escapeHtml(country.name)}</option>`).join('');
      }
      function syncScope() {
        const scope = new FormData(form).get('scope');
        document.getElementById('china-fields').classList.toggle('hidden', scope !== 'china');
        document.getElementById('world-fields').classList.toggle('hidden', scope !== 'world');
      }
      syncCities();
      syncCountries();
      form.querySelectorAll('[name="scope"]').forEach((item) => item.addEventListener('change', syncScope));
      provinceSelect.addEventListener('change', syncCities);
      continentSelect.addEventListener('change', syncCountries);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const scope = formData.get('scope');
        formData.set('regionId', scope === 'china' ? citySelect.value : countrySelect.value);
        formData.delete('scope');
        await apiFetch('/checkins', { method: 'POST', body: formData, headers: {} });
        await refreshAll();
        closeDrawer();
      });
    };

    async function refreshAll() {
      await Promise.all([loadProfile(), loadOverviewStats(), loadChinaRegions(), loadWorldRegions(), loadPhotos(), loadCheckins()]);
      restoreAuthenticatedPages();
      renderDerivedStats();
      renderChinaMap();
      renderWorldMap();
      renderAlbumPage();
      renderMePage();
      bindAuthenticatedPageControls();
      createIcons();
    }

    async function initApp() {
      setTab('home');
      createIcons();
      await ensureLogin();
      await refreshAll();
      bindAuthenticatedPageControls();
      document.getElementById('fab').addEventListener('click', openAddDrawer);
    }

    // 登录入口由 me-app.js 接管，未登录时不自动注入任何账号。
    window.TravelGlowShell = {
      restoreAuthenticatedPages,
      bindAuthenticatedPageControls
    };
    window.TravelGlowImages = {
      imagePlaceholder,
      safeImageUrl
    };
