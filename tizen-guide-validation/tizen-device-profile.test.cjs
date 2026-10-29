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

test('TV streaming defaults to shorter HLS segments without changing source profiles or explicit settings', () => {
    const host = getAppHost();
    const profiles = [
        { Type: 'Video', Context: 'Streaming', Protocol: 'hls', Container: 'ts', MinSegments: '1' },
        { Type: 'Video', Context: 'Streaming', Protocol: 'hls', Container: 'mp4', SegmentLength: 1 },
        { Type: 'Video', Context: 'Streaming', Protocol: 'http', Container: 'mp4' },
        { Type: 'Audio', Context: 'Streaming', Protocol: 'hls' },
        { Type: 'Video', Context: 'Static', Protocol: 'hls' }
    ];
    const before = JSON.stringify(profiles);
    const result = host.getDeviceProfile(() => ({ DirectPlayProfiles: [], TranscodingProfiles: profiles }));
    assert.equal(result.TranscodingProfiles[0].SegmentLength, 2);
    assert.equal(result.TranscodingProfiles[0].MinSegments, '1');
    assert.equal(result.TranscodingProfiles[0].VideoCodec, 'h264');
    assert.equal(result.TranscodingProfiles[1].SegmentLength, 1);
    assert.equal(result.TranscodingProfiles[2].SegmentLength, undefined);
    assert.equal(result.TranscodingProfiles[3].SegmentLength, undefined);
    assert.equal(result.TranscodingProfiles[4].SegmentLength, undefined);
    assert.equal(JSON.stringify(profiles), before);
    const sync = host.getSyncProfile(() => ({ DirectPlayProfiles: [], TranscodingProfiles: profiles }));
    assert.strictEqual(sync.TranscodingProfiles, profiles);
});

for (const method of ['getDeviceProfile', 'getSyncProfile']) {
    test(`${method} retains MKV remux rules and existing audio capabilities`, () => {
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
        assert.deepEqual(JSON.parse(JSON.stringify(result.TranscodingProfiles)), transcodingProfiles);
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
