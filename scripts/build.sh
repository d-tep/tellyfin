#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
root="$(pwd)"
cd jellyfin-web-tizen-fix
npm ci --no-audit
NODE_ENV=production USE_SYSTEM_FONTS=1 JELLYFIN_VERSION=Tellyfin-0.1.0 \
  node node_modules/webpack/bin/webpack.js --config ../scripts/webpack.config.cjs
cd "$root/jellyfin-tizen-fixed"
JELLYFIN_WEB_DIR=../jellyfin-web-tizen-fix/dist npm ci --no-audit
cd "$root"
node tizen-guide-validation/use-standard-abyss.cjs
node tizen-guide-validation/build-manual-guide.cjs
node scripts/bundle-theme.cjs
node scripts/ensure-tv-syntax.cjs
echo 'Unsigned app prepared in jellyfin-tizen-fixed/. Sign with: sh scripts/package.sh PROFILE'
