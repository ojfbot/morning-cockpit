"""Exercise the capture verifier against disposable copies, including python -O."""
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class CaptureVerifierTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source_root = Path(__file__).resolve().parents[2]
        planning = self.root / 'planning' / 'mc-ux-01'
        planning.mkdir(parents=True)
        for name in ('capture.json', 'verify-capture.py'):
            shutil.copyfile(Path(__file__).parent / name, planning / name)
        self.bundle = self.root / 'research' / 'design-handoff-mc-ux-01'
        shutil.copytree(source_root / 'research' / 'design-handoff-mc-ux-01', self.bundle)
        self.verifier = planning / 'verify-capture.py'

    def run_verifier(self, optimized):
        return subprocess.run(
            [sys.executable, *(['-O'] if optimized else []), str(self.verifier)],
            capture_output=True, text=True,
        )

    def test_original_capture_passes_with_and_without_optimization(self):
        for optimized in (False, True):
            with self.subTest(optimized=optimized):
                result = self.run_verifier(optimized)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('60 source files, 1670171 bytes, 29 manifest references', result.stdout)

    def test_same_length_changed_bytes_fail_with_and_without_optimization(self):
        path = self.bundle / 'PR.md'
        data = path.read_bytes()
        path.write_bytes(bytes([data[0] ^ 1]) + data[1:])
        for optimized in (False, True):
            with self.subTest(optimized=optimized):
                result = self.run_verifier(optimized)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('SHA-256 differs: PR.md', result.stderr)

    def test_extra_file_fails_with_and_without_optimization(self):
        (self.bundle / 'unexpected.md').write_text('not captured')
        for optimized in (False, True):
            with self.subTest(optimized=optimized):
                result = self.run_verifier(optimized)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('File inventory differs', result.stderr)
