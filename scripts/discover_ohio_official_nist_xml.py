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
        # NIST implementation PDFs explain the schema; they are not
        # result-count XML endpoints even when linked near the feed label.
        if parsed.path.lower().endswith((".pdf",".doc",".docx")):
            continue
        # Ohio's actual 2026 feed anchor is a SCRIPT ACTION, NOT a URL.
        # Preserve only the inert, allowlisted action and object key; never
        # execute JavaScript, invent a direct XML URL or download mock votes.
        action=re.fullmatch(
            r"""javascript:downloadReport\(['"]([A-Za-z0-9]{1,80})['"]\);?""",
            href.strip(),flags=re.I)
        if action:
            results.append({
              "href":None,"manual_review_candidate_url":None,
              "official_download_action":"downloadReport",
              "official_download_object_key":action.group(1),
              "link_label":label[:140],
              "verified_official_host":False,
              "needs_manual_host_review":True,
              "requires_page_script_resolution":True,
            })
            continue
        allow=parsed.scheme=="https" and parsed.hostname in OFFICIAL_HOSTS
        if url not in {r.get("href") or r.get("manual_review_candidate_url") for r in results}:
            results.append({
                "href":url if allow else None,
                "manual_review_candidate_url":None if allow else url,
                "manual_review_host":None if allow else parsed.hostname,
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
        "absence_of_mock_banner_does_not_prove_real_votes":True,
        "pre_election_data_must_be_treated_as_mock_until_independent_review":True,
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
