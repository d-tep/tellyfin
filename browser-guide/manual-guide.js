/* Browser-only guide fallback labels and explicit manual recording controls. */
(function () {
    'use strict';
    var queued = false;
    var currentClient;
    var currentAccount = '';
    var permission = false;
    var permissionPending = false;
    var modal;
    var observer;
    var catalog;
    var guideFilter = { search: '', category: '', status: 'all' };
    var searchTimer;
    var filterStorageError = '';

    function filterStorageKey() {
        return 'manual-guide-filters:v1:' + currentAccount;
    }
    function emptyFilters() {
        return { search: '', category: '', status: 'all' };
    }
    function loadGuideFilters() {
        filterStorageError = '';
        try {
            var stored = localStorage.getItem(filterStorageKey());
            if (!stored) return emptyFilters();
            var value = JSON.parse(stored);
            if (!value || typeof value.search !== 'string' || typeof value.category !== 'string' ||
                !['all', 'missing', 'available', 'favourites'].includes(value.status)) {
                throw new Error('Invalid saved guide filters');
            }
            return { search: value.search, category: value.category, status: value.status };
        } catch (error) {
            console.error('Could not restore saved guide filters.', error);
            filterStorageError = 'Could not restore saved filters';
            return emptyFilters();
        }
    }
    function saveGuideFilters() {
        if (!currentAccount) return;
        try {
            localStorage.setItem(filterStorageKey(), JSON.stringify(guideFilter));
            filterStorageError = '';
        } catch (error) {
            console.error('Could not save guide filters.', error);
            filterStorageError = 'Filters cannot be saved on this device';
        }
    }

    function groupNames(channel) {
        return catalog && catalog.groups[channel.Id] || [];
    }
    function channelMatches(channel, query, category, status) {
        var groups = groupNames(channel);
        var terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        var text = terms.length ? [channel.Name, cleanName(channel.Name), channel.ChannelNumber || channel.Number || '', groups.join(' '),
            channel.CurrentProgram && channel.CurrentProgram.Name || ''].join(' ').toLocaleLowerCase() : '';
        return terms.every(function (term) { return text.includes(term); }) &&
            (!category || (category === '__ungrouped__' ? !groups.length : groups.includes(category))) &&
            (status !== 'favourites' || !!(channel.UserData && channel.UserData.IsFavorite));
    }
    function populateCategories(select, channels, value) {
        var names = new Set();
        var ungrouped = false;
        channels.forEach(function (channel) {
            var groups = groupNames(channel);
            if (!groups.length) ungrouped = true;
            groups.forEach(function (name) { names.add(name); });
        });
        var values = [''].concat(Array.from(names).sort(function (a, b) { return a.localeCompare(b); }));
        if (ungrouped) values.push('__ungrouped__');
        if (value && !values.includes(value)) values.push(value);
        var signature = JSON.stringify(values);
        if (select.dataset.categories !== signature) {
            select.textContent = '';
            values.forEach(function (name) {
                var option = element('option', '', name === '' ? 'All categories' : name === '__ungrouped__' ? 'Ungrouped' : name);
                option.value = name;
                select.appendChild(option);
            });
            select.dataset.categories = signature;
        }
        select.value = values.includes(value) ? value : '';
        return select.value;
    }
    function loadCatalog(client, owner) {
        if (catalog && catalog.owner === owner && (catalog.pending || Date.now() - catalog.loadedAt < 60000)) return catalog.promise;
        var data = { owner: owner, channels: [], byId: {}, groups: {}, pending: true, loadedAt: 0 };
        catalog = data;
        data.promise = Promise.all([
            client.getLiveTvChannels({ UserId: client.getCurrentUserId(), EnableImages: false, Fields: 'Tags', Limit: 10000 }),
            client.getJSON(client.getUrl('XtreamLibrary/Guide/ChannelGroups')).catch(function () { data.groupsUnavailable = true; return []; })
        ]).then(function (results) {
            if (window.ApiClient !== client || account(client) !== owner || catalog !== data) throw new Error('account');
            data.channels = results[0].Items || [];
            data.channels.forEach(function (channel) { data.byId[channel.Id] = channel; });
            (results[1] || []).forEach(function (entry) { data.groups[entry.ChannelId] = entry.Groups || []; });
            data.pending = false;
            data.loadedAt = Date.now();
            schedule();
            return data.channels;
        }).catch(function (error) {
            if (catalog === data) { data.pending = false; data.loadedAt = Date.now(); data.failed = true; }
            throw error;
        });
        return data.promise;
    }
    function applyGuideFilters(header, guide, rows, headers) {
        var toolbar = header.querySelector('.manual-guide-toolbar');
        if (!toolbar) return;
        var channels = rows.map(function (row) { return catalog && catalog.byId[row.getAttribute('data-channelid')]; }).filter(Boolean);
        var category = toolbar.querySelector('.manual-guide-category');
        if (catalog && !catalog.pending && !catalog.failed) populateCategories(category, channels, guideFilter.category);
        var search = toolbar.querySelector('.manual-guide-search');
        if (search.value !== guideFilter.search) search.value = guideFilter.search;
        toolbar.querySelector('.manual-guide-filter').value = guideFilter.status;
        var count = 0;
        var changed = false;
        var query = guideFilter.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        rows.forEach(function (row) {
            var id = row.getAttribute('data-channelid');
            var cell = headers.get(id);
            var channel = catalog && catalog.byId[id] || { Id: id, Name: cell && (cell.getAttribute('data-manual-guide-original-title') || cell.title) || '' };
            var text = query.length ? [channel.Name, cleanName(channel.Name), channel.ChannelNumber || channel.Number || '', groupNames(channel).join(' '), row.textContent].join(' ').toLocaleLowerCase() : '';
            var hasGuide = !!row.querySelector('.programCell');
            var visible = query.every(function (term) { return text.includes(term); }) &&
                channelMatches(channel, '', guideFilter.category, guideFilter.status) &&
                (guideFilter.status !== 'missing' || !hasGuide) && (guideFilter.status !== 'available' || hasGuide);
            if (visible) count++;
            [row, cell].filter(Boolean).forEach(function (e) {
                if (e.classList.contains('manual-guide-filter-hidden') === visible) {
                    e.classList.toggle('manual-guide-filter-hidden', !visible);
                    changed = true;
                }
            });
        });
        var status = toolbar.querySelector('.manual-guide-filter-count');
        var text = rows.length ? (count ? count + ' of ' + rows.length + ' channels' : 'No matching channels') : 'Loading channels…';
        if (catalog && catalog.groupsUnavailable) text += ' · Categories unavailable';
        if (filterStorageError) text += ' · ' + filterStorageError;
        if (status.textContent !== text) status.textContent = text;
        if (changed) {
            var scroller = guide.querySelector('.guideVerticalScroller');
            if (scroller) {
                if (scroller.scroller && scroller.scroller.reload) scroller.scroller.reload();
                else if (scroller.refresh) scroller.refresh();
                scroller.scrollTop = 0;
            }
            if (document.activeElement && document.activeElement.closest('.manual-guide-filter-hidden')) toolbar.querySelector('.manual-guide-search').focus();
        }
    }


    function resetGuideFilters() {
        clearTimeout(searchTimer);
        guideFilter = emptyFilters();
        saveGuideFilters();
        document.querySelectorAll('.manual-guide-toolbar').forEach(function (toolbar) {
            toolbar.querySelector('.manual-guide-search').value = '';
            toolbar.querySelector('.manual-guide-category').value = '';
            toolbar.querySelector('.manual-guide-filter').value = 'all';
        });
        closeModal();
        document.querySelectorAll('.manual-guide-filter-hidden').forEach(function (row) { row.classList.remove('manual-guide-filter-hidden'); });
        schedule();
    }

    function cleanName(name) {
        return String(name || '').replace(/^(?:\d+\s+)?NBA\s+\d+\s*:\s*/i, '').trim();
    }
    function account(client) {
        return client.serverId() + ':' + client.getCurrentUserId();
    }
    function element(tag, className, text) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }
    function localDate(date) {
        var pad = function (n) { return String(n).padStart(2, '0'); };
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    }
    function closeModal() {
        if (!modal) return;
        var previous = modal.previousFocus;
        modal.remove();
        modal = null;
        if (previous && previous.isConnected) previous.focus();
    }
    function setStatus(text) {
        document.querySelectorAll('.manual-guide-status').forEach(function (e) { e.textContent = text; });
    }
    function openRecording(channelId) {
        var client = window.ApiClient;
        if (!client || !permission || client !== currentClient) return;
        closeModal();
        var owner = account(client);
        var overlay = element('div', 'manual-guide-overlay');
        overlay.previousFocus = document.activeElement;
        var form = element('form', 'manual-guide-dialog');
        form.setAttribute('role', 'dialog');
        form.setAttribute('aria-modal', 'true');
        form.setAttribute('aria-labelledby', 'manual-guide-heading');
        form.innerHTML = '<h2 id="manual-guide-heading">Manual recording</h2>' +
            '<p>Record a channel by time, even when guide data is missing. Times use your browser’s local timezone.</p>' +
            '<label>Search channels<input name="search" type="search" placeholder="Channel, team or event" autocomplete="off"></label>' +
            '<div class="manual-guide-form-filters"><label>Category<select name="category"><option value="">All categories</option></select></label>' +
            '<label>Show<select name="filter"><option value="all">All channels</option><option value="favourites">Favourites</option></select></label></div>' +
            '<p class="manual-guide-channel-count" role="status">Loading channels…</p>' +
            '<label>Channel<select name="channel" required disabled></select></label>' +
            '<label>Recording title<input name="title" maxlength="200" required></label>' +
            '<label class="manual-guide-now"><input name="now" type="checkbox" checked> Start now</label>' +
            '<label>Start date and time<input name="start" type="datetime-local" required disabled></label>' +
            '<label>Duration (minutes)<input name="duration" type="number" min="1" max="1440" step="1" value="180" required></label>' +
            '<p class="manual-guide-error" role="alert"></p>' +
            '<div class="manual-guide-actions"><button type="button" name="cancel">Cancel</button><button type="submit" name="save" disabled>Save recording</button></div>';
        overlay.appendChild(form);
        document.body.appendChild(overlay);
        modal = overlay;
        var fields = form.elements;
        var error = form.querySelector('.manual-guide-error');
        var availableChannels = [];
        var busy = false;
        fields.search.value = guideFilter.search;
        fields.start.value = localDate(new Date(Date.now() + 60000));
        fields.cancel.addEventListener('click', closeModal);
        fields.now.addEventListener('change', function () {
            fields.start.disabled = fields.now.checked;
        });
        function selectedChannel() {
            return availableChannels.find(function (c) { return c.Id === fields.channel.value; });
        }
        function updateChannelChoices(preferredId) {
            var previousId = preferredId || fields.channel.value;
            var matches = availableChannels.filter(function (channel) {
                return channelMatches(channel, fields.search.value, fields.category.value, fields.filter.value);
            });
            fields.channel.textContent = '';
            matches.forEach(function (channel) {
                var option = element('option', '', cleanName(channel.Name));
                option.value = channel.Id;
                fields.channel.appendChild(option);
            });
            if (matches.some(function (channel) { return channel.Id === previousId; })) fields.channel.value = previousId;
            if (!matches.length) {
                var empty = element('option', '', 'No matching channels');
                empty.value = '';
                fields.channel.appendChild(empty);
            }
            var selected = selectedChannel();
            if (!selected || fields.channel.value !== previousId || !fields.title.value) fields.title.value = selected ? cleanName(selected.Name) : '';
            fields.channel.disabled = !selected;
            fields.save.disabled = busy || !selected;
            form.querySelector('.manual-guide-channel-count').textContent = matches.length ? matches.length + ' of ' + availableChannels.length + ' channels' : 'No matching channels';
        }
        fields.search.addEventListener('input', function () { updateChannelChoices(); });
        fields.category.addEventListener('change', function () { updateChannelChoices(); });
        fields.filter.addEventListener('change', function () { updateChannelChoices(); });
        fields.channel.addEventListener('change', function () {
            var selected = selectedChannel();
            fields.title.value = selected ? cleanName(selected.Name) : '';
        });
        overlay.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
            if (event.key === 'Escape') { event.preventDefault(); if (!busy) closeModal(); }
            if (event.key === 'Tab') {
                var controls = Array.from(form.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)'));
                var first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            if (busy || modal !== overlay || !form.reportValidity()) return;
            error.textContent = '';
            var selected = selectedChannel();
            var startNow = fields.now.checked;
            var start = startNow ? new Date() : new Date(fields.start.value);
            var minutes = Number(fields.duration.value);
            var name = fields.title.value.trim();
            if (!selected || !name || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440 || !Number.isFinite(start.getTime())) {
                error.textContent = 'Choose a channel, title, valid start time and duration between 1 and 1440 minutes.'; return;
            }
            if (!startNow && start.getTime() <= Date.now()) {
                error.textContent = 'Choose a start time in the future, or select Start now.'; return;
            }
            if (window.ApiClient !== client || account(client) !== owner) {
                error.textContent = 'Your account changed. Close this form and open it again.'; return;
            }
            busy = true;
            var disabledBefore = Array.from(fields).map(function (control) { return [control, control.disabled]; });
            disabledBefore.forEach(function (entry) { entry[0].disabled = true; });
            try {
                var user = await client.getCurrentUser(false);
                if (!user.Policy || !user.Policy.EnableLiveTvManagement || user.Policy.EnableLiveTvAccess === false) throw new Error('permission');
                // Jellyfin may replace a manual timer's times with an EPG programme
                // whose start is within three minutes. Never silently change the user's window.
                var matching = await client.getLiveTvPrograms({
                    ChannelIds: [selected.Id],
                    MinStartDate: new Date(start.getTime() - 180000).toISOString(),
                    MaxStartDate: new Date(start.getTime() + 180000).toISOString(),
                    Limit: 1,
                    EnableImages: false
                });
                if (matching.Items && matching.Items.length) {
                    error.textContent = 'This start time matches a guide programme. Use its Record button, or choose a start time more than three minutes away.';
                    return;
                }
                var defaults = await client.getNewLiveTvTimerDefaults({});
                if (window.ApiClient !== client || account(client) !== owner || modal !== overlay) throw new Error('account');
                if (startNow) start = new Date();
                await client.createLiveTvTimer({
                    ChannelId: selected.Id,
                    ServiceName: defaults.ServiceName,
                    Name: name,
                    StartDate: start.toISOString(),
                    EndDate: new Date(start.getTime() + minutes * 60000).toISOString(),
                    PrePaddingSeconds: 0,
                    PostPaddingSeconds: 0,
                    IsPrePaddingRequired: false,
                    IsPostPaddingRequired: false,
                    Priority: defaults.Priority,
                    Status: 'New'
                });
                if (modal === overlay) {
                    setStatus('Recording saved: ' + name + '. Manage it in Jellyfin’s recording schedule.');
                    closeModal();
                }
            } catch (e) {
                error.textContent = 'Could not save the recording. Check your recording permissions and channel access, then try again.';
            } finally {
                busy = false;
                disabledBefore.forEach(function (entry) { entry[0].disabled = entry[1]; });
                fields.save.disabled = !selectedChannel();
            }
        });
        fields.cancel.focus();
        loadCatalog(client, owner).then(function (channels) {
            if (modal !== overlay || window.ApiClient !== client || account(client) !== owner) return;
            availableChannels = channels;
            populateCategories(fields.category, availableChannels, guideFilter.category);
            updateChannelChoices(channelId);
            fields.search.focus();
        }).catch(function () { error.textContent = 'Could not load channels. Close this form and try again.'; });
    }

    function render() {
        queued = false;
        if (document.documentElement.classList.contains('layout-tv')) return;
        var client = window.ApiClient;
        if (!client || !client.getCurrentUserId()) {
            closeModal();
            currentClient = null;
            currentAccount = '';
            guideFilter = emptyFilters();
            document.querySelectorAll('.manual-guide-toolbar').forEach(function (toolbar) { toolbar.remove(); });
            return;
        }
        var key = account(client);
        if (client !== currentClient || key !== currentAccount) {
            closeModal();
            currentClient = client;
            currentAccount = key;
            permission = false;
            permissionPending = false;
            catalog = null;
            guideFilter = loadGuideFilters();
            document.querySelectorAll('.manual-guide-toolbar').forEach(function (toolbar) { toolbar.remove(); });
        }
        var headers = Array.from(document.querySelectorAll('.tvGuideHeader')).filter(function (header) {
            return !header.closest('.page.hide');
        });
        if (!headers.length) return;
        loadCatalog(client, key).catch(function () { /* Existing guide rows can still be searched. */ });
        if (!permissionPending) {
            permissionPending = true;
            client.getCurrentUser(false).then(function (user) {
                if (client !== currentClient || key !== currentAccount) return;
                permission = !!(user.Policy && user.Policy.EnableLiveTvManagement && user.Policy.EnableLiveTvAccess !== false);
                schedule();
            }).catch(function () { /* Do not offer recording controls without verified permission. */ });
        }
        headers.forEach(function (header) {
            var toolbar = header.querySelector('.manual-guide-toolbar');
            if (!toolbar) {
                toolbar = element('div', 'manual-guide-toolbar');
                var searchLabel = element('label', 'manual-guide-search-label', 'Search guide');
                var search = element('input', 'manual-guide-search');
                search.type = 'search';
                search.placeholder = 'Channel, team or programme';
                search.value = guideFilter.search;
                search.addEventListener('input', function () {
                    guideFilter.search = search.value;
                    saveGuideFilters();
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(schedule, 120);
                });
                searchLabel.appendChild(search);
                toolbar.appendChild(searchLabel);
                var categoryLabel = element('label', '', 'Category');
                var category = element('select', 'manual-guide-category');
                category.appendChild(element('option', '', 'All categories'));
                category.options[0].value = '';
                category.addEventListener('change', function () { guideFilter.category = category.value; saveGuideFilters(); schedule(); });
                categoryLabel.appendChild(category);
                toolbar.appendChild(categoryLabel);
                var filterLabel = element('label', '', 'Show');
                var filter = element('select', 'manual-guide-filter');
                [['all', 'All channels'], ['missing', 'No guide data'], ['available', 'With guide data'], ['favourites', 'Favourites']].forEach(function (entry) {
                    var option = element('option', '', entry[1]); option.value = entry[0]; filter.appendChild(option);
                });
                filter.value = guideFilter.status;
                filter.addEventListener('change', function () { guideFilter.status = filter.value; saveGuideFilters(); schedule(); });
                filterLabel.appendChild(filter);
                toolbar.appendChild(filterLabel);
                var clear = element('button', 'manual-guide-clear', 'Clear filters');
                clear.type = 'button';
                clear.addEventListener('click', resetGuideFilters);
                toolbar.appendChild(clear);
                var count = element('span', 'manual-guide-filter-count');
                count.setAttribute('role', 'status');
                toolbar.appendChild(count);
                var button = element('button', 'manual-guide-record', 'Manual recording');
                button.type = 'button';
                button.addEventListener('click', function () { openRecording(); });
                toolbar.appendChild(button);
                var status = element('span', 'manual-guide-status');
                status.setAttribute('role', 'status');
                toolbar.appendChild(status);
                header.appendChild(toolbar);
            }
            toolbar.querySelector('.manual-guide-record').hidden = !permission;
        });
        headers.forEach(function (guideHeader) {
            var guide = guideHeader.closest('.tvguide') || guideHeader.closest('.page') || document;
            if (!guide.querySelector('.programGrid')) guide = document;
            var rows = Array.from(guide.querySelectorAll('.programGrid .channelPrograms'));
            var channelHeaders = new Map(Array.from(guide.querySelectorAll('.guide-channelHeaderCell')).map(function (header) {
                return [header.getAttribute('data-id'), header];
            }));
            rows.forEach(function (row) {
                var fallback = row.querySelector('.manual-guide-fallback');
                if (row.querySelector('.programCell')) { if (fallback) fallback.remove(); return; }
                var id = row.getAttribute('data-channelid');
                var header = channelHeaders.get(id);
                if (!header) return;
                var title = cleanName(header.getAttribute('data-manual-guide-original-title') || header.title);
                if (!fallback) {
                    fallback = element('div', 'manual-guide-fallback');
                    fallback.appendChild(element('span', 'manual-guide-label'));
                    var record = element('button', '', 'Record by time');
                    record.type = 'button';
                    record.addEventListener('click', function () { openRecording(id); });
                    fallback.appendChild(record);
                    row.appendChild(fallback);
                }
                var label = fallback.querySelector('.manual-guide-label');
                var text = title + ' — No guide data';
                if (label.textContent !== text) label.textContent = text;
                fallback.querySelector('button').hidden = !permission;
                if (/^(?:\d+\s+)?NBA\s+\d+\s*:/i.test(header.title)) {
                    header.setAttribute('data-manual-guide-original-title', header.title);
                    header.title = title;
                    var visibleName = header.querySelector('.guideChannelName');
                    if (visibleName) visibleName.textContent = title;
                }
            });
            applyGuideFilters(guideHeader, guide, rows, channelHeaders);
        });
    }
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(render);
    }
    function start() {
        observer = new MutationObserver(function (records) {
            if (records.some(function (r) {
                if (r.target.nodeType === 1 && r.target.closest('.manual-guide-overlay, .manual-guide-toolbar, .manual-guide-fallback')) return false;
                if (r.target.nodeType === 1 && r.target.closest('.programGrid, .channelsContainer, .tvGuideHeader')) return true;
                return Array.from(r.addedNodes).some(function (n) { return n.nodeType === 1 && (n.matches('.tvguide, .tvGuideHeader, .programGrid') || n.querySelector('.tvGuideHeader')); });
            })) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        function onNavigation() {
            closeModal();
            schedule();
        }
        window.addEventListener('hashchange', onNavigation);
        window.addEventListener('popstate', onNavigation);
        document.addEventListener('viewbeforeshow', onNavigation);
        document.addEventListener('viewbeforehide', function (event) {
            var view = event.target;
            if (view.matches && (view.matches('.tvguide') || view.querySelector('.tvGuideHeader'))) onNavigation();
        });
        schedule();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
