// 공유 링크 E2E 암호화 (AES-256-GCM, WebCrypto)
// 키는 URL fragment(#...)로만 전달되어 서버로 전송되지 않는다.

const b64encode = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const b64decode = (str: string): Uint8Array<ArrayBuffer> => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export interface EncryptedShare {
  ciphertext: string; // base64url
  iv: string; // base64url
  key: string; // base64url — URL fragment 용
}

export const encryptForShare = async (plaintext: string): Promise<EncryptedShare> => {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const rawKey = await crypto.subtle.exportKey('raw', key);

  return {
    ciphertext: b64encode(ciphertext),
    iv: b64encode(iv.buffer),
    key: b64encode(rawKey),
  };
};

export const decryptShare = async (
  ciphertext: string,
  iv: string,
  keyB64: string
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    b64decode(keyB64),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(iv) },
    key,
    b64decode(ciphertext)
  );
  return new TextDecoder().decode(plaintext);
};
