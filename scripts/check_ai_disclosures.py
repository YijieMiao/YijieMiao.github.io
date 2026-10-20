"""Conservative, evidence-based AI disclosure search. Never estimates authorship."""
import argparse
import datetime as dt
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'math-daily/data'
RULE_VERSION = 1
TOOL = re.compile(r'\b(?:ChatGPT|GPT[- ]?[345](?:\.\d+)?|GPT[- ]?o\d|OpenAI|Claude|Gemini|DeepSeek|Copilot|Grammarly|large language models?|generative (?:AI|artificial intelligence)|AI[- ](?:assisted|generated|based)|artificial intelligence|LLMs?)\b', re.I)
ACTION = re.compile(r'\b(?:us(?:e|ed|ing)|assist\w*|help\w*|acknowledg\w*|thank\w*|employ\w*|develop\w*|generat\w*|suggest\w*|obtain\w*|produc\w*|contribut\w*)\b', re.I)
SELF = re.compile(r'\b(?:we|our|the authors?|this (?:paper|work|manuscript|article|lemma|proof))\b', re.I)
NEGATIVE = re.compile(r"\b(?:not|never|without|neither|no|didn.t|hasn.t|haven.t|cannot|doesn.t|isn.t|wasn.t)\b", re.I)
_last_request = 0


class PaperHTML(HTMLParser):
    def __init__(self):
        super().__init__(); self.depth = 0; self.article_depth = None; self.capture = None; self.blocks = []; self.article_seen = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag not in {'br','hr','img','meta','link','input','wbr','source','area','base','embed','param','track','col'}:
            self.depth += 1
        if tag == 'article': self.article_depth = self.depth; self.article_seen = True
        if self.article_depth is not None and tag == 'p' and self.capture is None:
            self.capture = [self.depth, attrs.get('id',''), []]
    def handle_data(self, text):
        if self.capture: self.capture[2].append(text)
    def handle_endtag(self, tag):
        if self.capture and tag == 'p' and self.depth == self.capture[0]:
            self.blocks.append((' '.join(''.join(self.capture[2]).split()), self.capture[1])); self.capture = None
        if tag == 'article': self.article_depth = None
        if tag not in {'br','hr','img','meta','link','input','wbr','source','area','base','embed','param','track','col'}: self.depth -= 1


def classify(blocks):
    """Only positive self-referential usage statements enter the explicit numerator."""
    candidates = []
    for text, location in blocks:
        # Small sentence windows avoid inferring disclosure from a nearby citation.
        for sentence in re.split(r'(?<=[.!?])\s+(?=[A-Z])', text):
            match = TOOL.search(sentence)
            if not match: continue
            tool = TOOL.pattern
            patterns = [
                r'\b(?:we|I|the authors?)\b.{0,180}?\b(?:used|use|using|employed|utilized|consulted|thank|acknowledge)\b.{0,100}?' + tool,
                tool + r'.{0,100}?\b(?:was|were|is|has been|have been)\s+(?:also\s+)?(?:used|employed|consulted|utilized)\b',
                r'\b(?:proof|lemma|idea|argument|text|manuscript|paper|code)\b.{0,150}?\b(?:developed|generated|suggested|found|produced|written|assisted)\s+by\s+(?:a\s+)?' + tool,
            ]
            positive = next((m for pattern in patterns if (m := re.search(pattern,sentence,re.I))), None)
            explicit = bool(positive and not NEGATIVE.search(sentence))
            if positive:
                match = TOOL.search(sentence, positive.start()) or match
            words = sentence.split()
            center = len(sentence[:match.start()].split())
            excerpt = ' '.join(words[max(0,center-10):max(0,center-10)+24])
            if max(0,center-10): excerpt = '… ' + excerpt
            if len(words) > max(0,center-10)+24: excerpt += ' …'
            candidate = dict(status='explicit' if explicit else 'candidate', excerpt=excerpt, location=location)
            if explicit:
                roles = []
                if re.search(r'proof|lemma|theorem|conjecture|idea|research|argument', sentence, re.I): roles.append('research')
                if re.search(r'writ|language (?:edit|polish|improv)|grammar|edit|polish|translat|latex|typeset', sentence, re.I): roles.append('writing')
                if re.search(r'cod(?:e|ing)|program|implement|computation', sentence, re.I): roles.append('code')
                candidate['roles'] = roles
                return candidate
            candidates.append(candidate)
    return candidates[0] if candidates else dict(status='not_found', excerpt='', location='')


