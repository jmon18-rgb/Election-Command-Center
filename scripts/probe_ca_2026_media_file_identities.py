#!/usr/bin/env python3
"""2026 California SOS media index: metadata ONLY, zero results fetched."""
import datetime as dt
from html.parser import HTMLParser
import json
import re
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlsplit
from national_results_coverage_pulse import state_poll_closings

INDEX="https://media.sos.ca.gov/"
FILES=("C26GG.txt","J26GG.txt","P26GG.txt","R26GG.txt","S26GG.txt",
       "V26GG.txt","json-endpoints.csv","api-endpoints.csv")
MAX_BYTES=450000

class Index(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links=[]
        self.href=None
        self.label=[]
        self.visible=[]
        self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style"):
            self.skip+=1
        if tag=="a" and not self.skip:
            self.href=dict(attrs).get("href")
            self.label=[]
    def handle_endtag(self,tag):
        if tag=="a" and self.href is not None:
            self.links.append((" ".join(" ".join(self.label).split()),self.href))
            self.href=None
            self.label=[]
        if tag in ("script","style"):
            self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        if not self.skip:
            self.visible.append(data)
            if self.href is not None:
                self.label.append(data)

def exact_file(url,filename):
    try:
        p=urlsplit(url)
        return (p.scheme=="https" and p.hostname=="media.sos.ca.gov" and
            p.port in (None,443) and p.username is None and
            p.password is None and p.path=="/media/"+filename and
            p.query=="" and p.fragment=="")
    except ValueError:
        return False

def assess(html,now,available=True):
    if not isinstance(now,dt.datetime) or now.tzinfo is None:
        raise ValueError("Observer clock must be offset-aware")
    now=now.astimezone(dt.timezone.utc)
    doc=Index()
    doc.feed(html or "")
    heading=" ".join(" ".join(doc.visible).split())
    general=bool(re.search(
       r"california\s+general\s+election\s+(?:tuesday,?\s+)?november\s+3,?\s+2026",
       heading,re.I))
    test=bool(re.search(
       r"\b(?:test results|testing in progress|mock results|sample results)\b",
       heading,re.I))
    matched={}
    ambiguous=[]
    for name in FILES:
        # Official CA media HTML names the API catalog as "api endpoints
        # .csv file" rather than spelling its download filename in text.
        # Resolve the LINK PATH as well as the label before exact-host
        # verification; never infer any file not in the official HTML.
        links=[href for label,href in doc.links
               if name.lower() in label.lower() or
               urlsplit(urljoin(INDEX,href or "")).path.endswith("/"+name)]
        if len(links)>1:
            ambiguous.append(name)
        if len(links)==1:
            target=urljoin(INDEX,links[0])
            if exact_file(target,name):
                matched[name]=target
            else:
                ambiguous.append(name)
    if ambiguous:
        matched={}
    closed=now>=state_poll_closings()["CA"]
    status=("CA_INDEX_UNAVAILABLE" if not available else
      "CA_WRONG_ELECTION_PAGE" if not general else
      "CA_UNSAFE_OR_DUPLICATE_FILE_LINKS" if ambiguous else
      "CA_TEST_MODE_QUARANTINED" if test else
      "CA_2026_MEDIA_LINKS_BEFORE_LOCAL_CLOSE" if not closed else
      "CA_POST_CLOSE_LINKS_EXIST_BUT_VOTES_UNVERIFIED")
    return {
      "schema":"ca-2026-general-official-media-files-advisory-v1",
      "index":INDEX, "checked_at":now.isoformat(),"status":status,
      "official_2026_general_verified":bool(available and general),
      "test_mode_seen":bool(available and test),
      "expected_files":len(FILES),
      "exact_file_identities":len(matched) if general else 0,
      "official_metadata_links":matched if general else {},
      "missing_file_identities":sorted(set(FILES)-set(matched)),
      "unsafe_or_ambiguous":ambiguous,
      "local_poll_close_passed":closed,
      "result_files_downloaded":0,"verified_candidate_votes":None,
      "machine_house_feed_verified":False,"county_fips_verified":False,
      "browser_cors_verified":False,"rights_cleared":False,
      "api_schema_verified":False,"professional_calls_verified":False,
      "geographic_needle_calibrated":False,"may_update_model":False,
    }

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,request,fp,code,msg,headers,newurl):
        return None

def probe():
    now=dt.datetime.now(dt.timezone.utc)
    try:
        req=urllib.request.Request(INDEX,headers={
            "Accept":"text/html","Accept-Encoding":"identity",
            "User-Agent":"ElectionCommandCenterCA2026MediaIdentity/1.0"})
        with urllib.request.build_opener(NoRedirect).open(req,timeout=12) as resp:
            if resp.status!=200 or resp.geturl()!=INDEX:
                raise ValueError("Official index endpoint moved")
            raw=resp.read(MAX_BYTES+1)
        if len(raw)>MAX_BYTES:
            raise ValueError("Official index too large")
        return assess(raw.decode("utf-8","replace"),now)
    except (urllib.error.URLError,TimeoutError,ValueError,UnicodeError) as exc:
        report=assess("",now,False)
        report["error_type"]=type(exc).__name__
        if isinstance(exc,ValueError) and str(exc) in (
          "Official index endpoint moved","Official index too large"):
            report["safe_failure_reason"]=str(exc)
        return report

if __name__=="__main__":
    print(json.dumps(probe(),indent=2,sort_keys=True))
