# Third-party notices

- **Jellyfin Web**: <https://github.com/jellyfin/jellyfin-web>,
  GPL-2.0-or-later. Full modified source is in `jellyfin-web-tizen-fix/`;
  original licence is retained there and at the repository root.
- **Jellyfin Tizen**: <https://github.com/jellyfin/jellyfin-tizen>,
  Mozilla Public License 2.0. Wrapper source and licence are in
  `jellyfin-tizen-fixed/`.
- **Abyss**: <https://github.com/AumGupta/abyss-jellyfin>,
  MIT, copyright (c) 2026 Om Gupta. Pinned CSS and complete licence are in
  `skin/`. Build-time modifications remove remote font imports, use local
  system/Jellyfin icon fonts and append the TV/guide overrides.
- Dependencies retain their licences in their packages; npm lockfiles pin the
  web and wrapper dependency versions. Webpack-generated dependency licence
  notices are retained in the WGT.

Exact upstream revisions are recorded in `upstream.json`. New shared guide UI,
TV adaptation and build additions follow GPL-2.0-or-later; wrapper modifications
retain MPL-2.0. This project does not include Xtream provider data, accounts,
subscriptions, plugin configuration or private signing material.
