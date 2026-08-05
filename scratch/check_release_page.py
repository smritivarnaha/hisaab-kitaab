import urllib.request
import re

url = 'https://github.com/smritivarnaha/hisaab-kitaab/releases/tag/v1.0.1'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        links = re.findall(r'href="(/smritivarnaha/hisaab-kitaab/releases/download/[^"]+)"', html)
        print("Download links found on release page v1.0.1:")
        for l in links:
            print("https://github.com" + l)
except Exception as e:
    print("Error:", e)
