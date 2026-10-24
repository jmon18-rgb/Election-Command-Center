#!/usr/bin/env python3
"""Reconcile ACTUAL primary provider responses against the exact 506 race ledger.

Identity discovery is NOT observed 2026 votes. Only a positive source-reported
2026 vote count creates a reporting observation; neither missing, stale,
unqueried, nor zero-valued records imply no votes were cast. This diagnostic
never republishes candidate counts or becomes a forecast/race-call input.
"""
import datetime as dt
from collections import Counter
from pathlib import Path
import re

PRIMARY_SCOPE = "Open America 22-state scope"
EXPECTED = {"House":435, "Senate":35, "Governor":36}


def state_poll_closings():
    """Read the canonical 2026 state-local close schedule from the browser JS.

    The audit must not keep a second, stale list of opening dates/time zones.
    Only a strict 50-state literal map can be used. A missing/corrupt source
    contract fails the check, not the closed-polls precondition.
    """
    source=(Path(__file__).resolve().parent /
            "election_night_poll_closings_2026.js").read_text()
    match=re.search(r"const TIMES=Object\.freeze\(\{(.*?)\}\);",source,re.S)
    if not match:
        raise ValueError("Shared state poll close contract missing")
    pairs=re.findall(r"([A-Z]{2}):'([0-2]\d:[0-5]\d)'",match.group(1))
    if len(pairs)!=50 or len({s for s,_ in pairs})!=50:
        raise ValueError("Invalid or incomplete 50-state poll-close map")
    closings={}
    for state,clock in pairs:
        day=3 if state in ("IN","KY") else 4
        closings[state]=dt.datetime.fromisoformat(
            f"2026-11-{day:02d}T{clock}:00+00:00")
    if min(closings.values())!=dt.datetime(2026,11,3,23,tzinfo=dt.timezone.utc):
        raise ValueError("Wrong earliest 2026 state poll close")
    return closings


def valid_candidates(details, total):
    """Fail closed on source candidate arithmetic, never guess missing votes."""
    cands=details.get("cands")
    if not isinstance(cands,list) or (total>0 and not cands) or len(cands)>60:
        return False
    names=set()
    major_parties=set()
    summed=0
    for row in cands:
        if not isinstance(row,dict) or not isinstance(row.get("n"),str) or not row["n"].strip() or len(row["n"])>200:
            return False
        name=row["n"].strip().casefold()
        if name in names:
            return False
        names.add(name)
        if not isinstance(row.get("p"),str) or not row["p"].strip() or len(row["p"])>80:
            return False
        # Same source schema as browser reconciliation: one major-party
        # candidate per D/R column. More than one distinct minor-party
        # candidate is valid and must not be rejected.
        if row["p"] in ("D","R"):
            if row["p"] in major_parties:
                return False
            major_parties.add(row["p"])
        count=row.get("v")
        if type(count) is not int or count<0:
            return False
        summed+=count
        if summed>total:
            return False
    return True


def _time(s):
    try:
        value=dt.datetime.fromisoformat(str(s).replace("Z","+00:00"))
    except (ValueError,TypeError) as err:
        raise ValueError("Invalid authoritative provider time") from err
    if value.tzinfo is None:
        raise ValueError("Provider timestamp needs an offset")
    return value.astimezone(dt.timezone.utc)


