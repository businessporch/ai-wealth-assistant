(() => {
  const status=document.getElementById('news-status'),sources=document.getElementById('source-status'),list=document.getElementById('news-list'),preview=document.getElementById('policy-preview'),signals=document.getElementById('news-signals');
  let timer,busy=false,filter='all',saved=null;
  function n(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
  function format(value,dateOnly){if(dateOnly)return value+'（原文仅提供日期）';const d=new Date(value);return Number.isFinite(+d)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(d):'未提供';}
  const china=x=>['工信部','央视财经'].includes(x.source);
  function relevant(x){return (x.tags||[]).length>0;}
  function card(x){const a=n('article','','card');a.append(n('span',x.source==='工信部'?'事实来源 · 部门发布':x.source==='央视财经'?'媒体报道 · 央视财经':'事实来源 · 官方发布','badge'),n('h3',x.title,'news-title'),n('p','来源：'+x.source+' · 发布：'+format(x.publishedAt,x.dateOnly),'news-meta'));
    if((x.tags||[]).length)a.append(n('p','关注主题：'+x.tags.join(' / ')+'（关键词匹配）'));
    if(Date.now()-Date.parse(x.fetchedAt)>45*60000)a.append(n('p','此条抓取已超过45分钟，请核对原文是否更新。','news-warning'));
    a.append(n('p','分析：未调用AI；主题标签不代表利好、利空或买卖结论。'));
    try{const u=new URL(x.url);if(u.protocol==='https:'){const link=n('a','核对来源原文 ↗','news-link');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';a.append(link);}}catch{}return a;
  }
  function render(){if(!saved)return;list.replaceChildren();preview.replaceChildren();signals.replaceChildren();const data=saved;let items=data.items||[];
    const filtered=items.filter(x=>filter==='all'||filter==='china'&&china(x)||filter==='global'&&!china(x)||filter==='ai'&&(x.tags||[]).includes('AI / 算力'));
    filtered.slice(0,65).forEach(x=>list.append(card(x)));if(!filtered.length)list.append(n('p','当前筛选暂无可用报道。'));
    items.filter(china).slice(0,4).forEach(x=>preview.append(card(x)));if(!preview.children.length)preview.append(n('p','国内官方资讯尚未取得，请查看来源状态。'));
    const recent=items.filter(x=>relevant(x)&&Date.now()-Date.parse(x.publishedAt)<72*3600000&&Date.now()-Date.parse(x.publishedAt)>=0).slice(0,5);
    recent.forEach(x=>{const a=n('article','','card');a.append(n('strong',x.source+' · '+x.title),n('p','发布时间 '+format(x.publishedAt,x.dateOnly)+' · 规则匹配的关注事项，非重要性人工审核结果。'));signals.append(a);});if(!recent.length)signals.append(n('p','近72小时暂无匹配的已抓取关注报道；这不代表市场没有重大新闻。'));
  }
  async function load(){if(busy||document.hidden)return;busy=true;try{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response;try{response=await fetch('data/news.json',{cache:'no-store',signal:controller.signal});}finally{clearTimeout(timeout);}if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.items)||!Array.isArray(data.sources))throw Error();saved=data;const age=Date.now()-Date.parse(data.generatedAt);status.textContent='最近抓取 '+format(data.generatedAt)+'（北京时间） · 计划约15分钟检查一次，可能延迟'+(!Number.isFinite(age)||age>45*60000?' · 更新已过期':'');status.classList.toggle('news-warning',!Number.isFinite(age)||age>45*60000);sources.replaceChildren();data.sources.forEach(s=>sources.append(n('div',s.name+'：'+(s.ok?'抓取成功':'失败，可能保留旧数据')+' · 最近成功 '+format(s.lastSuccessAt))));render();}catch{status.textContent='本次资讯读取失败，已显示内容可能过期。';status.classList.add('news-warning');}finally{busy=false;clearTimeout(timer);if(!document.hidden)timer=setTimeout(load,60000);}}
  document.getElementById('refresh-news').addEventListener('click',load);document.querySelectorAll('[data-news-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.newsFilter;document.querySelectorAll('[data-news-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)load();});load();
})();
