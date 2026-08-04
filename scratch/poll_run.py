import urllib.request
import json
import time
import sys

run_id = "30931329941"
url = f"https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs/{run_id}"
jobs_url = f"https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs/{run_id}/jobs"

print("Polling GitHub Actions run", run_id)
for i in range(30): # Poll up to 5 minutes
    try:
        # Check overall run status
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            status = data.get('status')
            conclusion = data.get('conclusion')
            print(f"Status: {status} | Conclusion: {conclusion}")
            if status == "completed":
                break
        
        # Check job details
        req_jobs = urllib.request.Request(jobs_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_jobs) as resp_jobs:
            data_jobs = json.loads(resp_jobs.read().decode())
            jobs = data_jobs.get('jobs', [])
            for j in jobs:
                print(f"  Job: {j['name']} | Conclusion: {j['conclusion']}")
                for step in j.get('steps', []):
                    if step['status'] != 'queued':
                        print(f"    Step: {step['name']} | Status: {step['status']} | Conclusion: {step['conclusion']}")
        
    except Exception as e:
        print("Error checking status:", e)
    
    time.sleep(10)
