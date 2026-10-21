'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const palette=['#a54660','#368a86','#af7b24','#5d80b4','#8c6bb0','#b47756','#3f7e56','#b75093'];
  let subjects=[], enabled=new Set();
  let days = [], period = 'day', metric = 'papers';
  const number = v => `${Math.round(v*10)/10}`;
  const weekStart = date => { const d = new Date(date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)); return d.toISOString().slice(0,10); };
  const ns = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) { const el=document.createElementNS(ns,tag); for(const [k,v] of Object.entries(attrs || {}))el.setAttribute(k,v); if(text!==undefined)el.textContent=text; return el; }
  function rows() {
    const map = new Map();
    for(const day of days) {
      const key = period==='week' ? weekStart(day.date) : day.date;
      if(!map.has(key))map.set(key,{date:key,batches:0,groups:Object.fromEntries(subjects.map(s=>[s.code,{count:0,explicit:0,checked:0,available:false}]))});
      const row=map.get(key);row.batches++;
      for(const s of subjects){const raw=day.groups[s.code];if(!raw)continue;const g=row.groups[s.code];g.available=true;g.count+=raw.new;g.explicit+=raw.new_explicit || 0;g.checked+=raw.new_checked || 0;}
    }
    return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function show(row, focusedCode) {
    const list=subjects.filter(s=>enabled.has(s.code) && (!focusedCode || s.code===focusedCode));
    byId('trend-point').textContent=`${row.date}${period==='week'?` 起的一周（${row.batches} 个已归档日）`:''} · `+list.map(s=>{const g=row.groups[s.code];return !g.available?`${s.code}：未收录`:metric==='ai'?`${s.code}：${g.checked && g.count?number(100*g.explicit/g.count)+'%':'待核查'}（披露 ${g.explicit}/${g.count}，已核查 ${g.checked}）`:`${s.code}：${g.count} 篇`;}).join(' · ');
  }
  function render() {
    const data=rows(), active=subjects.filter(s=>enabled.has(s.code)), ai=metric==='ai';
    const host=byId('trend-chart');host.replaceChildren();byId('trend-rows').replaceChildren();
    if(!data.length){byId('trend-note').textContent='目前还没有可用的历史统计。';return;}
    byId('trend-title').textContent=`${period==='week'?'每周':'每日'}${ai?' AI 披露占比':'发文趋势'}`;
    for(const s of subjects)byId('trend-toggle-'+s.code).setAttribute('aria-pressed',String(enabled.has(s.code)));
    if(!active.length){byId('trend-point').textContent='点击上方方向按钮，选择要显示的曲线。';return;}
    const width=Math.max(220,Math.min(1000,host.clientWidth || 800)),height=280,left=40,right=22,top=22,bottom=44;
    const value=(row,s)=>{const g=row.groups[s.code];return !g.available?null:ai?(g.checked && g.count?100*g.explicit/g.count:null):g.count;};
    const max=ai?100:Math.max(4,Math.ceil(Math.max(...data.flatMap(r=>active.map(s=>value(r,s)||0)))/4)*4);
    const times=data.map(r=>Date.parse(r.date+'T00:00:00Z')),range=times.at(-1)-times[0];
    const x=i=>range?left+(times[i]-times[0])/range*(width-left-right):(width+left-right)/2;
    const y=v=>height-bottom-v/max*(height-top-bottom);
    const svg=svgEl('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${byId('trend-title').textContent}，按研究方向区分；下方提供数据表`});
    for(let i=0;i<=4;i++){const v=max*i/4;svg.append(svgEl('line',{x1:left,x2:width-right,y1:y(v),y2:y(v),stroke:'#e2e6ef'}),svgEl('text',{x:left-10,y:y(v)+4,'text-anchor':'end',fill:'#76829a','font-size':11},number(v)+(ai?'%':'')));}
    const stride=Math.max(1,Math.ceil(data.length/Math.max(2,Math.floor(width/100))));
    data.forEach((r,i)=>{if(i%stride===0 || i===data.length-1)svg.append(svgEl('text',{x:x(i),y:height-17,'text-anchor':'middle',fill:'#76829a','font-size':11},r.date.slice(5)));});
    let points=0;
    for(const s of active){
      let segment=[];
      const draw=()=>{if(segment.length>1)svg.append(svgEl('polyline',{points:segment.join(' '),fill:'none',stroke:s.color,'stroke-width':2.2,'stroke-linejoin':'round','data-subject':s.code}));segment=[];};
      data.forEach((r,i)=>{const v=value(r,s);if(v===null){draw();return;}segment.push(`${x(i)},${y(v)}`);});draw();
      data.forEach((r,i)=>{const v=value(r,s);if(v===null)return;points++;const label=`${r.date} ${s.code}：${number(v)}${ai?'%':' 篇'}`;const dot=svgEl('circle',{cx:x(i),cy:y(v),r:4,fill:s.color,stroke:'#fff','stroke-width':1.5,tabindex:0,'aria-label':label,'data-subject':s.code});dot.append(svgEl('title',{},label));for(const event of ['mouseenter','focus','click'])dot.addEventListener(event,()=>show(r,s.code));svg.append(dot);});
    }
    host.append(svg);show(data.at(-1));
    byId('trend-note').textContent=`${days.length} 个已归档批次（各方向起始日可能不同，缺失不补零） · ${data.length} 个${period==='week'?'周':'日期'}数据点。${data.length<3?'历史尚少，后续自动积累；尚不能据此判断长期趋势。':''}${ai?' 未核查不等于无 AI；比例仅表示已检出披露占新论文的比例，补查可能改变历史点位。':''}${!points?'当前所选方向尚无可绘制的已核查比例。':''}`;
    for(const row of data)for(const s of active){const g=row.groups[s.code];if(!g.available)continue;const tr=document.createElement('tr');for(const v of [row.date,s.code,g.count,g.explicit,g.checked]){const td=document.createElement('td');td.textContent=v;tr.append(td);}byId('trend-rows').append(tr);}
  }
  function syncSubjects(){
    subjects=MathSubjects.selected.map((code,i)=>({code,name:MathSubjects.names[code],color:palette[i%palette.length]}));
    enabled=new Set(subjects.map(s=>s.code));byId('trend-legend').replaceChildren();
    for(const s of subjects){const button=document.createElement('button');button.type='button';button.id='trend-toggle-'+s.code;button.className='trend-subject-toggle';button.title=s.name;button.style.setProperty('--series-color',s.color);button.setAttribute('aria-pressed','true');button.setAttribute('aria-label',s.name);const line=document.createElement('i');button.append(line,document.createTextNode(s.code));button.onclick=()=>{enabled.has(s.code)?enabled.delete(s.code):enabled.add(s.code);render();};byId('trend-legend').append(button);}
  }
  syncSubjects();
  window.addEventListener('math-subjects-change',()=>{syncSubjects();render();});
  for(const button of document.querySelectorAll('[data-period]'))button.onclick=()=>{period=button.dataset.period;for(const b of document.querySelectorAll('[data-period]'))b.setAttribute('aria-pressed',String(b===button));render();};
  for(const button of document.querySelectorAll('[data-metric]'))button.onclick=()=>{metric=button.dataset.metric;for(const b of document.querySelectorAll('[data-metric]'))b.setAttribute('aria-pressed',String(b===button));render();};
  let observedWidth=0;
  new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width!==observedWidth){observedWidth=width;if(days.length)render();}}).observe(byId('trend-chart'));
  fetch('data/trends.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{days=data.days;render();}).catch(()=>{byId('trend-note').textContent='趋势统计暂时加载失败，请刷新重试。论文列表不受影响。';});
})();
