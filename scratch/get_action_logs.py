import urllib.request
import json
import zipfile
import io

try:
    url = "https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs/30930577806/logs"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        zip_data = response.read()
        with zipfile.ZipFile(io.BytesIO(zip_data)) as z:
            for name in z.namelist():
                # Let's find log file containing 'Sync Capacitor'
                if 'sync-capacitor' in name.lower() or 'sync' in name.lower() or 'android' in name.lower() or 'job' in name.lower():
                    print(f"Log File: {name}")
                    content = z.read(name).decode('utf-8', errors='ignore')
                    # Print last 50 lines of log
                    lines = content.splitlines()
                    print("\n".join(lines[-100:]))
                    print("-" * 50)
except Exception as e:
    print("Error:", e)
