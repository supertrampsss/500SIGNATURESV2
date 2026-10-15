import json, os, subprocess, time
from pathlib import Path
folder=Path('/workspace/mandats-iteration38')
environment=os.environ.copy()
environment['MANDATS_CHROMIUM_EXECUTABLE']='/usr/bin/chromium'
environment['MANDATS_WEBKIT_EXECUTABLE']='/workspace/mandats-browser-libs/run-webkit.sh'
commands=[
    ('rework',['npx','playwright','test','--config','playwright.rework.config.ts']),
    ('social',['npx','playwright','test','--config','playwright.social.config.ts']),
    ('header',['npx','playwright','test','--config','playwright.header.config.ts']),
    ('mandats',['npm','run','test:mandats','--','--reporter=list,html,json'])
]
results=[]
for label,command in commands:
    state={'stage':label,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'command':command}
    (folder/'following-status.json').write_text(json.dumps({'completed':results,'running':state},indent=2)+'\n')
    print(json.dumps(state),flush=True)
    run_environment=environment.copy()
    if label=='mandats':
        run_environment['PLAYWRIGHT_JSON_OUTPUT_NAME']=str(folder/'mandats-report.json')
        run_environment['PLAYWRIGHT_HTML_OUTPUT_DIR']='playwright-report-mandats'
    with (folder/(label+'.log')).open('w') as log:
        code=subprocess.run(command,cwd='/workspace/500SIGNATURESV2/site',env=run_environment,stdout=log,stderr=subprocess.STDOUT).returncode
    state.update(exitCode=code,finishedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
    results.append(state)
    (folder/'following-status.json').write_text(json.dumps({'completed':results,'running':None},indent=2)+'\n')
    print(json.dumps(state),flush=True)
raise SystemExit(0 if all(result['exitCode']==0 for result in results) else 1)
