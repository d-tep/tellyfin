import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseWindow, RemoteSubtitleStream } from '../plugins/htmlVideoPlayer/remoteSubtitleStream';

class Request {
    static readonly all: Request[] = [];
    status = 200;
    responseText = '';
    timeout = 0;
    url = '';
    aborted = false;
    onprogress: (() => void) | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    constructor() { Request.all.push(this); }
    open(_method: string, url: string) { this.url = url; }
    send() { /* Controlled by the fixture. */ }
    abort() { this.aborted = true; }
    progress(text: string) {
        this.responseText = text;
        this.onprogress?.();
    }
    finish(text = this.responseText) {
        this.responseText = text + '\nNOTE jellyfin-window-complete\n\n';
        this.onload?.();
    }
}

function fixture(initialTime = 0, sourceOffset = 0) {
    const video = document.createElement('video');
    video.currentTime = initialTime;
    const cues: TextTrackCue[] = [];
    let mode: TextTrackMode = 'disabled';
    const track = {
        cues: Object.assign(cues, { getCueById: (id: string) => cues.find(cue => cue.id === id) || null }),
        get mode() { return mode; },
        set mode(value: TextTrackMode) { mode = value; },
        addCue(cue: TextTrackCue) { cues.push(cue); },
        removeCue(cue: TextTrackCue) { cues.splice(cues.indexOf(cue), 1); }
    };
    const error = vi.fn();
    let offset = sourceOffset;
    const stream = new RemoteSubtitleStream({
        video, track, url: start => `/window?start=${start}`,
        position: () => video.currentTime + sourceOffset,
        offset: () => offset,
        duration: () => 7200,
        onError: error
    });
    return {
        video, track, stream, error,
        setOffset: (value: number) => {
            offset = value;
        }
    };
}

