#!/usr/bin/env python3
"""Stream only Ohio's official NIST XML *tag structure*, never election values.

The publicly reachable export is MOCK prior to actual November 3 reporting.
This independent structural trace never stores candidate names, numerical
votes, county results, element text, or attribute values. No live output.
"""
import argparse
import collections
import datetime as dt
import json
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from probe_ohio_nist_xml_prefix import ROOT_ALTERNATIVE, NoRedirect, allow_target

CHUNK=32768
MAX_BYTES=32*1024*1024
MAX_EVENTS=750000
MAX_DEPTH=24
MAX_STRUCTURES=240
RISK=re.compile(br"<!DOCTYPE\b|<!ENTITY\b|<\?xml-stylesheet\b",re.I)


def clean_tag(name):
    value=str(name).rsplit("}",1)[-1].rsplit(":",1)[-1]
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.-]{0,90}",value):
        raise ValueError("Unsafe or unrecognized NIST XML tag")
    return value


def inspect_stream(stream, max_bytes=MAX_BYTES):
    parser=ET.XMLPullParser(events=("start","end"))
    paths=collections.Counter()
    attribute_names=collections.defaultdict(set)
    chain=[]
    namespace=set()
    previous=b""
    consumed=0
    events=0
    root_closed=False
    limit_hit=False
    while True:
        if consumed>=max_bytes:
            limit_hit=True
            break
        segment=stream.read(min(CHUNK,max_bytes-consumed))
        if not segment:
            break
        if not isinstance(segment,bytes):
            raise ValueError("Ohio stream is not binary XML")
        if RISK.search(previous+segment):
            raise ValueError("DTD/entity declarations forbidden in results XML")
        previous=segment[-80:]
        consumed+=len(segment)
        parser.feed(segment)
        for event,element in parser.read_events():
            events+=1
            if events>MAX_EVENTS:
                raise ValueError("NIST XML structural event budget exceeded")
            tag=clean_tag(element.tag)
            if event=="start":
                chain.append(tag)
                if len(chain)>MAX_DEPTH:
                    raise ValueError("Excessive XML structural nesting")
                if len(chain)==1 and tag!="ElectionReport":
                    raise ValueError("Official export is not ElectionReport XML")
                key="/".join(chain)
                paths[key]+=1
                for a in element.attrib:
                    attribute_names[key].add(clean_tag(a))
                if isinstance(element.tag,str) and element.tag.startswith("{"):
                    namespace.add(element.tag.split("}",1)[0][1:][:160])
            else:
                if not chain or chain[-1]!=tag:
                    raise ValueError("Mismatched NIST XML close event")
                chain.pop()
                if tag=="ElectionReport" and not chain:
                    root_closed=True
                element.clear()
    if not paths or not root_closed and not limit_hit:
        raise ValueError("NIST XML export is incomplete or unavailable")
    # Only path and ATTRIBUTE NAMES leave this process. Never text/values.
    top=sorted(paths.items(),key=lambda item:(-item[1],item[0]))[:MAX_STRUCTURES]
    return {
        "schema":"ohio-nist-xml-full-structural-observation-v1",
        "status":"OFFICIAL_MOCK_XML_TAG_LAYOUT_ONLY_NOT_RESULTS",
        "xml_root":"ElectionReport",
        "namespaces":sorted(namespace)[:8],
        "xml_complete_within_budget":root_closed,
        "reached_byte_budget":limit_hit,
        "bytes_sampled":consumed,
        "event_count":events,
        "unique_paths_count":len(paths),
        "element_paths":[{
          "path":path,
          "occurrences":count,
          "attribute_names_only":sorted(attribute_names[path])[:24],
        } for path,count in top],
        "attribute_values_logged":False,
        "candidate_names_or_vote_counts_logged":False,
        "no_real_2026_vote_approval":True,
        "candidate_totals_ingested":False,
        "may_move_national_needle":False,
    }


def read_official():
    if not allow_target(ROOT_ALTERNATIVE):
        raise ValueError("Unapproved Ohio NIST XML download source")
    req=urllib.request.Request(ROOT_ALTERNATIVE,method="GET",headers={
        "User-Agent":"ElectionCommandCenter/1.0 OhioFullXmlStructureOnly",
        "Accept":"text/plain,application/xml,text/xml",
        "Cache-Control":"no-cache",
    })
    opener=urllib.request.build_opener(NoRedirect)
    with opener.open(req,timeout=35) as response:
        if response.status!=200:
            raise ValueError("Unexpected official Ohio source status")
        return inspect_stream(response)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--probe",action="store_true")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.probe:p.error("Pass --probe for official schema-only read")
    try:
        report=read_official()
    except (OSError,ValueError,urllib.error.URLError,ET.ParseError) as ex:
        report={
          "schema":"ohio-nist-xml-full-structural-observation-v1",
          "status":"OHIO_OFFICIAL_XML_STRUCTURE_UNAVAILABLE",
          "error":str(ex)[:250],
          "candidate_totals_ingested":False,
          "may_move_national_needle":False,
        }
    report["checked_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    args.output.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))

if __name__=="__main__":
    main()
