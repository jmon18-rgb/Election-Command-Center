#!/usr/bin/env python3
"""Inspect NC official election-list JSON and the actual downloads page link templates.

Read-only, no guessed 2026 vote URLs and no automatic promotion to production.
"""
import json,urllib.request,re
from html.parser import HTMLParser
from urllib.parse import urljoin
ROOT="https://er.ncsbe.gov/"
class Discovery(HTMLParser):
 def __init__(self):super().__init__();self.script=False;self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script" and not dict(attrs).get("src"):self.script=True
 def handle_endtag(self,tag):
  if tag=="script":self.script=False
 def handle_data(self,data):
  if self.script:self.parts.append(data)
def analyze(html,files):
 d=Discovery();d.feed(html);js="\n".join(d.parts)
 evidence=[line.strip()[:500] for line in js.splitlines() if any(term in line for term in ("download","Download","electiondt","href","\.zip","\.csv"))]
 return {"election_lists":[{"url":u,"top_type":type(v).__name__,
   "count":len(v) if isinstance(v,(list,dict)) else None,
   "sample":(v[:2] if isinstance(v,list) else list(v)[:8] if isinstance(v,dict) else str(v)[:180])} for u,v in files],
   "download_js_evidence":evidence[:45],
   "verified_2026_county_votes":False}
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"ElectionCommandCenter/1.0","Accept":"application/json,text/html"})
 with urllib.request.urlopen(req,timeout=25) as resp:
  raw=resp.read(1500000)
  if resp.status!=200 or len(raw)>=1500000:raise ValueError("Unexpected or oversized official response")
 return raw.decode("utf-8-sig")
def main():
 files=[]
 for path in ("enr/elections.txt","enr/elections_filter.txt"):
  url=urljoin(ROOT,path);files.append((url,json.loads(get(url))))
 result=analyze(get(urljoin(ROOT,"downloads.html")),files)
 print(json.dumps(result,indent=2,default=str))
if __name__=="__main__":main()
