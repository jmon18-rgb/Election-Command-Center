#!/usr/bin/env python3
"""Read-only official Ohio NIST 1500-100 XML feed URL discovery.

Ohio's 2026 results site currently serves MOCK election results ahead of
November 3. NEVER download or publish candidate totals from those pages
as genuine 2026 votes. Discovery records only independently attributable
feed links from official HTML; the source cannot enter any live model.
"""
import argparse
import datetime as dt
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

PAGE="https://liveresults.ohiosos.gov/Home/Index"
OFFICIAL_HOSTS=frozenset(("liveresults.ohiosos.gov","ohiosos.gov","www.ohiosos.gov"))
MAX_HTML_BYTES=1_500_000

class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.candidates=[]
        self.href=None
        self.label=[]
    def handle_starttag(self,tag,attrs):
        if tag=="a":
            self.href=dict(attrs).get("href")
            self.label=[]
    def handle_data(self,data):
        if self.href is not None:
            self.label.append(data)
    def handle_endtag(self,tag):
        if tag=="a":
            if self.href is not None:
                self.candidates.append((self.href," ".join(self.label).strip()))
            self.href=None
            self.label=[]

def inspect(html):
    if not isinstance(html,str) or not html or len(html)>MAX_HTML_BYTES:
        raise ValueError("Missing or oversized Ohio official webpage")
    p=Links();p.feed(html)
    mock=bool(re.search(r"mock elections?|mock results?|test(?:ing)? (?:election|results)",html,re.I))
    results=[]
    for href,label in p.candidates:
        if not isinstance(href,str) or len(href)>1200:
            continue
        if not (re.search(r"election results xml feed|nist.?1500|xml feed",label,re.I)
                or re.search(r"\.xml(?:$|[?])|[?&]format=xml",href,re.I)):
            continue
        url=urllib.parse.urljoin(PAGE,href)
        parsed=urllib.parse.urlparse(url)
        allow=parsed.scheme=="https" and parsed.hostname in OFFICIAL_HOSTS
        if url not in {r["href"] for r in results}:
            results.append({
                "href":url if allow else None,
                "link_label":label[:140],
                "verified_official_host":allow,
                "needs_manual_host_review":not allow,
            })
    return {
        "schema":"ohio-official-nist-xml-discovery-v1",
        "status":"UNTRUSTED_PUBLISHED_FEED_LINK_DISCOVERY_NOT_LIVE_RESULTS",
        "official_landing":PAGE,
        "possible_feed_links":results[:12],
        "mock_or_test_banner_detected":mock,
        "source_votes_ingested":False,
        "candidate_counts_certified":False,
        "may_move_national_needle":False,
        "ready_for_automatic_2026_ingestion":False,
    }

def download():
    req=urllib.request.Request(PAGE,headers={
        "User-Agent":"ElectionCommandCenter/1.0 official-Ohio-XML-source-discovery",
        "Accept":"text/html",
    })
    with urllib.request.urlopen(req,timeout=16) as response:
        if response.status!=200:raise ValueError("Ohio landing HTTP "+str(response.status))
        data=response.read(MAX_HTML_BYTES+1)
        if len(data)>MAX_HTML_BYTES:raise ValueError("Oversized official Ohio HTML")
        charset=response.headers.get_content_charset() or "utf-8"
    return data.decode(charset,errors="replace")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--probe",action="store_true")
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    if not args.probe:parser.error("Pass --probe to review official Ohio source publication")
    try:
        result=inspect(download())
    except (OSError,urllib.error.URLError,ValueError,UnicodeError) as err:
        result={
            "schema":"ohio-official-nist-xml-discovery-v1",
            "status":"OHIO_OFFICIAL_LANDING_NOT_RETRIEVABLE_OR_INCOMPATIBLE",
            "official_landing":PAGE,
            "reason":str(err)[:300],"possible_feed_links":[],
            "source_votes_ingested":False,
            "candidate_counts_certified":False,
            "may_move_national_needle":False,
            "ready_for_automatic_2026_ingestion":False,
        }
    result["checked_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))

if __name__=="__main__":
    main()
