"""Public metadata and deterministic watch tags; no AI or private data."""
import json,re,html,time
from pathlib import Path
from datetime import datetime,timedelta,timezone,date
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlparse,quote
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
CN=timezone(timedelta(hours=8))
RULES=[('AI / 算力',['人工智能','算力','大模型','芯片','半导体','软件','AI','artificial intelligence']),('汽车 / 电池',['汽车','电池','储能','新能源','锂']),('政策 / 资本市场',['国务院','工信','证监','央行','利率','金融','货币','融资','monetary','interest rate','FOMC']),('公司 / 技术',['公司','企业','技术','研发','制造','创新'])]
def tags(title):
    return [name for name,words in RULES if any((bool(re.search(r'\b'+re.escape(w)+r'\b',title,re.I)) if w.isascii() else w in title) for w in words)]
def get(url):
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0 (public news metadata reader)'}),timeout=18) as r:
        data=r.read(3_000_001)
    if len(data)>3_000_000: raise ValueError('response too large')
    return data
class Parser(HTMLParser):
    def __init__(self):
        super().__init__();self.root={'tag':'root','text':[],'parent':None};self.stack=[self.root];self.links=[]
    def handle_starttag(self,tag,attrs):
        n={'tag':tag,'text':[],'parent':self.stack[-1],'attrs':dict(attrs)}
        if tag=='a':self.links.append(n)
        if tag not in ('br','img','meta','link','input','hr','source','wbr'):self.stack.append(n)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i]['tag']==tag:self.stack=self.stack[:i];break
    def handle_data(self,s):
        for n in self.stack:n['text'].append(s)
def parse_news(raw,base,name,now):
    parser=Parser();parser.feed(raw.decode('utf-8-sig','replace'));items=[]
    for n in parser.links:
        title=' '.join(''.join(n['text']).split());url=urljoin(base,n['attrs'].get('href',''))
        host=urlparse(url).hostname or '';allowed=(host=='www.miit.gov.cn' if name=='工信部' else host.endswith('.cctv.com'))
        if not allowed or not url.startswith('https:') or len(title)<10 or not tags(title):continue
        if re.search('招聘|校招|考核|党建|党组|视察|竞赛|大赛|学习贯彻|暖心',title):continue
        context=n
        for _ in range(4):
            if context['tag']=='li' or not context['parent']:break
            context=context['parent']
        match=re.search(r'(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})',url+' '+' '.join(context['text']))
        if not match:continue
        try:published=date(*map(int,match.groups()))
        except ValueError:continue
        if published>now.date() or (now.date()-published).days>30:continue
        items.append(dict(title=title,url=url,source=name,publishedAt=published.isoformat(),dateOnly=True,fetchedAt=now.isoformat(),kind='fact',analysis=None,tags=tags(title)))
    return list({x['url']:x for x in items}.values())[:35]
def collect_news():
    now=datetime.now(CN);target=ROOT/'data/news.json'
    try:data=json.loads(target.read_text(encoding='utf-8'))
    except (OSError,ValueError):data={'items':[],'sources':[]}
    for name,url in [('工信部','https://www.miit.gov.cn/xwfb/'),('央视财经','https://finance.cctv.com/index.shtml')]:
        old=next((s for s in data['sources'] if s['name']==name),{})
        try:
            items=parse_news(get(url),url,name,now)
            if not items:raise ValueError('No dated relevant links')
            data['items']=[x for x in data['items'] if x['source']!=name]+items
            state=dict(name=name,url=url,ok=True,lastSuccessAt=now.isoformat(),itemCount=len(items))
        except Exception as e:
            state=dict(name=name,url=url,ok=False,lastSuccessAt=old.get('lastSuccessAt'));print(name,type(e).__name__)
        data['sources']=[s for s in data['sources'] if s['name']!=name]+[state]
    for item in data['items']:item['tags']=tags(item['title'])
    data['items'].sort(key=lambda x:x['publishedAt'],reverse=True)
    data['generatedAt']=now.isoformat();target.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print('News',[(s['name'],s['ok'],s.get('itemCount')) for s in data['sources']])
