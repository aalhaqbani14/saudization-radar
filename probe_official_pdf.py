from urllib.request import Request,urlopen
import fitz, re
urls={
'english':'https://www.stats.gov.sa/sites/default/files/Report_GAStat%20Unified%20Saudi%20Occupational%20Classification_English_V1.pdf',
'arabic':'https://www.stats.gov.sa/sites/default/files/Report_GAStat%20Unified%20Saudi%20Occupational%20Classification_Arabic_V1.pdf'
}
for lang,url in urls.items():
 try:
  r=urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=45)
  blob=r.read(40_000_000)
  print("SOURCE",lang,r.status,len(blob))
  pdf=fitz.open(stream=blob,filetype='pdf')
  print("PAGES",len(pdf))
  for i in (30,31,32,35,38,40):
   if i>=len(pdf):continue
   s=pdf[i].get_text(sort=True)
   lines=s.splitlines()
   code_lines=[x for x in lines if re.search(r'\d{4,6}|[٠-٩]{4,6}',x)]
   print("PAGE",lang,i,repr(code_lines[:16]))
 except Exception as e: print("FAIL",lang,repr(e))
