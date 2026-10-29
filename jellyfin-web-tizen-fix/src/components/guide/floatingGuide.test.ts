import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../dialogHelper/dialogHelper', () => ({ default: {
    createDialog: () => {
        const dialog = document.createElement('div');
        dialog.className = 'dialog opened';
        return dialog;
    },
    open: (dialog: HTMLElement) => {
        document.body.appendChild(dialog);
        return Promise.resolve();
    },
    close: (dialog: HTMLElement) => {
        dialog.dispatchEvent(new Event('closing'));
        dialog.dispatchEvent(new Event('close'));
        dialog.remove();
    }
} }));
vi.mock('../../scripts/inputManager', () => ({ default: {
    on: (element: HTMLElement, handler: EventListener) => element.addEventListener('command', handler),
    off: (element: HTMLElement, handler: EventListener) => element.removeEventListener('command', handler)
} }));

import openFloatingGuide, { layoutPrograms } from './floatingGuide';

describe('floating playback guide', () => {
    let close: (() => void) | undefined;
    const now = Date.parse('2026-10-29T00:10:00Z');
    const current = { ChannelId: 'one', Name: 'Current programme', StartDate: '2026-10-29T00:00:00Z', EndDate: '2026-10-29T01:00:00Z', Overview: 'Programme detail' };
    const future = { ChannelId: 'one', Name: 'Next programme', StartDate: '2026-10-29T01:00:00Z', EndDate: '2026-10-29T02:00:00Z' };
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
    const keyboard = (key: string) => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const api = () => ({
        getCurrentUserId: vi.fn(() => 'owner'),
        getLiveTvChannels: vi.fn().mockResolvedValue({ Items: [{ Id: 'one', Name: 'Channel one' }, { Id: 'two', Name: '<Second & channel>' }], TotalRecordCount: 2 }),
        getLiveTvPrograms: vi.fn().mockResolvedValue({ Items: [current, future] })
    });
    const open = (client = api(), onTune = vi.fn().mockResolvedValue(undefined)) => {
        const onClose = vi.fn();
        const handle = openFloatingGuide({ apiClient: client, channelId: 'one', onTune, onClose });
        close = handle.close;
        return { client, onTune, onClose, handle };
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(now);
    });
    afterEach(() => {
        close?.();
        close = undefined;
        document.body.textContent = '';
        vi.useRealTimers();
    });

    it('clips programme geometry to the visible time window and rejects malformed dates', () => {
        const programs = [current, future, { ...current, StartDate: 'invalid' }, { ...current, EndDate: '2026-10-28T23:00:00Z' }];
        const cells = layoutPrograms(programs, 'one', now, now + 60 * 60000);
        expect(cells).toHaveLength(2);
        expect(cells[0]?.left).toBe(0);
        expect(cells[0]?.width).toBeCloseTo(100 * 50 / 60);
        expect(cells[1]?.width).toBeCloseTo(100 * 10 / 60);
    });

    it('loads authenticated guide data without changing playback and treats channel names as text', async () => {
        const { client, onTune } = open();
        await flush();
        expect(client.getLiveTvChannels).toHaveBeenCalledWith(expect.objectContaining({ UserId: 'owner', Limit: 500 }));
        expect(client.getLiveTvPrograms).toHaveBeenCalledWith(expect.objectContaining({ UserId: 'owner', channelIds: 'one,two', EnableImages: false }));
        expect(document.querySelectorAll('.floatingGuideRow')).toHaveLength(2);
        expect(document.querySelectorAll('.floatingGuideChannel')[1].textContent).toBe('<Second & channel>');
        expect(document.querySelector('.floatingGuideChannel img')).toBeNull();
        expect(onTune).not.toHaveBeenCalled();
        expect(document.activeElement?.textContent).toBe('Current programme');
    });

    it('moves focus with the remote and only changes channel after explicit selection', async () => {
        const { onTune } = open();
        await flush();
        keyboard('ArrowDown');
        expect(document.activeElement?.textContent).toContain('No guide data');
        expect(onTune).not.toHaveBeenCalled();
        keyboard('Enter');
        await flush();
        expect(onTune).toHaveBeenCalledExactlyOnceWith('two');
        expect(document.querySelector('.floatingLiveGuide')).toBeNull();
    });

    it('browses future programmes without tuning or navigating away', async () => {
        const { onTune } = open();
        await flush();
        keyboard('ArrowRight');
        keyboard('Enter');
        expect(onTune).not.toHaveBeenCalled();
        expect(document.querySelector('.floatingGuideStatus')?.textContent).toContain('Scheduled programme');
        expect(document.querySelector('.floatingGuideDetail')?.textContent).toContain('Next programme');
        expect(document.querySelector('.floatingLiveGuide')).not.toBeNull();
    });

    it('returns to the currently playing channel without restarting it', async () => {
        const { onTune, onClose } = open();
        await flush();
        keyboard('Enter');
        expect(onTune).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('Back closes only the overlay and disposes refresh work', async () => {
        const { onTune, client } = open();
        await flush();
        const event = new CustomEvent('command', { detail: { command: 'back' }, bubbles: true, cancelable: true });
        document.activeElement?.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(onTune).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(120000);
        expect(client.getLiveTvChannels).toHaveBeenCalledTimes(1);
    });

    it('retains live channel selection when EPG requests fail', async () => {
        const client = api();
        client.getLiveTvPrograms.mockRejectedValue(new Error('EPG unavailable'));
        const { onTune } = open(client);
        await flush();
        expect(document.querySelector('.floatingGuideStatus')?.textContent).toContain('Programme data could not be loaded');
        expect(document.querySelectorAll('.floatingGuideEmpty')).toHaveLength(2);
        (document.querySelectorAll('.floatingGuideChannel')[1] as HTMLButtonElement).click();
        await flush();
        expect(onTune).toHaveBeenCalledExactlyOnceWith('two');
    });

    it('G closes the overlay without restarting the stream', async () => {
        const { onTune } = open();
        await flush();
        keyboard('g');
        expect(document.querySelector('.floatingLiveGuide')).toBeNull();
        expect(onTune).not.toHaveBeenCalled();
    });

    it('shows recoverable channel errors without issuing playback requests', async () => {
        const client = api();
        client.getLiveTvChannels.mockRejectedValue(new Error('Channels unavailable'));
        const { onTune } = open(client);
        await flush();
        expect(document.querySelector('.floatingGuideStatus')?.textContent).toContain('Channels could not be loaded');
        expect(document.activeElement?.textContent).toBe('Close');
        expect(onTune).not.toHaveBeenCalled();
    });

    it('ignores late results after closing or changing accounts', async () => {
        const client = api();
        let resolve: (value: object) => void = () => undefined;
        client.getLiveTvChannels.mockReturnValue(new Promise(done => { resolve = done; }));
        const { handle, onTune } = open(client);
        handle.close();
        resolve({ Items: [{ Id: 'late', Name: 'Late result' }] });
        await flush();
        expect(document.querySelector('.floatingGuideRow')).toBeNull();
        expect(client.getLiveTvPrograms).not.toHaveBeenCalled();
        expect(onTune).not.toHaveBeenCalled();
        const other = api();
        open(other);
        other.getCurrentUserId.mockReturnValue('different');
        await flush();
        expect(document.querySelector('.floatingLiveGuide')).toBeNull();
    });

    it('does not allow player command defaults to seek or change channels while browsing', async () => {
        const { onTune } = open();
        await flush();
        for (const action of ['pageup', 'pagedown', 'channelup', 'channeldown']) {
            const event = new CustomEvent('command', { detail: { command: action }, bubbles: true, cancelable: true });
            document.activeElement?.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }
        expect(onTune).not.toHaveBeenCalled();
    });

    it('allows explicit volume and play/pause commands without OSD navigation', async () => {
        const { onTune } = open();
        await flush();
        for (const action of ['volumeup', 'volumedown', 'mute', 'playpause']) {
            const event = new CustomEvent('command', { detail: { command: action }, bubbles: true, cancelable: true });
            document.activeElement?.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
        }
        expect(onTune).not.toHaveBeenCalled();
    });
});
