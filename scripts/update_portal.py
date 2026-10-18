"""Free public news metadata, short extracts, and clearly dated Connect statistics."""
import json,re,html,math
from pathlib import Path
from datetime import datetime,timedelta,timezone
from urllib.request import Request,urlopen
from urllib.parse import urlencode,urlparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
CN=timezone(timedelta(hours=8))
def get(url):
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=14) as r:
        raw=r.read(4_000_000);header=r.headers.get_content_charset()
    declared=re.search(br'charset\s*=\s*["\x27]?([\w-]+)',raw[:1500],re.I)
    encoding=header or (declared[1].decode('ascii') if declared else 'utf-8')
    return raw.decode(encoding,'replace')
def clean(s):return ' '.join(html.unescape(re.sub('<[^>]+>','',s)).split())
def category(t):
    if re.search('财经早餐',t):return '早餐'
    if re.search('证券报纸|报刊头条|头版头条',t):return '报刊'
    if re.search('全球市场|美股.*收盘|美股.*收跌|美股.*收涨',t):return '全球市场'
    if re.search('机构论市|券商.*策略|策略.*券商|策略：|晨会',t):return '机构观点'
    if re.search('调研|机构.*盯上',t):return '机构调研'
    return '要闻'
def listing(col):
    u='https://np-listapi.eastmoney.com/comm/web/getNewsByColumns?'+urlencode(dict(client='web',biz='web_news_col',column=col,order=1,needInteractData=0,page_index=1,page_size=50,req_trace=1,fields='code,showTime,title,mediaName,summary,url',types='1,20'))
    data=json.loads(get(u));out=[];now=datetime.now(CN)
    for x in data.get('data',{}).get('list',[]):
        try:
            dt=datetime.strptime(x['showTime'],'%Y-%m-%d %H:%M:%S').replace(tzinfo=CN)
            if not now-timedelta(days=10)<=dt<=now:continue
            code=str(x['code'])
            if not re.fullmatch(r'\d{18,22}',code):continue
            t=clean(x['title']);cat=category(t)
            summary=clean(x.get('summary',''))
            out.append(dict(title=t,url='https://finance.eastmoney.com/a/'+code+'.html',source=x.get('mediaName') or '东方财富',publishedAt=dt.isoformat(),category=cat,kind='机构观点' if cat=='机构观点' else '媒体报道',summary=summary[:65]+('…' if len(summary)>65 else ''),summaryType='来源导语节选',via='东方财富公开列表'))
        except (ValueError,KeyError):continue
    return out
def enrich(x):
    try:
        raw=get(x['url']);body=raw.split('id="ContentBody"',1)[-1].split('class="sourcebox"',1)[0]
        headings=[clean(s) for s in re.findall(r'<(?:strong|h[23])[^>]*>(.*?)</(?:strong|h[23])>',body,re.S)]
        if not x.get('summary'):
            paragraphs=[clean(p) for p in re.findall(r'<p[^>]*>(.*?)</p>',body,re.S)]
            lead=next((p for p in paragraphs if len(p)>35),'')
            if lead:x.update(summary=lead[:65]+('…' if len(lead)>65 else ''),summaryType='原文导语节选')
        # Short section titles only, never mirror an entire article.
        x['sections']=[s[:42] for s in dict.fromkeys(headings) if 3<len(s)<110][:10]
        x['sectionLinks']=[]
        for url,label in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>\s*<strong[^>]*>(.*?)</strong>\s*</a>',body,re.S):
            url=url.replace('http://','https://',1)
            if urlparse(url).hostname=='finance.eastmoney.com':x['sectionLinks'].append(dict(title=clean(label)[:42],url=url))
        if x['category']=='报刊':
            papers=['中国证券报','上海证券报','证券时报','证券日报'];blocks=[]
            for paper in papers:
                at=body.find(paper)
                if at<0:continue
                tail=body[at:];m=re.search(r'<a\b[^>]*>(.*?)</a>',tail,re.S)
                if m:blocks.append(paper+'：'+clean(m[1])[:42])
            if blocks:x['sections']=blocks
    except Exception:x['detailStatus']='仅标题与来源导语可用'
    return x
