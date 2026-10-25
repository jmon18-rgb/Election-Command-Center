#!/usr/bin/env python3
"""Official Alaska 2026 general results PAGE discovery, not candidate votes."""
import datetime as dt
from html.parser import HTMLParser
import json
import re
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from national_results_coverage_pulse import state_poll_closings

URL="https://www.elections.alaska.gov/election-results/"
MAX=500_000
class Visible(HTMLParser):
    def __init__(self):
        super().__init__()
        self.words=[]
        self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style"):
            self.skip+=1
    def handle_endtag(self,tag):
        if tag in ("script","style"):
            self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        if not self.skip:
            self.words.append(data)

def assess(html,now,available=True):
    if not isinstance(now,dt.datetime) or now.tzinfo is None:
        raise ValueError("Need original observer clock with UTC offset")
    now=now.astimezone(dt.timezone.utc)
    v=Visible()
    v.feed(html or "")
    body=" ".join(" ".join(v.words).split())
    correct=bool(re.search(
      r"\b2026\s+(?:alaska\s+)?general\s+election\b.{0,150}\bnovember\s+3,?\s+2026\b",
      body,re.I))
    primary=bool(re.search(r"\b2026\s+primary\s+election\b",body,re.I))
    reaa=bool(re.search(r"\b2026\s+reaa\s+election\b",body,re.I))
    test=bool(re.search(r"\b(?:test results|testing in progress|sample results|mock results)\b",
       body,re.I))
    close=now>=state_poll_closings()["AK"]
    status=("ALASKA_RESULTS_PAGE_UNAVAILABLE" if not available else
            "2026_GENERAL_NOT_PUBLISHED_PRIMARY_REAA_ARE_NOT_GENERAL" if not correct else
            "ALASKA_2026_GENERAL_TEST_MODE" if test else
            "ALASKA_2026_GENERAL_PAGE_PRE_CLOSE_NOT_VOTES" if not close else
            "ALASKA_2026_GENERAL_PAGE_POST_CLOSE_NO_VERIFIED_MACHINE_FEED")
    return {
      "schema":"ak-2026-general-official-page-metadata-watch-v1",
      "source":URL,"checked_at":now.isoformat(),"status":status,
      "2026_general_page_verified":bool(available and correct),
      "2026_primary_reference_present":bool(available and primary),
      "2026_reaa_reference_present":bool(available and reaa),
      "test_or_mock_banner_seen":bool(available and test),
      "earliest_alaska_poll_close_passed":close,
      "machine_house_ak_00_verified":False,
      "machine_senate_ak_verified":False,
      "machine_governor_ak_verified":False,
      "professional_calls_approved":False,
      "voting_results_downloaded":0,
      "candidate_votes":None,"reported_precincts":None,
      "county_observations":None,"statewide_votes_observed":False,
      "may_update_forecast":False,"may_move_geographic_needle":False
    }

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def fetch():
    now=dt.datetime.now(dt.timezone.utc)
    try:
        req=urllib.request.Request(URL,headers={
          "Accept":"text/html","Accept-Encoding":"identity",
          "User-Agent":"ElectionCommandCenterAK2026MetadataOnly/1.0"})
        with urllib.request.build_opener(NoRedirect).open(req,timeout=13) as res:
            p=urlsplit(res.geturl())
            if (res.status!=200 or p.scheme!="https" or
                p.hostname!="www.elections.alaska.gov" or
                p.path.rstrip("/")!="/election-results" or
                p.query or p.fragment):
                raise ValueError("Official Alaska results source changed")
            content=res.read(MAX+1)
        if len(content)>MAX:
            raise ValueError("Official Alaska HTML source oversized")
        return assess(content.decode("utf-8","replace"),now)
    except (urllib.error.URLError,TimeoutError,ValueError,UnicodeError) as exc:
        x=assess("",now,False)
        x["error_type"]=type(exc).__name__
        if isinstance(exc,ValueError) and str(exc) in (
            "Official Alaska results source changed",
            "Official Alaska HTML source oversized"):
            x["safe_failure_reason"]=str(exc)
        return x

if __name__=="__main__":
    print(json.dumps(fetch(),indent=2,sort_keys=True))
