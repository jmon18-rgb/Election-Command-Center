#!/usr/bin/env python3
"""Extract only structural XML paths from the official Ohio 2026 mock export.

No candidate names, values, county counts, ballots, or raw XML logged or saved.
The official page warns results are currently MOCK; this diagnostic cannot
activate live return ingestion or update any forecast.
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

MAX_SAMPLE = 196608
MAX_PATHS = 75
MAX_DEPTH = 18
MAX_NAME = 90
ENTITY = re.compile(br"<!DOCTYPE\b|<!ENTITY\b|<\?xml-stylesheet\b",re.I)


def local_name(tag):
    if not isinstance(tag,str):
        raise ValueError("Unrecognized XML element name")
    return tag.rsplit("}",1)[-1].rsplit(":",1)[-1][:MAX_NAME]


def inspect(raw):
    if not isinstance(raw,bytes) or not 0<len(raw)<=MAX_SAMPLE:
        raise ValueError("Ohio XML body unavailable or exceeds bound")
    if ENTITY.search(raw):
        raise ValueError("XML DTD / external entity declaration blocked")
    if not re.match(br"^(?:\xef\xbb\xbf)?\s*(?:<\?xml\b|<(?:[A-Za-z_][\w.\-]*:)?ElectionReport\b)",raw[:200]):
        # The XML declaration is optional, but HTML and gateway pages are not.
        raise ValueError("Not an official NIST ElectionReport XML response prefix")
    parser=ET.XMLPullParser(events=("start","end"))
    counter=collections.Counter()
    namespaces=set()
    chain=[]
    consumed=0
    parse_note="first-chunk-only"
    # Streaming the sample in chunks prevents a truncated multi-byte sequence
    # from corrupting otherwise valid structural start events.
    for pos in range(0,len(raw),4096):
        piece=raw[pos:pos+4096]
        try:
            parser.feed(piece)
            events=list(parser.read_events())
        except ET.ParseError:
            parse_note="partial-or-invalid-xml"
            break
        consumed+=len(piece)
        for event,element in events:
            name=local_name(element.tag)
            if event=="start":
                chain.append(name)
                if len(chain)>MAX_DEPTH:
                    raise ValueError("XML nesting depth exceeded safe probe bound")
                path="/".join(chain)
                counter[path]+=1
                if element.tag.startswith("{"):
                    namespaces.add(element.tag.split("}",1)[0][1:][:140])
            else:
                if not chain or name!=chain[-1]:
                    raise ValueError("Malformed XML structural nesting")
                chain.pop()
                element.clear()
    if not counter or not any(x=="ElectionReport" for x in [k.split("/")[0] for k in counter]):
        raise ValueError("Official NIST ElectionReport root not observed")
    reported=sorted(counter.items(), key=lambda kv:(-kv[1],kv[0]))[:MAX_PATHS]
    return {
      "schema":"ohio-nist-2026-mock-xml-shape-only-v1",
      "status":"STRUCTURE_SAMPLED_NOT_PRODUCTION_APPROVED",
      "bytes_observed":consumed,
      "sample_incomplete_or_invalid":parse_note!="first-chunk-only" or bool(chain),
      "root_element":"ElectionReport",
      "xml_namespaces":sorted(namespaces)[:6],
      "structural_paths":[{"path":path,"occurrences_in_sample":n} for path,n in reported],
      "body_values_and_candidate_names_logged":False,
      "mock_data_not_live":True,
      "real_election_date_validated":False,
      "official_votes_ingested":False,
      "ready_for_automatic_2026_ingestion":False,
      "may_move_national_needle":False,
    }


def load_prefix(url=ROOT_ALTERNATIVE):
    if not allow_target(url):
        raise ValueError("Unexpected Ohio source URL")
    req=urllib.request.Request(url,method="GET",headers={
      "Range":f"bytes=0-{MAX_SAMPLE-1}",
      "User-Agent":"ElectionCommandCenter/1.0 Ohio-NIST-schema-only",
      "Accept":"application/xml,text/xml,text/plain,*/*",
      "Cache-Control":"no-cache",
    })
    opener=urllib.request.build_opener(NoRedirect)
    with opener.open(req,timeout=18) as response:
        if response.status not in (200,206):
            raise ValueError("Official Ohio XML GET unavailable")
        return response.read(MAX_SAMPLE)


def run():
    try:
        result=inspect(load_prefix())
    except (OSError,ValueError,urllib.error.URLError,ET.ParseError) as ex:
        result={
          "schema":"ohio-nist-2026-mock-xml-shape-only-v1",
          "status":"OFFICIAL_OHIO_XML_STRUCTURE_NOT_ESTABLISHED",
          "error":str(ex)[:200],
          "mock_data_not_live":True,
          "official_votes_ingested":False,
          "ready_for_automatic_2026_ingestion":False,
          "may_move_national_needle":False,
        }
    result["checked_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    return result


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--probe",action="store_true")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.probe:p.error("--probe required")
    report=run()
    args.output.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
