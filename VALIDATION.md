# Release validation: Tellyfin 0.1.6

This release ports selected private 0.1.42 features: floating Live TV guide,
playback warming, incremental shared-HLS text captions, Guide-key support and
two-second HLS defaults with H.264 preference. It retains Tellyfin's isolated
bundled theme, identity, signing/release pipeline and unrestricted resolution.
The private app's temporary 720p/4-Mbps cap is excluded.

Verified for 0.1.6:

- Production Webpack build passed with the existing asset/entrypoint size warnings.
- TypeScript (`npm run build:check`) passed.
- 31 source tests passed: isolated theme, guide, floating guide and subtitle loader.
- 19 Node keyboard, device-profile and Guide-key tests passed.
- Six release privacy-detector tests passed.
- TV compatibility check passed for 990 JavaScript files: three legacy syntax
  transformations and two upstream native module assets retained.
- Tizen Web build and development signing passed. The packaged author certificate
  matches the previous 0.1.5 release.
- Release scan passed for 1,266 WGT entries: source/package privacy checks,
  app identity/version, offline theme, required extensions and SHA-256 checksum.

The source-only Node build container lacked Git, so Webpack omitted its optional
commit label; the explicit application version remains Tellyfin-0.1.6.
Earlier uncommitted 0.1.4/0.1.5 installers are preserved locally under ignored
`.work/previous-releases/`; the tracked 0.1.3 package remains available as rollback.

Earlier measurements are historical and do not establish on-device results for 0.1.6. No install on
a physical TV is performed as part of this rebuild; validate first caption,
seek/window rollover, subtitle-off playback, guide controls, sign-in, Home and
restart on your own TV/server. Server plugin 2.0.11.8 is needed for shared captions.

## Historical validation

### Tellyfin 0.1.5

0.1.5 fixes window-dependent subtitle timestamp shifts. Protocol 2 returns
absolute source times, including cues that span a window start. Update the
Xtream plugin and client together. Ten focused loader tests cover timing,
overlap/resume offsets, stale responses and bounded retry recovery as well as
the original parsing/lifecycle checks. Transient failures retain delivered cues
and retry twice with 5/10-second backoff before reporting an error. Provider
stalls and sparse-track extraction timeouts remain possible.

Both 0.1.5 and private 0.1.35 production builds/type checks passed; both staged
apps passed legacy syntax validation (989 JavaScript files). The signed 0.1.5
WGT passed the release scan (1263 entries), and all ten loader tests passed in
both source trees. The deployed server passed three argument/auth tests.
Three synthetic seek windows retained exact source-clock cue times, and 29
matching cues in overlapping real endpoint windows had identical start/end
times. Private 0.1.35 was installed and resumed playback with active native cues.
The user reported a remaining steady early offset, then confirmed stable sync
after the standard three-second subtitle delay was applied for that playback.
That calibration is not automatically detected or persisted; no global
three-second delay is built into either app. Tellyfin 0.1.5 was packaged, not
separately installed on the TV during this check.

0.1.4 adds bounded streaming of remote embedded text subtitles when the updated
Xtream Library fork is installed. Seven focused loader tests cover incremental
cue parsing, deduplication, prefetch, offsets, seeks, disposal and HTTP,
truncation and timeout errors. The server build and three endpoint/argument
tests pass. Against the affected remote movie, its authenticated endpoint
returned the first cue in 8.4 seconds and completed a two-minute window in
30.2 seconds; anonymous requests return 401. These measurements are not a
guarantee for other providers. The same loader in installed private build
0.1.34 displayed active native English subtitle cues while video played;
French track selection, window rollover and switching subtitles off were
also verified. Tellyfin's signed 0.1.4 package passes its release check;
these rendering measurements are from the private app, not a separate
Tellyfin installation.

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
