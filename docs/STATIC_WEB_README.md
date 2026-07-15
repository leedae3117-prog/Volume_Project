# 정적 웹앱 전환 메모

이 폴더의 `index.html`, `styles.css`, `app.js`는 Streamlit 없이 Supabase에 직접 연결하는 운동 기록 웹앱입니다.

- 기존 Supabase 테이블 `workout_sets`를 그대로 사용합니다.
- 기존 데이터는 삭제하거나 수정하지 않습니다.
- 기본 사용자는 `daeyeon`으로 고정했습니다.
- 처음 실행하면 Supabase URL과 anon public key를 한 번 입력해야 합니다.
- 입력한 연결 정보는 현재 브라우저의 `localStorage`에 저장됩니다.

배포는 GitHub Pages, Netlify, Vercel, Cloudflare Pages 같은 정적 호스팅에 올리면 됩니다.
