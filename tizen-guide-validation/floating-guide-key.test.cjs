const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function harness(unsupported) {
    const handlers = {};
    const registered = [];
    const commands = [];
    const target = { dispatchEvent(event) { commands.push(event.detail.command); return false; } };
    const context = {
        console: { log() {} },
        localStorage: { getItem() { return 'test-device'; } },
        tizen: {
            application: { getCurrentApplication() { return { appInfo: { version: 'test' } }; } },
            tvinputdevice: { registerKey(name) { if (unsupported && name === 'Guide') throw Error('unsupported'); registered.push(name); } }
        },
        CustomEvent: class { constructor(name, options) { this.type = name; Object.assign(this, options); } },
        document: { activeElement: target, body: target },
        window: { addEventListener(name, handler) { handlers[name] = handler; } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../jellyfin-tizen-fixed/tizen.js'), 'utf8'), context);
    return { handlers, registered, commands };
}

test('Samsung Guide is registered and delivered as a cancelable guide command', () => {
    const { handlers, registered, commands } = harness(false);
    handlers.load();
    assert.ok(registered.includes('Guide'));
    let prevented = false;
    let stopped = false;
    handlers.keydown({ keyCode: 458, key: 'Guide', preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.deepEqual(commands, ['guide']);
    assert.ok(prevented && stopped);
});

test('unsupported Guide keys do not break media key registration or app startup', () => {
    const { handlers, registered } = harness(true);
    assert.doesNotThrow(() => handlers.load());
    assert.ok(registered.includes('MediaPlay') && registered.includes('MediaFastForward'));
});

test('normal remote keys are left to existing playback and navigation handlers', () => {
    const { handlers, commands } = harness(false);
    handlers.keydown({ keyCode: 40, key: 'ArrowDown' });
    assert.deepEqual(commands, []);
});
