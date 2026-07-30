# Secret Vault Autofill (Chrome Extension)

vault에 저장된 팀 공용 크리덴셜(id/password/url)을 현재 사이트에 맞게 찾아서
로그인 폼에 채워주는 크롬 익스텐션. 1Password의 사내 초경량 버전.

## 설치 (개발자 모드, 스토어 배포 없음)

1. Chrome → `chrome://extensions` → 우상단 **개발자 모드** 켜기
2. **압축해제된 확장 프로그램을 로드합니다** → 이 폴더(`apps/chrome-extension`) 선택
3. 툴바의 익스텐션 아이콘 클릭 → **Vault URL + 이메일/비밀번호로 로그인**
   - Vault URL은 API 서버 주소 (로컬 개발: `http://localhost:3000`, 운영: nginx 주소)
   - 로그인하면 본인이 속한 **모든 팀의 크리덴셜**이 보인다 (세션 24시간, 만료 시 재로그인)

> 고급: 로그인 대신 ⚙(Settings)에서 팀 스코프 API 토큰(`sv_...`)을 설정하면
> 해당 팀 크리덴셜만 보이는 토큰 모드로 동작한다 (공용 PC 등 개인 로그인이 싫을 때).

## 사용

- 로그인 페이지에서 익스텐션 아이콘 클릭
- 현재 사이트 도메인과 매칭되는 크리덴셜이 **This site** 섹션에 표시됨
- **Fill** → 아이디/비밀번호 자동 입력 (React 등 SPA 폼 대응)
- **Copy ID / Copy PW** → 클립보드 복사
- **+ New** → 팝업에서 바로 크리덴셜 등록 (현재 사이트 URL 자동 입력, 팀 선택 가능)
- 수정/삭제는 vault 웹 UI의 **Credentials** 페이지에서

## 동작 방식

- 익스텐션은 `GET /api/v1/credentials`를 팀 API 토큰으로 호출 — 토큰의 팀 스코프가
  서버에서 강제되므로 다른 팀 크리덴셜은 볼 수 없다
- vault가 private 서브넷에 있으므로 **사내망/VPN에서만 동작** — 이것이 자연스러운 보안 경계
- 크리덴셜은 메모리에만 유지되고 디스크에 캐시하지 않는다

## 보안 메모

- API 토큰은 `chrome.storage.local`에 저장된다. 기기 분실/퇴사 시 vault의 Tokens
  페이지에서 해당 토큰을 revoke하면 즉시 차단된다
- 팀원별로 **개인 이름을 붙인 토큰**을 발급해 쓰는 것을 권장 (예: `ext-jungbin`) —
  Activity 로그와 last-used로 추적 가능하고 개별 폐기 가능
