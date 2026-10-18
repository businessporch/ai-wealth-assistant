(() => {
'use strict';
const $=id=>document.getElementById(id),n=(tag,text='',cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
let data={items:[]},filter='★重点',busy=false,timer;
const sheet=n('section','','detail-sheet');sheet.hidden=true;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','新闻详情');document.body.append(sheet);let lastFocus;
const date=x=>x.dateOnly?x.publishedAt.replace(/(\d{4})-(\d{2})-(\d{2})/,'$1年$2月$3日'):new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x.publishedAt));
const link=(title,url)=>{const a=n('a',title,'related-link');try{const u=new URL(url);if(u.protocol!=='https:')return a;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{}return a;};
const sources=[['国务院政策原文','https://www.gov.cn/zhengce/zuixin/'],['财联社半导体设备专题','https://www.cls.cn/subject/11055'],['财联社半导体材料专题','https://www.cls.cn/subject/11056'],['中国证券报','https://www.cs.com.cn/'],['上海证券报','https://www.cnstock.com/'],['证券时报','https://www.stcn.com/'],['证券日报','https://www.zqrb.cn/'],['中国网财经 · 抖音官方账号','https://www.douyin.com/user/MS4wLjABAAAAq3kXlON6-IM-t8_aV2Rb6LHqdg1uCL5RF3LnZiszu2g']];
sources.forEach(([s,u])=>$('more-sources').append(link(s+' ↗',u)));$('more-sources').prepend(n('p','★重点由免费规则筛选近72小时内容：官方重要政策优先，其次是权威媒体政策报道和AI、跟踪ETF行业重大动态。不是官方重要性评级，可能漏报；不按标题夸张程度或粉丝数标星。'));
function all(){return [...new Map([...(data.items||[]),...(window.WealthNews||[])].map(x=>[x.url,x])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));}
function kind(x){return x.kind==='fact'?'媒体报道':x.kind==='analysis'?'来源分析':x.kind||(x.source==='美联储'||x.source==='欧洲央行'||x.source==='工信部'?'官方发布':'媒体报道');}
function priority(x,now=Date.now()){
 const time=Date.parse(x.dateOnly?x.publishedAt+'T00:00:00+08:00':x.publishedAt),age=now-time;
 if(!Number.isFinite(time)||age<0||age>72*3600000||/观点|分析/.test(kind(x)))return {score:0,reason:''};
 let host='';try{host=new URL(x.url).hostname;}catch{return {score:0,reason:''};}
 const official=['www.gov.cn','www.miit.gov.cn','www.pbc.gov.cn','www.csrc.gov.cn','www.federalreserve.gov','www.ecb.europa.eu'].includes(host);
 const text=x.title+' '+(x.titleZh||'');
 const policy=/国务院.*(?:政策|部署|意见|决定|条例|措施)|国常会|证监.*(?:政策|规则|规定|措施)|降准|降息|加息|货币政策|利率决议|FOMC|federal open market|monetary policy|interest rate|discount rate|出口.*管制|出口.*限制|人工智能\+|新质生产力/i.test(text);
 const industry=/半导体|芯片|算力|人工智能|云计算|储能|电池|海光信息|中科曙光|澜起科技|华海清科|中微公司|拓荆科技/.test(text);
 const event=/部署|政策|发布|出台|审议|回购|业绩|突破|禁令|管制|召回|停产|断供|澄清|辟谣|重大|涨超[23]|跌超[23]/.test(text);
 const media=['央视新闻','央视财经','央视新闻客户端','新华社','财联社','科创板日报','中国证券报','上海证券报','证券时报','证券日报','东方财富Choice数据'].includes(x.source)&&/^(?:[\w-]+\.)*(?:cctv\.com|cls\.cn|eastmoney\.com|cs\.com\.cn|cnstock\.com|stcn\.com|zqrb\.cn|news\.cn)$/.test(host);
 if(official&&/紧急通知|紧急公告|emergency/i.test(text))return {score:4,reason:'官方原文含紧急表述'};
 if(official&&policy)return {score:3,reason:'官方政策 / 央行重要发布'};
 if(media&&policy)return {score:2,reason:'权威媒体报道政策动态'};
 if(media&&industry&&event)return {score:1,reason:'与AI / 跟踪ETF行业有关的重要动态'};
 if(media&&/全球市场/.test(text)&&/涨超[23]|跌超[23]/.test(text))return {score:1,reason:'全球市场明显波动'};
 return {score:0,reason:''};
}
function ranked(items){return items.slice().sort((a,b)=>priority(b).score-priority(a).score||b.publishedAt.localeCompare(a.publishedAt));}
function titleOf(x){return x.titleZh||x.title;}
function starTitle(tag,x){const title=n(tag);if(priority(x).score){const star=n('span','★ ');star.style.color='#ffd47b';star.setAttribute('aria-label','重点');title.append(star);}title.append(document.createTextNode(titleOf(x)));return title;}


function row(x){const d=n('div','','news-row');const b=n('button','','headline-button');b.append(starTitle('span',x));b.append(n('span',(priority(x).score?priority(x).reason+' · ':'')+kind(x)+' · '+x.source+' · '+date(x),'news-caption'));b.addEventListener('click',()=>open(x));d.append(b);return d;}
function sourceReader(x){
 const box=n('section','','source-reader');box.append(n('h2','来源原文 · 直接阅读'));
 const fallback=link('在浏览器打开完整原文 ↗',x.url);fallback.style.cssText='display:block;background:#2261a2;color:white;border-radius:10px;padding:12px;margin:10px 0';box.append(fallback);
 let u;try{u=new URL(x.url);}catch{return box;}
 if(u.protocol==='https:'&&/^(?:finance|stock|global|fund|wap)\.eastmoney\.com$/.test(u.hostname)&&/^\/a\/\d+\.html$/.test(u.pathname)){
  const frame=n('iframe');frame.src='https://wap.eastmoney.com'+u.pathname;frame.title='来源原文：'+x.title;frame.style.cssText='width:100%;height:75vh;min-height:480px;border:1px solid #34516e;border-radius:10px;background:white';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');frame.referrerPolicy='no-referrer';box.append(n('p','下方为来源网站的手机原文，可在框内上下滑动。若加载受限或空白，请使用上方完整原文按钮。','muted'),frame);
 }else box.append(n('p','此来源暂未验证支持内嵌阅读，请使用上方按钮查看完整内容。','muted'));
 return box;
}


function open(x){lastFocus=document.activeElement;sheet.replaceChildren();const header=n('header');const back=n('button','← 返回','smallbtn');back.onclick=close;header.append(back,n('span',kind(x),'story-kind'));sheet.append(header,starTitle('h1',x),n('p',x.source+' · '+date(x),'muted'));if(x.titleZh)sheet.append(n('p',x.title,'muted'));
 const ref=/半导体|芯片/.test(x.title)?'sh588170':/云计算|算力/.test(x.title)?'sh516630':/储能|电池/.test(x.title)?'sz159566':/Federal|FOMC|美联储|纳斯达克|纳指|美股/.test(x.title)?'usIXIC':'sh000001';const q=window.WealthQuotes?.[ref];if(q){const p=n('p','行情参考：'+q.name+' '+q.price+'　'+(q.pct>=0?'+':'')+q.pct+'% · '+q.day,'quote-banner');sheet.append(p);}
 sheet.append(sourceReader(x)); if(kind(x).includes('观点'))sheet.append(n('p','以下为来源机构或作者的观点，尚非已发生的市场事实。','story-kind'));
 sheet.append(n('h2','内容提要'));if(x.summaryZh)sheet.append(n('p',x.summaryZh+'（中文译文）'));else if(x.summary)sheet.append(n('p',(x.summaryType||'来源导语节选')+'：'+x.summary));else sheet.append(n('p','此来源未提供可展示的摘要，请打开原文查看完整报道。','muted'));
 if(x.sections?.length){sheet.append(n('h2',x.category==='报刊'?'四大证券报 · 标题摘录':x.category==='机构观点'?'各机构观点 · 原文小标题':'原文分段 · 标题摘录'));x.sections.forEach(t=>{const s=(x.sectionLinks||[]).find(s=>s.title===t||t.endsWith(s.title));sheet.append(link(t+' ↗',s?.url||x.url));});}
 sheet.append(link('打开来源原文，阅读全部内容 ↗',x.url),n('h2','相关报道'));
 const words=(x.title.match(/人工智能|半导体|芯片|算力|储能|电池|美联储|利率|券商|机构|材料|设备|回购/g)||[]);const related=all().filter(y=>y.url!==x.url&&(words.some(t=>y.title.includes(t))||x.category&&y.category===x.category)).slice(0,5);
 related.forEach(y=>{const b=n('button',y.title,'related-story');b.onclick=()=>open(y);sheet.append(b);});if(!related.length)sheet.append(n('p','目前已抓取内容中暂无更多同主题报道。','muted'));
 const more=n('details','','source-details');more.append(n('summary','继续了解 · 原始来源和更多报道'));sources.forEach(([s,u])=>more.append(link(s+' ↗',u)));sheet.append(more);sheet.hidden=false;document.body.style.overflow='hidden';sheet.scrollTop=0;back.focus();}
function close(){sheet.hidden=true;document.body.style.overflow='';lastFocus?.focus();}
document.addEventListener('keydown',e=>{if(sheet.hidden)return;if(e.key==='Escape')close();if(e.key==='Tab'){const a=[...sheet.querySelectorAll('button,a[href],summary')].filter(e=>e.getClientRects().length);if(!a.length)return;if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0].focus();}}});
const cats=['★重点','要闻','国内政策','AI / 算力','半导体','机构观点','机构调研','全球市场','报刊','全部'];
function selected(x){return filter==='★重点'&&priority(x).score>0||filter==='全部'||filter==='要闻'&&!['早餐','报刊','机构调研'].includes(x.category)||filter==='国内政策'&&(x.category==='政策'||['中国政府网','工信部','央视新闻','央视财经'].includes(x.source))||filter==='AI / 算力'&&/人工智能|算力|AI|芯片|大模型/.test(x.title)||filter===x.category;}
function render(){const items=all();window.WealthPortalItems=items;const head=$('home-headlines');head.replaceChildren();const important=ranked(items.filter(x=>priority(x).score));important.slice(0,5).forEach(x=>head.append(row(x)));if(!head.children.length)items.slice(0,5).forEach(x=>head.append(row(x)));
 const list=$('portal-list');list.replaceChildren();(filter==='★重点'?ranked(items.filter(selected)):items.filter(selected)).slice(0,60).forEach(x=>list.append(row(x)));if(!list.children.length)list.append(n('p','此分类暂无已抓取报道；重点仅筛选近72小时命中规则的内容，可切换要闻查看其他报道。','footer'));
 const featured=$('portal-featured');featured.replaceChildren();if(filter==='要闻'){const box=n('div','','list-panel');const latest=items.filter(x=>/周末要闻|机构论市|科技股.*回购/.test(x.title));latest.slice(0,3).forEach(x=>box.append(row(x)));featured.append(box);const featuredUrls=new Set(latest.slice(0,3).map(x=>x.url));list.replaceChildren();items.filter(selected).filter(x=>!featuredUrls.has(x.url)).slice(0,12).forEach(x=>list.append(row(x)));const more=n('button','更多资讯 →','smallbtn');more.onclick=()=>{filter='全部';render();};list.append(more);}
 const tiles=$('must-read');tiles.replaceChildren();for(const cat of ['早餐','全球市场','报刊','机构调研']){const x=items.find(x=>x.category===cat);const b=n('button','','reading-tile');b.append(n('strong',cat));b.append(n('span',x?x.title:'尚未取得本栏最新数据'));b.append(n('small',x?date(x):'不以旧闻冒充今天'));b.disabled=!x;if(x)b.onclick=()=>open(x);tiles.append(b);}
 $('portal-filters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===filter)));document.dispatchEvent(new CustomEvent('wealth:portal'));}
cats.forEach(c=>{const b=n('button',c,'chip');b.onclick=()=>{filter=c;render();};$('portal-filters').append(b);});
function svg(tag,attrs){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;}
function south(d){const root=$('southbound');root.replaceChildren();const m=d.minute;if(m?.points?.length){const last=m.points.at(-1);root.append(n('h3','南向净买额 '+last[1].toFixed(2)+' 亿港元'),n('p',m.date+' '+last[0]+' · '+(m.ok?'最近来源数据':'读取失败，保留旧数据'),'muted'));const values=m.points.map(p=>p[1]);const min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1;const chart=svg('svg',{viewBox:'0 0 340 150',class:'chart-svg',role:'img','aria-label':'南向净买额分时图，单位亿港元'});chart.append(svg('line',{x1:40,x2:330,y1:15+(-min/range)*0,y2:15,stroke:'#29405a'}));const y=v=>120-(v-min)/range*100;chart.append(svg('line',{x1:40,x2:330,y1:y(0),y2:y(0),stroke:'#536c83','stroke-dasharray':'3 3'}));chart.append(svg('polyline',{points:m.points.map((p,i)=>(40+i/(values.length-1||1)*290)+','+y(p[1])).join(' '),fill:'none',stroke:'#68c4ef','stroke-width':2}));for(const [t,x,yy] of [[max.toFixed(1),2,20],[min.toFixed(1),2,125],[m.points[0][0],40,145],[last[0],295,145]]){const text=svg('text',{x,y:yy,fill:'#9bb4d1','font-size':10});text.textContent=t;chart.append(text);}root.append(chart);}
 (d.channels||[]).forEach(c=>{const details=n('details','','source-details');details.append(n('summary',c.name+' 十大成交 · '+(c.date||'日期缺失')+(c.ok?'':' · 读取失败')));const t=n('table','','market-table');const thead=n('thead'),h=n('tr');['证券','成交额','净买额'].forEach(s=>h.append(n('th',s)));thead.append(h);t.append(thead);c.rows?.forEach(r=>{const tr=n('tr');tr.append(n('th',r.name+' '+r.code),n('td',r.turnover.toFixed(2)),n('td',r.netBuy.toFixed(2)));t.append(tr);});details.append(n('p','单位：亿港元；沪、深通道分别披露，不冒充合并全市场排名。','muted'),t);root.append(details);});root.append(n('p','按来源日期显示；约15分钟检查一次，非实时。净买额与额度余额、资金净流入不是同一口径。','muted'),link('核对东方财富原始数据 ↗',d.sourceUrl));}
async function refresh(){if(busy||document.hidden)return;busy=true;try{const results=await Promise.allSettled(['portal','southbound'].map(async file=>{const c=new AbortController(),timeout=setTimeout(()=>c.abort(),15000);try{const r=await fetch('data/'+file+'.json',{cache:'no-store',signal:c.signal});if(!r.ok)throw Error(r.status);return await r.json();}finally{clearTimeout(timeout);}}));if(results[0].status==='fulfilled'){data=results[0].value;const failed=(data.sources||[]).filter(s=>!s.ok);$('portal-status').textContent='资讯数据检查 '+new Date(data.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+' · 文章各自标注发布时间'+(Date.now()-Date.parse(data.generatedAt)>45*60000?' · 数据已过期':'')+(failed.length?' · 部分来源读取失败':'');render();}else $('portal-status').textContent='新资讯读取失败，保留已显示内容。';if(results[1].status==='fulfilled')south(results[1].value);else $('southbound').append(n('p','资金数据读取失败。'));}finally{busy=false;clearTimeout(timer);if(!document.hidden)timer=setTimeout(refresh,60000);}}
document.addEventListener('wealth:news',render);document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh();});window.WealthStory={open,close};render();refresh();
})();


