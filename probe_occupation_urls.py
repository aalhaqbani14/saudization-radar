import urllib.request
import re
for url in ["https://lawaeh.com/occupations/","https://lawaeh.com/occupations/?p=2","https://lawaeh.com/occupations/?p=43","https://www.hrsd.gov.sa/api/proxy?page=1&langcode=ar&view_args=2802&path=%2Fapi%2Fv1%2Fstelios%2Fview%2Foccupations_content%2Foccupations_content_compiled"]:
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=15)
  s=r.read(1000000).decode('utf-8',errors='replace')
  print('PROBE',url, r.status,len(s),re.findall(r'(?:عرض|showing)\s*\d+[–-]\d+\s*(?:من|of)\s*[\d,]+',s)[:2],re.findall(r'>\s*11110\d\s*[^<]+<',s)[:4])
 except Exception as exc:
  print('PROBE_FAIL',url,repr(exc))
