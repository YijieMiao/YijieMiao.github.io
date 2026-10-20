'use strict';
const $ = id => document.getElementById(id);
let batch, selected = '', requestNumber = 0, shown = 40, archiveDates = [], currentScope = '';
const names = {'math.DG':'Differential Geometry','math.MG':'Metric Geometry','math.GT':'Geometric Topology','math.AP':'Analysis of PDEs','math.KT':'K-Theory and Homology','math.MP':'Mathematical Physics'};

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
function followed(paper) { return personal.authors.some(author => normalize(paper.authors).includes(normalize(author))); }
function subjects() {
  $('subjects').replaceChildren();
  for (const [code, en] of Object.entries(names)) {
    const el = button('', () => { selected = selected === code ? '' : code; shown = 40; subjects(); render(); }); el.className = 'subject'; el.setAttribute('aria-pressed', String(selected === code));
    el.append(element('span', code, 'code'), element('span', en, 'en'), element('span', `${batch.papers.filter(p => p.feeds.includes(code)).length} 篇 ↗`, 'total')); $('subjects').append(el);
  }
}
let aiRecords = {};
const aiLabels = {explicit:'检出 AI 使用声明', candidate:'AI 相关表述待核对', not_found:'已检索未发现 AI 披露', pending:'AI 披露尚未核查', unavailable:'AI 披露未完成核查'};
function aiInfo(p) {
  const record = aiRecords[p.id];
  const date = p.occurrences?.[0]?.date || batch?.date;
  if (!record || record.announcement_date !== date || (p.version_id && /v\d+$/.test(p.version_id) && p.version_id !== record.version_id)) return {status:'pending'};
  return record;
}
function aiStats(papers) {
  const counts = Object.fromEntries(Object.keys(aiLabels).map(key => [key,0]));
  for (const p of papers) counts[aiInfo(p).status]++;
  const total = papers.length, checked = counts.explicit + counts.candidate + counts.not_found;
  const el = $('ai-stats'); el.replaceChildren();
  const percent = total ? `${(100*counts.explicit/total).toFixed(1)}%` : '—';
  el.append(element('strong',`检出明确 AI 使用声明：${counts.explicit} / ${total} 篇 · ${percent}`));
  el.append(element('p',`已完成文字检索 ${checked} / ${total}（${total ? (100*checked/total).toFixed(1) : "—"}%） · 相关表述待核对 ${counts.candidate} · 未检出披露 ${counts.not_found} · 尚未核查 ${counts.pending} · 提取未完成 ${counts.unavailable}`));
  el.append(element('p', checked < total ? '核查尚未覆盖全部论文，以上是已发现声明占当前列表的比例，不是实际 AI 使用率。' : '以上是检出的披露比例，不是实际 AI 使用率。未披露或未检出不等于未使用。'));
}
function filtered(applyAI = true) {
  const query = normalize($('search').value.trim()), type = $('type').value, shelf = $('shelf').value;
  return batch.papers.filter(p => (!selected || p.feeds.includes(selected)) &&
    (type === 'all' || (type === 'new' ? !p.announce_type.includes('replace') : p.announce_type.includes('replace'))) &&
    normalize(`${p.title} ${p.authors} ${p.abstract} ${p.id}`).includes(query) &&
    (!applyAI || $('ai-filter').value === 'all' || aiInfo(p).status === $('ai-filter').value) &&
    (shelf === 'all' || (shelf === 'saved' && personal.saved.includes(p.id)) || (shelf === 'unread' && !personal.read.includes(p.id)) || (shelf === 'followed' && followed(p))));
}
function render() {
  if (!batch) return;
  aiStats(filtered(false));
  const papers = filtered();
  $('list-title').textContent = selected ? names[selected] : '全部方向';
  $('count').textContent = `${papers.length} 篇 · 已去重`;
  $('status').textContent = papers.length ? `${currentScope === 'all' ? '全部已归档批次' : '当前公告批次'} · ${$('type').selectedOptions[0].textContent} · 展示 ${Math.min(shown, papers.length)} / ${papers.length} 篇` : '没有匹配论文。可切换到“全部历史”、选择“全部公告”或重置筛选。';
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([$('papers')]);
  $('papers').replaceChildren();
  for (const p of papers.slice(0, shown)) {
    const article = element('article', undefined, 'paper'); article.id = `paper-${p.id.replace(/[^\w-]/g,'-')}`;
    const meta = element('div', undefined, 'paper-top');
    const kind = p.announce_type.includes('replace') ? '修订' : p.announce_type === 'cross' ? '交叉新论文' : '新论文';
    meta.append(element('span', `arXiv:${p.id}`), element('span', kind, 'tag'));
    const ai = aiInfo(p); meta.append(element('span', aiLabels[ai.status], `tag ai-tag ai-${ai.status}`));
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
    article.append(details);
    if (ai.status !== 'pending') {
      const audit = element('details', undefined, 'ai-evidence'); audit.append(element('summary','AI 披露核查依据'));
      audit.append(element('p',`${aiLabels[ai.status]} · ${ai.version_id || '版本未确认'} · ${ai.method === 'html' ? 'HTML 全文文字' : ai.method === 'pdf' ? 'PDF 全部页面文字' : '全文未能完整提取'}`));
      if (ai.checked_at) audit.append(element('p', `核查时间：${new Date(ai.checked_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）`));
      if (ai.excerpt) audit.append(element('blockquote',ai.excerpt));
      const roles = {research:'研究思路 / 证明相关',writing:'写作 / 排版相关',code:'代码 / 计算相关'};
      if (ai.roles?.length) audit.append(element('p',`声明中出现的用途关键词：${ai.roles.map(role => roles[role]).join('、')}（可能重叠）`));
      if (ai.source_url?.startsWith('https://arxiv.org/')) {
        const fragment = ai.location ? (ai.method === 'pdf' ? '#page='+ai.location : '#'+ai.location) : '';
        audit.append(link('查看所检索版本 / 原文位置 ↗',ai.source_url+fragment));
      }
      audit.append(element('p',ai.status === 'explicit' ? '规则检出作者使用声明，请结合原文判断用途；不据此推算 AI 完成了多少内容。' : ai.status === 'candidate' ? '可能是研究对象、引用、否定声明或使用声明；未计入明确披露的分子。' : ai.status === 'not_found' ? '仅表示文字检索未命中披露，不能证明没有使用 AI。' : '无法完整提取文字，未据此判断是否使用 AI。'));
      article.append(audit);
    }
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
const requestedAI = new URLSearchParams(location.search).get('ai');
if (requestedAI && Object.hasOwn(aiLabels, requestedAI)) $('ai-filter').value = requestedAI;
$('ai-filter').addEventListener('change', () => { const url = new URL(location.href); $('ai-filter').value === 'all' ? url.searchParams.delete('ai') : url.searchParams.set('ai',$('ai-filter').value); history.replaceState(null,'',url); });
for (const id of ['search','type','ai-filter']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { shown = 40; render(); });
$('archive').addEventListener('change', () => load($('archive').value));
$('shelf').addEventListener('change', () => { shown = 40; if (['saved','followed'].includes($('shelf').value)) { $('type').value = 'all'; $('archive').value = 'all'; load('all'); } else render(); });
$('load-more').onclick = () => { shown += 40; render(); };
$('clear-filters').onclick = () => { selected = ''; $('search').value = ''; $('type').value = 'all'; $('ai-filter').value = 'all'; const clearURL = new URL(location.href); clearURL.searchParams.delete('ai'); history.replaceState(null,'',clearURL); $('shelf').value = 'all'; shown = 40; if (batch) { subjects(); render(); } };
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
})();

(async () => {
  try { const data = await json('data/ai-disclosures.json'); aiRecords = data.records || {}; }
  catch { /* Missing audits remain explicitly pending; the paper list still works. */ }
  render();
})();
