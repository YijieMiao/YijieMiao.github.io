"""Archive arXiv announcement batches. Standard library only; no API keys."""
import argparse
import datetime as dt
import email.utils
import json
from pathlib import Path
import re
import time
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / 'math-daily' / 'data'
CATEGORIES = {'math.AC': ['Commutative Algebra'], 'math.AG': ['Algebraic Geometry'], 'math.AP': ['Analysis of PDEs'], 'math.AT': ['Algebraic Topology'], 'math.CA': ['Classical Analysis and ODEs'], 'math.CO': ['Combinatorics'], 'math.CT': ['Category Theory'], 'math.CV': ['Complex Variables'], 'math.DG': ['Differential Geometry'], 'math.DS': ['Dynamical Systems'], 'math.FA': ['Functional Analysis'], 'math.GM': ['General Mathematics'], 'math.GN': ['General Topology'], 'math.GR': ['Group Theory'], 'math.GT': ['Geometric Topology'], 'math.HO': ['History and Overview'], 'math.IT': ['Information Theory'], 'math.KT': ['K-Theory and Homology'], 'math.LO': ['Logic'], 'math.MG': ['Metric Geometry'], 'math.MP': ['Mathematical Physics'], 'math.NA': ['Numerical Analysis'], 'math.NT': ['Number Theory'], 'math.OA': ['Operator Algebras'], 'math.OC': ['Optimization and Control'], 'math.PR': ['Probability'], 'math.QA': ['Quantum Algebra'], 'math.RA': ['Rings and Algebras'], 'math.RT': ['Representation Theory'], 'math.SG': ['Symplectic Geometry'], 'math.SP': ['Spectral Theory'], 'math.ST': ['Statistics Theory']}

NS = {'dc': 'http://purl.org/dc/elements/1.1/', 'arxiv': 'http://arxiv.org/schemas/atom'}


def parse_feed(xml):
    channel = ET.fromstring(xml).find('channel')
    date = email.utils.parsedate_to_datetime(channel.findtext('pubDate')).date().isoformat()
    papers = []
    for item in channel.findall('item'):
        url = item.findtext('link', '').replace('http://', 'https://')
        if not re.fullmatch(r'https://arxiv.org/abs/[\w./-]+', url):
            raise ValueError(f'Unexpected paper URL: {url}')
        description = item.findtext('description', '')
        papers.append(dict(
            id=url.split('/abs/')[1], version_id=item.findtext('guid', '').removeprefix('oai:arXiv.org:') or url.split('/abs/')[1], title=' '.join(item.findtext('title', '').split()),
            authors=item.findtext('dc:creator', '', NS),
            abstract=description.partition('Abstract:')[2].strip() or description,
            categories=[c.text for c in item.findall('category')],
            announce_type=item.findtext('arxiv:announce_type', 'new', NS),
            url=url, pdf=url.replace('/abs/', '/pdf/'),
        ))
    return date, papers


def fetch(category):
    for attempt in range(3):
        try:
            request = urllib.request.Request('https://rss.arxiv.org/rss/' + category,
                                            headers={'User-Agent': 'MathDaily/1.0 (public academic feed reader)'})
            with urllib.request.urlopen(request, timeout=60) as response:
                return parse_feed(response.read())
        except Exception:
            if attempt == 2:
                raise
            time.sleep(4 * (attempt + 1))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def rebuild_library():
    """Newest metadata wins; retain each occurrence and its announcement kind."""
    library = {}
    for path in sorted((ROOT / 'archive').glob('*.json'), reverse=True):
        stored = json.loads(path.read_text(encoding='utf-8'))
        for paper in stored['papers']:
            entry = library.setdefault(paper['id'], dict(paper, occurrences=[]))
            entry['occurrences'].append(dict(date=stored['date'], announce_type=paper['announce_type'], feeds=paper['feeds']))
    write_json(ROOT / 'library.json', dict(papers=list(library.values())))


def rebuild_trends():
    """Keep original announcement totals and version-matched disclosure counts."""
    audit_path = ROOT / 'ai-disclosures.json'
    audits = json.loads(audit_path.read_text()).get('records', {}) if audit_path.exists() else {}
    rows = []
    for path in sorted((ROOT / 'archive').glob('*.json')):
        batch = json.loads(path.read_text())
        groups = {}
        for code in ['all', *(batch.get('coverage') or batch.get('categories') or {c:None for p in batch['papers'] for c in p['feeds']})]:
            papers = {p['id']: p for p in batch['papers'] if code == 'all' or code in p['feeds']}
            counts = dict(total=len(papers), new=0, revised=0, explicit=0, checked=0, new_explicit=0, new_checked=0)
            for paper in papers.values():
                counts['revised' if 'replace' in paper['announce_type'] else 'new'] += 1
                record = audits.get(paper['id'], {})
                same_version = not paper.get('version_id') or not record.get('version_id') or paper['version_id'] == record['version_id']
                if record.get('announcement_date') == batch['date'] and same_version and record.get('full_text'):
                    counts['checked'] += 1
                    counts['explicit'] += record['status'] == 'explicit'
                    if 'replace' not in paper['announce_type']:
                        counts['new_checked'] += 1
                        counts['new_explicit'] += record['status'] == 'explicit'
            groups[code] = counts
        rows.append(dict(date=batch['date'], groups=groups))
    write_json(ROOT / 'trends.json', dict(days=rows))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--feed-dir', type=Path, help='Read CATEGORY.xml fixtures instead of the network')
    args = parser.parse_args()
    # A single mathematics-wide RSS request serves every reader's preferences.
    date, entries = parse_feed((args.feed_dir / 'math.xml').read_bytes()) if args.feed_dir else fetch('math')
    papers = {}
    for entry in entries:
        feeds = [code for code in entry['categories'] if code in CATEGORIES]
        if feeds:
            papers.setdefault(entry['id'], dict(entry, feeds=feeds))
    batch = dict(date=date, categories=CATEGORIES, coverage=list(CATEGORIES), papers=list(papers.values()))
    archive = ROOT / 'archive' / f'{date}.json'
    # Empty weekend feeds must not replace an existing nonempty announcement batch.
    if not papers:
        write_json(ROOT / 'status.json', dict(last_success=dt.datetime.now(dt.timezone.utc).isoformat(), feed_date=date, empty=True))
        print('No announcements; preserving latest batch.')
        return
    write_json(archive, batch)
    batches = []
    for path in sorted((ROOT / 'archive').glob('*.json'), reverse=True):
        stored = json.loads(path.read_text(encoding='utf-8'))
        batches.append(dict(date=stored['date'], count=len(stored['papers'])))
    latest = json.loads((ROOT / 'archive' / f"{batches[0]['date']}.json").read_text(encoding='utf-8'))
    write_json(ROOT / 'latest.json', latest)
    write_json(ROOT / 'archive.json', batches)
    rebuild_library()
    rebuild_trends()
    write_json(ROOT / 'status.json', dict(last_success=dt.datetime.now(dt.timezone.utc).isoformat(), feed_date=date, empty=False))
    print(f"Archived {date}: {len(papers)} unique papers; {len(batches)} batches retained.")


if __name__ == '__main__':
    main()
