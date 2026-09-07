import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * package.json 에서 버전을 읽는다. 문자열로 박아 두면 릴리스할 때 어긋난다.
 */
function read(): string {
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(__dirname, rel), 'utf8'));
      if (pkg?.name === '@datasee/vault' && pkg.version) return pkg.version as string;
    } catch {
      /* 다음 후보 */
    }
  }
  return '0.0.0';
}

export const VERSION = read();
