import urllib.request
import re

url = 'https://github.com/smritivarnaha/hisaab-kitaab/actions'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        runs = re.findall(r'/smritivarnaha/hisaab-kitaab/actions/runs/\d+', html)
        print("Recent run links on actions page:")
        for r in set(runs):
            print("https://github.com" + r)
except Exception as e:
    print("Error:", e)