describe('streaming remote subtitles', () => {
    beforeEach(() => {
        Request.all.length = 0;
        vi.stubGlobal('XMLHttpRequest', Request);
        vi.stubGlobal('VTTCue', class extends EventTarget {
            constructor(public startTime: number, public endTime: number, public text: string) {
                super();
            }
        });
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('parses only complete WebVTT cues, including hours and CRLF', () => {
        expect(parseWindow('WEBVTT\r\n\r\n1\r\n01:02:03.004 --> 01:02:05.006\r\nFixture\r\n\r\n00:07.000 --> 00:08.000\r\nPartial'))
            .toEqual([{ start: 3723.004, end: 3725.006, text: 'Fixture' }]);
        expect(parseWindow('WEBVTT\n\nNOTE no cues\n\n')).toEqual([]);
    });

    it('renders cues before the window finishes and does not duplicate progress events', () => {
        const { track, stream } = fixture();
        const xhr = Request.all[0];
        xhr.progress('WEBVTT\n\n00:01.000 --> 00:03.000\nFixture\n\n');
        xhr.progress(xhr.responseText);
        expect(track.cues).toHaveLength(1);
        expect(track.cues[0].startTime).toBe(1);
        expect(track.mode).toBe('showing');
        xhr.finish();
        expect(Request.all).toHaveLength(1);
        stream.dispose();
    });

    it('enables the track before data arrives and does not reset native display mode on each chunk', () => {
        const { track, stream } = fixture();
        expect(track.mode).toBe('showing');
        const setter = vi.spyOn(track, 'mode', 'set');
        const xhr = Request.all[0];
        xhr.progress('WEBVTT\n\n00:01.000 --> 00:03.000\nFirst\n\n00:04.000 --> 00:');
        expect(track.cues).toHaveLength(1);
        xhr.progress(xhr.responseText + '06.000\nSecond\n\n');
        expect(track.cues).toHaveLength(2);
        expect(setter).not.toHaveBeenCalled();
        stream.dispose();
    });

    it('prefetches the next overlapping window and applies source and subtitle offsets', () => {
        const { video, track, stream, setOffset } = fixture();
        Request.all[0].finish();
        for (let time = 1; time <= 40; time++) {
            video.currentTime = time;
            video.dispatchEvent(new Event('timeupdate'));
        }
        expect(Request.all[1].url).toBe('/window?start=90');
        setOffset(2);
        Request.all[1].progress('WEBVTT\n\n01:31.000 --> 01:33.000\nFixture\n\n');
        expect(track.cues[0].startTime).toBe(89);
        stream.dispose();
    });

    it('cancels stale requests on seek and ignores responses after disposal', () => {
        const { video, track, stream } = fixture();
        const old = Request.all[0];
        video.currentTime = 2400;
        video.dispatchEvent(new Event('seeked'));
        expect(old.aborted).toBe(true);
        expect(Request.all[1].url).toBe('/window?start=2395');
        old.progress('WEBVTT\n\n00:01.000 --> 00:03.000\nStale\n\n');
        expect(track.cues).toHaveLength(0);
        stream.dispose();
        Request.all[1].progress('WEBVTT\n\n00:01.000 --> 00:03.000\nFixture\n\n');
        expect(track.cues).toHaveLength(0);
        expect(Request.all[1].aborted).toBe(true);
        expect(track.mode).toBe('disabled');
    });

    it('keeps absolute cue times across overlapping windows and clips a cue crossing a resumed source origin', () => {
        const { video, track, stream } = fixture(10, 2408);
        expect(Request.all[0].url).toBe('/window?start=2413');
        const data = 'WEBVTT\n\n40:07.072 --> 40:08.322\nCrossing origin\n\n41:35.100 --> 41:37.000\nOverlap\n\n';
        Request.all[0].progress(data);
        expect(track.cues[0].startTime).toBe(0);
        expect(track.cues[0].endTime).toBeCloseTo(0.322, 3);
        expect(track.cues[1].startTime).toBeCloseTo(87.1, 3);
        Request.all[0].finish();
        for (let time = 11; time <= 40; time++) {
            video.currentTime = time;
            video.dispatchEvent(new Event('timeupdate'));
        }
        expect(Request.all[1].url).toBe('/window?start=2503');
        Request.all[1].progress(data);
        expect(track.cues).toHaveLength(2);
        stream.dispose();
    });

    it.each(['http', 'truncated', 'timeout'])('retries %s failures with bounded backoff while retaining delivered cues', mode => {
        vi.useFakeTimers();
        const { error, stream, track } = fixture();
        for (let attempt = 0; attempt < 3; attempt++) {
            const xhr = Request.all[attempt];
            xhr.progress('WEBVTT\n\n00:01.000 --> 00:03.000\nFixture\n\n');
            if (mode === 'timeout') {
                xhr.status = 0;
                xhr.ontimeout?.();
            } else {
                xhr.status = mode === 'http' ? 429 : 200;
                xhr.onload?.();
            }
            expect(xhr.aborted).toBe(true);
            if (attempt < 2) {
                expect(error).not.toHaveBeenCalled();
                expect(track.cues).toHaveLength(1);
                expect(track.mode).toBe('showing');
                vi.advanceTimersByTime((attempt + 1) * 5000);
            }
        }
        expect(Request.all).toHaveLength(3);
        expect(error).toHaveBeenCalledOnce();
        expect(track.mode).toBe('disabled');
        stream.dispose();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('abandons retries after seeking or disposing', () => {
        vi.useFakeTimers();
        const { video, stream, error } = fixture();
        Request.all[0].status = 0;
        Request.all[0].onerror?.();
        video.currentTime = 2400;
        video.dispatchEvent(new Event('seeked'));
        expect(Request.all[1].url).toBe('/window?start=2395');
        vi.advanceTimersByTime(15000);
        expect(Request.all).toHaveLength(2);
        Request.all[1].status = 0;
        Request.all[1].onerror?.();
        stream.dispose();
        vi.advanceTimersByTime(15000);
        expect(Request.all).toHaveLength(2);
        expect(error).not.toHaveBeenCalled();
    });

    it('surfaces authorization errors without retrying', () => {
        const { error, stream } = fixture();
        Request.all[0].status = 403;
        Request.all[0].onload?.();
        expect(error).toHaveBeenCalledOnce();
        expect(Request.all).toHaveLength(1);
        stream.dispose();
    });
});