def fetch(url):
    global _last_request
    time.sleep(max(0, 3.1 - (time.monotonic()-_last_request)))
    _last_request = time.monotonic()
    req = urllib.request.Request(url, headers={'User-Agent':'MathDaily/1.1 (AI disclosure keyword audit; public academic reader)'})
    with urllib.request.urlopen(req, timeout=35) as r:
        content = r.read(30_000_001)
        if len(content)>30_000_000: raise ValueError('Source exceeds 30 MB extraction limit')
        return content, r.geturl()


def audit(paper):
    paper_id = paper['id']; pinned = paper.get('version_id', paper_id)
    record = dict(checked_at=dt.datetime.now(dt.timezone.utc).isoformat(), rule_version=RULE_VERSION,
                  announcement_date=paper['occurrences'][0]['date'], status='unavailable')
    try:
        raw, url = fetch('https://arxiv.org/html/'+pinned)
        html = raw.decode('utf-8'); parser = PaperHTML(); parser.feed(html)
        version = re.search(r'/abs/('+re.escape(paper_id)+r'v\d+)\b', html)
        text_len = sum(len(text) for text,_ in parser.blocks)
        if not parser.article_seen or text_len < 1500 or not version: raise ValueError('HTML full text unavailable')
        record.update(classify(parser.blocks), source_url='https://arxiv.org/html/'+version[1], version_id=version[1], method='html', full_text=True)
    except Exception:
        try:
            if not re.search(r'v\d+$', pinned):
                raw,_ = fetch('https://arxiv.org/abs/'+paper_id)
                versions = re.findall(r'\[v(\d+)\]',raw.decode('utf-8'))
                if not versions: raise ValueError('Could not resolve version')
                pinned = paper_id+'v'+str(max(map(int,versions)))
            raw,_ = fetch('https://arxiv.org/pdf/'+pinned)
            if not raw.startswith(b'%PDF'): raise ValueError('Not a PDF')
            with tempfile.TemporaryDirectory() as folder:
                path=Path(folder)/'paper.pdf'; path.write_bytes(raw)
                result=subprocess.run(['pdftotext','-layout',str(path),'-'],capture_output=True,timeout=50,check=True)
            pages=result.stdout.decode('utf-8',errors='replace').split('\f')
            if not pages[-1].strip(): pages.pop()
            if not pages or any(len(p.strip())<80 for p in pages): raise ValueError('Some pages have insufficient extractable text')
            blocks=[]
            for number,page in enumerate(pages,1):
                blocks.extend((' '.join(chunk.split()),str(number)) for chunk in re.split(r'\n\s*\n',page) if chunk.strip())
            record.update(classify(blocks),source_url='https://arxiv.org/pdf/'+pinned,version_id=pinned,method='pdf',full_text=True,pages=len(pages))
        except Exception as error:
            record.update(full_text=False,error=type(error).__name__,method='unavailable',source_url='https://arxiv.org/abs/'+paper_id)
    return record


def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--limit',type=int,default=200); args=parser.parse_args()
    library=json.loads((ROOT/'library.json').read_text())['papers']
    path=ROOT/'ai-disclosures.json'; data=json.loads(path.read_text()) if path.exists() else dict(records={})
    records=data['records']; completed=0
    for paper in library:
        old=records.get(paper['id']); date=paper['occurrences'][0]['date']
        if old and old.get('announcement_date')==date and old.get('rule_version')==RULE_VERSION:
            age=dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(old['checked_at'])
            if old['status']!='unavailable' or age<dt.timedelta(days=1): continue
        records[paper['id']]=audit(paper); completed+=1
        data['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
        temp=path.with_suffix('.tmp'); temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
        print(paper['id'], records[paper['id']]['status'],flush=True)
        if completed>=args.limit: break
    print(f'Checked {completed} papers; {len(records)} cached records. No model API used.')

if __name__=='__main__': main()
