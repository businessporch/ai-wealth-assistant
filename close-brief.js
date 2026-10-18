(() => {
 const root=document.getElementById('close-brief');
 function n(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
 fetch('data/close-brief.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{root.replaceChildren();if(d.status!=='available'){root.append(n('p',d.message||'尚无收盘后快照。'));return;}root.append(n('h3',d.tradeDate+' · 最近收盘后跟踪'),n('p','生成时间 '+new Date(d.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})),n('p',d.note));(d.quotes||[]).forEach(q=>root.append(n('p',q.name+'：'+q.price+'，日涨跌 '+q.dailyPercent.toFixed(2)+'%'+(q.thresholdHit?' · 达到±1.5%':''))));root.append(n('p','该日已抓取报道 '+(d.news||[]).length+' 条；最新报道见上方官方资讯。'));}).catch(()=>{root.textContent='暂时无法读取收盘后记录，不生成模拟报告。';});
})();
