#!/usr/bin/env python3
"""Trace the REAL official Ohio XML downloadReport script, read-only.

A JavaScript action such as downloadReport('VSSC1622XmlFileBlob') is NOT a
download URL. Inspect only Ohio-hosted scripts and short function excerpts.
Do not execute JavaScript, fetch result XML, or ingest mock candidate votes.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

PAGE="https://liveresults.ohiosos.gov/Home/Index"
ORIGIN="https://liveresults.ohiosos.gov"
ALLOW_HOST="liveresults.ohiosos.gov"
OBJECT_KEY="VSSC1622XmlFileBlob"
MAX_PAGE=1_500_000
MAX_SCRIPT=1_500_000
MAX_SCRIPTS=12
MARKERS=(r"\b(?:function\s+downloadReport\s*\(|downloadReport\s*[:=]\s*function\s*\(|downloadReport\s*=\s*(?:async\s*)?\()",r"VSSC1622XmlFileBlob",r"(?i)downloadReport")
WORD_SAFE=re.compile(r"(?i)(?:^|[/])(?:content|scripts?|js|bundles?)(?:[/]|$)")

class HtmlScriptRefs(HTMLParser):
    def __init__(self):
        super().__init__();self.sources=[];self.inline=[];self.in_script=False;self.current=""
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="script":
            obj=dict(attrs)
            if obj.get("src"):self.sources.append(obj["src"])
            else:self.in_script=True;self.current=""
    def handle_data(self,data):
        if self.in_script:self.current+=data
    def handle_endtag(self,tag):
        if tag.lower()=="script" and self.in_script:
            self.inline.append(self.current)
            self.current="";self.in_script=False

def safe_script_url(value):
    if not isinstance(value,str) or len(value)>500: return None
    candidate=urllib.parse.urljoin(PAGE,value)
    u=urllib.parse.urlsplit(candidate)
    if u.scheme!="https" or u.hostname!=ALLOW_HOST or u.username or u.password or u.port not in (None,443):
        return None
    # Static script assets only. Never request .xml, .pdf, or a download action.
    if not u.path.lower().endswith(".js") and not WORD_SAFE.search(u.path.lower()):
        return None
    return urllib.parse.urlunsplit(("https",ALLOW_HOST,u.path,u.query,""))

def function_excerpts(source):
    if not isinstance(source,str): raise ValueError("Expected JavaScript source text")
    out=[]
    for pattern in MARKERS:
        matches=list(re.finditer(pattern,source))
        for m in matches[:4]:
            # A snippet is evidence for human review, never executable input.
            excerpt=source[max(0,m.start()-170):min(len(source),m.end()+520)]
            out.append({"marker":pattern[:65],"offset":m.start(),"evidence":excerpt})
    return out[:12]

def scan_document(page_html,fetcher=None):
    if not isinstance(page_html,str) or not 0<len(page_html)<=MAX_PAGE:
        raise ValueError("Invalid/bloated official landing HTML")
    parser=HtmlScriptRefs();parser.feed(page_html)
    inline=[{"origin":"HTML inline script","evidence":function_excerpts(s)}
        for s in parser.inline if function_excerpts(s)]
    source_urls=[];blocked=[]
    for src in parser.sources:
        normalized=safe_script_url(src)
        if normalized and normalized not in source_urls:source_urls.append(normalized)
        elif not normalized:blocked.append(src[:150])
    records=[]
    for u in source_urls[:MAX_SCRIPTS]:
        item={"url":u}
        if fetcher:
            try:
                source=fetcher(u)
                if not isinstance(source,str) or len(source)>MAX_SCRIPT:
                    raise ValueError("Oversized script")
                item.update({"sha256":hashlib.sha256(source.encode()).hexdigest(),
                             "bytes":len(source.encode()),
                             "excerpts":function_excerpts(source)})
            except Exception as ex:
                item.update({"status":"SOURCE_SCRIPT_FETCH_FAILED",
                             "reason":str(ex)[:160]})
        records.append(item)
    return {
       "schema":"ohio-nist-official-download-action-trace-v1",
       "status":"READ_ONLY_OFFICIAL_PAGE_SCRIPT_EVIDENCE_NOT_LIVE",
       "landing":PAGE,"observed_export_object_key":OBJECT_KEY,
       "document_contains_action":OBJECT_KEY in page_html and "downloadReport" in page_html,
       "scripts_seen":len(parser.sources),"scripts_inspected":len(records),
       "skipped_external_or_unsafe_assets":len(blocked),
       "inline_evidence":inline[:5],
       "official_script_evidence":records,
       "derived_verified_xml_endpoint":None,
       "candidate_votes_read":False,
       "pre_election_mock_votes_permitted":False,
       "may_move_national_needle":False,
    }

def https_text(url,limit):
    if url!=PAGE and safe_script_url(url)!=url:raise ValueError("URL outside Ohio static script scope")
    request=urllib.request.Request(url,headers={
       "Accept":"text/html,application/javascript,text/javascript",
       "User-Agent":"ElectionCommandCenter/1.0-source-provenance",
    })
    with urllib.request.urlopen(request,timeout=16) as response:
        if response.status!=200:raise ValueError("HTTP "+str(response.status))
        payload=response.read(limit+1)
        if len(payload)>limit:raise ValueError("Response over strict size limit")
        return payload.decode("utf-8-sig",errors="replace")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--probe",action="store_true")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.probe:p.error("Pass --probe to inspect only the official webpage/scripts")
    html=https_text(PAGE,MAX_PAGE)
    result=scan_document(html,lambda u:https_text(u,MAX_SCRIPT))
    result["checked_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))

if __name__=="__main__":
    main()
