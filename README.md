# Tellyfin

An **unofficial Jellyfin client for Samsung Tizen TVs**, combining a modified
Jellyfin Web 12.2 client, the Tizen wrapper, a locally bundled Abyss theme and
remote-control/guide improvements. It is not affiliated with Jellyfin or Samsung.

**Release: 0.1.6**, incorporating selected improvements from private build 0.1.42.

## Download and install

The distributable is [Tellyfin-0.1.6.wgt](releases/Tellyfin-0.1.6.wgt).
Verify its SHA-256 against [SHA256SUMS](releases/SHA256SUMS).

You need a Samsung **Tizen** TV, a computer with the Tizen Studio CLI and SDB
(including the TV extension), and a reachable Jellyfin server. Both the TV and
computer must be on the same network for installation. A Samsung account and
Samsung Certificate Extension may be needed to create your own signing profile.

1. Open **Apps** on the TV. On many models, press **1 2 3 4 5** to open Developer
   Mode; the method varies by model. Enable Developer Mode and enter your
   **computer's LAN address** as Host PC. Restart the TV as instructed.
2. Find the **TV's LAN address** in its network settings. Do not confuse it with
   the computer's address.
3. From this repository's root, replace `TV_IP` with the TV address:

   ```sh
   sdb connect TV_IP:26101
   sdb devices
   tizen install -n Tellyfin-0.1.6.wgt -s TV_IP:26101 -- releases
   tizen run -p TellyfinTV.Tellyfin -s TV_IP:26101
   ```

4. Launch **Tellyfin**, enter **your own Jellyfin server address**, and sign in.
   No server, account, media provider, playlist or login is preconfigured.

If the Tizen CLI is not on your PATH, add the CLI and SDB directories from your
Tizen Studio installation. A connection failure usually means Developer Mode,
Host PC address, network reachability, firewall, or a required TV restart.

### Important: signing is not universal

The included WGT is a **development-signed sideload package**, not a Samsung
Store application. It may install directly on some TVs, but this is **not
guaranteed**. Other TVs require a Samsung distributor certificate containing
their device identifier (DUID).

If installation reports a certificate/signature/privilege error, create a TV
certificate profile in Tizen Studio Certificate Manager using the Samsung
Certificate Extension, include your TV, and build/sign with **your own profile**:

```sh
sh scripts/build.sh
sh scripts/package.sh YOUR_PROFILE
```

The public signatures inside a WGT are normal. Private signing keys, profile
files and passwords are **not** included in this repository.

Tellyfin has its own identity (`TellyfinTV.Tellyfin`), separate from the original
Jellyfin app and the earlier private guide-fix app. It installs alongside them
and does not inherit their login. Keep your existing client until you have
verified playback. Future upgrades to an existing Tellyfin install need the
same compatible author certificate; switching signers may require uninstalling
Tellyfin and losing its local login/preferences. Keep your private signing key safe.

## Theme policy: other server skins do not override Tellyfin

Tellyfin **does not inject either server custom CSS or user custom CSS**.
Instead, its modified web client loads the packaged theme, with TV and guide
overrides appended last. The usual Jellyfin custom-CSS preferences therefore
have no effect in this client. No server setting or other client's appearance
is changed.

The theme is pinned to the Abyss revision in [upstream.json](upstream.json).
It uses system text fonts and Jellyfin's bundled Material Icons instead of
fetching Google fonts or icon fonts from a CDN. Abyss's separate Spotlight
add-on is not packaged; Home uses Tellyfin's lightweight Continue Watching banner. The server is still needed for authentication, media and API responses;
"bundled/offline theme" does not mean offline playback.

## Features and controls

- Guide focus follows the selected channel beyond the first screen.
- Search channel names, teams and programme titles; combine category, guide
  availability and favourites filters.
- Search/category/Show filters persist per server/account across app restarts.
  **Clear filters** resets the saved selection.
- From guide Search, **Down enters the first visible matching row**; Up from
  that row returns to Search. Right reaches Category. With no matches, Down
  stays on Search.
- Left/Right traverse toolbar controls. Select opens a dropdown; Up/Down choose
  an option. Back closes a dropdown before cancelling its parent dialog.
