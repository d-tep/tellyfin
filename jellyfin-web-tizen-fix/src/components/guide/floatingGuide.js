import dialogHelper from '../dialogHelper/dialogHelper';
import inputManager from '../../scripts/inputManager';
import './floatingGuide.scss';

const HALF_HOUR = 30 * 60 * 1000;
const WINDOW_LENGTH = 4 * HALF_HOUR;

export function layoutPrograms(programs, channelId, start, end) {
    return programs.filter(program => program.ChannelId === channelId).map(program => {
        const begins = Date.parse(program.StartDate);
        const finishes = Date.parse(program.EndDate);
        const left = Math.max(start, begins);
        const right = Math.min(end, finishes);
        if (!Number.isFinite(begins) || !Number.isFinite(finishes) || right <= left) return null;
        return { program, begins, finishes, left: 100 * (left - start) / (end - start), width: 100 * (right - left) / (end - start) };
    }).filter(Boolean).sort((a, b) => a.begins - b.begins);
}

// A separate dialog keeps the current player and route alive while browsing.
export default function openFloatingGuide({ apiClient, channelId, onTune, onClose }) {
    const owner = apiClient.getCurrentUserId();
    const dialog = dialogHelper.createDialog({ enableHistory: false, autoFocus: false, scrollY: false });
    dialog.classList.add('dialog-fixedSize', 'floatingLiveGuide');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Live TV guide');
    dialog.innerHTML = '<div class="floatingGuideHeader"><h2>Live TV guide</h2><div class="floatingGuideActions"><button type="button" data-action="earlier">Earlier</button><button type="button" data-action="now">Now</button><button type="button" data-action="later">Later</button><button type="button" data-action="retry">Refresh</button><button type="button" data-action="close">Close</button></div></div><div class="floatingGuideDetail"></div><div class="floatingGuideTimes"></div><div class="floatingGuideRows"></div><div class="floatingGuideStatus" role="status" aria-live="polite"></div>';
    const rows = dialog.querySelector('.floatingGuideRows');
    const status = dialog.querySelector('.floatingGuideStatus');
    const detail = dialog.querySelector('.floatingGuideDetail');
    const times = dialog.querySelector('.floatingGuideTimes');
    let offset = 0;
    let generation = 0;
    let closed = false;
    let closing = false;
    let tuning = false;
    const refreshTimer = setInterval(() => {
        if (!offset && !tuning) void refresh();
    }, 60000);
    let channels = [];

    const clock = value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const stillOwned = () => apiClient.getCurrentUserId() === owner;
    const close = () => {
        if (!closed && !closing) {
            closing = true;
            dialogHelper.close(dialog);
        }
    };
    const valid = request => {
        if (!stillOwned()) close();
        return !closed && !closing && request === generation && stillOwned();
    };

    function button(text, className) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = className;
        element.textContent = text;
        return element;
    }

    function focus(element) {
        if (!element) return;
        element.focus();
        const row = element.closest('.floatingGuideRow');
        if (row) {
            const top = row.offsetTop;
            if (top < rows.scrollTop) rows.scrollTop = top;
            else if (top + row.offsetHeight > rows.scrollTop + rows.clientHeight) rows.scrollTop = top + row.offsetHeight - rows.clientHeight;
        }
    }

    async function tune(id) {
        if (tuning || closed || closing || !stillOwned()) return;
        if (id === channelId) {
            close();
            return;
        }
        tuning = true;
        status.textContent = 'Switching channel…';
        try {
            await onTune(id);
            close();
        } catch {
            if (!closed && !closing) status.textContent = 'Could not switch channel. Try again or close the guide.';
        } finally {
            tuning = false;
        }
    }

    async function refresh() {
        const request = ++generation;
        if (!valid(request)) return;
        const active = document.activeElement;
        const activeRow = active?.closest('.floatingGuideRow');
        const focusChannel = activeRow?.dataset.channelId || channelId;
        const restoreGridFocus = !rows.children.length || rows.contains(active);
        const start = Math.floor(Date.now() / HALF_HOUR) * HALF_HOUR + offset * WINDOW_LENGTH;
        const end = start + WINDOW_LENGTH;
        dialog.querySelector('[data-action="earlier"]').disabled = offset === 0;
        dialog.querySelector('[data-action="later"]').disabled = offset >= 12;
        status.textContent = 'Loading guide…';
        try {
            const channelResult = await apiClient.getLiveTvChannels({ UserId: owner, Limit: 500, EnableCurrentProgram: true, EnableFavoriteSorting: true });
            if (!valid(request)) return;
            channels = channelResult.Items || [];
            let programs = [];
            let guideFailed = false;
            if (channels.length) {
                try {
                    const result = await apiClient.getLiveTvPrograms({ UserId: owner, channelIds: channels.map(channel => channel.Id).join(','), MinEndDate: new Date(start).toISOString(), MaxStartDate: new Date(end).toISOString(), EnableImages: false, EnableTotalRecordCount: false, SortBy: 'StartDate' });
                    programs = result.Items || [];
                } catch {
                    guideFailed = true;
                }
            }
            if (!valid(request)) return;
            rows.textContent = '';
            times.textContent = '';
            for (let slot = 0; slot < 4; slot++) {
                const label = document.createElement('span');
                label.textContent = clock(start + slot * HALF_HOUR);
                times.appendChild(label);
            }
            channels.forEach(channel => {
                const row = document.createElement('div');
                row.className = 'floatingGuideRow';
                row.dataset.channelId = channel.Id;
                const name = button(channel.Name, 'floatingGuideChannel');
                name.title = channel.Name;
                name.dataset.watch = channel.Id;
                name.setAttribute('aria-label', 'Watch ' + channel.Name);
                if (channel.Id === channelId) name.setAttribute('aria-current', 'true');
                row.appendChild(name);
                const grid = document.createElement('div');
                grid.className = 'floatingGuidePrograms';
                const cells = layoutPrograms(programs, channel.Id, start, end);
                cells.forEach(cell => {
                    const element = button(cell.program.Name || 'Untitled programme', 'floatingGuideProgram');
                    element.style.left = cell.left + '%';
                    element.style.width = cell.width + '%';
                    element.dataset.begins = cell.begins;
                    element.dataset.finishes = cell.finishes;
                    element.dataset.channelId = channel.Id;
                    element.dataset.description = cell.program.Overview || '';
                    element.title = clock(cell.begins) + '–' + clock(cell.finishes) + ' · ' + element.textContent;
                    element.setAttribute('aria-label', element.title);
                    grid.appendChild(element);
                });
                if (!cells.length) {
                    const empty = button(guideFailed ? 'Guide unavailable · Watch channel' : 'No guide data · Watch channel', 'floatingGuideEmpty');
                    empty.dataset.watch = channel.Id;
                    grid.appendChild(empty);
                }
                row.appendChild(grid);
                rows.appendChild(row);
            });
            const total = channelResult.TotalRecordCount || channels.length;
            if (!channels.length) {
                status.textContent = 'No Live TV channels are available for this account.';
            } else if (guideFailed) {
                status.textContent = 'Programme data could not be loaded. Channels remain available; use Refresh to retry.';
            } else {
                status.textContent = 'Browse with arrows · Select a current programme or channel name to watch · Back closes';
            }
            if (total > channels.length) status.textContent += ' · Showing first ' + channels.length + ' of ' + total + ' channels.';
            if (restoreGridFocus && channels.length) {
                const row = Array.from(rows.children).find(element => element.dataset.channelId === focusChannel) || rows.firstElementChild;
                focus(row.querySelector('.floatingGuideProgram') || row.querySelector('.floatingGuideEmpty') || row.querySelector('.floatingGuideChannel'));
            }
        } catch {
            if (valid(request)) status.textContent = 'Channels could not be loaded. Use Refresh to retry; your current channel keeps playing.';
        }
    }

    function activate(element) {
        if (!element || closed || closing) return;
        if (element.dataset.watch) {
            void tune(element.dataset.watch);
            return;
        }
        if (element.classList.contains('floatingGuideProgram')) {
            const now = Date.now();
            if (Number(element.dataset.begins) <= now && Number(element.dataset.finishes) > now) void tune(element.dataset.channelId);
            else status.textContent = 'Scheduled programme. Select the channel name to watch its live stream.';
            return;
        }
        const action = element.dataset.action;
        if (action === 'close') {
            close();
        } else if (['earlier', 'now', 'later', 'retry'].includes(action)) {
            if (action === 'earlier') offset = Math.max(0, offset - 1);
            if (action === 'later') offset = Math.min(12, offset + 1);
            if (action === 'now') offset = 0;
            void refresh();
        }
    }

    function navigate(direction) {
        const active = document.activeElement;
        const row = active?.closest('.floatingGuideRow');
        if (row) {
            if (direction === 'up' || direction === 'down') {
                const next = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;
                if (next) {
                    const anchor = Number(active.dataset.begins) || Date.now();
                    const candidates = Array.from(next.querySelectorAll('.floatingGuideProgram'));
                    focus(candidates.find(cell => Number(cell.dataset.begins) <= anchor && Number(cell.dataset.finishes) > anchor) || next.querySelector('.floatingGuideEmpty') || next.querySelector('.floatingGuideChannel'));
                } else if (direction === 'up') {
                    focus(dialog.querySelector('[data-action="now"]'));
                }
            } else {
                const choices = Array.from(row.querySelectorAll('button'));
                const index = choices.indexOf(active) + (direction === 'left' ? -1 : 1);
                focus(choices[index] || dialog.querySelector('[data-action="' + (direction === 'left' ? 'now' : 'later') + '"]'));
            }
        } else if (direction === 'down') {
            focus(rows.querySelector('button'));
        } else if (direction === 'left' || direction === 'right') {
            const choices = Array.from(dialog.querySelectorAll('.floatingGuideActions button:not(:disabled)'));
            const index = choices.indexOf(active) + (direction === 'left' ? -1 : 1);
            focus(choices[Math.max(0, Math.min(choices.length - 1, index))]);
        }
    }

    function command(event) {
        const action = event.detail.command;
        event.stopImmediatePropagation();
        // Explicit volume/play/pause keys still work; navigation must not seek
        // or switch channels behind the guide.
        if (['volumeup', 'volumedown', 'mute', 'unmute', 'togglemute', 'play', 'pause', 'playpause'].includes(action)) return;
        event.preventDefault();
        if (action === 'back' || action === 'guide') close();
        else if (action === 'select') activate(document.activeElement);
        else if (['up', 'down', 'left', 'right'].includes(action)) navigate(action);
    }

    dialog.addEventListener('keydown', event => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        const guide = event.key === 'g' || event.key === 'G';
        // Older Samsung WebViews expose their Back key only as keyCode.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const back = ['Escape', 'GoBack', 'BrowserBack', 'Backspace'].includes(event.key) || event.keyCode === 10009;
        if (directions[event.key] || back || guide || event.key === 'Enter' || event.key === ' ' || event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            if (back || guide) {
                close();
            } else if (directions[event.key]) {
                navigate(directions[event.key]);
            } else if (event.key === 'Tab') {
                const choices = Array.from(dialog.querySelectorAll('button:not(:disabled)'));
                const next = choices.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1);
                focus(choices[(next + choices.length) % choices.length]);
            } else {
                activate(document.activeElement);
            }
        }
    });
    dialog.addEventListener('click', event => {
        const element = event.target.closest('button');
        if (element && dialog.contains(element)) {
            event.stopPropagation();
            activate(element);
        }
    });
    dialog.addEventListener('focusin', event => {
        const cell = event.target.closest('.floatingGuideProgram');
        if (cell) detail.textContent = cell.title + (cell.dataset.description ? ' · ' + cell.dataset.description : '');
        else if (event.target.dataset.watch) detail.textContent = (event.target.title || event.target.textContent) + ' · Select to watch. Browsing alone does not change playback.';
    });
    dialog.addEventListener('closing', () => {
        closing = true;
        generation++;
        clearInterval(refreshTimer);
    });
    dialog.addEventListener('close', () => {
        closed = true;
        generation++;
        clearInterval(refreshTimer);
        inputManager.off(dialog, command);
        onClose?.();
    }, { once: true });
    inputManager.on(dialog, command);
    void dialogHelper.open(dialog);
    // Leave the video visible above the lower panel.
    if (dialog.backdrop) dialog.backdrop.style.background = 'transparent';
    focus(dialog.querySelector('[data-action="close"]'));
    void refresh();
    return { close };
}
