#!/usr/bin/env python3
"""Inspect actual NC downloads selection form; discovery only, never guessed votes."""
from html.parser import HTMLParser
from urllib.parse import urljoin,urlparse
import urllib.request,json

URL="https://er.ncsbe.gov/downloads.html"
class FormAudit(HTMLParser):
 def __init__(self):
  super().__init__();self.forms=[];self.selects=[];self.inputs=[];self.buttons=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=="form":self.forms.append({k:a.get(k) for k in ("id","method","action")})
  if tag=="select":self.selects.append({k:a.get(k) for k in ("id","name")})
  if tag=="input":self.inputs.append({k:a.get(k) for k in ("id","name","type","value")})
  if tag=="button":self.buttons.append({k:a.get(k) for k in ("id","name","type")})

def inspect(html):
 p=FormAudit();p.feed(html)
 # A discovered action is metadata, not authorization to submit it.
 for f in p.forms:
  action=f.get("action")
  if action:
   absolute=urljoin(URL,action)
   if urlparse(absolute).hostname!="er.ncsbe.gov" or urlparse(absolute).scheme!="https":
    f["action"]="EXTERNAL_OR_UNTRUSTED"
 return {"forms":p.forms,"select_controls":p.selects,
         "inputs":p.inputs,"buttons":p.buttons,
         "county_export_schema_verified":False,
         "production_2026_feed_verified":False}

def main():
 req=urllib.request.Request(URL,headers={"Accept":"text/html","User-Agent":"ElectionCommandCenter/1.0"})
 with urllib.request.urlopen(req,timeout=25) as response:
  raw=response.read(1500000).decode("utf-8-sig")
 print(json.dumps(inspect(raw),indent=2))
if __name__=="__main__":main()