- Search and recording inputs wait for **Select/click** to open the keyboard.
  While editing, arrows remain keyboard controls; Back/Done returns to navigation.
- The interface keeps its size when the TV keyboard opens on any text field,
  including server address, sign-in, search, recording and settings fields.
  Sign In and Save buttons stay in place instead of jumping up over the form.
- The sign-in screen uses a plain background and skips the server's custom
  splash image; the server's branding setting is left unchanged.
- Explicit manual recording controls for channels without guide data. Use
  **Save recording** to schedule; Enter in a text field does not implicitly save.
- Home library shortcuts, stable header focus, static focus outlines and no
  decorative tile scaling/blur. Right at a row's last card moves to the first
  card in the next visible non-empty row; the final row does not wrap.
- Guide updates share channel-header lookups, skip hidden cached pages and
  avoid repeated whole-document input scans.
- Up/Down through guide rows keeps the guide at the same time. Selecting a long
  programme no longer pulls the view hours ahead or behind.
- Home shows a **Continue Watching banner**: the latest five titles (Next Up if
  empty), artwork on the right two-thirds, title/synopsis/progress on the left,
  Resume and Details, and dot navigation whose active marker is a short line.
  Selecting a dot changes the slide. Slides rotate every 10 seconds, pausing
  while a banner control is focused. Nothing plays until you choose Resume.
- Tiles have a single rounded focus frame that encloses the artwork and title
  without clipping text.
- Video direct play excludes MKV, as the Tizen wrapper always intended, so
  MKV files are remuxed by the server instead of stalling the TV's native
  player. Audio/video are copied when compatible rather than re-encoded.

Names, counts and available Home rows depend on the server and user permissions.
The application respects the configured Home sections rather than forcing a
My Media row.

### Optional Xtream Library integration

Normal Jellyfin use does **not** require Xtream Library. Category metadata uses
the optional authenticated `XtreamLibrary/Guide/ChannelGroups` server endpoint.
If unavailable, the UI reports it; channel search and guide-status filtering
remain usable. No plugin binary, provider subscription or provider configuration
is included here. The full custom plugin fork is a separate server-side project.

Version 0.1.6 requires protocol 2 with `SharedPlayback=true` from the fork's
`XtreamLibrary/StreamingSubtitles/Capabilities` endpoint (plugin 2.0.11.8).
For eligible HTTP VOD transcoding, embedded SRT/VTT/mov_text captions come from
the **existing HLS FFmpeg process**, avoiding the older client's extra provider
connection. Completed cues are parsed incrementally without reparsing delivered
text or toggling native track visibility on every chunk. Absolute source times
remain stable across overlapping windows, resume and seeks. Track changes and
seeks cancel stale requests. Temporary failures retry twice with 5/10-second
backoff; authorization failures report an error immediately. The standard
subtitle-offset control remains available for a source-specific mismatch.

Direct playback, ASS/SSA, external files, Live TV, bitmap subtitles and servers
without shared-playback support retain standard subtitle delivery. Bitmap
subtitles may require expensive burn-in and should be tested separately.

### Playback startup and floating guide

Movie/episode thumbnails prepare a native media probe after 1.5 seconds of
hover/focus; series thumbnails resolve the signed-in user's next episode. This
requires the matching server plugin for probe reuse and does not start video or
reuse playback sessions. Server-side limits and failure invalidation remain in
force. Bounded numeric launch timings help diagnose startup.

During local Live TV playback, press **Guide**, **G**, or the player's Guide
button. The overlay lets you browse without interrupting playback; select a
channel/current programme to tune. Back/Escape closes it, and future programmes
show information. API failures leave playback running. It stays hidden for
movies, episodes and playback on another device.

Native streaming HLS profiles default to **two-second segments** and prefer
**H.264**, preserving explicit segment lengths and audio support. Offline sync
profiles are unchanged. Tellyfin does not include the private app's temporary
720p/4-Mbps cap; choose quality for your own server, TV and network.

## Compatibility and validation

### Slow movie startup on the server side

If playback stays on the loading screen for a long time, especially for remote
`.strm` items, the delay is usually on the server, not the TV. Two optional server
changes helped substantially in testing (not applied by Tellyfin):

