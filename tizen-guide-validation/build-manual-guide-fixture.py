from pathlib import Path
import runpy
root = Path(__file__).resolve().parents[1]
runpy.run_path(str(root / 'browser-guide/tests/build-browser-fixture.py'))
fixture = root / 'browser-guide/tests/fixture.html'
html = fixture.read_text().replace('class="layout-desktop"', 'class="layout-tv"')
for name in ('manual-guide.js', 'manual-guide.css'):
    html = html.replace((root / 'browser-guide' / name).read_text(), (root / 'jellyfin-tizen-fixed/www/ui' / name).read_text())
extra = (root / 'tizen-guide-validation/manual-guide-remote-tests.js').read_text()
html = html.replace('</body>', '<script>' + extra + '</script></body>')
(root / 'tizen-guide-validation/manual-guide-fixture.html').write_text(html)
fixture.unlink()
