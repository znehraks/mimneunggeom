# Netlify → Pages 리다이렉트 배포물
2026-07-12 Cloudflare Pages(mimneunggeom.pages.dev)로 주 호스팅 이전.
Netlify 크레딧이 리셋되는 2026-07-19 이후 아래 명령으로 1회 배포하면
기존 mimneunggeom.netlify.app 링크가 전부 새 주소로 301 리다이렉트된다.

    netlify deploy --prod --dir netlify-redirect
