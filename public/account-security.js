const AccountSecurity = (() => {
  const state = {
    password: {},
    email: {}
  };

  function app() {
    return window.TravelGlowAccount;
  }

  function user() {
    return app()?.getUser?.();
  }

  function settings() {
    return app()?.getSettings?.() || {};
  }

  function root() {
    return document.getElementById('me-page-root');
  }

  function escape(value = '') {
    return app()?.escapeHtml ? app().escapeHtml(value) : String(value);
  }

  function icon(name, classes = 'h-5 w-5') {
    return `<i data-lucide="${name}" class="${classes}"></i>`;
  }

  function ensureAuth() {
    if (user()) return true;
    app()?.clearToken?.();
    app()?.renderMePage?.();
    app()?.openLoginDrawer?.();
    return false;
  }

  function shell({ title, eyebrow = 'Account Security', step = '', body }) {
    const host = root();
    if (!host) return;
    host.innerHTML = `
      <section class="min-h-[calc(100vh-7rem)] pb-28">
        <div class="sticky top-0 z-20 -mx-4 border-b border-cyan-300/10 bg-[#030712]/88 px-4 py-3 backdrop-blur-xl">
          <div class="mx-auto flex max-w-md items-center gap-3">
            <button class="account-back grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-[#06B6D4]" type="button" aria-label="返回">
              ${icon('arrow-left', 'h-5 w-5')}
            </button>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs text-[#06B6D4]">${escape(eyebrow)}</p>
              <h1 class="truncate text-xl font-semibold text-[#F9FAFB]">${escape(title)}</h1>
            </div>
            ${step ? `<span class="shrink-0 rounded-full border border-cyan-300/20 bg-[#111827]/80 px-3 py-1 text-xs text-cyan-100">${escape(step)}</span>` : ''}
          </div>
        </div>
        <div class="mx-auto mt-5 max-w-md space-y-4">
          ${body}
        </div>
      </section>
    `;
    host.querySelector('.account-back')?.addEventListener('click', () => open('home'));
    app()?.createIcons?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function panel(content, extra = '') {
    return `<div class="rounded-3xl border border-cyan-300/10 bg-[#111827]/60 p-4 shadow-[0_0_30px_rgba(6,182,212,.08)] backdrop-blur-md ${extra}">${content}</div>`;
  }

  function button(label, action, tone = 'normal') {
    const danger = tone === 'danger';
    return `
      <button class="${action} w-full rounded-2xl ${danger ? 'border border-rose-400/30 bg-rose-500/10 text-rose-100' : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#030712]'} px-5 py-4 font-semibold" type="submit">
        ${escape(label)}
      </button>
    `;
  }

  function errorLine(name) {
    return `<p class="field-error mt-2 min-h-5 text-sm text-rose-300" data-error-for="${name}"></p>`;
  }

  function setError(form, name, message) {
    const target = form.querySelector(`[data-error-for="${name}"]`) || form.querySelector('.form-error');
    if (target) target.textContent = message || '';
  }

  function clearErrors(form) {
    form.querySelectorAll('.field-error,.form-error').forEach((item) => {
      item.textContent = '';
    });
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

  function field(label, name, attrs = '') {
    return `
      <label class="block">
        <span class="mb-2 block text-sm text-[#9CA3AF]">${escape(label)}</span>
        <input name="${name}" ${attrs} class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
        ${errorLine(name)}
      </label>
    `;
  }

  async function submitForm(form, task) {
    clearErrors(form);
    try {
      await task();
    } catch (error) {
      setError(form, 'form', error.message || '请求失败');
    }
  }

  function finish(title, message, next = 'profile') {
    shell({
      title,
      eyebrow: 'Success',
      step: '第 3 步 / 共 3 步',
      body: panel(`
        <div class="flex items-start gap-3">
          <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200">${icon('check-circle-2', 'h-6 w-6')}</span>
          <div>
            <h2 class="text-lg font-semibold text-[#F9FAFB]">${escape(title)}</h2>
            <p class="mt-2 text-sm leading-6 text-emerald-100">${escape(message)}</p>
            <p class="mt-3 text-xs text-[#9CA3AF]">即将自动返回账号资料页。</p>
          </div>
        </div>
      `)
    });
    window.setTimeout(() => open(next), 1200);
  }

  function openHome() {
    app()?.renderMePage?.();
  }

  function openProfile() {
    if (!ensureAuth()) return;
    const current = user();
    shell({
      title: '账号资料',
      body: `
        ${panel(`
          <div class="flex items-center gap-4">
            <img class="h-20 w-20 rounded-3xl border border-cyan-300/30 object-cover" src="${escape(current.avatar || userProfile.avatar)}" alt="用户头像">
            <div class="min-w-0 flex-1">
              <p class="truncate text-xl font-semibold text-[#F9FAFB]">${escape(current.nickname || '旅光用户')}</p>
              <p class="mt-1 truncate text-sm text-[#9CA3AF]">${escape(current.username || '未设置账号名')}</p>
            </div>
          </div>
        `)}
        ${panel(`
          <form id="profile-edit-form" class="space-y-4">
            <div class="flex items-center justify-between gap-3 border-b border-[#1F2937] pb-3">
              <div>
                <p class="text-sm text-[#9CA3AF]">头像</p>
                <p class="mt-1 text-xs text-[#4B5563]">支持 JPG、PNG、WEBP</p>
              </div>
              <label class="shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-sm text-[#06B6D4]">
                编辑<input name="avatar" type="file" accept="image/*" class="hidden">
              </label>
            </div>
            <label class="block">
              <span class="mb-2 flex items-center justify-between text-sm text-[#9CA3AF]">昵称<span class="text-xs text-[#06B6D4]">编辑</span></span>
              <input name="nickname" value="${escape(current.nickname || '')}" required class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
              ${errorLine('nickname')}
            </label>
            <label class="block">
              <span class="mb-2 flex items-center justify-between text-sm text-[#9CA3AF]">个性签名<span class="text-xs text-[#06B6D4]">编辑</span></span>
              <textarea name="bio" rows="4" class="w-full rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">${escape(current.bio || '')}</textarea>
              ${errorLine('bio')}
            </label>
            <p class="form-error min-h-5 text-sm text-rose-300"></p>
            ${button('保存资料', 'save-profile')}
          </form>
        `)}
        ${panel(`
          ${profileRow('邮箱', current.email || '未绑定', '更换', 'email')}
          ${profileRow('注册时间', current.createdAt ? new Date(current.createdAt).toLocaleString() : '未知', '', '')}
        `)}
      `
    });
    const form = document.getElementById('profile-edit-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitForm(form, async () => {
        const avatarFile = form.avatar.files[0];
        if (avatarFile) {
          const avatarData = new FormData();
          avatarData.append('avatar', avatarFile);
          await app().apiRequest('/user/avatar', { method: 'POST', body: avatarData, headers: {} });
        }
        await app().apiRequest('/user/profile', {
          method: 'PUT',
          body: JSON.stringify({
            nickname: form.nickname.value.trim(),
            bio: form.bio.value.trim()
          })
        });
        await app().refreshAll();
        app().showToast('资料已保存', 'success');
        openProfile();
      });
    });
    root().querySelectorAll('[data-open-account]').forEach((item) => {
      item.addEventListener('click', () => open(item.dataset.openAccount));
    });
  }

  function profileRow(label, value, actionLabel, action) {
    return `
      <div class="flex items-center justify-between gap-3 border-b border-[#1F2937] py-3 last:border-b-0">
        <div class="min-w-0">
          <p class="text-sm text-[#9CA3AF]">${escape(label)}</p>
          <p class="mt-1 truncate text-sm text-[#F9FAFB]">${escape(value)}</p>
        </div>
        ${action ? `<button class="shrink-0 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-sm text-[#06B6D4]" type="button" data-open-account="${action}">${escape(actionLabel)}</button>` : ''}
      </div>
    `;
  }

  function openPasswordStep(step = 1) {
    if (!ensureAuth()) return;
    if (step === 1) return renderPasswordVerify();
    if (step === 2) return renderPasswordNew();
    return finish('密码已修改', '新密码已生效。你选择的设备退出策略已执行。');
  }

  function renderPasswordVerify() {
    shell({
      title: '修改密码',
      step: '第 1 步 / 共 3 步',
      body: panel(`
        <form id="password-verify-form" class="space-y-4">
          <p class="text-sm leading-6 text-[#9CA3AF]">请输入当前密码，确认是你本人在操作。</p>
          ${field('当前密码', 'password', 'type="password" autocomplete="current-password" required')}
          <p class="form-error min-h-5 text-sm text-rose-300"></p>
          ${button('下一步', 'password-next')}
        </form>
      `)
    });
    const form = document.getElementById('password-verify-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitForm(form, async () => {
        await app().apiRequest('/user/security/verify-password', {
          method: 'POST',
          body: JSON.stringify({ password: form.password.value })
        });
        state.password.oldPassword = form.password.value;
        openPasswordStep(2);
      });
    });
  }

  function passwordScore(value) {
    return [
      value.length >= 10,
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value)
    ].filter(Boolean).length;
  }

  function renderPasswordNew() {
    shell({
      title: '修改密码',
      step: '第 2 步 / 共 3 步',
      body: panel(`
        <form id="password-new-form" class="space-y-4">
          ${field('新密码', 'newPassword', 'type="password" autocomplete="new-password" required')}
          <div>
            <div class="h-2 overflow-hidden rounded-full bg-[#030712]">
              <div id="password-strength-bar" class="h-full w-0 rounded-full bg-rose-400 transition-all"></div>
            </div>
            <p id="password-strength-text" class="mt-2 text-xs text-[#9CA3AF]">至少 10 位，包含大小写字母、数字和符号。</p>
          </div>
          ${field('确认新密码', 'confirmPassword', 'type="password" autocomplete="new-password" required')}
          <label class="flex items-center justify-between rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-sm text-[#F9FAFB]">
            <span>退出所有其他设备</span>
            <input name="revokeOtherSessions" type="checkbox" checked>
          </label>
          <p class="form-error min-h-5 text-sm text-rose-300"></p>
          ${button('完成修改', 'password-submit')}
        </form>
      `)
    });
    const form = document.getElementById('password-new-form');
    const bar = document.getElementById('password-strength-bar');
    const text = document.getElementById('password-strength-text');
    form.newPassword.addEventListener('input', () => {
      const score = passwordScore(form.newPassword.value);
      const colors = ['bg-rose-400', 'bg-rose-400', 'bg-amber-300', 'bg-cyan-300', 'bg-emerald-300', 'bg-emerald-300'];
      bar.className = `h-full rounded-full transition-all ${colors[score]}`;
      bar.style.width = `${score * 20}%`;
      text.textContent = score >= 5 ? '密码强度高。' : '至少 10 位，包含大小写字母、数字和符号。';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitForm(form, async () => {
        if (form.newPassword.value !== form.confirmPassword.value) {
          setError(form, 'confirmPassword', '两次输入的新密码不一致');
          return;
        }
        await app().apiRequest('/user/password', {
          method: 'PUT',
          body: JSON.stringify({
            oldPassword: state.password.oldPassword,
            newPassword: form.newPassword.value,
            revokeOtherSessions: form.revokeOtherSessions.checked
          })
        });
        state.password = {};
        openPasswordStep(3);
      });
    });
  }

  function openBindFlow(kind, step = 1) {
    if (!ensureAuth()) return;
    const copy = { title: '换绑邮箱', target: '新邮箱', name: 'email', input: 'type="email"', sendPath: '/user/email/code', submitPath: '/user/email' };
    if (step === 1) return renderBindVerify(kind, copy);
    if (step === 2) return renderBindTarget(kind, copy);
    return finish(`${copy.title}成功`, `${copy.target.replace('新', '')}已更新。`);
  }

  function renderBindVerify(kind, copy) {
    shell({
      title: copy.title,
      step: '第 1 步 / 共 3 步',
      body: panel(`
        <form id="bind-verify-form" class="space-y-4">
          <p class="text-sm leading-6 text-[#9CA3AF]">为了保护账号安全，请先验证当前密码。</p>
          ${field('当前密码', 'password', 'type="password" autocomplete="current-password" required')}
          <p class="form-error min-h-5 text-sm text-rose-300"></p>
          ${button('下一步', 'bind-next')}
        </form>
      `)
    });
    const form = document.getElementById('bind-verify-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitForm(form, async () => {
        await app().apiRequest('/user/security/verify-password', {
          method: 'POST',
          body: JSON.stringify({ password: form.password.value })
        });
        state[kind].password = form.password.value;
        openBindFlow(kind, 2);
      });
    });
  }

  function renderBindTarget(kind, copy) {
    shell({
      title: copy.title,
      step: '第 2 步 / 共 3 步',
      body: panel(`
        <form id="bind-target-form" class="space-y-4">
          ${field(copy.target, copy.name, `${copy.input} required`)}
          <div>
            <div class="grid grid-cols-[1fr_auto] gap-3">
              <input name="code" inputmode="numeric" maxlength="6" placeholder="6 位验证码" class="min-w-0 rounded-2xl border border-[#1F2937] bg-[#030712]/70 px-4 py-3 text-[#F9FAFB] outline-none focus:border-cyan-400/50">
              <button class="send-code rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-[#06B6D4]" type="button">发送验证码</button>
            </div>
            ${errorLine('code')}
          </div>
          <p class="form-error min-h-5 text-sm text-rose-300"></p>
          ${button('完成绑定', 'bind-submit')}
        </form>
      `)
    });
    const form = document.getElementById('bind-target-form');
    const sendButton = form.querySelector('.send-code');
    sendButton.addEventListener('click', async () => {
      clearErrors(form);
      const originalText = sendButton.textContent;
      try {
        const value = form[copy.name].value.trim();
        if (!value) {
          setError(form, copy.name, `请输入${copy.target}`);
          return;
        }
        sendButton.disabled = true;
        sendButton.textContent = '\u53d1\u9001\u4e2d...';
        const result = await app().apiRequest(copy.sendPath, { method: 'POST', body: JSON.stringify({ email: value }) });
        sendButton.disabled = true;
        sendButton.textContent = result.devCode ? `验证码 ${result.devCode}` : '已发送';
        startButtonCooldown(sendButton, originalText, 60);
      } catch (error) {
        const retryAfter = Number(error.retryAfterSeconds || error.details?.retryAfterSeconds || 0);
        if (error.status === 429 && retryAfter > 0) {
          startButtonCooldown(sendButton, originalText, retryAfter);
        } else {
          sendButton.textContent = originalText;
          sendButton.disabled = false;
        }
        setError(form, 'form', error.message || '验证码发送失败');
      }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitForm(form, async () => {
        const value = form[copy.name].value.trim();
        const body = { password: state[kind].password, email: value, code: form.code.value.trim() };
        await app().apiRequest(copy.submitPath, { method: 'PUT', body: JSON.stringify(body) });
        await app().loadAuthMe();
        await app().refreshAll();
        state[kind] = {};
        openBindFlow(kind, 3);
      });
    });
  }

  async function openDevices() {
    if (!ensureAuth()) return;
    let sessions = [];
    try {
      const data = await app().apiRequest('/auth/sessions');
      sessions = data.sessions || [];
    } catch (error) {
      app().showToast(error.message || '设备列表加载失败', 'error');
    }
    shell({
      title: '登录设备管理',
      body: `
        ${panel(`
          <button id="logout-other-devices" class="w-full rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100" type="button">退出其他所有设备</button>
        `)}
        <div class="space-y-3">
          ${sessions.length ? sessions.map(deviceCard).join('') : panel('<p class="text-sm text-[#9CA3AF]">暂无活跃设备。</p>')}
        </div>
      `
    });
    document.getElementById('logout-other-devices')?.addEventListener('click', async () => {
      if (!window.confirm('确定退出其他所有设备吗？')) return;
      await app().apiRequest('/auth/sessions/others', { method: 'DELETE', body: JSON.stringify({}) });
      await app().loadAuthMe();
      app().showToast('其他设备已退出登录', 'success');
      openDevices();
    });
    root().querySelectorAll('.revoke-device').forEach((buttonEl) => {
      buttonEl.addEventListener('click', async () => {
        if (!window.confirm('确定退出这台设备吗？')) return;
        await app().apiRequest(`/auth/sessions/${buttonEl.dataset.sessionId}`, { method: 'DELETE', body: JSON.stringify({}) });
        if (buttonEl.dataset.current === 'true') {
          app().clearToken();
          app().renderMePage();
          app().openLoginDrawer();
          return;
        }
        await app().loadAuthMe();
        app().showToast('设备已退出登录', 'success');
        openDevices();
      });
    });
  }

  function deviceCard(session) {
    const active = session.isCurrent ? '<span class="rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100">当前设备</span>' : '';
    return panel(`
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-semibold text-[#F9FAFB]">${escape(session.deviceName || 'Unknown device')}</p>
            ${active}
          </div>
          <p class="mt-2 break-all text-xs leading-5 text-[#9CA3AF]">${escape(session.userAgent || 'Unknown user agent')}</p>
          <p class="mt-2 text-xs text-[#9CA3AF]">${escape(session.ipAddress || 'Unknown IP')} · ${session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : '未知活跃时间'}</p>
        </div>
        <button class="revoke-device shrink-0 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100" type="button" data-session-id="${session.id}" data-current="${session.isCurrent ? 'true' : 'false'}">退出</button>
      </div>
    `);
  }

  function openChoice({ title, key, options }) {
    if (!ensureAuth()) return;
    const currentValue = settings()[key];
    shell({
      title,
      body: panel(`
        <form id="choice-form" class="space-y-3">
          ${options.map(([value, label]) => `
            <label class="flex items-center justify-between rounded-2xl border ${currentValue === value ? 'border-cyan-300/40 bg-cyan-400/10' : 'border-[#1F2937] bg-[#030712]/70'} px-4 py-3 text-[#F9FAFB]">
              <span>${escape(label)}</span>
              <input type="radio" name="value" value="${escape(value)}" ${currentValue === value ? 'checked' : ''}>
            </label>
          `).join('')}
          <p class="form-error min-h-5 text-sm text-rose-300"></p>
          ${button('保存设置', 'choice-submit')}
        </form>
      `)
    });
    const form = document.getElementById('choice-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitForm(form, async () => {
        const value = new FormData(form).get('value');
        await app().saveSettings({ [key]: value });
        app().showToast('设置已保存', 'success');
        openHome();
      });
    });
  }

  async function clearCache() {
    if (!ensureAuth()) return;
    await app().apiRequest('/user/cache', { method: 'DELETE', body: JSON.stringify({}) });
    app().showToast('缓存已清除', 'success');
    openHome();
  }

  function open(action) {
    const routes = {
      home: openHome,
      profile: openProfile,
      password: () => openPasswordStep(1),
      email: () => openBindFlow('email', 1),
      devices: openDevices,
      privacy: () => openChoice({
        title: '隐私设置',
        key: 'privacyVisibility',
        options: [['private', '仅自己可见'], ['friends', '好友可见'], ['public', '公开']]
      }),
      theme: () => openChoice({
        title: '主题设置',
        key: 'mapTheme',
        options: [['cyber', '赛博深邃'], ['aurora', '极光微芒'], ['classic', '经典暗色']]
      }),
      language: () => openChoice({
        title: '语言',
        key: 'language',
        options: [['zh-CN', '简体中文'], ['en-US', 'English']]
      }),
      cache: clearCache,
      logout: () => app()?.logout?.()
    };
    (routes[action] || openHome)();
  }

  return { open };
})();

window.AccountSecurity = AccountSecurity;
