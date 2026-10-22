// Apply the standard server-provided Abyss skin without the packaged Spotlight extension.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'jellyfin-tizen-fixed', 'www');
const indexPath = path.join(web, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<script\b[^>]*\bdata-(?:abyss-spotlight|home-library-navigation)\b[^>]*><\/script>/g, '');
fs.mkdirSync(path.join(web, 'ui'), { recursive: true });
fs.copyFileSync(path.join(root, 'tizen-guide-validation', 'home-library-navigation.js'), path.join(web, 'ui', 'home-library-navigation.js'));
html = html.replace('</body>', '<script src="ui/home-library-navigation.js" data-home-library-navigation></script></body>');
fs.copyFileSync(path.join(root, 'tizen-guide-validation', 'tv-header-spacing.css'), path.join(web, 'ui', 'tv-header-spacing.css'));
html = html.replace(/<link[^>]*id="tv-header-spacing"[^>]*>/g, '');
html = html.replace('</head>', '<link id="tv-header-spacing" rel="stylesheet" href="ui/tv-header-spacing.css"></head>');
fs.copyFileSync(path.join(root, 'tizen-guide-validation', 'tv-performance.css'), path.join(web, 'ui', 'tv-performance.css'));
html = html.replace(/<link[^>]*id="tv-performance"[^>]*>/g, '');
html = html.replace('</head>', '<link id="tv-performance" rel="stylesheet" href="ui/tv-performance.css"></head>');
fs.writeFileSync(indexPath, html);
for (const name of ['spotlight-loader.js', 'spotlight.css', 'spotlight.html']) {
    fs.rmSync(path.join(web, 'ui', name), { force: true });
}
if (html.includes('data-abyss-spotlight') || html.includes('ui/spotlight')) {
    throw new Error('Spotlight reference remains');
}
if (!html.includes('data-home-library-navigation')) {
    throw new Error('Requested home navigation is missing');
}
console.log('Removed packaged Spotlight; applied Home, Shows, Movies and Live TV navigation; retained compiled guide fix.');
