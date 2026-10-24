#!/usr/bin/env python3
"""Advisory-only discovery of a possible NC November 2026 results ZIP.

The NCSBE officially describes an election-night "Results File" and links to
prior election ZIP archives. The 2026 URL below is an UNCONFIRMED inference
from the archival naming convention, NOT a verified 2026 election-night feed.
No votes, winner calls, geographic needle data, or source pins may be emitted.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request
import zipfile

CANDIDATE_URL="https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip"
LIMIT_BYTES=55_000_000
MAX_UNCOMPRESSED=180_000_000
USER_AGENT="ElectionCommandCenter NC media-file candidate audit/1.0"


def request(opener,url,method):
    req=urllib.request.Request(url,method=method,headers={
        "User-Agent":USER_AGENT,"Cache-Control":"no-cache","Accept":"application/zip,*/*"
    })
    try:
        with opener(req,timeout=18) as response:
            status=response.status
            headers=dict(response.headers)
            if status!=200:
                return status,headers,None
            if method=="HEAD":
                return status,headers,None
            data=response.read(LIMIT_BYTES+1)
            if len(data)>LIMIT_BYTES:
                raise ValueError("Candidate file exceeds safe network cap")
            return status,headers,data
    except urllib.error.HTTPError as e:
        return e.code,{},None


def inspect_zip(blob):
    if not blob or len(blob)>LIMIT_BYTES or not zipfile.is_zipfile(io.BytesIO(blob)):
        return {"status":"FOUND_NON_ZIP_OR_TOO_LARGE"}
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            infos=[x for x in archive.infolist() if not x.is_dir()]
            if not 1<=len(infos)<=5:
                return {"status":"FOUND_UNEXPECTED_ARCHIVE_MEMBERS"}
            if sum(x.file_size for x in infos)>MAX_UNCOMPRESSED:
                return {"status":"FOUND_OVERSIZED_ARCHIVE"}
            choices=[x for x in infos if re.search(r'20261103',x.filename)
                and x.filename.lower().endswith((".txt",".tsv",".csv"))]
            if len(choices)!=1:
                return {"status":"FOUND_UNCONFIRMED_ELECTION_MEMBER"}
            with archive.open(choices[0]) as stream:
                header=stream.readline(20000).decode("utf-8-sig",errors="replace").strip().lower()
            columns={c.strip() for c in re.split(r"[\t,;]",header)}
            fields_ok=all(any(fragment in c for c in columns) for fragment in
                          ("county","contest","choice"))
            has_count=any("total" in c and ("vote" in c or c=="total")
                          for c in columns)
            if len(columns)<6 or not fields_ok or not has_count:
                return {"status":"FOUND_UNVERIFIED_TABULAR_SCHEMA",
                        "member_count":len(infos)}
            return {"status":"CANDIDATE_ZIP_LAYOUT_PLAUSIBLE_MANUAL_REVIEW_REQUIRED",
                    "member_count":len(infos),"candidate_file_size":choices[0].file_size,
                    "archive_sha256":hashlib.sha256(blob).hexdigest()}
    except (zipfile.BadZipFile,EOFError,OSError,RuntimeError,ValueError):
        return {"status":"FOUND_ARCHIVE_READ_ERROR"}


def probe(opener=urllib.request.urlopen, now=None):
    now=now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Audit timestamp must be UTC-aware")
    report={
        "schema":"ncsbe-2026-unconfirmed-media-file-path-probe-v1",
        "checked_at":now.astimezone(timezone.utc).isoformat(),
        "candidate_url":CANDIDATE_URL,
        "status":"UNKNOWN",
        "publication_url_independently_confirmed":False,
        "s3_path_only_inferred_from_previous_archives":True,
        "actual_2026_election_night_feed_verified":False,
        "browser_cors_verified":False,
        "live_votes_verified":False,
        "may_publish_votes":False,
        "may_move_geographic_or_national_needle":False,
        "professional_calls_verified":False,
    }
    try:
        status,headers,_=request(opener,CANDIDATE_URL,"HEAD")
        if status in (403,404):
            report["status"]="UNAVAILABLE_OR_NOT_PUBLICLY_AUTHORIZED"
            report["http_status"]=status
            return report
        if status!=200:
            report["status"]="UPSTREAM_STATUS_UNVERIFIED"
            report["http_status"]=status
            return report
        size=headers.get("Content-Length")
        if size is not None and (not size.isdecimal() or int(size)>LIMIT_BYTES):
            report["status"]="CANDIDATE_OBJECT_TOO_LARGE_OR_UNTRUSTED"
            return report
        status,_,blob=request(opener,CANDIDATE_URL,"GET")
        if status!=200 or blob is None:
            report["status"]="CANDIDATE_HEAD_PRESENT_GET_UNAVAILABLE"
            return report
        report.update(inspect_zip(blob))
    except (ValueError,TimeoutError,OSError,urllib.error.URLError) as e:
        report["status"]="SOURCE_UNAVAILABLE_OR_INVALID"
        report["failure_type"]=type(e).__name__
    return report


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    result=probe()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as out:
            out.write("### NC November 2026 candidate results-file probe\n\n")
            out.write("- Discovery status: "+result["status"]+"\n")
            out.write("- Source path INFERRED from 2024 official archive; not published as 2026 link by NCSBE.\n")
            out.write("- NO vote totals, CORS approval, results feed authorization, or needle update.\n")


if __name__=="__main__":
    main()
