interface CueData {
    start: number;
    end: number;
    text: string;
}

export function parseWindow(text: string): CueData[] {
    const blocks = text.replace(/\r/g, '').split('\n\n');
    blocks.pop(); // A cue is usable only after its terminating blank line arrives.
    return blocks.flatMap(block => {
        const lines = block.split('\n');
        const index = lines.findIndex(line => line.includes(' --> '));
        if (index === -1) return [];
        const match = /^((?:\d+:)?\d{2}:\d{2}\.\d{3}) --> ((?:\d+:)?\d{2}:\d{2}\.\d{3})/.exec(lines[index]);
        if (!match) return [];
        const seconds = (value: string) => value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
        return [{ start: seconds(match[1]), end: seconds(match[2]), text: lines.slice(index + 1).join('\n') }];
    });
}

interface Options {
    video: Pick<HTMLVideoElement, 'addEventListener' | 'removeEventListener' | 'currentTime'>;
    track: Pick<TextTrack, 'cues' | 'addCue' | 'removeCue' | 'mode'>;
    url: (start: number) => string;
    position: () => number;
    offset: () => number;
    duration: () => number;
    onError: (error: Error) => void;
}

export class RemoteSubtitleStream {
    private readonly pending = new Map<number, XMLHttpRequest>();
    private readonly completed = new Set<number>();
    private readonly retries = new Map<number, { attempts: number; after: number }>();
    private retryTimer?: ReturnType<typeof setTimeout>;
    private disposed = false;
    private anchor = 0;
    private lastPosition = 0;

    constructor(private readonly options: Options) {
        options.track.mode = 'showing';
        options.video.addEventListener('timeupdate', this.tick);
        options.video.addEventListener('seeked', this.tick);
        this.tick();
    }

    dispose() {
        this.disposed = true;
        this.options.video.removeEventListener('timeupdate', this.tick);
        this.options.video.removeEventListener('seeked', this.tick);
        this.pending.forEach(xhr => {
            xhr.abort();
        });
        this.pending.clear();
        clearTimeout(this.retryTimer);
        this.retries.clear();
        this.options.track.mode = 'disabled';
    }

    private readonly tick = () => {
        if (this.disposed) return;
        const position = Math.max(0, this.options.position());
        if (Math.abs(position - this.lastPosition) > 10) {
            this.anchor = Math.max(0, Math.floor(position) - 5);
        }
        this.lastPosition = position;
        const core = this.anchor + Math.floor((position - this.anchor) / 90) * 90;
        const start = Math.max(0, core);
        const next = core + 90;
        this.pending.forEach((xhr, key) => {
            if (key !== start && key !== next) {
                xhr.abort();
                this.pending.delete(key);
            }
        });
        this.completed.forEach(key => {
            if (Math.abs(key - start) > 240) this.completed.delete(key);
        });
        this.retries.forEach((_, key) => {
            if (key !== start && key !== next) this.retries.delete(key);
        });
        if (!this.retries.size) clearTimeout(this.retryTimer);
        const cues = Array.from(this.options.track.cues || []);
        cues.forEach(cue => {
            if (cue.endTime < this.options.video.currentTime - 120) this.options.track.removeCue(cue);
        });
        if (this.pending.size) return;
        if (!this.completed.has(start)) {
            this.load(start);
        } else if (position >= core + 30 && !this.completed.has(next) && next < this.options.duration()) {
            this.load(next);
        }
    };

    private load(start: number) {
        const retry = this.retries.get(start);
        if (retry && Date.now() < retry.after) return;
        const xhr = new XMLHttpRequest();
        this.pending.set(start, xhr);
        xhr.open('GET', this.options.url(start));
        xhr.timeout = 185000;
        let consumed = 0;
        xhr.onprogress = () => {
            if (this.disposed || this.pending.get(start) !== xhr || xhr.status !== 200) return;
            const remaining = xhr.responseText.slice(consumed);
            const lf = remaining.lastIndexOf('\n\n');
            const crlf = remaining.lastIndexOf('\r\n\r\n');
            const complete = Math.max(lf < 0 ? 0 : lf + 2, crlf < 0 ? 0 : crlf + 4);
            if (!complete) return;
            consumed += complete;
            for (const data of parseWindow(remaining.slice(0, complete))) {
                const from = data.start - this.options.offset();
                const to = data.end - this.options.offset();
                const cues = Array.from(this.options.track.cues || []);
                if (to <= 0 || to <= from || cues.some(cue => cue instanceof VTTCue && cue.text === data.text && cue.startTime < to && cue.endTime > from)) continue;
                const cue = new VTTCue(Math.max(0, from), Math.max(0, to), data.text);
                this.options.track.addCue(cue);
            }
        };
        const fail = () => {
            if (this.disposed || this.pending.get(start) !== xhr) return;
            const attempts = (retry?.attempts || 0) + 1;
            const recoverable = xhr.status === 0 || xhr.status === 200 || xhr.status === 408 || xhr.status === 429 || xhr.status >= 500;
            if (recoverable && attempts < 3) {
                console.warn(`Retrying remote subtitle window (HTTP ${xhr.status}, attempt ${attempts})`);
                this.pending.delete(start);
                xhr.abort();
                const delay = attempts * 5000;
                this.retries.set(start, { attempts, after: Date.now() + delay });
                clearTimeout(this.retryTimer);
                this.retryTimer = setTimeout(this.tick, delay);
                return;
            }
            this.dispose();
            this.options.onError(new Error(`Remote subtitle window failed (HTTP ${xhr.status})`));
        };
        xhr.onload = () => {
            if (this.disposed || this.pending.get(start) !== xhr) return;
            if (xhr.status !== 200 || !xhr.responseText.includes('NOTE jellyfin-window-complete')) {
                fail();
                return;
            }
            xhr.onprogress?.(new ProgressEvent('progress'));
            this.pending.delete(start);
            this.retries.delete(start);
            this.completed.add(start);
            this.tick();
        };
        xhr.onerror = fail;
        xhr.ontimeout = fail;
        xhr.send();
    }
}
