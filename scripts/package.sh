#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then
    echo "Usage: sh scripts/package.sh YOUR_TIZEN_CERTIFICATE_PROFILE" >&2
    exit 1
fi
cd "$(dirname "$0")/.."
root="$(pwd)"
version="$(sed -n 's/.*<widget[^>]* version="\([^"]*\)".*/\1/p' jellyfin-tizen-fixed/config.xml)"
test -n "$version"
cd jellyfin-tizen-fixed
test -f www/ui/tellyfin-theme.css
tizen build-web -e ".*" -e "node_modules/*" -e "package*.json" -e gulpfile.babel.js -e LICENSE
tizen package -t wgt -s "$1" -o "$root/releases" -- .buildResult
cd "$root/releases"
mv Tellyfin.wgt "Tellyfin-$version.wgt"
cd "$root"
python3 scripts/check-release.py --write-checksum
