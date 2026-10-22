#!/usr/bin/env python3
"""Exercise release privacy detectors with synthetic data."""
from pathlib import Path
import runpy
import unittest

scan = runpy.run_path(str(Path(__file__).with_name('check-release.py')))['scan']


class ReleaseScanTests(unittest.TestCase):
    def test_private_key_is_rejected(self):
        self.assertTrue(scan('www/example.js', b'-----BEGIN ' + b'PRIVATE KEY-----'))

    def test_credentials_in_url_are_rejected(self):
        self.assertTrue(scan('www/example.js', b'https://exampleuser' + b':examplepass@example.test/'))

    def test_lan_address_is_rejected(self):
        self.assertTrue(scan('www/config.json', b'http://10.' + b'24.35.46:8096'))

    def test_upstream_translation_example_only(self):
        example = b'192.168.' + b'1.100:8096'
        self.assertFalse(scan('www/en-us-json.abc.chunk.js', example))
        self.assertTrue(scan('www/config.json', example))

    def test_upstream_dependency_paths_only(self):
        self.assertFalse(scan('www/node_modules.@jellyfin.sdk.bundle.js', b'/Users/' + b'ForgotPassword/Pin'))
        self.assertTrue(scan('www/config.json', b'/home/' + b'syntheticuser/config'))

    def test_semver_is_not_an_address(self):
        self.assertFalse(scan('package.json', b'"version": "10.13.0"'))


if __name__ == '__main__':
    unittest.main()
