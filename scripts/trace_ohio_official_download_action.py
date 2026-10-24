#!/usr/bin/env python3
"""Trace ONLY the official page scripts which define Ohio's NIST XML export.

This collects link/script metadata and bounded downloadReport() source code
context. It NEVER runs JavaScript, fetches the XML export, reads candidate
totals, or enables a live ballot source. The 2026 page is in mock-election
mode until independently certified otherwise.
"""
import argparse
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

from discover_ohio_official_nist_xml import PAGE, OFFICIAL_HOSTS, inspect

MAX_SCRIPT = 750_000
MAX_HTML = 1_500_000
MAX_SCRIPTS = 12
KEY = "VSSC1622XmlFileBlob"

class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls=[]
        self.inline=[]
        self.inside=False
        self.buffer=[]
    def handle_starttag(self,tag,attrs):
        if tag!="script":return
        src=dict(attrs).get("src")
        if src:self.urls.append(src)
        else:
            self.inside=True
            self.buffer=[]
    def handle_data(self,data):
        if self.inside:self.buffer.append(data)
    def handle_endtag(self,tag):
        if tag=="script" and self.inside:
            self.inline.append("".join(self.buffer))
            self.inside=False
            self.buffer=[]

def allowed(url):
    parsed=urllib.parse.urlparse(url)
    return parsed.scheme=="https" and parsed.hostname in OFFICIAL_HOSTS and not parsed.username and not parsed.password

def script_candidates(html):
    if not isinstance(html,str) or not html or len(html)>MAX_HTML:
        raise ValueError("Official Ohio results HTML unavailable")
    p=ScriptParser();p.feed(html)
    urls=[]
    for raw in p.urls:
        url=urllib.parse.urljoin(PAGE,raw)
        if allowed(url) and url not in urls and len(url)<=1200:
            urls.append(url)
    return urls[:MAX_SCRIPTS],p.inline

def findings(js,where):
    if not isinstance(js,str) or len(js)>MAX_SCRIPT:
        raise ValueError("Script source missing or oversized")
    markers=["downloadReport",KEY]
    out=[]
    for marker in markers:
        starts=[m.start() for m in re.finditer(re.escape(marker),js,re.I)]
        for position in starts[:3]:
            # The text is inert source only; no JS execution or export calls.
            out.append({"marker":marker,"script":where,"at_character":position,
                        "context":js[max(0,position-180):min(len(js),position+640)]})
    return out

def trace(html,fetch):
    urls,inline=script_candidates(html)
    page=inspect(html)
    actions=[x for x in page["possible_feed_links"] if
             x.get("official_download_action")=="downloadReport" and
             x.get("official_download_object_key")==KEY]
    observations=[]
    errors=[]
    for i,content in enumerate(inline):
        if KEY in content or "downloadReport" in content:
            observations+=findings(content,"official landing inline-script-"+str(i))
    for url in urls:
        try:
            data=fetch(url)
            if not isinstance(data,str) or len(data)>MAX_SCRIPT:
                raise ValueError("Script invalid size or encoding")
            observations+=findings(data,url)
        except Exception as err:
            errors.append({"source":url,"reason":str(err)[:180]})
    return {
      "schema":"ohio-2026-official-download-action-trace-v1",
      "status":"SCRIPT_DISCOVERY_REQUIRES_MANUAL_VERIFICATION_NOT_LIVE_COUNTS",
      "original_landing":PAGE,
      "official_blob_object_key":KEY,
      "expected_export_action_seen":bool(actions),
      "approved_script_source_urls":urls,
      "observed_function_or_key_references":observations[:20],
      "fetch_errors":errors,
      "mock_results_must_not_be_ingested":True,
      "real_election_results_verified":False,
      "resolved_xml_endpoint_verified":False,
      "source_votes_ingested":False,
      "may_move_national_needle":False
    }

def fetch(url,max_bytes):
    if not allowed(url):raise ValueError("Unofficial Ohio script host")
    req=urllib.request.Request(url,headers={
       "User-Agent":"ElectionCommandCenter/1.0 ohio-official-script-audit",
       "Accept":"text/html,application/javascript,text/javascript"
    })
    with urllib.request.urlopen(req,timeout=16) as response:
        if response.status!=200 or not allowed(response.geturl()):
            raise ValueError("Ohio source rejected HTTP or redirect")
        body=response.read(max_bytes+1)
        if len(body)>max_bytes:raise ValueError("Official page script oversized")
        return body.decode("utf-8-sig",errors="replace")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--probe",action="store_true")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.probe:p.error("--probe required")
    try:
        html=fetch(PAGE,MAX_HTML)
        output=trace(html,lambda url:fetch(url,MAX_SCRIPT))
    except (OSError,ValueError,UnicodeError) as e:
        output={
           "schema":"ohio-2026-official-download-action-trace-v1",
           "status":"OHIO_OFFICIAL_SCRIPT_UNAVAILABLE",
           "original_landing":PAGE,"reason":str(e)[:250],
           "source_votes_ingested":False,"resolved_xml_endpoint_verified":False,
           "real_election_results_verified":False,"may_move_national_needle":False,
        }
    output["checked_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.write_text(json.dumps(output,indent=2)+"\n")
    print(json.dumps(output,indent=2))

if __name__=="__main__":
    main()