def pulse(ledger, primary, now):
    if now.tzinfo is None:
        raise ValueError("Pulse requires an offset-aware clock")
    now=now.astimezone(dt.timezone.utc)
    if (not isinstance(ledger,dict) or
        ledger.get("status")!="SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE" or
        ledger.get("election")!="2026-11-03" or
        not isinstance(ledger.get("races"),list) or len(ledger["races"])!=506):
        raise ValueError("Invalid nationwide 506-race source identity ledger")
    poll_closes=state_poll_closings()
    identities=set()
    observed=Counter()
    sample_by_office={}
    as_of={}
    for office in EXPECTED:
        doc=primary.get(office)
        if doc is None:
            sample_by_office[office]=None
            continue
        # This does NOT authenticate an official state source; the existing
        # preflight validator must be applied first at ingestion.
        if (not isinstance(doc,dict) or doc.get("api")!=1 or
            doc.get("year")!=2026 or doc.get("office")!=office or
            not isinstance(doc.get("races"),dict) or
            len(doc["races"])>550 or
            doc.get("source") not in ("state","") or
            doc.get("counts",{}).get("races")!=len(doc["races"]) or
            doc.get("live") is True and doc.get("stale") is True):
            raise ValueError("Office provider snapshot inconsistent")
        sample_by_office[office]=doc["races"]
        if doc.get("as_of"):
            as_of[office]=_time(doc["as_of"])
            if as_of[office]>now+dt.timedelta(minutes=15):
                raise ValueError("Future source observation")
    seen_by_office=Counter()
    rows=[]
    for item in ledger["races"]:
        if not isinstance(item,dict):
            raise ValueError("Malformed individual source ledger entry")
        office,key=item.get("office"),item.get("key")
        identifier=item.get("id")
        if office not in EXPECTED or identifier!=office+"|"+str(key) or identifier in identities:
            raise ValueError("Duplicate/wrong ballot identity in nationwide source ledger")
        identities.add(identifier)
        seen_by_office[office]+=1
        status="OUTSIDE_PRIMARY_NOT_QUERIED"
        if item.get("provider_scope")==PRIMARY_SCOPE:
            races=sample_by_office.get(office)
            if races is None:
                status="PRIMARY_PROVIDER_UNAVAILABLE"
            elif key not in races:
                status="PRIMARY_RACE_ABSENT_NOT_ZERO"
            else:
                details=races[key]
                count=details.get("total") if isinstance(details,dict) else None
                if type(count) is not int or count<0 or details.get("called") is not False or details.get("winner"):
                    raise ValueError("Provider race unexpectedly invalid or called")
                if not valid_candidates(details,count):
                    status="PRIMARY_INVALID_CANDIDATE_ARITHMETIC"
                elif count==0:
                    status="PRIMARY_ZERO_REPORTED_NOT_ZERO_VOTES_CAST"
                elif office not in as_of:
                    status="PRIMARY_NO_RELIABLE_2026_UPDATE_TIME"
                elif key[:2] not in poll_closes:
                    raise ValueError("Unknown state in 506-race identity ledger")
                elif as_of[office]<poll_closes[key[:2]] or now<poll_closes[key[:2]]:
                    status="PRIMARY_SOURCE_BEFORE_STATE_POLL_CLOSE"
                elif now-as_of[office]>dt.timedelta(hours=3):
                    status="PRIMARY_REPORTED_BUT_STALE"
                else:
                    status="PRIMARY_OBSERVED_CANDIDATE_COUNTS_UNCALLED"
        elif item.get("source_identity_status")=="PINNED_PREVIOUSLY_VERIFIED_ID":
            status="SECONDARY_PIN_ONLY_NOT_QUERIED"
        elif item.get("source_identity_status")=="SCOPED_ADAPTER_NO_PINNED_ID":
            status="SECONDARY_SCOPED_NOT_QUERIED"
        else:
            status="NO_2026_MACHINE_SOURCE_IDENTITY"
        observed[(office,status)]+=1
        # The 35 Senate contests are always watchworthy. Keep the other
        # offices aggregated so diagnostics don't turn into a votes relay.
        if office=="Senate":
            rows.append({"race":identifier,"status":status})
    if dict(seen_by_office)!=EXPECTED:
        raise ValueError("Missing 435 House / 35 Senate / 36 governor source rows")
    return {
        "schema":"election-night-506-coverage-pulse-v1",
        "election":"2026-11-03",
        "checked_at":now.isoformat().replace("+00:00","Z"),
        "purpose":"PROVIDER_OBSERVATION_GAPS_NOT_CERTIFIED_NATIONWIDE_RESULTS",
        "professional_race_calls_verified":0,
        "independent_official_counts_verified":False,
        "may_update_election_forecast":False,
        "expected":{"house":435,"senate":35,"governor":36},
        "offices":{office:{"total":EXPECTED[office],
          "status_counts":{key:n for (o,key),n in sorted(observed.items()) if o==office}}
          for office in EXPECTED},
        "senate":rows,
    }
