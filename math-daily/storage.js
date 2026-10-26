'use strict';
// Keep legacy keys and JSON shapes so existing browsers remain compatible.
window.MathStorage = {
  open(key, validate, fallback) {
    let value=fallback, blocked=false, message='';
    try { const raw=localStorage.getItem(key);if(raw!==null)value=validate(JSON.parse(raw)); }
    catch { blocked=true;message='已有数据暂时无法读取，原始内容已保留；请先导出原始备份，或恢复上次本地备份。'; }
    return {
      get value(){return value;},get blocked(){return blocked;},get message(){return message;},
      write(next, merge) {
        if(blocked)throw Error(message);
        // Validate the current record again: another tab may have changed it.
        const raw=localStorage.getItem(key);
        const latest=raw===null?fallback:validate(JSON.parse(raw));
        const checked=validate(merge?merge(latest,value,next):next);
        const encoded=JSON.stringify(checked);
        if(raw!==encoded){if(raw!==null)localStorage.setItem(key+'-backup',raw);localStorage.setItem(key,encoded);}
        value=checked;return value;
      },
      restore() {
        const raw=localStorage.getItem(key+'-backup');if(raw===null)throw Error('尚无可恢复的本地备份。');
        const checked=validate(JSON.parse(raw));localStorage.setItem(key,JSON.stringify(checked));value=checked;blocked=false;message='';return value;
      }
    };
  },
  mergePersonal(latest, baseline, next) {
    const merged={...latest};
    for(const key of ['saved','read','authors']){
      const removed=new Set(baseline[key].filter(x=>!next[key].includes(x)));
      const added=next[key].filter(x=>!baseline[key].includes(x));
      merged[key]=[...new Set([...latest[key].filter(x=>!removed.has(x)),...added])];
    }
    return merged;
  }
};
