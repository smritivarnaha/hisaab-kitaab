import urllib.request
import json
import sys

run_id = sys.argv[1] if len(sys.argv) > 1 else "30932330950"
try:
    url = f"https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs/{run_id}/jobs"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        jobs = data.get('jobs', [])
        for j in jobs:
            print(f"Job: {j['name']} | Conclusion: {j['conclusion']}")
            for step in j.get('steps', []):
                print(f"  Step: {step['name']} | Status: {step['status']} | Conclusion: {step['conclusion']}")
except Exception as e:
    print("Error:", e)
