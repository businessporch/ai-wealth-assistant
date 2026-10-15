(() => {
const price=document.getElementById('nasdaq-price'), change=document.getElementById('nasdaq-change'), state=document.getElementById('nasdaq-status'), stamp=document.getElementById('nasdaq-time'), button=document.getElementById('nasdaq-refresh');
let timer, busy=false, lastSuccess=0, lastQuote='';
function active(){return !document.hidden && document.getElementById('markets').classList.contains('active');}
function schedule(){clearTimeout(timer);if(active())timer=setTimeout(update,60000);}
async function update(){
if(busy||!active())return;busy=true;button.disabled=true;state.textContent='正在读取…';
try{
const response=await fetch('https://qt.gtimg.cn/q=usIXIC&_='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('HTTP '+response.status);
const raw=new TextDecoder('gb18030').decode(await response.arrayBuffer()), match=raw.match(/="([^"]*)"/);
if(!match)throw Error('格式错误');const f=match[1].split('~');
if(f[2]!=='.IXIC'||!f[3]?.trim()||!Number.isFinite(Number(f[3]))||Number(f[3])<=0||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(f[30]))throw Error('数据无效');
price.textContent=Number(f[3]).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
change.textContent=Number.isFinite(Number(f[32]))&&f[32]?.trim()?'涨跌幅 '+Number(f[32]).toFixed(2)+'%':'涨跌幅未提供';
stamp.textContent='来源行情时间（原样）：'+f[30];
state.textContent=(lastQuote===f[30]?'行情时间未变化，可能休市或来源延迟。':'读取成功。')+' 最近读取：'+new Date().toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai'})+'（北京时间）';
lastQuote=f[30];lastSuccess=Date.now();
}catch(e){state.textContent=lastSuccess?'更新失败，当前为旧数据；请勿当成最新行情。':'读取失败，暂时无法取得行情。';}
finally{busy=false;button.disabled=false;schedule();}
}
function resume(){if(active()){if(lastSuccess)state.textContent='保留上次数据，正在重新核实…';update();}else clearTimeout(timer);}
button.addEventListener('click',update);
document.addEventListener('visibilitychange',resume);
new MutationObserver(resume).observe(document.getElementById('markets'),{attributes:true,attributeFilter:['class']});
})();