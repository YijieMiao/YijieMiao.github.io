'use strict';
(() => {
  const byId = id => document.getElementById(id);
  let days = [];
  const number = value => `${Math.round(value*10)/10}`;
  const weekStart = date => { const d = new Date(date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay()+6)%7)); return d.toISOString().slice(0,10); };
  const ns = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) { const el = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs || {})) el.setAttribute(k,v); if (text !== undefined) el.textContent = text; return el; }
  function rows() {
    const map = new Map(), code = byId('trend-subject').value, weekly = byId('trend-period').value === 'week';
    for (const day of days) {
      const key = weekly ? weekStart(day.date) : day.date;
      if (!map.has(key)) map.set(key,{date:key,total:0,new:0,revised:0,explicit:0,checked:0,batches:0});
      const row = map.get(key), value = day.groups[code]; if (!value) continue;
      for (const k of ['total','new','revised','explicit','checked']) row[k] += value[k];
      row.batches++;
    }
    return [...map.values()].sort((a,b) => a.date.localeCompare(b.date));
  }
  function render() {
    const data = rows(), ai = byId('trend-metric').value === 'ai', weekly = byId('trend-period').value === 'week';
    const host = byId('trend-chart'); host.replaceChildren(); byId('trend-legend').replaceChildren(); byId('trend-rows').replaceChildren();
    if (!data.length) { byId('trend-note').textContent = '目前还没有可用的历史统计。'; return; }
    const series = ai ? [{key:'explicit',name:'已检出 AI 声明 / 总稿次',color:'#9675aa',value:r => r.checked && r.total ? 100*r.explicit/r.total : null},{key:'checked',name:'文字检索覆盖率',color:'#6a97a3',value:r => r.total ? 100*r.checked/r.total : null}] : [{key:'new',name:'新论文（含交叉）',color:'#678cac',value:r => r.new},{key:'revised',name:'修订论文',color:'#b38b9d',value:r => r.revised}];
    for (const s of series) { const span = document.createElement('span'); const dot = document.createElement('i'); dot.style.background = s.color; span.append(dot,document.createTextNode(s.name)); byId('trend-legend').append(span); }
    const width=Math.max(220,Math.min(1000,host.clientWidth || 800)), height=250, left=40, right=22, top=22, bottom=44;
    const max = ai ? 100 : Math.max(5,Math.ceil(Math.max(...data.flatMap(r => series.map(s => s.value(r) || 0)))/5)*5);
    const times=data.map(r => Date.parse(r.date+'T00:00:00Z')), range=times.at(-1)-times[0];
    const x=i => range ? left+(times[i]-times[0])/range*(width-left-right) : (width+left-right)/2;
    const y=v => height-bottom-v/max*(height-top-bottom);
    const svg=svgEl('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${weekly?'每周':'每日'}${ai?' AI 披露及核查覆盖率':'新论文及修订数量'}趋势；下方提供完整数据表`});
    for(let i=0;i<=4;i++){const value=max*i/4;svg.append(svgEl('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),stroke:'#e2e6ef'}),svgEl('text',{x:left-10,y:y(value)+4,'text-anchor':'end',fill:'#76829a','font-size':11},number(value)+(ai?'%':'')));}
    const stride=Math.max(1,Math.ceil(data.length/Math.max(2,Math.floor(width/100))));
    data.forEach((row,i) => {if(i%stride===0 || i===data.length-1)svg.append(svgEl('text',{x:x(i),y:height-17,'text-anchor':'middle',fill:'#76829a','font-size':11},row.date.slice(5)));});
    function show(row) { byId('trend-point').textContent = `${row.date}${weekly?' 起的一周':''} · 新论文 ${row.new} · 修订 ${row.revised} · 总稿次 ${row.total} · 检出 AI 声明 ${row.explicit} · 已核查 ${row.checked}/${row.total}${row.checked && row.total ? ` · 披露占比 ${number(100*row.explicit/row.total)}%` : ' · 披露占比待核查'}`; }
    for(const s of series){
      let segment=[];
      const draw=()=>{if(segment.length>1)svg.append(svgEl('polyline',{points:segment.join(' '),fill:'none',stroke:s.color,'stroke-width':2.3,'stroke-linejoin':'round'}));segment=[];};
      data.forEach((row,i)=>{const value=s.value(row);if(value===null){draw();return;}segment.push(`${x(i)},${y(value)}`);});draw();
      data.forEach((row,i)=>{const value=s.value(row);if(value===null)return;const label=`${row.date} ${s.name}：${number(value)}${ai?'%':' 稿次'}`;const dot=svgEl('circle',{cx:x(i),cy:y(value),r:4.5,fill:s.color,stroke:'#fff','stroke-width':2,tabindex:0,'aria-label':label});dot.append(svgEl('title',{},label));dot.addEventListener('mouseenter',()=>show(row));dot.addEventListener('focus',()=>show(row));dot.addEventListener('click',()=>show(row));svg.append(dot);});
    }
    host.append(svg);show(data.at(-1));
    byId('trend-note').textContent = `${days.length} 个已归档批次 · ${data.length} 个${weekly?'周':'日期'}数据点。${data.length<3?'历史尚少，随着每日归档增加会形成更完整的曲线。':''}${ai?' 披露线反映当前可核查证据，补查旧论文也可能改变历史点位；不能作为真实 AI 使用率。':''}`;
    for (const row of data) {const tr=document.createElement('tr');for(const value of [row.date,row.new,row.revised,row.total,row.explicit,row.checked]){const td=document.createElement('td');td.textContent=value;tr.append(td);}byId('trend-rows').append(tr);}
  }
  for(const id of ['trend-period','trend-metric','trend-subject'])byId(id).addEventListener('change',render);
  let observedWidth = 0;
  new ResizeObserver(entries => { const width = Math.round(entries[0].contentRect.width); if (width !== observedWidth) { observedWidth = width; if (days.length) render(); } }).observe(byId('trend-chart'));
  fetch('data/trends.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{days=data.days;render();}).catch(()=>{byId('trend-note').textContent='趋势统计暂时加载失败，请刷新重试。论文列表不受影响。';});
})();
