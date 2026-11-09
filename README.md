# STACKFALL

Supabase에 점수와 피드백을 저장하는 웹 블록 낙하 퍼즐 게임입니다. 빌드 과정 없는 정적 사이트라 Vercel에 바로 배포할 수 있습니다.
요구사항은 [PRD.md](PRD.md)에 정리되어 있습니다.

## 1. Supabase 설정
1. https://supabase.com 에서 새 프로젝트를 만듭니다.
2. **SQL Editor**에서 [supabase/schema.sql](supabase/schema.sql)의 내용을 붙여넣고 실행합니다. (처음 설치할 때. 기존 데이터가 삭제됩니다)
   - 이미 운영 중인 DB라면 schema.sql 대신 [supabase/migrations/](supabase/migrations/)의 파일을 번호 순서대로 실행하세요.
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사합니다.
4. [js/config.js](js/config.js)에 붙여넣습니다.
   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
   > anon 키는 공개해도 되는 키이며, 접근은 RLS 정책으로 제한됩니다(점수는 조회 + 등록 함수만, 피드백은 조회와 추가만 가능). `service_role` 키는 절대 넣지 마세요.

## 2. 로컬 실행
ES Module을 쓰기 때문에 `file://`로 열면 동작하지 않습니다. 간단한 정적 서버로 실행하세요.
```bash
python -m http.server 5173
# 또는: npx serve .
```
http://localhost:5173 에 접속합니다.

## 3. Vercel 배포
1. 이 저장소를 GitHub에 push합니다.
2. Vercel → **Add New → Project** → `supabase_tetris` 저장소를 Import합니다.
3. Framework Preset은 **Other**, Build Command와 Output Directory는 비워둡니다.
4. **Deploy**를 누릅니다. 이후에는 push할 때마다 자동으로 다시 배포됩니다.

## 조작법
| 키 | 동작 |
|---|---|
| ← → | 이동 |
| ↓ | 소프트 드롭 |
| ↑ / X | 회전 · Z 역회전 |
| Space | 하드 드롭 |
| C / Shift | 홀드 |
| P / Esc | 일시정지 |
| M | 음소거 |

모바일에서는 화면 하단의 터치 버튼을 사용합니다.
