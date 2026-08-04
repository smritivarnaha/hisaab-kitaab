import urllib.request
import json

try:
    url = "https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs/30930577806/jobs"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        jobs = data.get('jobs', [])
        for j in jobs:
            print("Job ID:", j['id'])
            print("HTML URL:", j['html_url'])
            print("Log URL:", j.get('logs_url'))
except Exception as e:
    print("Error:", e)
