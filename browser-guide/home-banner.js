/* Shared Home banner. Slide rotation never starts playback. */
(function () {
    'use strict';
    var state = null;
    var queued = false;
    var generation = 0;

    function node(tag, className, text) {
        var el = document.createElement(tag);
        el.className = className;
        if (text) el.textContent = text;
        return el;
    }
    function owner(client) {
        return client.serverId() + ':' + client.getCurrentUserId();
    }
    function activeHome() {
        if (!/^#\/?home(?:[?]|$)/.test(location.hash)) return null;
        return document.querySelector('.page:not(.hide) .homeSectionsContainer');
    }
    function imageUrl(client, item) {
        var tags = item.BackdropImageTags || [];
        var id = tags.length ? item.Id : item.ParentBackdropItemId;
        var tag = tags[0] || (item.ParentBackdropImageTags || [])[0];
        if (id && tag) return client.getImageUrl(id, { type: 'Backdrop', index: 0, tag: tag, maxWidth: 1280, quality: 85 });
        if (item.ImageTags && item.ImageTags.Primary) return client.getImageUrl(item.Id, {
            type: 'Primary', tag: item.ImageTags.Primary, maxWidth: 900, quality: 85
        });
        return '';
    }
    function reset() {
        generation++;
        if (state) {
            clearTimeout(state.timer);
            state.panel.remove();
        }
        state = null;
    }
    function rotate(current) {
        clearTimeout(current.timer);
        if (!valid(current) || current.items.length < 2) return;
        current.timer = setTimeout(function () {
            if (!valid(current) || !activeHome()) return;
            var dialog = document.querySelector('.dialogContainer:not(.hide), dialog[open], .manual-guide-overlay');
            var video = Array.from(document.querySelectorAll('video')).some(function (el) { return !el.paused; });
            if (!document.hidden && !current.hovered &&
                !current.panel.contains(document.activeElement) &&
                !(dialog && dialog.getClientRects().length) && !video) {
                current.index = (current.index + 1) % current.items.length;
                render(current);
            } else rotate(current);
        }, 10000);
    }
    function valid(current) {
        var client = window.ApiClient;
        return state === current && client === current.client &&
            client.getCurrentUserId() && owner(client) === current.owner;
    }
    function render(current) {
        var item = current.items[current.index];
        if (!item || !valid(current)) return;
        var panel = current.panel;
        panel.querySelector('.home-banner-actions').hidden = false;
        panel.querySelector('.home-banner-title').textContent = item.SeriesName || item.Name || 'Untitled';
        panel.querySelector('.home-banner-kicker').textContent = current.source;
        var meta = [];
        if (item.Type === 'Episode') {
            if (item.ParentIndexNumber != null && item.IndexNumber != null) meta.push('S' + item.ParentIndexNumber + ' · E' + item.IndexNumber);
            if (item.Name) meta.push(item.Name);
        } else if (item.ProductionYear) meta.push(String(item.ProductionYear));
        if (item.OfficialRating) meta.push(item.OfficialRating);
        panel.querySelector('.home-banner-meta').textContent = meta.join('  ·  ');
        panel.querySelector('.home-banner-overview').textContent = item.Overview || 'Open Details to learn more about this title.';
        var ticks = Number(item.RunTimeTicks) || 0;
        var position = Number(item.UserData && item.UserData.PlaybackPositionTicks) || 0;
        var percentage = ticks > 0 ? Math.min(100, Math.max(0, position / ticks * 100)) : 0;
        var progress = panel.querySelector('progress');
        progress.value = percentage;
        progress.hidden = !position || !ticks;
        var remaining = ticks > position ? Math.ceil((ticks - position) / 600000000) : 0;
        panel.querySelector('.home-banner-remaining').textContent = remaining ? remaining + ' min ' + (position ? 'remaining' : 'runtime') : '';
        panel.querySelector('.home-banner-play').textContent = position ? 'Resume' : 'Play';
        var details = panel.querySelector('.home-banner-details');
        details.href = '#/details?id=' + encodeURIComponent(item.Id) + '&serverId=' + encodeURIComponent(current.client.serverId());
        panel.querySelectorAll('.home-banner-dot').forEach(function (button, index) {
            button.setAttribute('aria-pressed', String(index === current.index));
        });
        var image = panel.querySelector('.home-banner-art');
        var url = imageUrl(current.client, item);
        image.hidden = !url;
        if (url) image.src = url;
        else image.removeAttribute('src');
        panel.querySelector('.home-banner-status').textContent = '';
        var next = current.items[current.index + 1];
        var nextUrl = next && imageUrl(current.client, next);
        current.prefetch = nextUrl ? new Image() : null;
        if (current.prefetch) current.prefetch.src = nextUrl;
        rotate(current);
    }
    function create(current) {
        var panel = node('section', 'home-banner');
        panel.setAttribute('aria-label', 'Featured watching');
        panel.addEventListener('mouseenter', function () { current.hovered = true; });
        panel.addEventListener('mouseleave', function () { current.hovered = false; rotate(current); });
        panel.addEventListener('focusin', function () { rotate(current); });
        panel.addEventListener('focusout', function () { rotate(current); });
        panel.addEventListener('keydown', function (event) {
            if (!document.documentElement.classList.contains('layout-tv') ||
                event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            var controls = Array.from(panel.querySelectorAll('button:not(:disabled), a[href]'));
            var index = controls.indexOf(document.activeElement);
            if (index < 0) return;
            var target;
            if (event.key === 'ArrowRight') target = controls[index + 1];
            else if (event.key === 'ArrowLeft') target = controls[index - 1];
            else if (event.key === 'ArrowDown') {
                target = index < 2 ? panel.querySelector('.home-banner-dot[aria-pressed="true"]') : null;
                if (!target) target = Array.from(current.home.querySelectorAll('.card:not([tabindex="-1"])')).find(function (card) {
                    return card.getClientRects().length && getComputedStyle(card).visibility !== 'hidden';
                });
            } else if (event.key === 'ArrowUp' && index >= 2) target = panel.querySelector('.home-banner-play');
            if (!target) return;
            target.focus();
            event.preventDefault();
            event.stopImmediatePropagation();
        });
        var image = node('img', 'home-banner-art');
        image.alt = '';
        image.addEventListener('error', function () { image.hidden = true; });
        panel.appendChild(image);
        var content = node('div', 'home-banner-content');
        content.appendChild(node('div', 'home-banner-kicker', 'Continue Watching'));
        content.appendChild(node('h1', 'home-banner-title', 'Loading your next watch…'));
        content.appendChild(node('div', 'home-banner-meta'));
        content.appendChild(node('p', 'home-banner-overview'));
        var progress = document.createElement('progress');
        progress.max = 100;
        progress.hidden = true;
        progress.setAttribute('aria-label', 'Playback progress');
        content.appendChild(progress);
        content.appendChild(node('div', 'home-banner-remaining'));
        var actions = node('div', 'home-banner-actions');
        actions.hidden = true;
        var play = node('button', 'home-banner-play emby-button show-focus', 'Resume');
        play.type = 'button';
        play.addEventListener('click', function () {
            if (!valid(current)) return;
            var item = current.items[current.index];
            var home = activeHome();
            if (!item || !home) return;
            var card = Array.from(home.querySelectorAll('.card[data-id]')).find(function (card) {
                return card.getAttribute('data-id') === item.Id;
            });
            if (!card) {
                panel.querySelector('.home-banner-status').textContent = 'This title is not in the loaded Home rows. Open Details to play it.';
                return;
            }
            // Jellyfin's existing shortcut handles resume, playback permissions and errors.
            card.dispatchEvent(new CustomEvent('command', { bubbles: true, cancelable: true, detail: { command: 'resume' } }));
        });
        actions.appendChild(play);
        actions.appendChild(node('a', 'home-banner-details emby-button show-focus', 'Details'));
        content.appendChild(actions);
        var status = node('div', 'home-banner-status');
        status.setAttribute('role', 'status');
        content.appendChild(status);
        panel.appendChild(content);
        var controls = node('div', 'home-banner-controls');
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Choose featured title');
        controls.hidden = true;
        panel.appendChild(controls);
        current.panel = panel;
        return panel;
    }
    function createDots(current) {
        var controls = current.panel.querySelector('.home-banner-controls');
        current.items.forEach(function (item, index) {
            var button = node('button', 'home-banner-dot show-focus');
            button.type = 'button';
            button.setAttribute('aria-label', 'Show title ' + (index + 1) + ' of ' + current.items.length + ': ' + (item.SeriesName || item.Name || 'Untitled'));
            button.appendChild(node('span', 'home-banner-dot-mark'));
            function select() {
                if (!valid(current)) return;
                current.index = index;
                render(current);
            }
            button.addEventListener('focus', select);
            button.addEventListener('click', select);
            controls.appendChild(button);
        });
        controls.hidden = false;
    }
    async function load(current) {
        var request = generation;
        try {
            var client = current.client;
            var result = await client.getJSON(client.getUrl('Users/' + encodeURIComponent(client.getCurrentUserId()) + '/Items/Resume', {
                Limit: 5, MediaTypes: 'Video', Fields: 'Overview', ImageTypeLimit: 1,
                EnableImageTypes: 'Backdrop,Primary', EnableTotalRecordCount: false
            }));
            var items = result.Items || [];
            if (request !== generation || !valid(current)) return;
            current.source = 'Continue Watching';
            if (!items.length) {
                result = await client.getJSON(client.getUrl('Shows/NextUp', {
                    UserId: client.getCurrentUserId(), Limit: 5, Fields: 'Overview',
                    ImageTypeLimit: 1, EnableImageTypes: 'Backdrop,Primary', EnableTotalRecordCount: false
                }));
                items = result.Items || [];
                current.source = 'Next Up';
            }
            if (request !== generation || !valid(current)) return;
            current.items = items.filter(function (item) { return item.Id; }).slice(0, 5);
            if (!current.items.length) {
                current.panel.hidden = true;
                return;
            }
            createDots(current);
            render(current);
        } catch (error) {
            if (request !== generation || !valid(current)) return;
            console.error('Home banner could not load watching items.', error);
            current.panel.querySelector('.home-banner-title').textContent = 'Your Home rows are still available below';
            current.panel.querySelector('.home-banner-status').textContent = 'Could not load featured watching. Leave Home and return to retry.';
        }
    }
    function sync() {
        queued = false;
        var client = window.ApiClient;
        var home = activeHome();
        if (!client || !client.getCurrentUserId() || !home) {
            if (state) reset();
            return;
        }
        var key = owner(client);
        if (state && state.client === client && state.owner === key && state.home === home) return;
        reset();
        var current = { client: client, owner: key, home: home, items: [], index: 0 };
        state = current;
        home.before(create(current));
        load(current);
    }
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(sync);
    }
    function start() {
        var observer = new MutationObserver(function (records) {
            if (records.some(function (record) {
                if (!state && record.target.nodeType === 1 && record.target.matches('.homeSectionsContainer')) return true;
                return Array.from(record.addedNodes).some(function (el) {
                    return el.nodeType === 1 && (el.matches('.homeSectionsContainer') || el.querySelector('.homeSectionsContainer'));
                });
            })) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('hashchange', schedule);
        document.addEventListener('viewshow', schedule);
        document.addEventListener('viewbeforeshow', schedule);
        document.addEventListener('visibilitychange', function () {
            if (state) {
                clearTimeout(state.timer);
                if (!document.hidden) rotate(state);
            }
            if (!document.hidden) schedule();
        });
        schedule();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
