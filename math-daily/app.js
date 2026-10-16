'use strict';
const $ = id => document.getElementById(id);
// Public-domain verses; choose again on each visit and avoid consecutive repeats.
const verses = [
  ['行到水穷处，', '坐看云起时。', '王维 ·《终南别业》'],
  ['问渠那得清如许？', '为有源头活水来。', '朱熹 ·《观书有感二首·其一》'],
  ['此中有真意，', '欲辨已忘言。', '陶渊明 ·《饮酒·其五》'],
  ['微雨从东来，', '好风与之俱。', '陶渊明 ·《读山海经·其一》'],
  ['山光悦鸟性，', '潭影空人心。', '常建 ·《题破山寺后禅院》'],
  ['掬水月在手，', '弄花香满衣。', '于良史 ·《春山夜月》'],
  ['大明终始，', '六位时成。', '《周易·乾·彖传》'],
  ['仰观宇宙之大，', '俯察品类之盛。', '王羲之 ·《兰亭集序》'],
];
let previousVerse = -1;
try { previousVerse = Number(localStorage.getItem('math-daily-verse') ?? -1); } catch {}
const choices = verses.map((_, index) => index).filter(index => index !== previousVerse);
const verseIndex = choices[Math.floor(Math.random() * choices.length)];
const [firstLine, secondLine, attribution] = verses[verseIndex];
$('verse-first').textContent = firstLine;
$('verse-second').textContent = secondLine;
$('verse-source').textContent = attribution;
try { localStorage.setItem('math-daily-verse', String(verseIndex)); } catch {}
let batch, selected = '', requestNumber = 0;
const names = {'math.DG':['Differential Geometry','微分几何'],'math.MG':['Metric Geometry','度量几何'],'math.GT':['Geometric Topology','几何拓扑'],'math.AP':['Analysis of PDEs','偏微分方程'],'math.KT':['K-Theory and Homology','K 理论与同调'],'math.MP':['Mathematical Physics','数学物理']};
function element(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; }
function link(text, url) { const el = element('a', text); el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; return el; }
function subjects() {
  $('subjects').replaceChildren();
  for (const [code, [en, zh]] of Object.entries(names)) {
    const button = element('button', undefined, 'subject'); button.type = 'button'; button.setAttribute('aria-pressed', String(selected === code));
    button.append(element('span', code, 'code'), element('span', zh, 'zh'), element('span', en, 'en'), element('span', `${batch.papers.filter(p => p.feeds.includes(code)).length} 篇 ↗`, 'total'));
    button.onclick = () => { selected = selected === code ? '' : code; subjects(); render(); };
    $('subjects').append(button);
  }
}
function render() {
  const query = $('search').value.toLocaleLowerCase().trim(), type = $('type').value;
  const papers = batch.papers.filter(p => (!selected || p.feeds.includes(selected)) && (type === 'all' || (type === 'new' ? !p.announce_type.includes('replace') : p.announce_type.includes('replace'))) && `${p.title} ${p.authors} ${p.abstract} ${p.id}`.toLocaleLowerCase().includes(query));
  $('list-title').textContent = selected ? names[selected][1] : '全部论文';
  $('count').textContent = `${papers.length} 篇 · 已去重`;
  $('status').textContent = papers.length ? '点击论文标题阅读原文，展开摘要快速浏览。再次点击学科可返回全部论文。' : '当前筛选没有匹配论文。可以清除搜索或更换分类。';
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([$('papers')]);
  $('papers').replaceChildren();
  for (const p of papers) {
    const article = element('article', undefined, 'paper'); const meta = element('div', undefined, 'paper-top');
    meta.append(element('span', `arXiv:${p.id}`), element('span', p.announce_type, 'tag'));
    for (const c of p.categories) meta.append(element('span', c, 'tag'));
    const title = element('h3'); title.append(link(p.title, p.url));
    const links = element('div', undefined, 'links'); links.append(link('arXiv ↗', p.url), link('PDF ↗', p.pdf));
    const details = element('details'); const abstract = element('p', p.abstract, 'abstract'); details.append(element('summary', '展开英文摘要'), abstract);
    details.addEventListener('toggle', () => { if (details.open && window.MathJax?.typesetPromise) window.MathJax.typesetPromise([abstract]).catch(console.error); });
    article.append(meta, title, element('p', p.authors, 'authors'), links, details); $('papers').append(article);
  }
  if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([...$('papers').querySelectorAll('h3')]).catch(console.error);
}
async function json(url) { const response = await fetch(url); if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); }
async function load(date = '') {
  const current = ++requestNumber;
  $('status').textContent = '正在读取论文…';
  try {
    const data = await json(date ? `data/archive/${date}.json` : 'data/latest.json');
    if (current !== requestNumber) return;
    batch = data; $('edition').textContent = `arXiv 公告批次 ${batch.date} · ${batch.papers.length} 篇论文 · 六个方向`;
    subjects(); render();
    const url = new URL(location.href); date ? url.searchParams.set('date', date) : url.searchParams.delete('date'); history.replaceState(null, '', url);
  } catch (error) { if (current === requestNumber) { $('papers').replaceChildren(); $('status').textContent = '论文数据加载失败，请刷新重试或选择其他批次。'; console.error(error); } }
}
$('search').addEventListener('input', () => { if (batch) render(); });
$('type').addEventListener('change', () => { if (batch) render(); });
$('archive').addEventListener('change', () => load($('archive').value));
(async () => {
  try {
    const archives = await json('data/archive.json');
    for (const a of archives) { const option = element('option', `${a.date} · ${a.count} 篇`); option.value = a.date; $('archive').append(option); }
    const requested = new URLSearchParams(location.search).get('date');
    const date = archives.some(a => a.date === requested) ? requested : '';
    $('archive').value = date; await load(date);
  } catch (error) { $('status').textContent = '归档目录加载失败，请刷新重试。'; console.error(error); }
})();
