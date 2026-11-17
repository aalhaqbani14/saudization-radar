"""Temporary live check of every HRSD page used by the site. No alert writes."""
import monitor
sources=monitor.monitored_sources()
bad=[]
print("SOURCE_COUNT",len(sources),flush=True)
for item in sources:
 try:
  value=monitor.get_text(item['url'])
  if len(value)<110:
   raise ValueError("short primary content")
  off_topic=any(phrase in value for phrase in ['طب الأسنان', 'وزير العمل والحماية الاجتماعية الكيني', 'السياسة الوطنية لتشجيع تكافؤ الفرص'])
  if monitor.is_detail_page(item['url']) and off_topic:
   raise ValueError("related content leaked into detail source")
  print("PASS",item['kind'],item['name'],"chars",len(value),"version",monitor.extraction_version(item['url']),flush=True)
 except Exception as exc:
  bad.append(item['name'])
  print("FAIL",item['name'],type(exc).__name__,str(exc),flush=True)
print("RESULT",len(sources)-len(bad),"/",len(sources),"FAILED",bad,flush=True)
if bad:raise RuntimeError("Official detail extraction failure")
