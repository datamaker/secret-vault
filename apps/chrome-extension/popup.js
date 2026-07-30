const $ = (id) => document.getElementById(id);

const views = { login: $('loginView'), list: $('listView'), add: $('addView') };
const content = $('content');
const searchInput = $('search');

let settings = {}; // { vaultUrl, apiToken?, accessToken? }
let allCredentials = [];
let currentTab = null;
let currentHost = '';

const showView = (name) => {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  $('addLink').classList.toggle('hidden', name !== 'list' || !settings.accessToken);
  $('logoutLink').classList.toggle('hidden', !settings.accessToken);
};

const authHeader = () => ({
  Authorization: `Bearer ${settings.apiToken || settings.accessToken}`,
});

const api = (path, options = {}) =>
  fetch(`${settings.vaultUrl}/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {}) },
  });

const hostnameOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const matchesHost = (credentialUrl, tabHost) => {
  const credHost = hostnameOf(credentialUrl || '');
  if (!credHost || !tabHost) return false;
  return tabHost === credHost || tabHost.endsWith(`.${credHost}`) || credHost.endsWith(`.${tabHost}`);
};

// 페이지에 주입되어 로그인 폼을 채우는 함수 (React 등 controlled input 대응)
const fillCredentials = (username, password) => {
  const setValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const passwordInput = document.querySelector('input[type="password"]');
  if (!passwordInput) return { ok: false, reason: 'no-password-field' };

  if (password) setValue(passwordInput, password);

  if (username) {
    const form = passwordInput.closest('form') || document;
    const candidates = Array.from(
      form.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')
    ).filter((el) => el.offsetParent !== null);
    const before = candidates.filter(
      (el) => el.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING
    );
    const target = before[before.length - 1] || candidates[0];
    if (target) setValue(target, username);
  }

  return { ok: true };
};

const escapeHtml = (str) =>
  String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const render = () => {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = allCredentials.filter((c) => {
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.url ?? '').toLowerCase().includes(q) ||
      (c.username ?? '').toLowerCase().includes(q)
    );
  });

  const matched = filtered.filter((c) => matchesHost(c.url, currentHost));
  const others = filtered.filter((c) => !matchesHost(c.url, currentHost));

  if (filtered.length === 0) {
    content.innerHTML = '<div class="empty">No credentials found.</div>';
    return;
  }

  const item = (c, highlight) => `
    <div class="item" data-id="${c.id}">
      <div class="name">${escapeHtml(c.name)}${c.teamName ? `<span class="team">${escapeHtml(c.teamName)}</span>` : ''}</div>
      <div class="meta">${escapeHtml(c.username || '')}${c.username && c.url ? ' · ' : ''}${escapeHtml(hostnameOf(c.url || '') || '')}</div>
      <div class="actions">
        ${highlight ? '<button class="fill" data-action="fill">Fill</button>' : ''}
        <button data-action="copy-user">Copy ID</button>
        <button data-action="copy-pass">Copy PW</button>
      </div>
    </div>`;

  let html = '';
  if (matched.length > 0) {
    html += `<div class="section-label">This site (${escapeHtml(currentHost)})</div>`;
    html += matched.map((c) => item(c, true)).join('');
  }
  if (others.length > 0) {
    html += `<div class="section-label">All credentials</div>`;
    html += others.map((c) => item(c, false)).join('');
  }
  content.innerHTML = html;
};

const loadCredentials = async () => {
  showView('list');
  content.innerHTML = '<div class="empty">Loading...</div>';
  try {
    const res = await api('/credentials');
    if (res.status === 401) {
      // 토큰 만료 → 재로그인
      settings.accessToken = null;
      await chrome.storage.local.remove('accessToken');
      showView('login');
      $('loginStatus').textContent = '세션이 만료되었습니다. 다시 로그인하세요.';
      $('loginStatus').className = 'status error';
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      content.innerHTML = `<div class="empty">Vault 오류 (${res.status}): ${escapeHtml(body.message || '')}</div>`;
      return;
    }
    allCredentials = await res.json();
    render();
  } catch {
    content.innerHTML = '<div class="empty">Vault에 접근할 수 없습니다.<br/>사내망/VPN 연결을 확인하세요.</div>';
  }
};

// --- 이벤트 ---

$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('logoutLink').addEventListener('click', async () => {
  settings.accessToken = null;
  await chrome.storage.local.remove('accessToken');
  showView('login');
});

$('loginButton').addEventListener('click', async () => {
  const vaultUrl = $('loginVaultUrl').value.trim().replace(/\/$/, '');
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const status = $('loginStatus');

  if (!vaultUrl || !email || !password) {
    status.textContent = 'Vault URL, 이메일, 비밀번호를 모두 입력하세요.';
    status.className = 'status error';
    return;
  }

  status.textContent = '로그인 중...';
  status.className = 'status ok';
  try {
    const res = await fetch(`${vaultUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      status.textContent = body.message || `로그인 실패 (${res.status})`;
      status.className = 'status error';
      return;
    }
    const { accessToken } = await res.json();
    settings.vaultUrl = vaultUrl;
    settings.accessToken = accessToken;
    await chrome.storage.local.set({ vaultUrl, accessToken });
    $('loginPassword').value = '';
    await loadCredentials();
  } catch {
    status.textContent = 'vault에 접근할 수 없습니다. URL과 사내망/VPN 연결을 확인하세요.';
    status.className = 'status error';
  }
});

