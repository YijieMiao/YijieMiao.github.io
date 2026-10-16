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
CATEGORIES = {
    'math.DG': ['Differential Geometry', '微分几何'],
    'math.MG': ['Metric Geometry', '度量几何'],
    'math.GT': ['Geometric Topology', '几何拓扑'],
    'math.AP': ['Analysis of PDEs', '偏微分方程'],
    'math.KT': ['K-Theory and Homology', 'K 理论与同调'],
    'math.MP': ['Mathematical Physics', '数学物理'],
}
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
            id=url.split('/abs/')[1], title=' '.join(item.findtext('title', '').split()),
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--feed-dir', type=Path, help='Read CATEGORY.xml fixtures instead of the network')
    args = parser.parse_args()
    feeds = {}
    # Fetch and validate all six before modifying any published data.
    for category in CATEGORIES:
        feeds[category] = parse_feed((args.feed_dir / (category + '.xml')).read_bytes()) if args.feed_dir else fetch(category)
        if not args.feed_dir:
            time.sleep(3)
    dates = {date for date, _ in feeds.values()}
    if len(dates) != 1:
        raise ValueError(f'Feeds have different announcement dates; retry later: {dates}')
    date = dates.pop()
    papers = {}
    for category, (_, entries) in feeds.items():
        for entry in entries:
            paper = papers.setdefault(entry['id'], dict(entry, feeds=[]))
            paper['feeds'].append(category)
    batch = dict(date=date, categories=CATEGORIES, papers=list(papers.values()))
    archive = ROOT / 'archive' / f'{date}.json'
    # Empty weekend feeds must not replace an existing nonempty announcement batch.
    if not papers:
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
    print(f"Archived {date}: {len(papers)} unique papers; {len(batches)} batches retained.")


if __name__ == '__main__':
    main()
