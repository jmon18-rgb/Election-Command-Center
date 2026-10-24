#!/usr/bin/env python3
"""Review-only Ohio NIST source identity inventory. NO VOTE TALLIES.

Given an explicit local NIST XML input, extract county unit IDs, party IDs,
and Senate/House/Governor contest/candidate identities for human review.
Original XML may be MOCK. Output is NEVER an approved source configuration.
"""
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from build_approved_ohio_nist_results import (
    MAX_BYTES,NS,ROOT_ALTERNATIVE,UNSAFE,q,child_text,required,
)

IMPORTANT=re.compile(r"(?:senat|govern|representative|congress|district)",re.I)

def safe_label(value,limit=180):
    if value is None:return ""
    if not isinstance(value,str):raise ValueError("Expected source label text")
    out=" ".join(value.split())
    return out[:limit]

def text_label(item):
    if item is None:return ""
    for k in ("Name","Label","Type"):
        attr=item.get(k)
        if attr and k!="Type":return safe_label(attr)
    n=item.find(q("Name"))
    if n is not None:
        s=n.find(q("LanguageString"))
        if s is not None:return safe_label(s.text)
        return safe_label(n.text)
    return ""

def collect(raw):
    if not isinstance(raw,bytes) or not 100<=len(raw)<=MAX_BYTES or UNSAFE.search(raw):
        raise ValueError("Reject missing, oversized, or unsafe Ohio source XML")
    try:
        xml=ET.fromstring(raw)
    except ET.ParseError as e:raise ValueError("NIST XML not well formed") from e
    if xml.tag!=q("ElectionReport"):raise ValueError("Unexpected NIST source namespace")
    election=xml.find(q("Election"))
    if election is None or election.get("Date")!="2026-11-03":
        raise ValueError("Wrong 2026 Ohio election identity for candidate review")
    group=xml.find(q("GpUnitCollection"))
    parties=xml.find(q("PartyCollection"))
    candidates=election.find(q("CandidateCollection"))
    contests=election.find(q("ContestCollection"))
    if any(x is None for x in (group,parties,candidates,contests)):
        raise ValueError("Incomplete Ohio contest/candidate/party/county source identity")
    geo=[]
    for x in group.findall(q("GpUnit")):
        ident=required(x.get("ObjectId"),"geographic source object ID",120)
        geo.append({"source_gpunit_id":ident,
          "reported_source_type":safe_label(x.get("Type"),60),
          "reported_source_label":text_label(x),
          "reviewed_fips":None})
    if len(geo)>1000 or len({x["source_gpunit_id"] for x in geo})!=len(geo):
        raise ValueError("Invalid/duplicate geographic IDs")
    party_items=[]
    for x in parties.findall(q("Party")):
        ident=required(x.get("ObjectId"),"source party ID",120)
        party_items.append({"source_party_id":ident,
            "source_label":text_label(x),"reviewed_dashboard_party":None})
    if len(party_items)>100 or len({x["source_party_id"] for x in party_items})!=len(party_items):
        raise ValueError("Invalid source party identity table")
    cand_map={}
    for x in candidates.findall(q("Candidate")):
        ident=required(x.get("ObjectId"),"candidate source ID",120)
        if ident in cand_map:raise ValueError("Duplicate source candidate ID")
        ballot=x.find(q("BallotName"))
        name=child_text(ballot,"LanguageString") if ballot is not None else ""
        cand_map[ident]={"source_candidate_id":ident,
          "source_ballot_name":safe_label(name),
          "source_party_id":child_text(x,"PartyId")}
    if len(cand_map)>1000:raise ValueError("Overlarge candidate source ID table")
    contests_out=[]
    for x in contests.findall(q("Contest")):
        ident=required(x.get("ObjectId"),"contest source ID",120)
        name=safe_label(x.get("Name"))
        if not IMPORTANT.search(name):continue
        candidate_ids=[]
        for selection in x.findall(q("BallotSelection")):
            ident_c=child_text(selection,"CandidateId")
            if ident_c and ident_c not in candidate_ids:candidate_ids.append(ident_c)
        if len(candidate_ids)>40:raise ValueError("Oversized ballot slate")
        contests_out.append({
            "source_contest_id":ident,
            "source_office_id":child_text(x,"OfficeId"),
            "source_contest_name":name,
            "reviewed_dashboard_race_key":None,
            "candidate_ids":candidate_ids,
            "candidates":[cand_map[c] for c in candidate_ids if c in cand_map],
        })
    if len(contests_out)>500:raise ValueError("Too many ballot contests")
    review_template={
        "schema":"ohio-nist-2026-live-approval-v1",
        "enabled":False,
        "real_results_publication_reviewed":False,
        "source_url":ROOT_ALTERNATIVE,
        "source_reviewed_at":None,
        "expected_report_status":None,
        "approved_county_unit_type":None,
        "approved_total_votes_type":None,
        "county_gpunit_to_fips":{},
        "party_object_id_to_party":{},
        "approved_contests":[],
    }
    return {
        "schema":"ohio-nist-metadata-review-draft-v1",
        "status":"SOURCE_IDENTITY_PROPOSAL_FROM_POTENTIALLY_MOCK_XML_NOT_APPROVED",
        "original_xml_sha256":hashlib.sha256(raw).hexdigest(),
        "election_date":"2026-11-03",
        "original_report_status_untrusted":safe_label(xml.get("Status"),50),
        "generated_at_untrusted":safe_label(xml.get("GeneratedDate"),80),
        "counties_and_other_reporting_units":geo,
        "source_party_objects":party_items,
        "reviewable_senate_house_governor_contests":contests_out,
        "disabled_approval_template":review_template,
        "numeric_vote_counts_extracted":False,
        "candidate_votes_published":False,
        "real_election_results_verified":False,
        "may_move_national_needle":False,
        "manual_review_required":"Review real-vs-mock publication, map all 88 county GpUnit IDs to independently verified FIPS, select election contests and candidate/party IDs, verify actual VoteCounts Type, and separately approve after 2026-11-03 Ohio poll close.",
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--xml",type=Path,required=True,help="Local original Ohio NIST XML (may contain MOCK vote totals)")
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    output=collect(args.xml.read_bytes())
    args.output.write_text(json.dumps(output,indent=2)+"\n")
    print(json.dumps({
        "status":output["status"],
        "source_sha256":output["original_xml_sha256"],
        "candidate_vote_counts_extracted":False,
        "county_and_other_units":len(output["counties_and_other_reporting_units"]),
        "contests_for_review":len(output["reviewable_senate_house_governor_contests"]),
        "approval_enabled":False,
        "review_file":str(args.output),
    }))

if __name__=="__main__":main()
