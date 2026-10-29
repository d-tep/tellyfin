const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'jellyfin-tizen-fixed/www');
let css = fs.readFileSync(path.join(root, 'skin/abyss.upstream.css'), 'utf8');
assert.equal((css.match(/@import\s+url\([^\r\n]+\);/g) || []).length, 1);
css = css.replace(/@import\s+url\([^\r\n]+\);/, '');
const iconFace = /@font-face\s*\{[^}]*font-family:\s*'Material Icons Round';[^}]*\}/;
assert.match(css, iconFace);
css = css.replace(iconFace, '');
css = css.replaceAll("'Material Icons Round'", "'Material Icons'").replaceAll('"Google Sans"', 'Arial');
assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/i);
const overrides = ['tv-header-spacing.css', 'tv-performance.css'];
for (const name of overrides) {
    css += '\n' + fs.readFileSync(path.join(root, 'tizen-guide-validation', name), 'utf8');
}
css += '\n' + fs.readFileSync(path.join(web, 'ui/manual-guide.css'), 'utf8');
// Fixed Tellyfin login art, independent of the connected server's branding.
fs.copyFileSync(path.join(root, 'skin/login-background.png'), path.join(web, 'ui/login-background.png'));
css += `
#loginPage {
    background-image: url("login-background.png") !important;
    background-size: cover !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
}
`;
fs.writeFileSync(path.join(web, 'ui/tellyfin-theme.css'), css);
let index = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
index = index.replace(/<link[^>]*id="(?:tv-header-spacing|tv-performance|tv-manual-guide-style)"[^>]*>/g, '');
fs.writeFileSync(path.join(web, 'index.html'), index);
fs.mkdirSync(path.join(web, 'licenses'), { recursive: true });
for (const [source, name] of [
    ['LICENSE', 'JELLYFIN-WEB-LICENSE'],
    ['jellyfin-tizen-fixed/LICENSE', 'JELLYFIN-TIZEN-LICENSE'],
    ['skin/LICENSE', 'ABYSS-LICENSE'],
    ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md']
]) fs.copyFileSync(path.join(root, source), path.join(web, 'licenses', name));
console.log('Bundled offline Abyss theme, then TV/guide overrides; no remote CSS/font imports.');