$('addLink').addEventListener('click', async () => {
  showView('add');
  $('addStatus').textContent = '';
  $('addUrl').value = currentTab?.url ? new URL(currentTab.url).origin : '';
  $('addName').value = currentHost || '';
  // 팀 목록 로드
  const teamSelect = $('addTeam');
  teamSelect.innerHTML = '<option>Loading...</option>';
  try {
    const res = await api('/teams');
    const teams = await res.json();
    const { lastTeamId } = await chrome.storage.local.get('lastTeamId');
    teamSelect.innerHTML = teams
      .map((t) => `<option value="${t.id}" ${t.id === lastTeamId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`)
      .join('');
  } catch {
    teamSelect.innerHTML = '<option value="">팀 목록을 불러오지 못했습니다</option>';
  }
});

$('addCancel').addEventListener('click', () => showView('list'));

$('addSave').addEventListener('click', async () => {
  const teamId = $('addTeam').value;
  const name = $('addName').value.trim();
  const url = $('addUrl').value.trim();
  const username = $('addUsername').value.trim();
  const password = $('addPassword').value;
  const status = $('addStatus');

  if (!teamId || !name || !password) {
    status.textContent = '팀, 이름, 비밀번호는 필수입니다.';
    status.className = 'status error';
    return;
  }

  $('addSave').disabled = true;
  try {
    const res = await api(`/teams/${teamId}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ name, url: url || null, username: username || null, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      status.textContent = body.message || `저장 실패 (${res.status})`;
      status.className = 'status error';
      return;
    }
    await chrome.storage.local.set({ lastTeamId: teamId });
    $('addName').value = $('addUrl').value = $('addUsername').value = $('addPassword').value = '';
    await loadCredentials();
  } catch {
    status.textContent = '저장 실패: vault에 접근할 수 없습니다.';
    status.className = 'status error';
  } finally {
    $('addSave').disabled = false;
  }
});

content.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('.item').dataset.id;
  const credential = allCredentials.find((c) => c.id === id);
  if (!credential) return;

  const action = button.dataset.action;
  if (action === 'copy-user') {
    await navigator.clipboard.writeText(credential.username || '');
    button.textContent = 'Copied!';
    setTimeout(() => (button.textContent = 'Copy ID'), 1200);
  } else if (action === 'copy-pass') {
    await navigator.clipboard.writeText(credential.password || '');
    button.textContent = 'Copied!';
    setTimeout(() => (button.textContent = 'Copy PW'), 1200);
  } else if (action === 'fill') {
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: fillCredentials,
      args: [credential.username || '', credential.password || ''],
    });
    window.close();
  }
});

searchInput.addEventListener('input', render);

// --- 초기화 ---

const init = async () => {
  settings = await chrome.storage.local.get(['vaultUrl', 'apiToken', 'accessToken']);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentHost = hostnameOf(tab?.url || '');

  if (settings.vaultUrl) $('loginVaultUrl').value = settings.vaultUrl;

  // API 토큰(고급 설정) 또는 로그인 세션이 있으면 바로 목록으로
  if (settings.vaultUrl && (settings.apiToken || settings.accessToken)) {
    await loadCredentials();
  } else {
    showView('login');
  }
};

init();
