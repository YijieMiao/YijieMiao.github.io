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

    def test_trends_dedupe_and_match_audit_date_and_version(self):
        original = daily.ROOT
        try:
            with tempfile.TemporaryDirectory() as folder:
                daily.ROOT = Path(folder)
                paper = dict(id='2610.1', version_id='2610.1v1', feeds=['math.DG','math.AP'], announce_type='new')
                revised = dict(paper, id='2610.2', version_id='2610.2v2', announce_type='replace')
                daily.write_json(daily.ROOT/'archive/2026-10-16.json',dict(date='2026-10-16',papers=[paper,paper,revised]))
                daily.write_json(daily.ROOT/'ai-disclosures.json',dict(records={
                    '2610.1':dict(announcement_date='2026-10-16',version_id='2610.1v1',full_text=True,status='explicit'),
                    '2610.2':dict(announcement_date='2026-10-16',version_id='2610.2v1',full_text=True,status='explicit')}))
                daily.rebuild_trends()
                row=json.loads((daily.ROOT/'trends.json').read_text())['days'][0]
                self.assertEqual(row['groups']['all'],dict(total=2,new=1,revised=1,explicit=1,checked=1))
                self.assertEqual(row['groups']['math.DG']['total'],2)
                self.assertEqual(row['groups']['math.AP']['total'],2)
                self.assertEqual(row['groups']['math.MG']['total'],0)
        finally:
            daily.ROOT = original

    def test_feed_rejects_unexpected_paper_link(self):
        xml = '<rss><channel><pubDate>Fri, 16 Oct 2026 04:00:00 GMT</pubDate><item><link>https://example.com/abs/123</link></item></channel></rss>'
        with self.assertRaises(ValueError):
            daily.parse_feed(xml)


if __name__ == '__main__':
    unittest.main()
