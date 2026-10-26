"use strict";
window.MathReader = {
  cleanLink(base, values) { const url=new URL(base);url.search='';url.hash='';for(const [key,value] of Object.entries(values))if(value)url.searchParams.set(key,value);return url.href; },
  parseSubjects(value, names) { return [...new Set((value || '').split(',').filter(code=>Object.hasOwn(names,code)))]; },
  rss(codes) { return codes.length ? 'https://rss.arxiv.org/rss/'+codes.join('+') : ''; },
  sort(papers, mode, follows, fallbackDate) { return papers.slice().sort((a,b)=>{
    if(mode==='followed'){const priority=Number(follows(b))-Number(follows(a));if(priority)return priority;}
    const dateA=a.occurrences?.[0]?.date || fallbackDate || '', dateB=b.occurrences?.[0]?.date || fallbackDate || '';
    return dateB.localeCompare(dateA) || b.id.localeCompare(a.id,undefined,{numeric:true});
  }); },
  updateMessage(status, now=Date.now()) {
    if(status.result==='error')return '最近一次检查失败，仍显示上次成功归档；稍后会重试。';
    const elapsed=now-Date.parse(status.last_success);
    if(!Number.isFinite(elapsed))return '最近检查时间暂不可用。';
    if(elapsed>48*3600000)return '超过 48 小时未确认成功检查，更新可能异常；公告日期不能单独用于判断。';
    if(status.empty || status.result==='no_new')return '检查成功，未发现新的公告内容；周末及休刊日可能没有新公告。';
    return '最近检查成功，论文已归档。';
  }
};
