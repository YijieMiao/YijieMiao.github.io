"""Offline release gate: assets, DOM wiring and published archive consistency."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit, unquote


class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = []; self.assets = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        if tag == 'script' and attrs.get('src'): self.assets.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet': self.assets.append(attrs['href'])


def validate(root):
    page = Page(); page.feed((root/'index.html').read_text())
    assert len(page.ids) == len(set(page.ids)), 'Duplicate HTML IDs'
    for url in page.assets:
        parts = urlsplit(url)
        if parts.scheme or parts.netloc: continue
        path = (root/unquote(parts.path)).resolve()
        assert path.is_relative_to(root.resolve()) and path.is_file(), f'Missing or unsafe asset: {url}'
    app = (root/'app.js').read_text()
    used = set(re.findall(r"\$\('([^']+)'\)", app))
    assert used <= set(page.ids), f'Missing DOM targets: {used-set(page.ids)}'
    data = root/'data'
    batches = json.loads((data/'archive.json').read_text())
    assert batches and batches == sorted(batches, key=lambda b:b['date'], reverse=True), 'Archive order'
    for batch in batches:
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', batch['date']), 'Invalid batch date'
        saved = json.loads((data/'archive'/f"{batch['date']}.json").read_text())
        assert saved['date'] == batch['date'] and len(saved['papers']) == batch['count'], 'Archive count/date mismatch'
        ids = [p['id'] for p in saved['papers']]
        assert len(ids) == len(set(ids)), 'Duplicate papers in batch'
        for p in saved['papers']:
            assert all(key in p for key in ('id','title','authors','abstract','feeds','categories','announce_type','url','pdf')), 'Paper schema changed'
            assert isinstance(p['feeds'],list) and p['feeds'], 'Missing category membership'
    latest = json.loads((data/'latest.json').read_text())
    assert latest == json.loads((data/'archive'/f"{batches[0]['date']}.json").read_text()), 'Latest differs from latest archive'
    library = json.loads((data/'library.json').read_text())['papers']
    assert len(library) == len({p['id'] for p in library}), 'Duplicate library records'
    assert all(p.get('occurrences') for p in library), 'Missing library history'
    trends = json.loads((data/'trends.json').read_text())['days']
    assert {r['date'] for r in trends} == {b['date'] for b in batches}, 'Trend dates do not match archive'
    assert {r['date']:r['groups']['all']['total'] for r in trends} == {b['date']:b['count'] for b in batches}, 'Trend totals do not match archive'
    print(f'Release validated: {len(page.assets)} assets, {len(batches)} batches, {len(library)} papers.')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path('math-daily'));args=parser.parse_args();validate(args.root)
