import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'scripts/validate_math_release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_actual_release(self):
        release.validate(ROOT/'math-daily')

    def test_missing_asset_blocks_release(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'index.html').write_text('<script src="missing.js?v=1"></script>')
            with self.assertRaisesRegex(AssertionError,'Missing or unsafe asset'):
                release.validate(root)

    def test_restore_keeps_current_paper_data(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
            git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.com')
            (root/'math-daily/data').mkdir(parents=True)
            (root/'math-daily/index.html').write_text('previous page')
            (root/'math-daily/data/latest.json').write_text('old data')
            git('add','.');git('commit','-qm','previous');old=git('rev-parse','HEAD')
            (root/'math-daily/index.html').write_text('new page')
            (root/'math-daily/extra.js').write_text('new asset')
            (root/'math-daily/data/latest.json').write_text('latest data')
            git('add','.');git('commit','-qm','current')
            subprocess.run(['python3',str(ROOT/'scripts/restore_math_frontend.py'),old,'--apply'],cwd=root,check=True,capture_output=True)
            self.assertEqual((root/'math-daily/index.html').read_text(),'previous page')
            self.assertEqual((root/'math-daily/data/latest.json').read_text(),'latest data')
            self.assertFalse((root/'math-daily/extra.js').exists())
