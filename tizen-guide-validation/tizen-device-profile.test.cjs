const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function getAppHost() {
    const context = {
        console: { log() {} },
        localStorage: { getItem() { return 'test-device'; } },
        tizen: { application: { getCurrentApplication() { return { appInfo: { version: 'test' } }; } } },
        window: { addEventListener() {} }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../jellyfin-tizen-fixed/tizen.js'), 'utf8'), context);
    return context.window.NativeShell.AppHost;
}

for (const method of ['getDeviceProfile', 'getSyncProfile']) {
    test(`${method} excludes MKV video without forcing video or audio encoding`, () => {
        const host = getAppHost();
        const original = {
            DirectPlayProfiles: [
                { Container: 'mkv', Type: 'Video', VideoCodec: 'h264' },
                { Container: 'mp4, MKV,webm', Type: 'Video', VideoCodec: 'h264,vp9' },
                { Container: 'hls', Type: 'Video' },
                { Container: 'mkv', Type: 'Audio' }
            ],
            TranscodingProfiles: [{ Container: 'ts', Protocol: 'hls', VideoCodec: 'h264', AudioCodec: 'aac' }],
            CodecProfiles: [{ Type: 'Video', Codec: 'h264' }]
        };
        const directProfiles = original.DirectPlayProfiles;
        const before = JSON.stringify(directProfiles);
        const transcodingProfiles = original.TranscodingProfiles;
        const codecProfiles = original.CodecProfiles;
        let options;
        const result = host[method](value => { options = value; return original; });
        assert.deepEqual(JSON.parse(JSON.stringify(result.DirectPlayProfiles)), [
            { Container: 'mp4,webm', Type: 'Video', VideoCodec: 'h264,vp9' },
            { Container: 'hls', Type: 'Video' },
            { Container: 'mkv', Type: 'Audio' }
        ]);
        assert.strictEqual(result.TranscodingProfiles, transcodingProfiles);
        assert.strictEqual(result.CodecProfiles, codecProfiles);
        assert.equal(options.enableMkvProgressive, false);
        assert.equal(options.enableSsaRender, method === 'getDeviceProfile' ? true : undefined);
        assert.equal(JSON.stringify(directProfiles), before);
    });

    test(`${method} preserves profiles without MKV`, () => {
        const host = getAppHost();
        const profiles = [{ Container: 'mp4', Type: 'Video' }, { Container: 'mp3', Type: 'Audio' }];
        const result = host[method](() => ({ DirectPlayProfiles: profiles }));
        assert.deepEqual(JSON.parse(JSON.stringify(result.DirectPlayProfiles)), profiles);
    });
}
