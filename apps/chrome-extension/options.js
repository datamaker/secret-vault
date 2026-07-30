const $ = (id) => document.getElementById(id);

const setStatus = (message, ok) => {
  const el = $('status');
  el.textContent = message;
  el.className = ok ? 'ok' : 'error';
};

chrome.storage.local.get(['vaultUrl', 'apiToken']).then(({ vaultUrl, apiToken }) => {
  if (vaultUrl) $('vaultUrl').value = vaultUrl;
  if (apiToken) $('apiToken').value = apiToken;
});

$('save').addEventListener('click', async () => {
  const vaultUrl = $('vaultUrl').value.trim().replace(/\/$/, '');
  const apiToken = $('apiToken').value.trim();
  if (!vaultUrl || !apiToken) {
    setStatus('Vault URL과 API Token을 모두 입력하세요.', false);
    return;
  }
  await chrome.storage.local.set({ vaultUrl, apiToken });
  setStatus('저장되었습니다.', true);
});

$('test').addEventListener('click', async () => {
  const vaultUrl = $('vaultUrl').value.trim().replace(/\/$/, '');
  const apiToken = $('apiToken').value.trim();
  if (!vaultUrl || !apiToken) {
    setStatus('Vault URL과 API Token을 먼저 입력하세요.', false);
    return;
  }
  setStatus('연결 확인 중...', true);
  try {
    const res = await fetch(`${vaultUrl}/api/v1/credentials`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (res.ok) {
      const list = await res.json();
      setStatus(`연결 성공 — 크리덴셜 ${list.length}개 접근 가능`, true);
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`연결 실패 (${res.status}): ${body.message || '토큰/URL을 확인하세요'}`, false);
    }
  } catch {
    setStatus('연결 실패: vault에 접근할 수 없습니다. 사내망/VPN 연결을 확인하세요.', false);
  }
});
