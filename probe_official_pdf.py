from urllib.request import Request,urlopen
import fitz, re
urls={
'english':'https://quality.kku.edu.sa/sites/quality.kku.edu.sa/files/2024-03/Unified%20Saudi%20Occupational%20Classification%201.pdf',
'arabic':'https://quality.kku.edu.sa/sites/quality.kku.edu.sa/files/2024-03/%D8%A7%D9%84%D8%AA%D8%B5%D9%86%D9%8A%D9%81%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%20%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF%20%D9%84%D9%84%D9%85%D9%87%D9%86%201.pdf'
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
