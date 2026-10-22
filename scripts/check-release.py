#!/usr/bin/env python3
"""Check the assembled WGT for forbidden files, leaked secrets and theme integrity."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import subprocess
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'releases/Tellyfin-0.1.0.wgt'
PATTERNS = {
    'private key': rb'-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----',
    'GitHub token': rb'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b',
    'cloud access key': rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'JWT': rb'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b',
    'credential URL': rb'https?://[^\s/\'"<>]+:[^\s/\'"<>]+@',
    'private LAN address': rb'\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b',
    'personal home path': rb'/(?:Users|home)/[A-Za-z0-9_.-]+/',
}
FORBIDDEN = {'.p12', '.pfx', '.pem', '.key', '.db', '.sqlite', '.sqlite3', '.log', '.strm', '.m3u', '.m3u8'}


def scan(name, data):
    issues = []
    for label, pattern in PATTERNS.items():
        reviewed = data
        if label == 'private LAN address':
            if re.search(r'(?:src/strings/[^/]+\.json|[^/]+-json\.[^/]+\.chunk\.js)$', name):
                reviewed = re.sub(rb'192\.168\.1\.(?:100|1):\s*8096', b'EXAMPLE_HOST', reviewed)
            if name.endswith('assets/img/devices/html5.svg'):
                reviewed = reviewed.replace(b'10.059.003.23', b'SVG_COORDINATES')
            if name == 'scripts/check-release.py':
                reviewed = reviewed.replace(b'192.168.1.100:8096', b'EXAMPLE_HOST')
                reviewed = reviewed.replace(b'192.168.1.1:8096', b'EXAMPLE_HOST')
                reviewed = reviewed.replace(b'10.059.003.23', b'SVG_COORDINATES')
        if label == 'personal home path':
            if name == 'scripts/check-release.py':
                reviewed = reviewed.replace(b'/home/runner/', b'UPSTREAM_CI/')
                reviewed = reviewed.replace(b'/Users/ForgotPassword/', b'JELLYFIN_API/')
            if re.fullmatch(r'www/libbitsub_bg\.[a-f0-9]+\.wasm', name):
                reviewed = reviewed.replace(b'/home/runner/', b'UPSTREAM_CI/')
            if name == 'www/node_modules.@jellyfin.sdk.bundle.js':
                reviewed = reviewed.replace(b'/Users/ForgotPassword/', b'JELLYFIN_API/')
        if re.search(pattern, reviewed):
            issues.append((name, label))
    return issues


def check(write_checksum=False):
    issues = []
    files = subprocess.check_output(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT
    ).decode().split('\0')
    for name in set(files) - {''}:
        source = ROOT / name
        if source.is_symlink():
            issues.append((name, 'unreviewed source symlink'))
        elif source.suffix != '.wgt':
            issues.extend(scan(name, source.read_bytes()))
    with zipfile.ZipFile(PACKAGE) as archive:
        names = archive.namelist()
        for name in names:
            if Path(name).suffix.lower() in FORBIDDEN or '..' in Path(name).parts:
                issues.append((name, 'private/runtime or unsafe path'))
            if name.endswith('/'):
                continue
            data = archive.read(name)
            issues.extend(scan(name, data))
        required = {'config.xml', 'www/index.html', 'www/ui/tellyfin-theme.css',
                    'www/ui/manual-guide.js', 'www/ui/home-library-navigation.js',
                    'author-signature.xml', 'signature1.xml', 'www/licenses/ABYSS-LICENSE'}
        for missing in required - set(names):
            issues.append((missing, 'required asset missing'))
        config = ET.fromstring(archive.read('config.xml'))
        ns = {'w': 'http://www.w3.org/ns/widgets', 't': 'http://tizen.org/ns/widgets'}
        if config.find('w:name', ns).text != 'Tellyfin' or config.find('t:application', ns).get('id') != 'TellyfinTV.Tellyfin':
            issues.append(('config.xml', 'unexpected identity'))
        theme = archive.read('www/ui/tellyfin-theme.css').decode()
        if re.search(r'@import|url\(\s*[\'"]?https?:', theme, re.I):
            issues.append(('theme', 'remote theme/font dependency'))
        for marker in ['--abyss-accent', 'manual-guide-input-active', 'manual-guide-toolbar', 'headerButton.show-focus:focus']:
            if marker not in theme:
                issues.append(('theme', 'required override missing: ' + marker))
        client_config = json.loads(archive.read('www/config.json'))
        if client_config.get('servers') or client_config.get('menuLinks'):
            issues.append(('www/config.json', 'preconfigured server or menu links'))
        if not any(b'data-tellyfin-theme' in archive.read(name) for name in names if name.endswith('.js')):
            issues.append(('web build', 'compiled isolated theme component missing'))
    if issues:
        for name, reason in issues:
            print(f'{name}: {reason}', file=sys.stderr)
        return 1
    checksum = f'{hashlib.sha256(PACKAGE.read_bytes()).hexdigest()}  {PACKAGE.name}\n'
    target = ROOT / 'releases/SHA256SUMS'
    if write_checksum:
        target.write_text(checksum)
    elif not target.exists() or target.read_text() != checksum:
        print('Release checksum is absent or mismatched', file=sys.stderr)
        return 1
    print(f'PASS: {len(names)} WGT entries checked; identity, offline theme, overrides and checksum verified.')
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-checksum', action='store_true')
    sys.exit(check(parser.parse_args().write_checksum))
