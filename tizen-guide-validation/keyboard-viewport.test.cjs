const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness() {
    const handlers = { document: {}, window: {} };
    const classes = new Set();
    const properties = new Map();
    const root = {
        classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
        style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) }
    };
    const listen = target => (name, callback) => {
        (handlers[target][name] ||= []).push(callback);
    };
    const inputs = [];
    let documentScans = 0;
    const document = { documentElement: root, activeElement: null, addEventListener: listen('document'), body: {}, querySelectorAll: () => { documentScans++; return inputs; } };
    const window = { innerHeight: 1080, addEventListener: listen('window') };
    const callbacks = [];
    const observers = [];
    const context = {
        document, window,
        MutationObserver: class {
            constructor(callback) { observers.push(callback); }
            observe() {}
        },
        getComputedStyle: () => ({ fontSize: properties.get('--manual-guide-input-font-size') || (window.innerHeight >= 1000 ? '27px' : '16px') }),
        requestAnimationFrame: callback => callbacks.push(callback),
        setTimeout: callback => callbacks.push(callback)
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'tv-manual-guide.js'), 'utf8'), context);
    function flush() {
        while (callbacks.length) callbacks.shift()();
    }
    function emit(target, name, event = {}) {
        for (const callback of handlers[target][name] || []) callback(event);
        flush();
    }
    function input(dialog = null) {
        const attributes = new Set();
        const field = {
            nodeType: 1,
            readOnly: false,
            tagName: 'INPUT',
            hasAttribute: name => attributes.has(name),
            setAttribute: name => attributes.add(name),
            matches: () => true,
            querySelectorAll: () => [],
            closest: selector => selector === 'form.manual-guide-dialog' ? dialog : null,
            getBoundingClientRect: () => ({ top: 600, bottom: 660 }),
            blur: () => {
                document.activeElement = null;
                emit('document', 'focusout', { target: field });
            },
            focus: () => focus(field)
        };
        inputs.push(field);
        return field;
    }
    function focus(field) {
        document.activeElement = field;
        emit('document', 'focusin', { target: field });
    }
    function resize(height) {
        window.innerHeight = height;
        emit('window', 'resize');
    }
    return { document, properties, classes, emit, input, focus, resize, observers, documentScans: () => documentScans };
}

test('TV keyboard preserves font size until the keyboard closes after blur', () => {
    const h = harness();
    h.focus(h.input());
    h.resize(568);
    assert.equal(h.properties.get('--manual-guide-input-font-size'), '27px');
    h.document.activeElement = null;
    h.emit('document', 'focusout');
    assert.ok(h.classes.has('manual-guide-input-active'));
    h.resize(1080);
    assert.equal(h.classes.size, 0);
    assert.equal(h.properties.size, 0);
});

test('moving between recording inputs does not capture the reduced viewport font', () => {
    const h = harness();
    h.focus(h.input());
    h.resize(568);
    h.focus(h.input());
    assert.equal(h.properties.get('--manual-guide-input-font-size'), '27px');
    h.resize(1080);
    h.document.activeElement = null;
    h.emit('document', 'focusout');
    assert.equal(h.classes.size, 0);
});

test('recording input scrolls inside its dialog above the keyboard', () => {
    const h = harness();
    const dialog = { scrollTop: 0, getBoundingClientRect: () => ({ top: 40, bottom: 525 }) };
    h.focus(h.input(dialog));
    h.resize(568);
    assert.equal(dialog.scrollTop, 147);
});

test('unrelated input does not change TV font styling', () => {
    const h = harness();
    h.focus({ matches: () => false, closest: () => null });
    h.resize(568);
    assert.equal(h.classes.size, 0);
    assert.equal(h.properties.size, 0);
});

test('focus waits for Select and Back ends editing without leaving the field', () => {
    const h = harness();
    const field = h.input();
    h.focus(field);
    assert.equal(field.readOnly, true);
    let prevented = 0;
    const key = (key, keyCode) => h.emit('document', 'keydown', {
        target: field, key, keyCode,
        preventDefault: () => prevented++,
        stopImmediatePropagation() {}
    });
    key('Enter', 13);
    assert.equal(field.readOnly, false);
    assert.equal(h.document.activeElement, field);
    h.resize(568);
    key('GoBack', 10009);
    assert.equal(field.readOnly, true);
    assert.equal(h.document.activeElement, field);
    assert.equal(prevented, 2);
});

test('native keyboard dismissal rearms Select-to-edit', () => {
    const h = harness();
    const field = h.input();
    h.focus(field);
    h.emit('document', 'click', { target: field, preventDefault() {}, stopImmediatePropagation() {} });
    assert.equal(field.readOnly, false);
    h.resize(568);
    h.resize(1080);
    assert.equal(field.readOnly, true);
});

test('IME Done rearms the field without submitting or closing the form', () => {
    const h = harness();
    const field = h.input();
    h.focus(field);
    h.emit('document', 'click', { target: field, preventDefault() {}, stopImmediatePropagation() {} });
    let prevented = false;
    h.emit('document', 'keydown', {
        target: field, key: 'Unidentified', keyCode: 65376,
        preventDefault: () => { prevented = true; },
        stopImmediatePropagation() {}
    });

    assert.equal(field.readOnly, true);
    assert.equal(h.document.activeElement, field);
    assert.equal(prevented, true);
});

test('focus prepares only the selected input without rescanning the document', () => {
    const h = harness();
    const scans = h.documentScans();
    const field = h.input();
    h.focus(field);
    assert.equal(field.readOnly, true);
    assert.equal(h.documentScans(), scans);
});

test('input observer prepares added fields and nested fields without scanning existing pages', () => {
    const h = harness();
    const existing = h.input();
    const added = h.input();
    const nested = h.input();
    const subtree = { nodeType: 1, matches: () => false, querySelectorAll: () => [nested] };
    const scans = h.documentScans();
    h.observers[0]([{ addedNodes: [added, subtree, { nodeType: 3 }] }]);
    assert.equal(added.readOnly, true);
    assert.equal(nested.readOnly, true);
    assert.equal(existing.readOnly, false);
    assert.equal(h.documentScans(), scans);
});
