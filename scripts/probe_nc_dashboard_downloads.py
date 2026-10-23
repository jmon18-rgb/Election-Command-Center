#!/usr/bin/env python3
"""Audit *actual* official NC election dashboard HTML for discoverable exports.

Never guesses a 2026 URL; never ingests data, mistakes tests for votes or
sets a verified source flag. Reports exact public links needing field audit.
"""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
import json
import urllib.request

PAGES=("https://er.ncsbe.gov/","https://er.ncsbe.gov/downloads.html")
HOSTS={"er.ncsbe.gov","dl.ncsbe.gov","www.ncsbe.gov"}
EXTENSIONS=(".csv",".tsv",".xlsx",".xls",".zip",".json")

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs=[]
        self.scripts=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag in ("a","link") and d.get("href"):self.hrefs.append(d["href"])
        if tag=="script" and d.get("src"):self.scripts.append(d["src"])

def inspect(html,base):
    parser=Links()
    parser.feed(html)
    def safe(link):
        url=urljoin(base,link)
        parsed=urlparse(url)
        return url if parsed.scheme=="https" and parsed.hostname in HOSTS else None
    assets=sorted({x for link in parser.scripts if (x:=safe(link))})
    exports=sorted({x for link in parser.hrefs if (x:=safe(link)) and
                    urlparse(x).path.lower().endswith(EXTENSIONS)})
    return {"page":base,"script_urls":assets,"published_file_urls":exports,
            "county_candidate_votes_verified":False,
            "production_2026_feed_verified":False}

def main():
    findings=[]
    for url in PAGES:
        req=urllib.request.Request(url,headers={"User-Agent":"ElectionCommandCenter/1.0",
                    "Accept":"text/html"})
        with urllib.request.urlopen(req,timeout=25) as response:
            content_type=response.headers.get("Content-Type","").lower()
            body=response.read(2_000_000)
            if response.status!=200 or "html" not in content_type or len(body)==2_000_000:
                raise ValueError("Official dashboard response unavailable or malformed")
        findings.append(inspect(body.decode("utf-8-sig"),url))
    print(json.dumps(findings,indent=2))

if __name__=="__main__":main()
