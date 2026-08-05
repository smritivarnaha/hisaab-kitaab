import urllib.request
import re

url = 'https://github.com/smritivarnaha/hisaab-kitaab/actions/runs/30932865041'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        if 'color-fg-success' in html or 'Success' in html:
            print("Run status contains Success!")
        if 'color-fg-danger' in html or 'Failure' in html:
            print("Run status contains Failure/Danger!")
        
        title = re.findall(r'<title>(.*?)</title>', html)
        print("Page title:", title)
except Exception as e:
    print("Error:", e)
