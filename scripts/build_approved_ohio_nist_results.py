#!/usr/bin/env python3
"""Ohio NIST 1622 Election Night county candidate parser, RELEASE-GATED.

The official source currently displays MOCK results. Merely parsing valid
XML does not authorize any data import. An independent manual approval must
name the exact original source, actual November publication, all 88 verified
county object IDs/FIPS and specific Senate/Gov/House source contest IDs.
Source candidate-only rows cannot produce professional calls, remaining
ballots, or changes to the national election needle.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from probe_ohio_nist_xml_prefix import ROOT_ALTERNATIVE

NS="http://grouper.ieee.org/groups/1622/groups/2/V1/1622_2-election_results_reporting.xsd"
MAX_BYTES=32*1024*1024
LIVE_START=dt.datetime(2026,11,4,0,30,tzinfo=dt.timezone.utc)
COUNTIES=frozenset(f"39{i:03d}" for i in range(1,176,2))
RACE_KEYS=frozenset(["OH-SEN-special","OH-GOV"]+
    [f"OH-{i:02d}" for i in range(1,16)])
UNSAFE=re.compile(br"<!DOCTYPE\b|<!ENTITY\b|<\?xml-stylesheet\b",re.I)


def q(tag):
    return "{"+NS+"}"+tag


def iso_date(value):
    try:
        parsed=dt.datetime.fromisoformat(value.replace("Z","+00:00"))
    except (AttributeError,ValueError,TypeError) as ex:
        raise ValueError("Missing or invalid source timestamp") from ex
    if parsed.tzinfo is None:
        raise ValueError("Source timestamp must have timezone")
    return parsed.astimezone(dt.timezone.utc)


def required(value,what,max_len=260):
    if not isinstance(value,str) or not 0<len(value.strip())<=max_len:
        raise ValueError("Missing or oversized "+what)
    return value.strip()


def child_text(parent,name):
    node=parent.find(q(name))
    return (node.text or "").strip() if node is not None else ""


def approve(review,now):
    if not isinstance(now,dt.datetime) or now.tzinfo is None:
        raise ValueError("UTC clock is required")
    now=now.astimezone(dt.timezone.utc)
    if not isinstance(review,dict) or review.get("schema")!="ohio-nist-2026-live-approval-v1":
        raise ValueError("Missing independent Ohio source approval contract")
    if (review.get("enabled") is not True or
        review.get("real_results_publication_reviewed") is not True or
        review.get("source_url")!=ROOT_ALTERNATIVE or
        now<LIVE_START):
        raise ValueError("Ohio MOCK/test vote gate remains closed")
    checked=iso_date(review.get("source_reviewed_at"))
    if checked<LIVE_START or checked>now+dt.timedelta(minutes=5):
        raise ValueError("No post-poll-closing, independently reviewed Ohio source publication")
    required(review.get("expected_report_status"),"actual NIST source report status",50)
    unit_type=required(review.get("approved_county_unit_type"),"county GpUnit type",60)
    required(review.get("approved_total_votes_type"),"exact reviewed VoteCounts Type",60)
    if len(unit_type)>60:raise ValueError("County unit type exceeds bound")
    units=review.get("county_gpunit_to_fips")
    if (not isinstance(units,dict) or len(units)!=88 or
        len(set(units.values()))!=88 or set(units.values())!=COUNTIES or
        any(not isinstance(k,str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,120}",k)
            for k in units)):
        raise ValueError("88 independently reviewed Ohio county/FIPS source unit IDs required")
    types=review.get("party_object_id_to_party")
    if (not isinstance(types,dict) or not {"DEM","REP"}.issubset(set(types.values())) or
        any(v not in ("DEM","REP","OTHER") for v in types.values())):
        raise ValueError("Explicit independent major-party ID mapping required")
    contests=review.get("approved_contests")
    if (not isinstance(contests,list) or not 1<=len(contests)<=17 or
        len({c.get("race_key") for c in contests if isinstance(c,dict)})!=len(contests)):
        raise ValueError("One or more unique reviewed Ohio contests required")
    for c in contests:
        if not isinstance(c,dict) or c.get("race_key") not in RACE_KEYS:
            raise ValueError("Unapproved Ohio election race key")
        for name in ("source_contest_id","source_office_id","source_contest_name"):
            required(c.get(name),name,160)
        ids=c.get("candidate_ids")
        if (not isinstance(ids,list) or not 2<=len(ids)<=24 or
            len(set(ids))!=len(ids) or
            any(not isinstance(x,str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,120}",x)
                for x in ids)):
            raise ValueError("Missing independent ballot candidate ID list")
    return now


def parse(xml_bytes,review,now):
    now=approve(review,now)
    if not isinstance(xml_bytes,bytes) or not 100<=len(xml_bytes)<=MAX_BYTES:
        raise ValueError("Ohio XML source empty or over budget")
    if UNSAFE.search(xml_bytes):
        raise ValueError("DTD/entity expansion in official XML rejected")
    try:
        root=ET.fromstring(xml_bytes)
    except ET.ParseError as err:
        raise ValueError("Invalid full NIST XML source") from err
    if root.tag!=q("ElectionReport") or root.get("Status")!=review["expected_report_status"]:
        raise ValueError("Unexpected Ohio NIST XML root namespace or status")
    observed=iso_date(root.get("GeneratedDate"))
    if (observed<LIVE_START-dt.timedelta(minutes=5) or
        observed>now+dt.timedelta(minutes=5) or
        now-observed>dt.timedelta(minutes=30)):
        raise ValueError("Official Ohio election report is stale, premature or future-dated")
    election=root.find(q("Election"))
    if election is None or election.get("Date")!="2026-11-03":
        raise ValueError("Wrong original Ohio 2026 election date")
    geographical=root.find(q("GpUnitCollection"))
    if geographical is None:
        raise ValueError("Official source has no county reporting units")
    unit_lookup={}
    for item in geographical.findall(q("GpUnit")):
        ident=item.get("ObjectId")
        if ident in unit_lookup:
            raise ValueError("Duplicate geographic unit identity")
        if ident:unit_lookup[ident]=item
    approved_units=review["county_gpunit_to_fips"]
    if (not set(approved_units).issubset(unit_lookup) or
        any(unit_lookup[unit].get("Type")!=review["approved_county_unit_type"]
            for unit in approved_units)):
        raise ValueError("Approved 88 county geographic units not present as expected")
    parties=root.find(q("PartyCollection"))
    if parties is None:raise ValueError("Party source identity table missing")
    seen_parties=set()
    for item in parties.findall(q("Party")):
        ident=item.get("ObjectId")
        if ident in seen_parties:raise ValueError("Duplicate party identity")
        seen_parties.add(ident)
    if not set(review["party_object_id_to_party"]).issubset(seen_parties):
        raise ValueError("Approved Democratic and Republican source party identities missing")
    candidates=election.find(q("CandidateCollection"))
    if candidates is None:raise ValueError("Candidate identity table absent")
    by_id={}
    for person in candidates.findall(q("Candidate")):
        ident=person.get("ObjectId")
        if not ident or ident in by_id:
            raise ValueError("Missing/duplicate candidate source ID")
        party=child_text(person,"PartyId")
        ballot=person.find(q("BallotName"))
        name=child_text(ballot,"LanguageString") if ballot is not None else ""
        by_id[ident]={"party_source":party,"name":required(name,"candidate ballot name",180)}
    collection=election.find(q("ContestCollection"))
    if collection is None:raise ValueError("Source election contains no contest list")
    by_contest={}
    for item in collection.findall(q("Contest")):
        ident=item.get("ObjectId")
        if not ident or ident in by_contest:
            raise ValueError("Missing/duplicate source contest identity")
        by_contest[ident]=item
    out=[]
    for reviewed in review["approved_contests"]:
        race=reviewed["race_key"]
        contest=by_contest.get(reviewed["source_contest_id"])
        if (contest is None or
            child_text(contest,"OfficeId")!=reviewed["source_office_id"] or
            contest.get("Name")!=reviewed["source_contest_name"]):
            raise ValueError("Reviewed Ohio race/source contest identity changed: "+race)
        tally={}
        seen_candidates=set()
        for sel in contest.findall(q("BallotSelection")):
            cand_id=child_text(sel,"CandidateId")
            if not cand_id or cand_id not in reviewed["candidate_ids"] or cand_id in seen_candidates:
                raise ValueError("Unexpected, missing or duplicated approved Ohio candidate identity")
            seen_candidates.add(cand_id)
            metadata=by_id.get(cand_id)
            if metadata is None:raise ValueError("Candidate source record unavailable")
            party=review["party_object_id_to_party"].get(metadata["party_source"])
            if not party:raise ValueError("Candidate party not independently mapped")
            sets=sel.find(q("VoteCountsCollection"))
            if sets is None:raise ValueError("Candidate has no reporting units")
            for votes in sets.findall(q("VoteCounts")):
                if votes.get("Type")!=review["approved_total_votes_type"]:
                    continue
                unit=child_text(votes,"GpUnitId")
                if unit not in approved_units:
                    continue  # Exclude district/state-level totals to avoid double count
                raw=votes.get("Count")
                if not raw or not re.fullmatch(r"\d{1,9}",raw):
                    raise ValueError("Missing/invalid total votes for approved Ohio county")
                count=int(raw)
                if count>5_000_000:raise ValueError("Impossible one-county candidate total")
                key=(unit,cand_id)
                if key in tally:raise ValueError("Duplicate county/party total in source")
                tally[key]=count
        if set(reviewed["candidate_ids"])!=seen_candidates:
            raise ValueError("An independently reviewed Ohio ballot selection is missing")
        counties=[]
        for unit,fips in sorted(approved_units.items(),key=lambda x:x[1]):
            subset=[]
            for cand_id in reviewed["candidate_ids"]:
                value=tally.get((unit,cand_id))
                if value is None:continue
                source=by_id[cand_id]
                subset.append({"name":source["name"],
                               "party":review["party_object_id_to_party"][source["party_source"]],
                               "votes":value})
            if subset:
                counties.append({"county_fips":fips,"candidates":subset})
        if not counties:raise ValueError("No county totals for approved Ohio race")
        if (not any(x["party"]=="DEM" for row in counties for x in row["candidates"]) or
            not any(x["party"]=="REP" for row in counties for x in row["candidates"])):
            raise ValueError("Both major parties require observed source candidate totals")
        out.append({"race_key":race,"office":("Senate" if race.startswith("OH-SEN") else
                   "Governor" if race=="OH-GOV" else "House"),"counties":counties,
                    "reported_county_count":len(counties)})
    return {
        "schema":"ohio-nist-candidate-county-2026-v1",
        "status":"INDEPENDENTLY_REVIEWED_UNOFFICIAL_CANDIDATE_COUNTS_NO_RACE_CALLS",
        "election_date":"2026-11-03","state":"OH",
        "source":{"url":ROOT_ALTERNATIVE,"xml_sha256":hashlib.sha256(xml_bytes).hexdigest(),
                  "generated_at":observed.isoformat().replace("+00:00","Z"),
                  "approval_reviewed_at":review["source_reviewed_at"]},
        "ballots_remaining":None,"reporting_fraction":None,
        "independently_certified_winner_calls":False,
        "may_move_national_needle":False,
        "races":out,
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--xml",type=Path,required=True)
    p.add_argument("--approval",type=Path,default=Path("data/ohio_nist_source_approval_2026.json"))
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    approval=json.loads(args.approval.read_text())
    # The disabled default config aborts BEFORE reading the current official
    # mock XML. A future enabled config must be independently reviewed.
    approve(approval,dt.datetime.now(dt.timezone.utc))
    result=parse(args.xml.read_bytes(),approval,dt.datetime.now(dt.timezone.utc))
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({"status":result["status"],"race_count":len(result["races"]),
          "source_sha":result["source"]["xml_sha256"],"needle":False}))


if __name__=="__main__":
    main()
