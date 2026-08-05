import urllib.request
import json
import zipfile
import io

run_id = "30932460342"
url = f"https://api.github.com/repos/smritivarnaha/hisaab-kitaab/actions/runs/{run_id}/artifacts"
req = urllib.request.Request(url, headers={'User-Agent': 'Python'})

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        artifacts = data.get('artifacts', [])
        print("Artifacts found:", len(artifacts))
        for art in artifacts:
            print(f"Name: {art['name']}, Download URL: {art['archive_download_url']}")
            dl_url = art['archive_download_url']
            dl_req = urllib.request.Request(dl_url, headers={'User-Agent': 'Python'})
            try:
                with urllib.request.urlopen(dl_req) as dl_resp:
                    z = zipfile.ZipFile(io.BytesIO(dl_resp.read()))
                    for filename in z.namelist():
                        print(f"=== File inside zip: {filename} ===")
                        content = z.read(filename).decode('utf-8', errors='ignore')
                        print(content[-2000:])  # Print last 2000 chars
            except Exception as e:
                print("Download error:", e)
except Exception as e:
    print("Error:", e)
