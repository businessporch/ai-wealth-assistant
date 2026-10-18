import unittest,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from unittest.mock import patch
from datetime import datetime,timedelta
import update_portal as p

class PortalTest(unittest.TestCase):
    def test_classification_distinguishes_opinions(self):
        self.assertEqual(p.category('十大机构论市：短期可能见底'),'机构观点')
        self.assertEqual(p.category('10月16日四大证券报纸头版头条'),'报刊')
        self.assertEqual(p.category('全球市场：美股三大指数收跌'),'全球市场')
    def test_metadata_time_and_untrusted_code(self):
        now=datetime.now(p.CN)-timedelta(minutes=2)
        def item(code,t):return dict(code=code,showTime=t.strftime('%Y-%m-%d %H:%M:%S'),title='十大机构论市',mediaName='来源',summary='摘要'*100)
        payload={'data':{'list':[item('202610183899160468',now),item('202610183899160469',now+timedelta(days=2)),item('../bad',now)]}}
        with patch.object(p,'get',return_value=json.dumps(payload)):
            rows=p.listing(345)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['kind'],'机构观点')
        self.assertTrue(rows[0]['summary'].endswith('…'))
        self.assertEqual(rows[0]['publishedAt'],now.replace(microsecond=0).isoformat())
    def test_government_only_official_host(self):
        day=datetime.now(p.CN).date().isoformat()
        payload=[dict(TITLE='国务院政策',DOCRELPUBTIME=day,URL='https://www.gov.cn/zhengce/example.htm'),dict(TITLE='冒充来源',DOCRELPUBTIME=day,URL='https://example.com/')]
        with patch.object(p,'get',return_value=json.dumps(payload)):
            rows=p.government()
        self.assertEqual(len(rows),1)
        self.assertTrue(rows[0]['dateOnly'])

if __name__=='__main__':unittest.main()

