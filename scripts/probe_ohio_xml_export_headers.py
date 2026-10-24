#!/usr/bin/env python3
"""Read ONLY HTTP HEAD metadata for the real Ohio election XML export path.

The official NIST 1500-100 link resolves through:
  downloadReport('VSSC1622XmlFileBlob')
  window.open('Api/v1/download?filename='+key, '_blank')
As of October 23 the statewide site shows pre-election MOCK results.
This probe never issues GET, downloads XML, parses votes or enables a source.
"""
import argparse
import datetime as dt
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from discover_ohio_official_nist_xml import PAGE

KEY="VSSC1622XmlFileBlob"
RELATIVE="Api/v1/download?filename="+KEY
SCRIPT_RESOLVED=urllib.parse.urljoin(PAGE,RELATIVE)
ROOT_ALTERNATIVE=urllib.parse.urljoin("https://liveresults.ohiosos.gov/",RELATIVE)
OHIO_HOST="liveresults.ohiosos.gov"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def evaluate(response):
    if not isinstance(response,dict):raise ValueError("HEAD metadata missing")
    status=response.get("status")
    if type(status) is not int or status<100 or status>599:
        raise ValueError("Invalid HTTP status metadata")
    location=response.get("location") or ""
    if len(location)>1800:raise ValueError("Unbounded Ohio redirect")
    redirect_host=urllib.parse.urlparse(
        urllib.parse.urljoin(SCRIPT_RESOLVED,location)).hostname if location else None
    length=response.get("content_length")
    if length is not None and (not str(length).isdigit() or len(str(length))>14):
        raise ValueError("Invalid Ohio source Content-Length")
    return {
        "http_status":status,
        "mime_type":str(response.get("content_type") or "")[:120],
        "content_length_bytes":int(length) if length is not None else None,
        "last_modified":str(response.get("last_modified") or "")[:160],
        "redirect_hostname_only":redirect_host,
        "body_downloaded":False,
        "xml_candidate_verified":False,
    }

def head(url):
    if urllib.parse.urlparse(url).hostname!=OHIO_HOST:
        raise ValueError("Not official Ohio live results host")
    request=urllib.request.Request(url,method="HEAD",headers={
        "User-Agent":"ElectionCommandCenter/1.0 Ohio-XML-metadata-only",
        "Accept":"application/xml,text/xml,application/octet-stream",
    })
    opener=urllib.request.build_opener(NoRedirect)
    try:
        response=opener.open(request,timeout=15)
    except urllib.error.HTTPError as error:
        response=error
    with response:
        return {
            "status":response.status,
            "content_type":response.headers.get("Content-Type",""),
            "content_length":response.headers.get("Content-Length"),
            "last_modified":response.headers.get("Last-Modified"),
            "location":response.headers.get("Location"),
        }

def probe(fetch=head):
    urls=(SCRIPT_RESOLVED,ROOT_ALTERNATIVE)
    if len(set(urls))!=2:raise ValueError("Unexpected duplicate Ohio script-relative endpoints")
    results=[]
    for url in urls:
        try:
            result=evaluate(fetch(url))
        except (OSError,ValueError,urllib.error.URLError) as err:
            result={"unavailable_reason":str(err)[:180],"body_downloaded":False,
                    "xml_candidate_verified":False}
        results.append({"candidate_endpoint_path":urllib.parse.urlparse(url).path,
                        "url_verified_for_live_results":False,**result})
    return {
        "schema":"ohio-nist-xml-export-head-only-v1",
        "source":"Ohio Secretary of State official live results site",
        "official_origin":"https://"+OHIO_HOST,
        "observed_action":"downloadReport",
        "official_export_object_key":KEY,
        "script_relative_candidate":SCRIPT_RESOLVED,
        "root_alternative_requires_manual_review":ROOT_ALTERNATIVE,
        "endpoint_metadata":results,
        "2026_early_results_are_mock_until_proven_otherwise":True,
        "http_head_only":True,
        "candidate_votes_ingested":False,
        "source_approved_for_election_night":False,
        "may_move_national_needle":False,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--probe",action="store_true")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.probe:p.error("--probe required")
    output=probe()
    output["checked_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.write_text(json.dumps(output,indent=2)+"\n")
    print(json.dumps(output,indent=2))

if __name__=="__main__":
    main()
