#!/usr/bin/env python3
"""Strict read-only 2026 general election link discovery for DE and WY.

An official landing page or 2026 primary link is NOT a 2026 general result,
machine-readable feed, vote, or winner call. Do not fetch discovered links.
"""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import re
from urllib.parse import urljoin, urlsplit
import urllib.request

CONFIG = {
    "DE": ("https://elections.delaware.gov/results/", "elections.delaware.gov",
           "House|DE-00"),
    "WY": ("https://sos.wyo.gov/Elections/ElectionResults.aspx", "sos.wyo.gov",
           "House|WY-00"),
}
MAX_HTML=350_000


def official_url(state,url):
    if state not in CONFIG:
        return False
    base,host,_=CONFIG[state]
    p=urlsplit(url)
    return (p.scheme=="https" and p.hostname==host and
            p.username is None and p.password is None and p.port in (None,443)
            and bool(p.path) and p.path!="/" and
            p.path.lower()!=urlsplit(base).path.lower() and
            chr(92) not in p.path)


class ResultAnchors(HTMLParser):
    def __init__(self,state):
        super().__init__()
        self.state=state
        self.section=None
        self.heading=None
        self.anchor=None
        self.matches=[]

    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag in ("h1","h2","h3","h4","h5","h6"):
            self.heading=[tag,[]]
        if tag=="a":
            href=attrs.get("href","")
            dest=urljoin(CONFIG[self.state][0],href)
            self.anchor=[dest,[],self.section] if href and not href.startswith("#") else None

    def handle_data(self,data):
        if self.heading is not None:
            self.heading[1].append(data)
        if self.anchor is not None:
            self.anchor[1].append(data)

    def handle_endtag(self,tag):
        if self.heading is not None and tag==self.heading[0]:
            title=" ".join(" ".join(self.heading[1]).split()).lower()
            if re.search(r"\b20(?:2[0-9]|3[0-9])\b.*\belection\b",title):
                self.section="2026" if re.search(r"\b2026\b",title) else "other"
            elif self.state=="DE" and title in ("current year elections","previous elections"):
                self.section="2026" if title=="current year elections" else "other"
            self.heading=None
        if tag=="a" and self.anchor is not None:
            url,raw,year=self.anchor
            label=" ".join(" ".join(raw).split())
            self.anchor=None
            if (official_url(self.state,url) and
                re.search(r"\bgeneral\s+election\b",label,re.I) and
                not re.search(r"\b(primary|special primary|2024|2022|2020)\b",label,re.I) and
                (year=="2026" or re.search(r"\b2026\b",label))):
                self.matches.append({"label":label[:140],"url":url})


def assess(html,state,when,available=True):
    if state not in CONFIG or when.tzinfo is None:
        raise ValueError("Known state and timezone-aware observation required")
    parsed=ResultAnchors(state)
    parsed.feed(html or "")
    matches=sorted(set(x["url"] for x in parsed.matches))
    return {
        "schema":"de-wy-official-2026-general-results-link-advisory-v1",
        "race":CONFIG[state][2],
        "source":CONFIG[state][0],
        "checked_at":when.astimezone(timezone.utc).isoformat(),
        "status":"SOURCE_UNAVAILABLE_NOT_ASSESSED" if not available else
                 "OFFICIAL_2026_GENERAL_LINK_FOUND_UNVERIFIED" if len(matches)==1 else
                 "AMBIGUOUS_OFFICIAL_LINKS_NOT_APPROVED" if matches else
                 "2026_GENERAL_RESULT_LINK_NOT_ON_PAGE",
        "candidate_official_links":matches[:5] if available else [],
        "automated_feed_verified":False,"candidate_votes":None,
        "professional_calls":None,"may_update_model":False,
        "next_validation":"Verify November 3 2026 contest identity, publication clock, production status, downloadable format and rights before any ingestion.",
    }


def probe(state):
    now=datetime.now(timezone.utc)
    base,_,_=CONFIG[state]
    try:
        req=urllib.request.Request(base,headers={
            "User-Agent":"ElectionCommandCenterOfficial2026LinkAudit/1.0",
            "Accept":"text/html"})
        with urllib.request.urlopen(req,timeout=12) as response:
            if response.status!=200 or not official_url_redirect(state,response.geturl()):
                raise ValueError("Official portal redirected elsewhere or returned non-200")
            raw=response.read(MAX_HTML+1)
        if len(raw)>MAX_HTML:
            raise ValueError("Official page exceeded bounded read")
        return assess(raw.decode("utf-8","replace"),state,now)
    except Exception as exc:
        result=assess("",state,now,available=False)
        result["error_type"]=type(exc).__name__
        return result


def official_url_redirect(state,url):
    p=urlsplit(url)
    return (p.scheme=="https" and p.hostname==CONFIG[state][1] and
            p.username is None and p.password is None and p.port in (None,443))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--probe",action="store_true")
    args=parser.parse_args()
    if not args.probe:
        parser.error("Use --probe (metadata only)")
    print(json.dumps({state:probe(state) for state in CONFIG},indent=2,sort_keys=True))
