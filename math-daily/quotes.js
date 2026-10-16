'use strict';
(async () => {
  const heading = document.getElementById('verse-first');
  const second = document.getElementById('verse-second');
  const source = document.getElementById('verse-source');
  const next = document.getElementById('next-quote');
  const note = document.getElementById('quote-note');
  try {
    const response = await fetch('content/quotes.json?v=100', {cache:'no-cache'});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const quotes = await response.json();
    if (!Array.isArray(quotes) || quotes.length !== 100 || new Set(quotes.map(q => q.id)).size !== 100) throw Error('Invalid quote collection');
    const ids = quotes.map(q => q.id);
    let cycle = {remaining:[], last:null}, storageAvailable = true;
    try {
      const stored = JSON.parse(localStorage.getItem('math-daily-quotes-v1'));
      if (stored && Array.isArray(stored.remaining) && stored.remaining.every(id => ids.includes(id)) && new Set(stored.remaining).size === stored.remaining.length) cycle = stored;
    } catch { storageAvailable = false; }
    function refill() {
      cycle.remaining = [...ids];
      for (let i = cycle.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cycle.remaining[i], cycle.remaining[j]] = [cycle.remaining[j], cycle.remaining[i]];
      }
      // Also prevent repeating the last item at the boundary of two cycles.
      if (cycle.remaining.at(-1) === cycle.last) [cycle.remaining[0], cycle.remaining[99]] = [cycle.remaining[99], cycle.remaining[0]];
    }
    function showNext() {
      if (!cycle.remaining.length) refill();
      cycle.last = cycle.remaining.pop();
      const q = quotes.find(q => q.id === cycle.last);
      heading.textContent = q.text;
      heading.lang = q.language;
      heading.classList.toggle('foreign-quote', q.language !== 'zh');
      heading.dataset.quoteId = q.id;
      second.textContent = q.continuation || q.translation;
      second.hidden = !second.textContent;
      second.classList.toggle('quote-translation', q.language !== 'zh');
      source.replaceChildren();
      const attribution = `${q.author} · ${q.work}`;
      if (q.source_url) {
        const a = document.createElement('a'); a.textContent = attribution; a.href = q.source_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; source.append(a);
      } else source.textContent = attribution;
      try { localStorage.setItem('math-daily-quotes-v1', JSON.stringify(cycle)); } catch { storageAvailable = false; }
      note.textContent = q.language === 'zh' ? '诗文 · 文学 · 戏剧 · 电影' : '中文为本站译意';
      next.title = storageAvailable ? '100 条随机轮换，一轮读完前不重复；刷新也会记住进度' : '本页内一轮读完前不重复；浏览器未允许保存轮换进度';
    }
    next.onclick = showNext;
    next.hidden = false;
    showNext();
  } catch (error) {
    // Keep the original static verse; quote loading never blocks the reading room.
    console.error('Quote collection unavailable:', error);
  }
})();
