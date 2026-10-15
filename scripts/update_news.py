"""Fetch official RSS metadata only; no third-party dependencies or private data."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse
import json, xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
FEEDS=[('美联储','https://www.federalreserve.gov/feeds/press_all.xml','www.federalreserve.gov'),('欧洲央行','https://www.ecb.europa.eu/rss/press.html','www.ecb.europa.eu')]
def collect():
    now=datetime.now(timezone.utc).isoformat()
    target=ROOT/'data/news.json'
    try: old=json.loads(target.read_text(encoding='utf-8'))
    except (OSError,ValueError): old={'items':[],'sources':[]}
    items=[]; states=[]
    for name,url,host in FEEDS:
        try:
            with urlopen(Request(url,headers={'User-Agent':'AIWealthAssistant/1.1 RSS reader'}),timeout=25) as response:
                raw=response.read(2_000_001)
            if len(raw)>2_000_000: raise ValueError('Feed too large')
            feed=ET.fromstring(raw); current=[]
            for entry in feed.findall('./channel/item'):
                title=' '.join((entry.findtext('title') or '').split())
                link=(entry.findtext('link') or '').strip()
                parsed=urlparse(link)
                if not title or parsed.scheme!='https' or parsed.hostname!=host: continue
                try:
                    published=parsedate_to_datetime(entry.findtext('pubDate') or '')
                    if published.tzinfo is None: continue
                    if published>datetime.now(timezone.utc): continue
                except (ValueError,TypeError,OverflowError): continue
                current.append(dict(title=title,url=link,source=name,publishedAt=published.isoformat(),fetchedAt=now,kind='fact',analysis=None))
            if not current: raise ValueError('No valid entries')
            items.extend(current[:20]); states.append(dict(name=name,url=url,ok=True,lastSuccessAt=now))
        except Exception as exc:
            items.extend(x for x in old['items'] if x['source']==name)
            previous=next((s for s in old['sources'] if s['name']==name),{})
            states.append(dict(name=name,url=url,ok=False,lastSuccessAt=previous.get('lastSuccessAt')))
            print(f'{name}: {type(exc).__name__}')
    items=list({x['url']:x for x in items}.values())
    items.sort(key=lambda x:datetime.fromisoformat(x['publishedAt']),reverse=True)
    target.parent.mkdir(exist_ok=True)
    temporary=target.with_suffix('.tmp')
    temporary.write_text(json.dumps(dict(version=1,generatedAt=now,sources=states,items=items),ensure_ascii=False,indent=2),encoding='utf-8')
    temporary.replace(target)
    print(f'{len(items)} items; {sum(s["ok"] for s in states)}/{len(states)} feeds succeeded')
    if not any(s['ok'] for s in states): raise SystemExit(1)
if __name__=='__main__': collect()
