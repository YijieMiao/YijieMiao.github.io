import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('daily', Path(__file__).resolve().parents[1] / 'scripts/update_math_daily.py')
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)


class LibraryTests(unittest.TestCase):
    def test_latest_metadata_and_complete_occurrences(self):
        original = daily.ROOT
        try:
            with tempfile.TemporaryDirectory() as folder:
                daily.ROOT = Path(folder)
                base = dict(id='2610.12345', title='Original title', feeds=['math.DG'], announce_type='new')
                daily.write_json(daily.ROOT / 'archive/2026-10-15.json', dict(date='2026-10-15', papers=[base]))
                updated = dict(base, title='Revised title', announce_type='replace')
                daily.write_json(daily.ROOT / 'archive/2026-10-16.json', dict(date='2026-10-16', papers=[updated]))
                daily.rebuild_library()
                result = json.loads((daily.ROOT / 'library.json').read_text())['papers']
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]['title'], 'Revised title')
                self.assertEqual([x['date'] for x in result[0]['occurrences']], ['2026-10-16', '2026-10-15'])
                self.assertEqual(result[0]['occurrences'][1]['announce_type'], 'new')
        finally:
            daily.ROOT = original

    def test_feed_rejects_unexpected_paper_link(self):
        xml = '<rss><channel><pubDate>Fri, 16 Oct 2026 04:00:00 GMT</pubDate><item><link>https://example.com/abs/123</link></item></channel></rss>'
        with self.assertRaises(ValueError):
            daily.parse_feed(xml)


if __name__ == '__main__':
    unittest.main()