def collect():
    target=ROOT/'data/portal.json';now=datetime.now(CN).isoformat()
    try:old=json.loads(target.read_text(encoding='utf-8'))
    except Exception:old={}
    items={};states=[]
    for col in [345,409,395]:
        try:
            rows=listing(col);items.update({x['url']:x for x in rows});states.append(dict(name='东方财富栏目 '+str(col),ok=bool(rows)))
        except Exception:states.append(dict(name='东方财富栏目 '+str(col),ok=False))
    if not items:items={x['url']:x for x in old.get('items',[])}
    rows=sorted(items.values(),key=lambda x:x['publishedAt'],reverse=True)
    for name,fn in [('中国政府网',government),('财联社半导体专题',cls_news),('全球市场收盘报道',global_daily)]:
        try:
            extra=fn();rows.extend(extra);states.append(dict(name=name,ok=bool(extra)))
        except Exception:states.append(dict(name=name,ok=False))
    rows=sorted({x['url']:x for x in rows}.values(),key=lambda x:x['publishedAt'],reverse=True)
    # Preserve a concise detail view for the newest item in each reading category.
    chosen=[]
    for cat in ['早餐','报刊','全球市场','机构观点','机构调研','要闻']:
        chosen.extend([x for x in rows if x['category']==cat][:2])
    with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(enrich,chosen))
    result=dict(generatedAt=now,items=rows[:120],sources=states)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Portal:',len(rows),'items;',[(x['name'],x['ok']) for x in states])
def government():
    rows=[];now=datetime.now(CN)
    for x in json.loads(get('https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json')):
        day=x['DOCRELPUBTIME'][:10];dt=datetime.fromisoformat(day).replace(tzinfo=CN)
        if not now-timedelta(days=30)<=dt<=now or urlparse(x['URL']).hostname!='www.gov.cn':continue
        rows.append(dict(title=x['TITLE'],url=x['URL'],source='中国政府网',publishedAt=day,dateOnly=True,category='政策',kind='官方发布'))
    return rows[:12]
def global_daily():
    raw=get('https://global.eastmoney.com/');rows=[]
    for url,title in re.findall(r'href="(https://finance\.eastmoney\.com/a/\d+\.html)"[^>]*>([^<]*全球市场[^<]*)',raw):
        if any(x['url']==url for x in rows):continue
        body=get(url);m=re.search(r'(20\d{2})年(\d{2})月(\d{2})日\s*(\d{2}):(\d{2})',body)
        if not m:continue
        dt=datetime(*map(int,m.groups()),tzinfo=CN)
        if not datetime.now(CN)-timedelta(days=7)<=dt<=datetime.now(CN):continue
        rows.append(dict(title=clean(title),url=url,source='东方财富Choice数据',publishedAt=dt.isoformat(),category='全球市场',kind='媒体报道'))
        if len(rows)>=2:break
    return rows
def cls_news():
    rows=[];now=datetime.now(CN)
    for topic in ['11055','11056']:
        raw=get('https://www.cls.cn/subject/'+topic)
        m=re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',raw,re.S)
        data=json.loads(m[1])['props']['pageProps']['data']
        for x in data.get('articles',[]):
            dt=datetime.fromtimestamp(x['article_time'],CN)
            if not now-timedelta(days=14)<=dt<=now:continue
            full=clean(x.get('article_title',''));heading=re.match('【([^】]+)】',full)
            title=heading[1] if heading else full[:90]+('…' if len(full)>90 else '')
            brief=clean(x.get('article_brief','')) or (full[len(heading[0]):] if heading else '')
            rows.append(dict(title=title,url='https://www.cls.cn/detail/'+str(x['article_id']),source='财联社',publishedAt=dt.isoformat(),category='半导体',kind='机构观点' if re.search('研报|策略|证券：',full) else '媒体报道',summary=brief[:65]+('…' if len(brief)>65 else ''),summaryType='来源导语节选',relatedStocks=[s.get('name','') for s in x.get('stock_list',[])]))
    return list({x['url']:x for x in rows}.values())
