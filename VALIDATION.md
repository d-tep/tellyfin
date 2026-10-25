# Release validation: Tellyfin 0.1.3

0.1.3 matches the private custom build 0.1.33. It keeps the Sign In button in
place when the keyboard opens (Abyss's sticky submit buttons are made static
while typing), and, as in 0.1.2, fixes the interface shrinking
("zooming out") when the Samsung keyboard opens on sign-in, server-address and
other non-guide text fields, and removes the server splash image from the sign-in
screen. It keeps all 0.1.1 changes: guide time-drift fix, Continue Watching banner,
single rounded tile focus frame, MKV direct-play exclusion and the TV Up/Down
guide anchor.

## Passed for this distribution

- Production build of the included modified Jellyfin Web source, with full
  TypeScript checking. Webpack reports its existing asset/entrypoint-size
  advisory warnings; the build succeeds.
- Seven guide focus/time-drift regressions were run for 0.1.2; 0.1.1 also
  ran eight source tests: seven guide focus/time-drift regressions and a
  theme-isolation test that fails if server or user custom CSS hooks are called.
  The two time-drift regressions fail against 0.1.0's guide code.
- ESLint for the guide component and its tests.
- Fifteen Node tests: eleven input/keyboard/sign-in lifecycle tests (including
  the all-text-field font lock and sign-in splash suppression) and four Tizen
  device-profile tests (MKV removed from video direct play only; no forced
  video/audio encoding).
- Six synthetic privacy-detector tests.
- Headless Chrome synthetic fixtures, all `PASS`: guide/remote controls, Home
  row rollover, and the Home banner (dot navigation, rotation and safeguards,
  timer cleanup, D-pad, metadata/progress, native resume, Next Up, empty/error
  states and account replacement).
- Explicit legacy transpilation and syntax checking of 988 generated JavaScript
  assets. Ordinary scripts parse as ES5; two upstream module assets retain native
  module imports/exports/import.meta while their other syntax is transformed.
- Source and extracted WGT scans (1262 entries), versioned checksum, expected app
  identity and version, required theme/guide/banner assets and no external
  theme/font imports.
- Development signing and in-place upgrade of the existing, signed-in Tellyfin
  install on Samsung Tizen 6.0 / Chromium 76.
- On the TV, on the Tellyfin sign-in page: with the keyboard open on the username
  field (viewport 1080 → 568 px), the root font stayed 27 px, and the lock released
  after Back. In 0.1.3 the Sign In button stayed at 781 px with the keyboard open
  (it previously jumped to 457 px). No `Branding/Splashscreen` request was made and no backdrop image
  was shown.

## Inherited on-device results

The same guide, banner and playback-profile changes were measured on the private
0.1.31 build on the same TV with an authenticated server: 0 px horizontal guide
drift over 15 Down and 5 Up presses across 49 rows (from the guide start and
from a later time), and movie startup reduced from about 57 s to 15–23 s with
the server-side probe limits described in the README.

## Limits

The guide and playback measurements above are from the private build that
shares this source. Verify sign-in, playback,
subtitles, seek, guide navigation, the Home banner and app restart with your own
server, remote and media. Different Samsung models may need their own
distributor certificate. No Store certification or universal-installability
claim is made.

The final release checksum is in `releases/SHA256SUMS`. Automated scans allow
only narrowly identified upstream translation examples, a vector coordinate,
the Jellyfin SDK's password-reset API route and a dependency's public
CI build path. Those are not deployment data. Scan output avoids printing
candidate secret values; automated scanning cannot prove arbitrary secret absence.
