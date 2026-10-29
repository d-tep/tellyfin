const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'jellyfin-tizen-fixed/node_modules');
const babel = require(path.join(modules, '@babel/core'));
const acorn = require(path.join(modules, 'acorn'));
const web = path.join(root, 'jellyfin-tizen-fixed/www');
const source = fs.readFileSync(path.join(root, 'browser-guide/playback-warm.js'), 'utf8');
const compiled = babel.transformSync(source, {
    presets: [[require.resolve(path.join(modules, '@babel/preset-env')), {
        targets: { chrome: '38' }, forceAllTransforms: true, modules: false, useBuiltIns: false
    }]], sourceType: 'script', comments: false, babelrc: false, configFile: false
}).code;
acorn.parse(compiled, { ecmaVersion: 5 });
fs.mkdirSync(path.join(web, 'ui'), { recursive: true });
fs.writeFileSync(path.join(web, 'ui/playback-warm.js'), compiled);
const index = path.join(web, 'index.html');
let html = fs.readFileSync(index, 'utf8')
    .replace(/<script[^>]*id="tv-playback-warm"[^>]*><\/script>/g, '');
html = html.replace('</body>', '<script id="tv-playback-warm" src="ui/playback-warm.js" defer></script></body>');
fs.writeFileSync(index, html);
console.log('Playback warming and launch timing packaged; ES5 syntax verified.');
