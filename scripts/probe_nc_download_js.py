#!/usr/bin/env python3
"""Inspect literal official NC downloads page JS for request names; never submit."""
import re,json,urllib.request
from html.parser import HTMLParser
URL="https://er.ncsbe.gov/downloads.html"
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.inline=[];self._script=False;self.sources=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   d=dict(attrs);self._script=not bool(d.get("src"))
   if d.get("src"):self.sources.append(d["src"])
 def handle_endtag(self,tag):
  if tag=="script":self._script=False
 def handle_data(self,data):
  if self._script:self.inline.append(data)
def inspect(html):
 p=Scripts();p.feed(html)
 js="\n".join(p.inline)
 hits=[]
 for pattern in (r'.{0,180}cboElection.{0,220}',r'.{0,180}downloads?\.html.{0,220}',r'.{0,220}(?:fetch\(|\.ajax\(|XMLHttpRequest|\.open\(|\.send\().{0,350}'):
  hits.extend(re.findall(pattern,js,re.I))
 lines=js.splitlines()
 request_lines=[{"line":i+1,"context":" ".join(lines[max(0,i-1):i+3])[:700]} for i,line in enumerate(lines) if "open(" in line or "send(" in line or "fileElection" in line]
 return {"request_calls":request_lines[:30],"inline_js_snippets":list(dict.fromkeys(hits))[:25],
         "external_script_paths":p.sources,
         "endpoint_verified":False,"live_2026_county_votes_verified":False}
def main():
 req=urllib.request.Request(URL,headers={"User-Agent":"ElectionCommandCenter/1.0","Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=25) as resp:
  body=resp.read(2000000).decode("utf-8-sig")
 print(json.dumps(inspect(body),indent=2))
if __name__=="__main__":main()
