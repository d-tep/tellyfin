/* Bounded thumbnail-dwell preparation and numeric launch timing; never opens a video. */
(function () {
    'use strict';
    if (window.__jellyfinPlaybackWarm) return;
    window.__jellyfinPlaybackWarm = true;
    var state = { client: null, owner: '', caps: null, capsAt: 0, capsPromise: null, generation: 0 };
    var completed = new Map();
    var activeCard = null;
    var dwellTimer = null;
    var inFlight = false;
    var nextRequest = 0;
    var recentClick = 0;
    var launch = null;
    var lastFrame = null;
    var seenVideos = new WeakSet();

    function context() {
        var client = window.ApiClient;
        if (!client || typeof client.getCurrentUserId !== 'function' || !client.getCurrentUserId()) return null;
        var owner = client.getCurrentUserId() + ':' + (typeof client.serverId === 'function' ? client.serverId() : '');
        if (client !== state.client || owner !== state.owner) {
            state = { client: client, owner: owner, caps: null, capsAt: 0, capsPromise: null, generation: state.generation + 1 };
            completed.clear();
            launch = null;
            lastFrame = null;
            window.__jellyfinLastLaunchProfile = null;
        }
        return { client: client, owner: owner, generation: state.generation };
    }
    function owned(request) {
        var current = context();
        return current && current.client === request.client && current.owner === request.owner && current.generation === request.generation;
    }
    async function capabilities(request) {
        if (state.capsAt > Date.now()) return state.caps;
        if (state.capsPromise) return state.capsPromise;
        var promise = request.client.getJSON(request.client.getUrl('XtreamLibrary/PlaybackWarm/Capabilities'))
            .then(function (result) { return result.Version === 1 ? result : null; }).catch(function () { return null; });
        state.capsPromise = promise;
        var result = await promise;
        if (owned(request)) {
            state.caps = result;
            state.capsAt = Date.now() + (result ? 600000 : 30000);
            state.capsPromise = null;
        }
        return result;
    }
    function post(request, path, data) {
        return request.client.ajax({ type: 'POST', url: request.client.getUrl('XtreamLibrary/PlaybackWarm/' + path), data: data ? JSON.stringify(data) : undefined, contentType: 'application/json', dataType: data ? undefined : 'json', timeout: 10000 });
    }
    function remember(key, milliseconds) {
        completed.delete(key);
        if (completed.size >= 128) completed.delete(completed.keys().next().value);
        completed.set(key, Date.now() + milliseconds);
    }
    function playing() {
        return Array.from(document.querySelectorAll('video')).some(function (video) { return !video.paused && !video.ended && !!video.currentSrc; });
    }
    async function warm(card) {
        var request = context();
        if (!request || !card.isConnected || document.hidden || playing() || inFlight) return;
        var id = card.getAttribute('data-id');
        var type = card.getAttribute('data-type');
        if (!/^[\da-f-]{32,36}$/i.test(id || '') || !['Movie', 'Episode', 'Series'].includes(type)) return;
        var key = type + ':' + id;
        if ((completed.get(key) || 0) > Date.now()) return;
        if (Date.now() < nextRequest) { schedule(card, nextRequest - Date.now()); return; }
        inFlight = true;
        nextRequest = Date.now() + 5000;
        try {
            var caps = await capabilities(request);
            if (!caps || !caps.Enabled || !owned(request) || activeCard !== card || playing()) return;
            if (type === 'Series') {
                var next = await request.client.getNextUpEpisodes({ UserId: request.client.getCurrentUserId(), SeriesId: id, Limit: 1, EnableImages: false });
                id = next.Items && next.Items[0] && next.Items[0].Id;
                if (!id || !owned(request) || activeCard !== card || playing()) return;
            }
            var result = await post(request, id);
            if (owned(request)) remember(key, result && result.Ready ? 540000 : 15000);
        } catch {
            if (owned(request)) remember(key, 15000);
        } finally {
            inFlight = false;
            if (activeCard && activeCard !== card) schedule(activeCard, 1500);
        }
    }
    function schedule(card, delay) {
        clearTimeout(dwellTimer);
        if (card) dwellTimer = setTimeout(function () { if (activeCard === card) void warm(card); }, Math.max(1500, delay || 0));
    }
    function enter(event) {
        var card = event.target.closest && event.target.closest('.card[data-id][data-type]');
        if (!card || card === activeCard) return;
        activeCard = card;
        schedule(card, 1500);
    }
    function leave(event) {
        if (activeCard && activeCard.contains(event.target) && (!event.relatedTarget || !activeCard.contains(event.relatedTarget))) {
            activeCard = null;
            clearTimeout(dwellTimer);
        }
    }
    document.addEventListener('pointerover', enter, true);
    document.addEventListener('focusin', enter, true);
    document.addEventListener('pointerout', leave, true);
    document.addEventListener('focusout', leave, true);
    document.addEventListener('visibilitychange', function () { if (document.hidden) { activeCard = null; clearTimeout(dwellTimer); } });
    document.addEventListener('click', function (event) {
        if (event.target.closest && event.target.closest('.btnPlay, .btnResume, [data-action="play"], [data-action="resume"]')) recentClick = performance.now();
    }, true);

    // Resource entries are inspected in memory; URLs, tokens, profiles and account IDs
    // are never copied into diagnostics. The backend accepts only bounded numeric fields.
    function resource(entry) {
        var path;
        try { path = new URL(entry.name, location.href).pathname; } catch { return; }
        var match = path.match(/\/Items\/([\da-f-]{32,36})\/PlaybackInfo\/?$/i);
        if (!match || entry.duration <= 0) return;
        var request = context();
        if (!request) return;
        if (!launch || launch.sent || launch.id !== match[1] || entry.startTime - launch.start > 30000) {
            launch = { request: request, id: match[1], start: entry.startTime, click: recentClick > 0 && recentClick <= entry.startTime && entry.startTime - recentClick < 15000 ? recentClick : null, infoMs: 0, infoEnd: 0, probeMs: null, cacheHits: 0, requests: 0, sent: false };
        }
        (entry.serverTiming || []).forEach(function (timing) {
            if (timing.name === 'xtream-probe') {
                launch.probeMs = (launch.probeMs || 0) + timing.duration;
                if (timing.description === 'hit') launch.cacheHits++;
            }
        });
        launch.infoMs += entry.duration;
        launch.infoEnd = Math.max(launch.infoEnd, entry.responseEnd);
        launch.requests++;
        if (lastFrame && lastFrame.time >= launch.infoEnd) void firstFrame(lastFrame.kind, lastFrame.time);
    }
    async function firstFrame(kind, time) {
        lastFrame = { kind: kind, time: time };
        var record = launch;
        if (!record || record.sent || time < record.infoEnd || time - record.start > 300000 || !owned(record.request)) return;
        record.sent = true;
        var payload = { ItemId: record.id, PlaybackInfoMs: Math.round(record.infoMs), InfoToFrameMs: Math.round(time - record.infoEnd), ClickToFrameMs: record.click === null ? null : Math.round(time - record.click), PlaybackInfoRequests: record.requests, ProbeMs: record.probeMs === null ? null : Math.round(record.probeMs), CacheHits: record.cacheHits, FrameKind: kind };
        window.__jellyfinLastLaunchProfile = payload;
        try {
            var caps = await capabilities(record.request);
            if (caps && owned(record.request)) await post(record.request, 'Profile', payload);
        } catch { /* Diagnostics cannot delay playback or trigger retries. */ }
    }
    function observeVideo(video) {
        if (seenVideos.has(video)) return;
        seenVideos.add(video);
        video.addEventListener('loadstart', function () { lastFrame = null; });
        video.addEventListener('error', function () {
            completed.clear();
            var record = launch;
            if (record && owned(record.request)) {
                void post(record.request, record.id + '/Invalidate', {}).catch(function () {});
            }
        });
        if (typeof video.requestVideoFrameCallback === 'function') {
            var pending = false;
            var requestFrame = function () {
                if (pending) return;
                pending = true;
                video.requestVideoFrameCallback(function (now) { pending = false; void firstFrame('decoded-frame', now); });
            };
            video.addEventListener('loadstart', requestFrame);
            video.addEventListener('playing', requestFrame);
            requestFrame();
        } else {
            video.addEventListener('playing', function () { void firstFrame('playing-event', performance.now()); });
        }
    }
    function scanVideos() { document.querySelectorAll('video').forEach(observeVideo); }
    function start() {
        if (typeof PerformanceObserver === 'function') {
            var observer = new PerformanceObserver(function (list) { list.getEntries().forEach(resource); });
            try { observer.observe({ type: 'resource', buffered: true }); }
            catch { observer.observe({ entryTypes: ['resource'] }); }
        }
        new MutationObserver(scanVideos).observe(document.body, { childList: true, subtree: true });
        scanVideos();
    }
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
