import urllib.request

try:
    # Let's try downloading the job log directly using the jobs endpoint
    url = "https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/jobs/92065306636/logs"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8', errors='ignore')
        # Print last 50 lines
        lines = content.splitlines()
        print("\n".join(lines[-100:]))
except Exception as e:
    print("Error:", e)
