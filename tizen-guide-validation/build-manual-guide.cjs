// Package tested browser guide controls with Samsung remote support.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const babel = require(path.join(root, 'jellyfin-tizen-fixed/node_modules/@babel/core'));
const acorn = require(path.join(root, 'jellyfin-tizen-fixed/node_modules/acorn'));
const read = name => fs.readFileSync(path.join(root, 'browser-guide', name), 'utf8');
const out = path.join(root, 'jellyfin-tizen-fixed/www/ui');
let source = read('manual-guide.js');
const guard = "        if (document.documentElement.classList.contains('layout-tv')) return;";
if (!source.includes(guard)) throw Error('Expected browser TV guard changed');
source = source.replace(guard, '').replace('your browser’s local timezone', 'your TV’s local timezone');
const remote = fs.readFileSync(path.join(__dirname, 'tv-manual-guide.js'), 'utf8');
const compiled = babel.transformSync(source + '\n' + remote, {
    presets: [[require.resolve(path.join(root, 'jellyfin-tizen-fixed/node_modules/@babel/preset-env')), {
        targets: { chrome: '38' }, forceAllTransforms: true, modules: false, useBuiltIns: false
    }]], sourceType: 'script', comments: false, babelrc: false, configFile: false
}).code;
acorn.parse(compiled, {ecmaVersion: 5});
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'manual-guide.js'), compiled);
const hide = '.layout-tv .manual-guide-toolbar, .layout-tv .manual-guide-fallback { display:none; }';
let css = read('manual-guide.css');
if (!css.includes(hide)) throw Error('Expected TV hiding rule changed');
css = css.replace(hide, '');
css += `
/* Chromium 76: explicit grid spacing, percentage margins, static focus. */
html.layout-tv.manual-guide-input-active { font-size:var(--manual-guide-input-font-size) !important; }
/* Abyss pins submit buttons with position:sticky; the keyboard's shrunken viewport would drag them over the form. */
html.layout-tv.manual-guide-input-active .button-submit, html.layout-tv.manual-guide-input-active form button[type="submit"].MuiButton-root { position:static !important; }
.layout-tv .manual-guide-toolbar, .layout-tv .tvGuideHeader .guideHeaderDateSelection { margin-left:3.3%; margin-right:3.3%; }
.layout-tv .manual-guide-toolbar { display:grid; grid-template-columns:minmax(10em, 1fr) minmax(7em, .65fr) minmax(7em, .65fr) auto auto auto; grid-gap:.65em; --manual-guide-control-height:2.6rem; }
.layout-tv .manual-guide-toolbar label { min-width:0; }
.layout-tv .manual-guide-toolbar input, .layout-tv .manual-guide-toolbar select { width:100%; max-width:none; font-size:inherit; }
.layout-tv .manual-guide-toolbar button { font-size:.85em; }
.layout-tv .manual-guide-search-label { max-width:none; }
.layout-tv .manual-guide-toolbar .manual-guide-clear, .layout-tv .manual-guide-toolbar .manual-guide-record, .layout-tv .manual-guide-toolbar .manual-guide-filter-count { grid-row:auto; grid-column:auto; }
.layout-tv .manual-guide-toolbar .manual-guide-status { grid-column:1 / -1; }
.layout-tv .manual-guide-fallback { max-width:none; }
.layout-tv .manual-guide-label { margin-right:.8em; }
.layout-tv .manual-guide-dialog { max-width:36em; }
.layout-tv .manual-guide-dialog input, .layout-tv .manual-guide-dialog select, .layout-tv .manual-guide-dialog button { font-size:inherit; }
.layout-tv .manual-guide-dialog .manual-guide-form-filters { display:grid; grid-template-columns:1fr 1fr; grid-gap:1em; }
.layout-tv .manual-guide-actions button + button { margin-left:.8em; }
.layout-tv .manual-guide-toolbar :focus, .layout-tv .manual-guide-fallback button:focus, .layout-tv .manual-guide-dialog :focus { outline:3px solid #fff !important; outline-offset:2px; transform:none !important; }
.layout-tv .manual-guide-picker { z-index:100001; }
.layout-tv .manual-guide-picker button { display:block; width:100%; margin:.3em 0; text-align:left; white-space:normal; }
.layout-tv .manual-guide-picker [aria-pressed=true] { border-color:#fff; }
`;
fs.writeFileSync(path.join(out, 'manual-guide.css'), css);
const indexPath = path.join(root, 'jellyfin-tizen-fixed/www/index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<script[^>]*id="tv-manual-guide"[^>]*><\/script>/g, '').replace(/<link[^>]*id="tv-manual-guide-style"[^>]*>/g, '');
html = html.replace('</head>', '<link id="tv-manual-guide-style" rel="stylesheet" href="ui/manual-guide.css"></head>');
html = html.replace('</body>', '<script id="tv-manual-guide" src="ui/manual-guide.js" defer></script></body>');
fs.writeFileSync(indexPath, html);
console.log('TV guide controls packaged; ES5 syntax verified.');