SYMBOLS={'sh000001':'000001.SS','sz399001':'399001.SZ','sz399006':'399006.SZ','sh588170':'588170.SS','sh516630':'516630.SS','sz159566':'159566.SZ','usIXIC':'^IXIC'}
def history_meta(rows):
    rows=sorted(rows);last=date.fromisoformat(rows[-1][0]);monday=last-timedelta(days=last.weekday());bases={}
    for offset in range(-1,4):
        start=monday-timedelta(weeks=offset);prior=[r for r in rows if r[0]<start.isoformat()]
        if prior:bases[start.isoformat()]={'date':prior[-1][0],'close':prior[-1][1]}
    previous_start=monday-timedelta(days=7);before=[r for r in rows if r[0]<previous_start.isoformat()];week=[r for r in rows if previous_start.isoformat()<=r[0]<monday.isoformat()]
    completed=None
    if before and week:completed={'startBaseDate':before[-1][0],'endDate':week[-1][0],'points':week[-1][1]-before[-1][1],'percent':(week[-1][1]/before[-1][1]-1)*100}
    return dict(weekBases=bases,lastCompletedWeek=completed,lastDailyDate=rows[-1][0])
def collect_history():
    path=ROOT/'data/weekly.json';now=datetime.now(CN).isoformat()
    try:old=json.loads(path.read_text(encoding='utf-8'))
    except (OSError,ValueError):old={'symbols':{}}
    symbols={}
    for code,symbol in SYMBOLS.items():
        try:
            url='https://query1.finance.yahoo.com/v8/finance/chart/'+quote(symbol,safe='')+'?interval=1d&range=3mo'
            result=json.loads(get(url))['chart']['result'][0];closes=result['indicators']['quote'][0]['close'];offset=result['meta'].get('gmtoffset',0)
            rows=[((datetime.fromtimestamp(t,timezone.utc)+timedelta(seconds=offset)).date().isoformat(),float(c)) for t,c in zip(result['timestamp'],closes) if c and c>0]
            meta=history_meta(rows);source='Yahoo Finance 日线';source_url='https://finance.yahoo.com/quote/'+quote(symbol,safe='')+'/history/'
            latest=date.fromisoformat(rows[-1][0]);week_start=(latest-timedelta(days=latest.weekday())).isoformat()
            if week_start not in meta['weekBases'] and code!='usIXIC':
                alt_url='https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param='+code+',day,,,60,qfq'
                alt=json.loads(get(alt_url))['data'][code];daily=alt.get('day') or alt.get('qfqday') or []
                alt_rows=[(x[0],float(x[2])) for x in daily if float(x[2])>0]
                if alt_rows:meta=history_meta(alt_rows);source='腾讯财经 日线';source_url=alt_url
            symbols[code]=dict(**meta,ok=True,fetchedAt=now,source=source,sourceUrl=source_url)
        except Exception as e:
            symbols[code]=dict(old['symbols'].get(code,{}),ok=False);print(code,type(e).__name__)
    path.write_text(json.dumps(dict(generatedAt=now,symbols=symbols),ensure_ascii=False,indent=2),encoding='utf-8')
    print('History',sum(x['ok'] for x in symbols.values()),'/',len(symbols))
def collect_close():
    now=datetime.now(CN);path=ROOT/'data/close-brief.json'
    if now.weekday()>=5 or now.hour<15:
        if not path.exists():path.write_text(json.dumps({'status':'waiting','message':'尚无已核验的收盘后跟踪记录；周末不生成当天交易报告。'},ensure_ascii=False),encoding='utf-8')
        return
    try:
        raw=get('https://qt.gtimg.cn/q='+','.join(c for c in SYMBOLS if c!='usIXIC')).decode('gb18030')
        rows=[]
        for code,value in re.findall(r'v_(\w+)="([^"]*)"',raw):
            f=value.split('~')
            if len(f)<33 or not f[30].startswith(now.strftime('%Y%m%d')):continue
            rows.append(dict(code=code,name=f[1],price=float(f[3]),dailyPercent=float(f[32]),sourceTime=f[30],thresholdHit=abs(float(f[32]))>=1.5))
        if not rows:return
        data=json.loads((ROOT/'data/news.json').read_text(encoding='utf-8'))
        news=[x for x in data['items'] if x['publishedAt'].startswith(now.date().isoformat())][:8]
        path.write_text(json.dumps(dict(status='available',tradeDate=now.date().isoformat(),generatedAt=now.isoformat(),quotes=rows,news=news,note='按来源交易日验证的收盘后快照，未核验交易所最终收盘值；报道为已抓取范围。'),ensure_ascii=False,indent=2),encoding='utf-8')
    except Exception as e:print('Close briefing',type(e).__name__)
if __name__=='__main__':
    collect_news();collect_history();collect_close()