- Disable unneeded metadata fetchers for that library in Jellyfin's library
  settings, which otherwise refresh remote items when playback starts.
- Bound FFmpeg's media probe, for example with the environment variables
  `JELLYFIN_FFmpeg__analyzeduration=5M` and `JELLYFIN_FFmpeg__probesize=10M`.


The inherited guide/keyboard/navigation changes were tested on a Samsung 2021
TV, **Tizen 6.0 / Chromium 76**, against Jellyfin **12.2**. The manifest's lower
minimum version is not a promise of support for every older TV. Other server
versions and TV models require testing.

This release adds a new app identity and self-contained theme. See
[VALIDATION.md](VALIDATION.md) for the exact release checks and any on-device
limitations; inherited test results are not a claim that every device is tested.
Verify sign-in, playback, subtitles, seek, guide scrolling, filter persistence,
keyboard opening/dismissal and Back with your physical remote.

This is a **client-only** installation; it does not modify Jellyfin server
binaries, server branding or media. To roll back, use the original Jellyfin
client. Removing Tellyfin deletes its local settings, not server media.

## Build from the included source

Requirements: Node.js **24**, npm, Python **3**, Git, and Tizen Studio CLI for
signing. Dependencies are pinned by the web and wrapper lockfiles. Allow enough
RAM for a production Webpack build; compilation/minification use two workers.

```sh
sh scripts/build.sh
sh scripts/package.sh YOUR_PROFILE
```

The first command installs dependencies with `npm ci`, builds Jellyfin Web,
builds the wrapper, applies guide/navigation adaptations and playback warming,
bundles the theme and includes licence notices. It then transpiles remaining
modern dependency scripts for the TV, preserving the upstream native module entry points.
The second signs and writes the versioned WGT
and checksum under `releases/`. The release version comes from
`jellyfin-tizen-fixed/config.xml`. Run both again after source changes.

The included source is the corresponding modified source for the distributed
WGT, not merely a reference to a moving upstream branch.

### Tests and privacy checks

```sh
cd jellyfin-web-tizen-fix
npm test -- src/components/CustomCss.test.tsx src/components/guide/guide.test.ts src/components/guide/floatingGuide.test.ts src/utils/remoteSubtitleStream.test.ts
npm run build:check
cd ..
node --test tizen-guide-validation/keyboard-viewport.test.cjs tizen-guide-validation/tizen-device-profile.test.cjs tizen-guide-validation/floating-guide-key.test.cjs
python3 scripts/test-release.py
python3 tizen-guide-validation/build-manual-guide-fixture.py
python3 tizen-guide-validation/build-home-row-fixture.py
python3 browser-guide/tests/build-home-banner-fixture.py
python3 scripts/check-release.py
```

Open the generated HTML fixtures in a browser; require `PASS` and, for the TV
guide fixture, `TV PASS`. These use synthetic data and never schedule real
recordings. Generated fixtures, dependencies and staging/build directories
are ignored by Git.

Do not add real configuration, databases, playlists, tokens, logs, STRM output
or certificates. Re-run release checks and review `git diff --cached` before
pushing. Automated scanning is a safeguard, not a guarantee against arbitrary
secrets. Replace any release package only after reviewing its contents.

Architecture and agent maintenance notes are in [robot.txt](robot.txt).

## Project layout

| Directory | Contents |
| --- | --- |
| `jellyfin-web-tizen-fix/` | Full modified Jellyfin Web source and lockfile |
| `jellyfin-tizen-fixed/` | Tizen wrapper source, app manifest and lockfile |
| `skin/` | Pinned upstream Abyss CSS and MIT licence |
| `browser-guide/` | Shared guide UI and synthetic regression generator |
| `tizen-guide-validation/` | TV adaptations, overrides and regression helpers |
| `scripts/` | Portable build, theme assembly, signing and release checks |
| `releases/` | Distributable development-signed WGT and SHA-256 |

## Attribution and licences

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Jellyfin Web and related modifications are GPL-2.0-or-later; the Tizen wrapper
retains MPL-2.0; Abyss is MIT. Copyright/licence notices and corresponding
source are included. Tellyfin is an unofficial distribution, not an upstream
Jellyfin release.