def holdings():
    url='https://fund.chinaamc.com/fund/588170/zichanzuhe.shtml';path=ROOT/'data/holdings-588170.json'
    try:
        raw=get(url);matches=list(dict.fromkeys(re.findall(r'<div class="item">(\d{6})</div>\s*<div class="item">([^<]+)</div>\s*<div class="item">([\d.]+)</div>',raw)))
        dates=re.findall(r'截止日期\s*(\d{4}-\d{2}-\d{2})',raw)
        if len(matches)!=10 or not dates:raise ValueError('holdings structure changed')
        data=dict(code='588170',name='华夏上证科创板半导体材料设备主题ETF',date=dates[-1],fetchedAt=datetime.now(CN).isoformat(),ok=True,source='华夏基金资产组合',sourceUrl=url,scope='披露的前十大股票持仓；非全部成分股，非实时持仓',holdings=[dict(code=c,name=n,weight=float(w)) for c,n,w in matches])
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        print('Holdings',data['date'],len(matches))
    except Exception:
        if path.exists():
            d=json.loads(path.read_text(encoding='utf-8'));d['ok']=False;path.write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8')
def connect():
    target=ROOT/'data/southbound.json';now=datetime.now(CN).isoformat()
    try:old=json.loads(target.read_text(encoding='utf-8'))
    except Exception:old={}
    out=dict(generatedAt=now,source='东方财富公开数据',sourceUrl='https://data.eastmoney.com/hsgt/hsgtV2.html',channels=[])
    for typ,name in [('002','港股通（沪）'),('004','港股通（深）')]:
        try:
            u='https://datacenter-web.eastmoney.com/api/data/v1/get?'+urlencode(dict(reportName='RPT_MUTUAL_TOP10DEAL',columns='ALL',pageNumber=1,pageSize=10,sortColumns='TRADE_DATE,RANK',sortTypes='-1,1',source='WEB',client='WEB',filter='(MUTUAL_TYPE="'+typ+'")'))
            rows=json.loads(get(u))['result']['data'];day=rows[0]['TRADE_DATE'][:10];rows=[r for r in rows if r['TRADE_DATE'][:10]==day]
            if len(rows)!=10:raise ValueError('incomplete top ten')
            out['channels'].append(dict(name=name,date=day,ok=True,rows=[dict(code=r['SECURITY_CODE'],name=r['SECURITY_NAME'],turnover=r['DEAL_AMT']/1e8,netBuy=r['NET_BUY_AMT']/1e8) for r in rows]))
        except Exception:
            prev=next((c for c in old.get('channels',[]) if c['name']==name),dict(name=name,rows=[]))
            out['channels'].append(dict(prev,ok=False))
    try:
        u='https://push2.eastmoney.com/api/qt/kamtbs.rtmin/get?fields1=f1,f2,f3,f4&fields2=f51,f54,f52,f58,f53,f62,f56,f57,f60,f61'
        d=json.loads(get(u))['data'];points=[]
        for s in d['n2s']:
            v=s.split(',')
            if len(v)>5 and v[5] not in ('','-'):
                value=float(v[5])/10000 # source uses ten-thousand HKD; display hundred-million HKD
                if math.isfinite(value):points.append([v[0],value])
        if not points or not re.fullmatch(r'20\d{2}-\d{2}-\d{2}',d['n2sDate']):raise ValueError('invalid series')
        out['minute']=dict(ok=True,date=d['n2sDate'],unit='亿港元',points=points)
    except Exception:out['minute']=dict(old.get('minute',{}),ok=False)
    target.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Southbound:',[(c['name'],c['ok']) for c in out['channels']], 'minute',out['minute']['ok'])
if __name__=='__main__':collect();connect();holdings()

