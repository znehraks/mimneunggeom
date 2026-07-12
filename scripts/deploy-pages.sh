#!/usr/bin/env bash
# 밈검정원 → Cloudflare Pages 배포. 사이트 파일만 임시 디렉터리에 스테이징해 업로드
# (node_modules·test·scripts 등이 딸려 올라가지 않게). 로컬 wrangler OAuth 또는
# CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID 환경변수 인증을 사용한다.
set -euo pipefail
cd "$(dirname "$0")/.."
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp index.html og.png "$STAGE/"
cp -R assets gwangclick patience superpower "$STAGE/"
npx --yes wrangler pages deploy "$STAGE" --project-name=mimneunggeom --branch=main --commit-dirty=true
