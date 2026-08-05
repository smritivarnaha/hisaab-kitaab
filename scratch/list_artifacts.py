import urllib.request
import json
import zipfile
import io

try:
    # 1. Fetch artifacts of the run 30931597119
    url = "https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs/30931597119/artifacts"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        artifacts = data.get('artifacts', [])
        for art in artifacts:
            print(f"Artifact Name: {art['name']} | ID: {art['id']} | Download URL: {art['archive_download_url']}")
            
            # Since download url requires auth, let's look if we can fetch it, or see if we can get another detail.
except Exception as e:
    print("Error:", e)
