#!/usr/bin/env python3
"""Nonpublishing second-source discovery: API reachability, CORS and schema.

This probe NEVER republishes candidate votes or makes winner calls. Its
questions are: can GitHub Pages access civicAPI directly; does a search
retrieve real general-election 2026 races; and are identifiers enough to join
House/Senate/Governor ballots without treating primary results as generals?
"""
import json
import urllib.error
import urllib.parse
import urllib.request

BASE="https://civicapi.org/api/v2/"
ORIGIN="https://jmon18-rgb.github.io"
CHECKS=[
 ("status",{}),
 ("getElectionDates",{"year":2026,"country":"US"}),
 ("race/search",{"country":"US","startDate":"2026-11-03","endDate":"2026-11-03","limit":4}),
 ("race/search",{"country":"US","startDate":"2026-09-08","endDate":"2026-09-08","limit":3}),
 ("race/search",{"country":"US","province":"NH","startDate":"2026-11-03","endDate":"2026-11-03","limit":8}),
 ("race/search",{"country":"US","province":"NV","startDate":"2026-11-03","endDate":"2026-11-03","limit":8}),
]
def summarize(content):
 if isinstance(content,dict):
  ans={"type":"object","keys":sorted(content)}
  for key,value in content.items():
   if isinstance(value,list):
    ans["list_"+key]={"size":len(value),
      "sample_keys":sorted(value[0])[:35] if value and isinstance(value[0],dict) else [],
      "sample_races":[{
       k:entry[k] for k in ("id","country","province","district","election_date",
       "election_name","election_type","type","percent_reporting","municipality")
       if k in entry
      } for entry in value[:3] if isinstance(entry,dict)],
      "candidate_keys":sorted(value[0].get("candidates",[{}])[0])[:35]
        if value and isinstance(value[0],dict) and value[0].get("candidates") and
        isinstance(value[0]["candidates"][0],dict) else []}
   elif key in ("status","message","success","code","count"):
    ans[key]=value
  return ans
 if isinstance(content,list):
  return {"type":"array","size":len(content),
          "sample_keys":sorted(content[0])[:40] if content and isinstance(content[0],dict) else []}
 return {"type":type(content).__name__}
def probe(path,params):
 url=BASE+path+("?"+urllib.parse.urlencode(params) if params else "")
 request=urllib.request.Request(url,headers={
  "Origin":ORIGIN,"Accept":"application/json",
  "User-Agent":"InSearchOfBlueWaves/1.0 (personal 2026 election research)"
 })
 try:
  with urllib.request.urlopen(request,timeout=18) as response:
   body=response.read(5_000_001)
   ct=response.headers.get("Content-Type","")
   acao=response.headers.get("Access-Control-Allow-Origin","")
   print(json.dumps({"endpoint":path,"params":params,"http":response.status,
     "cors_origin":acao,"content_type":ct,"bytes":len(body)}))
  if len(body)>5_000_000:
   print("SOURCE TOO LARGE, cannot safely parse")
   return
  try:
   obj=json.loads(body)
   print("SOURCE_SHAPE",json.dumps(summarize(obj),sort_keys=True))
   return obj
  except Exception as exc:
   print("SOURCE NOT JSON",str(exc),"first_content_type",ct)
 except urllib.error.HTTPError as exc:
  print(json.dumps({"endpoint":path,"http":exc.code,"cors_origin":exc.headers.get("Access-Control-Allow-Origin",""),"error":str(exc)}))
 except Exception as exc:
  print(json.dumps({"endpoint":path,"error":str(exc)}))
def main():
 for path,params in CHECKS:
  obj=probe(path,params)
  if path=="race/search" and params.get("startDate")=="2026-11-03" and "province" not in params:
   for row in (obj or {}).get("races",[]):
    if str(row.get("id","")).isdigit():
     probe("race/"+str(row["id"]),{"light":""})
     break
if __name__=="__main__":main()
