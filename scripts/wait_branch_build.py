"""Avoid a legacy branch Pages build overwriting the fresh RSS deployment."""
import json, os, time
from urllib.request import Request, urlopen

def wait_for_branch_build():
    repo=os.environ['GITHUB_REPOSITORY']
    sha=os.environ['GITHUB_SHA']
    token=os.environ['GH_TOKEN']
    endpoint=f'https://api.github.com/repos/{repo}/actions/runs?head_sha={sha}&per_page=30'
    for attempt in range(30):
        with urlopen(Request(endpoint,headers={'Authorization':f'Bearer {token}','Accept':'application/vnd.github+json'}),timeout=20) as response:
            runs=json.load(response)['workflow_runs']
        legacy=[run for run in runs if run['event']=='dynamic' and run['path'].startswith('dynamic/pages/')]
        if legacy and all(run['status']=='completed' for run in legacy):
            print('Legacy branch Pages build finished; fresh RSS deployment can proceed.')
            return
        if not legacy and attempt>=5:
            print('No legacy branch Pages build detected.')
            return
        time.sleep(10)
    raise SystemExit('Previous branch Pages build did not finish; refusing an overlapping deployment.')

if __name__=='__main__':
    wait_for_branch_build()
