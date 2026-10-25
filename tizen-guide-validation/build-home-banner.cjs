const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'jellyfin-tizen-fixed/node_modules');
const babel = require(path.join(modules, '@babel/core'));
const acorn = require(path.join(modules, 'acorn'));
const web = path.join(root, 'jellyfin-tizen-fixed/www');
const source = fs.readFileSync(path.join(root, 'browser-guide/home-banner.js'), 'utf8');
const compiled = babel.transformSync(source, {
    presets: [[require.resolve(path.join(modules, '@babel/preset-env')), {
        targets: { chrome: '38' }, forceAllTransforms: true, modules: false, useBuiltIns: false
    }]], sourceType: 'script', comments: false, babelrc: false, configFile: false
}).code;
acorn.parse(compiled, { ecmaVersion: 5 });
fs.mkdirSync(path.join(web, 'ui'), { recursive: true });
fs.writeFileSync(path.join(web, 'ui/home-banner.js'), compiled);
fs.copyFileSync(path.join(root, 'browser-guide/home-banner.css'), path.join(web, 'ui/home-banner.css'));
const index = path.join(web, 'index.html');
let html = fs.readFileSync(index, 'utf8')
    .replace(/<script[^>]*id="tv-home-banner"[^>]*><\/script>/g, '')
    .replace(/<link[^>]*id="tv-home-banner-style"[^>]*>/g, '');
html = html.replace('</head>', '<link id="tv-home-banner-style" rel="stylesheet" href="ui/home-banner.css"></head>')
    .replace('</body>', '<script id="tv-home-banner" src="ui/home-banner.js" defer></script></body>');
fs.writeFileSync(index, html);
console.log('Home banner packaged; ES5 syntax verified.');
