# Floating guide during Live TV playback

The private TV build adds a Guide button to the video player's controls for
local Live TV playback. Press that button, G on a keyboard, or the Samsung
remote's Guide key where available. The lower panel leaves the video playing
above it and does not navigate away from the player.

- Browse channels with Up/Down and programmes with Left/Right.
- Earlier, Now and Later browse two-hour windows, up to 24 hours ahead.
- Select a current programme or a channel name to tune. Focusing a channel
  alone does not change playback. Selecting the current channel closes the
  guide without reopening the stream.
- Selecting a future programme displays its information. It does not start
  playback, create a timer or schedule a recording.
- Back, Close, Guide or G dismiss the panel. Playback continues and focus
  returns to the player's Guide control.
- Channel names remain selectable when programme data is missing or an EPG
  request fails. Refresh retries guide requests; channel errors do not stop
  the current player.
- Explicit volume and play/pause commands remain available while browsing.

The panel uses the current user's Jellyfin API client and visible channel list.
It loads at most 500 channels and reports truncation if the server returns more.
It refreshes the current time window once per minute, ignores stale responses,
and disposes its refresh timer when closed or playback ends. Movies, episodes,
and playback on a remote player do not show the Guide button.

Programme tiles have individual outlines and dark gutters. Channel labels use a
darker background and a gap before the timeline. Current-channel and focus
highlights retain their original colours. This styling is included in private
TV installer 0.1.37.

## Checks

```sh
npm test -- src/components/guide/floatingGuide.test.ts
npm run build:check
```

Tests cover clipped programme geometry, safe text rendering, no implicit tune,
D-pad focus, explicit channel switching, missing EPG, API failures, late results,
account changes, Back/G and timer cleanup. The browser fixture also verifies a
synthetic video's playhead advances while the panel is open, Back preserves
playback, and the panel fits 1920×1080 and 1280×720 viewports. Physical Samsung
remote and provider playback checks remain necessary on the final installed app.
