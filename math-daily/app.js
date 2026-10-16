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
let batch, selected = '', requestNumber = 0, shown = 40, archiveDates = [], currentScope = '';
const names = {'math.DG':['Differential Geometry','微分几何'],'math.MG':['Metric Geometry','度量几何'],'math.GT':['Geometric Topology','几何拓扑'],'math.AP':['Analysis of PDEs','偏微分方程'],'math.KT':['K-Theory and Homology','K 理论与同调'],'math.MP':['Mathematical Physics','数学物理']};
const topics = {
  '标量曲率': ['scalar curvature', 'yamabe'],
  'Ricci 流与曲率': ['ricci', 'curvature flow'],
  '极小曲面与几何测度论': ['minimal surface', 'minimal hypersurface', 'minimal submanifold', 'geometric measure', 'varifold', 'mean curvature', 'finite perimeter'],
  '谱几何': ['spectral', 'eigenvalue', 'laplacian', 'heat kernel'],
  '度量与最优传输': ['metric measure', 'optimal transport', 'wasserstein', 'ricci limit', 'gromov', 'alexandrov'],
  '几何拓扑': ['manifold', 'knot', 'cobordism', 'heegaard', 'floer'],
  '几何分析与 PDE': ['elliptic', 'parabolic', 'sobolev', 'regularity', 'harmonic map'],
  'K 理论与同调': ['k-theory', 'k theory', 'homology', 'algebraic k', 'hochschild'],
  '数学物理': ['quantum', 'schrödinger', 'schrodinger', 'gauge', 'yang-mills', 'dirac'],
};
function element(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; }
function link(text, url) { const el = element('a', text); el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; return el; }
function button(text, action) { const el = element('button', text); el.type = 'button'; el.onclick = action; return el; }
let personal = {saved: [], read: [], authors: []};
function validatePersonal(value) {
  if (!value || !['saved','read','authors'].every(k => Array.isArray(value[k]) && value[k].length <= 20000 && value[k].every(x => typeof x === 'string' && x.length <= 500))) throw Error('个人数据格式不正确');
  return Object.fromEntries(['saved','read','authors'].map(k => [k, [...new Set(value[k])]]));
}
try { const stored = localStorage.getItem('math-daily-personal'); if (stored) personal = validatePersonal(JSON.parse(stored)); } catch { $('personal-status').textContent = '无法读取已有个人数据；当前使用临时设置。'; }
function persist() {
  try { localStorage.setItem('math-daily-personal', JSON.stringify(personal)); $('personal-status').textContent = '已保存在此浏览器。'; }
  catch { $('personal-status').textContent = '浏览器无法保存数据；当前操作只在本页有效，请导出备份。'; }
}
$('authors').value = personal.authors.join('\n');
function toggle(key, id) { personal[key] = personal[key].includes(id) ? personal[key].filter(x => x !== id) : [...personal[key], id]; persist(); render(); }
function normalize(value) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[{}\\$]/g,'').toLowerCase(); }
function matches(paper, words) { const text = normalize(`${paper.title} ${paper.abstract}`); return words.filter(word => text.includes(normalize(word))); }
function followed(paper) { return personal.authors.some(author => normalize(paper.authors).includes(normalize(author))); }
function subjects() {
  $('subjects').replaceChildren();
  for (const [code, [en, zh]] of Object.entries(names)) {
    const el = button('', () => { selected = selected === code ? '' : code; shown = 40; subjects(); render(); }); el.className = 'subject'; el.setAttribute('aria-pressed', String(selected === code));
    el.append(element('span', code, 'code'), element('span', zh, 'zh'), element('span', en, 'en'), element('span', `${batch.papers.filter(p => p.feeds.includes(code)).length} 篇 ↗`, 'total')); $('subjects').append(el);
  }
}
function filtered() {
  const query = normalize($('search').value.trim()), type = $('type').value, shelf = $('shelf').value, topic = $('topic').value;
  return batch.papers.filter(p => (!selected || p.feeds.includes(selected)) &&
    (type === 'all' || (type === 'new' ? !p.announce_type.includes('replace') : p.announce_type.includes('replace'))) &&
    normalize(`${p.title} ${p.authors} ${p.abstract} ${p.id}`).includes(query) &&
    (!topic || matches(p, topics[topic]).length) &&
    (shelf === 'all' || (shelf === 'saved' && personal.saved.includes(p.id)) || (shelf === 'unread' && !personal.read.includes(p.id)) || (shelf === 'followed' && followed(p))));
}
function render() {
  if (!batch) return;
  const papers = filtered();
  $('list-title').textContent = selected ? names[selected][1] : '全部方向';
  $('count').textContent = `${papers.length} 篇 · 已去重`;
  $('status').textContent = papers.length ? `${currentScope === 'all' ? '全部已归档批次' : '当前公告批次'} · ${$('type').selectedOptions[0].textContent} · 展示 ${Math.min(shown, papers.length)} / ${papers.length} 篇` : '没有匹配论文。可切换到“全部历史”、选择“全部公告”或重置筛选。';
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([$('papers')]);
  $('papers').replaceChildren();
  for (const p of papers.slice(0, shown)) {
    const article = element('article', undefined, 'paper'); article.id = `paper-${p.id.replace(/[^\w-]/g,'-')}`;
    const meta = element('div', undefined, 'paper-top');
    const kind = p.announce_type.includes('replace') ? '修订' : p.announce_type === 'cross' ? '交叉新论文' : '新论文';
    meta.append(element('span', `arXiv:${p.id}`), element('span', kind, 'tag'));
    if (p.occurrences?.length) meta.append(element('span', p.occurrences[0].date));
    for (const c of p.categories) meta.append(element('span', c, 'tag'));
    if (followed(p)) meta.append(element('span', '关注作者', 'tag interest'));
    const title = element('h3'); title.append(link(p.title, p.url));
    const links = element('div', undefined, 'links'); links.append(link('arXiv ↗', p.url), link('PDF ↗', p.pdf));
    const saved = button(personal.saved.includes(p.id) ? '★ 已收藏' : '☆ 收藏', () => toggle('saved', p.id)); saved.setAttribute('aria-pressed', String(personal.saved.includes(p.id))); saved.setAttribute('aria-label', `收藏：${p.title}`);
    const read = button(personal.read.includes(p.id) ? '✓ 已读' : '标记已读', () => toggle('read', p.id)); read.setAttribute('aria-pressed', String(personal.read.includes(p.id))); read.setAttribute('aria-label', `已读：${p.title}`);
    links.append(saved, read);
    const details = element('details'), abstract = element('p', p.abstract, 'abstract'); details.append(element('summary', '展开英文摘要'), abstract);
    details.addEventListener('toggle', () => { if (details.open && window.MathJax?.typesetPromise) window.MathJax.typesetPromise([abstract]).catch(console.error); });
    article.append(meta, title, element('p', p.authors, 'authors'), links);
    if ($('topic').value) article.append(element('p', `关键词匹配：${matches(p, topics[$('topic').value]).join(' · ')}`, 'match-reason'));
    article.append(details);
    if (p.occurrences?.length > 1) {
      const history = element('details'); history.append(element('summary', `收录记录 · ${p.occurrences.length} 个批次`));
      for (const occurrence of p.occurrences) history.append(element('p', `${occurrence.date} · ${occurrence.announce_type} · ${occurrence.feeds.join(', ')}`, 'history-entry'));
      article.append(history);
    }
    $('papers').append(article);
  }
  $('load-more').hidden = papers.length <= shown;
  if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([...$('papers').querySelectorAll('h3')]).catch(console.error);
}
async function json(url) { const response = await fetch(url, {cache:'no-cache'}); if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); }
async function load(scope = '') {
  const current = ++requestNumber;
  $('papers').replaceChildren(); $('load-more').hidden = true; batch = null;
  $('status').textContent = '正在读取论文…';
  try {
    const data = await json(scope === 'all' ? 'data/library.json' : scope ? `data/archive/${scope}.json` : 'data/latest.json');
    if (current !== requestNumber) return;
    batch = data; currentScope = scope; shown = 40;
    $('edition').textContent = scope === 'all' ? `全部历史 · ${archiveDates.length} 个批次 · ${batch.papers.length} 篇论文` : `arXiv 公告批次 ${batch.date} · ${batch.papers.length} 篇论文 · 六个方向`;
    subjects(); render();
    const url = new URL(location.href); scope ? url.searchParams.set('date', scope) : url.searchParams.delete('date'); history.replaceState(null, '', url);
  } catch (error) { if (current === requestNumber) { $('status').textContent = '论文数据加载失败。请刷新重试或选择其他批次。'; console.error(error); } }
}
for (const id of ['search','type','topic']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { shown = 40; render(); });
$('archive').addEventListener('change', () => load($('archive').value));
$('shelf').addEventListener('change', () => { shown = 40; if (['saved','followed'].includes($('shelf').value)) { $('type').value = 'all'; $('archive').value = 'all'; load('all'); } else render(); });
$('load-more').onclick = () => { shown += 40; render(); };
$('clear-filters').onclick = () => { selected = ''; $('search').value = ''; $('type').value = 'all'; $('topic').value = ''; $('shelf').value = 'all'; shown = 40; if (batch) { subjects(); render(); } };
$('save-authors').onclick = () => { personal.authors = $('authors').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0,500); persist(); render(); };
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], {type})); const a = element('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('export-data').onclick = () => download('math-daily-personal.json', JSON.stringify(personal,null,2), 'application/json');
$('import-data').onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5000000) throw Error('请选择小于 5 MB 的个人数据文件');
    const imported = validatePersonal(JSON.parse(await file.text()));
    for (const key of ['saved','read','authors']) personal[key] = [...new Set([...personal[key], ...imported[key]])];
    $('authors').value = personal.authors.join('\n'); persist(); render();
  } catch (error) { $('personal-status').textContent = `导入失败：${error.message}`; }
  event.target.value = '';
};
$('export-reading').onclick = async () => {
  try {
    const library = await json('data/library.json'); const saved = library.papers.filter(p => personal.saved.includes(p.id));
    const content = '# Math Daily · 选读清单\n\n' + saved.map(p => `## ${p.title.replace(/\n/g,' ')}\n\n${p.authors}\n\n${p.url}\n\n`).join('');
    download('math-daily-reading.md',content,'text/markdown'); $('personal-status').textContent = `已导出 ${saved.length} 篇收藏，可发给师兄弟共同选读。`;
  } catch { $('personal-status').textContent = '导出失败，请稍后重试。'; }
};
for (const topic of Object.keys(topics)) { const option = element('option', topic); option.value = topic; $('topic').append(option); }
(async () => {
  try {
    archiveDates = await json('data/archive.json');
    for (const a of archiveDates) { const option = element('option', `${a.date} · ${a.count} 篇`); option.value = a.date; $('archive').append(option); }
    const requested = new URLSearchParams(location.search).get('date'); const scope = requested === 'all' || archiveDates.some(a => a.date === requested) ? requested : '';
    $('archive').value = scope; await load(scope);
  } catch (error) { $('status').textContent = '归档目录加载失败，请刷新重试。'; console.error(error); }
})();
(async () => {
  const el = $('update-status');
  try {
    const status = await json('data/status.json'); const date = new Date(status.last_success);
    if (!Number.isFinite(date.getTime())) throw Error('invalid timestamp');
    el.replaceChildren(element('span', `最近成功抓取：${date.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间） · 每日 12:00 自动检查`));
    if (Date.now() - date.getTime() > 48*3600000) el.append(element('span', ' · 已超过 48 小时未记录成功检查，请查看任务状态。'));
    if (status.empty) el.append(element('span',' · 本次没有公告，保留上一非空批次。'));
  } catch { el.textContent = '暂时无法读取最近成功抓取时间。'; }
  el.append(document.createTextNode(' '), link('查看更新任务 ↗','https://github.com/YijieMiao/YijieMiao.github.io/actions/workflows/math-daily.yml'));
})();
