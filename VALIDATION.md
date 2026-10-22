# Release validation: Tellyfin 0.1.0

## Passed for this distribution

- Production build of the included modified Jellyfin Web source, with full
  TypeScript checking. Webpack reports its existing asset/entrypoint-size
  advisory warnings; the build succeeds.
- Five source tests: four guide focus regressions and a theme-isolation test
  that fails if server or user custom CSS hooks are called.
- Targeted typed ESLint checks for the theme component and its regression test.
- Nine input/keyboard lifecycle tests.
- Six synthetic privacy-detector tests.
- Real-Chrome synthetic guide/remote fixture: filters, persistence, account/server
  isolation, storage failure feedback, async guide updates, explicit recording
  submission, dialog paint, Back, Search Down into matching rows and empty results.
- Real-Chrome Home fixture: row rollover, hidden/empty rows, ordinary navigation,
  header recreation and content-mutation isolation.
- Explicit legacy transpilation and syntax checking of 985 generated JavaScript
  assets. Ordinary scripts parse as ES5; two upstream module assets retain native
  module imports/exports/import.meta while their other syntax is transformed.
- Clean staging contains only the app manifest, icon, launcher, Tizen integration
  and generated web assets. No dependency directories or source build caches.
- Source and extracted WGT scans, versioned checksum, expected app identity,
  required theme/guide assets and no external theme/font imports.
- Development signing and installation as a **new, separate app** on Samsung
  Tizen 6.0 / Chromium 76.
- Fresh native launch reaches **Select Server**, with the local theme loaded.
  No servers or accounts are preconfigured. Existing Jellyfin apps remain separate.
- A fresh native reload has no uncaught JavaScript startup exceptions.

## Limits

This new app identity has not been signed into a real server for authenticated
end-to-end playback testing. Its prior private build's guide, keyboard and Home
navigation were exercised on this TV, but that is not a substitute for testing
the new complete distribution with your own server, remote and media.

In particular, verify video/audio codecs, subtitles, seek, playback controls,
authenticated guide dialogs, skin layout on Home and app restart on your TV.
Different Samsung models may need their own distributor certificate. No Store
certification or universal-installability claim is made.

The final release checksum is in `releases/SHA256SUMS`. Automated scans allow
only narrowly identified upstream translation examples, a vector coordinate,
the Jellyfin SDK's password-reset API route and a dependency's public
CI build path. Those are not deployment data. Scan output avoids printing
candidate secret values; automated scanning cannot prove arbitrary secret absence.
