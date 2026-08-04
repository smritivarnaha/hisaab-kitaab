import urllib.request
import json

try:
    url = "https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs?per_page=5"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        runs = data.get('workflow_runs', [])
        for r in runs:
            print(f"ID: {r['id']} | Status: {r['status']} | Conclusion: {r['conclusion']} | Event: {r['event']} | Created: {r['created_at']}")
except Exception as e:
    print("Error:", e)
