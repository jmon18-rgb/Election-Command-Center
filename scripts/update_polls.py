#!/usr/bin/env python3
"""Update an attributed observation-only 2026 polling snapshot.
Source: NYT-derived public poll tables curated at ElectIndex (NYT data CC BY 4.0).
This is NOT a forecast. No win probabilities or confidence intervals are inferred.
"""
import csv
import datetime as dt
import io
import json
import math
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "polls.json"
UPSTREAM = "https://raw.githubusercontent.com/ElectIndex/26_us_forecast_data/main/"
TABLES = {
    "generic": UPSTREAM + "gcb_polls.csv",
    "races": UPSTREAM + "race_polls.csv",
}
TODAY = dt.datetime.now(dt.timezone.utc).date()
UTC_NOW = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
USER_AGENT = "ElectionCommandCenter/0.4 (noncommercial public polling observation tracker)"

def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/csv, text/plain"})
    with urllib.request.urlopen(req, timeout=35) as response:
        raw = response.read(3_000_000)
    text = raw.decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise ValueError("CSV returned no rows")
    return rows

def valid_date(s):
    try:
        value = dt.date.fromisoformat((s or "").strip()[:10])
        if dt.date(2026, 1, 1) <= value <= TODAY:
            return value
    except ValueError:
        pass
    return None

def percentage(s):
    try:
        n = float(s)
        return round(n, 2) if math.isfinite(n) and 0 <= n <= 100 else None
    except (ValueError, TypeError):
        return None

def size(s):
    try:
        n = int(float(s))
        return n if n > 0 else None
    except (ValueError, TypeError):
        return None

def known_lean(s):
    val = (s or "").strip().upper()
    return val if val in ("D", "R") else ""

def generic_ballot(rows):
    observations = []
    for r in rows:
        day = valid_date(r.get("end_date"))
        dem, rep = percentage(r.get("dem")), percentage(r.get("rep"))
        pollster = (r.get("pollster") or "").strip()
        if not day or dem is None or rep is None or not pollster:
            continue
        observations.append({
            "field_end": day.isoformat(), "pollster": pollster,
            "dem": dem, "rep": rep, "margin": round(dem - rep, 2),
            "sample_size": size(r.get("n")), "partisan_lean": known_lean(r.get("lean")),
        })
    observations.sort(key=lambda p: p["field_end"], reverse=True)
    # Mean is descriptive, not a predictive forecast. Exclude self-identified D/R
    # sponsored polls from the headline descriptive mean.
    eligible = [p for p in observations if not p["partisan_lean"]]
    chosen = []
    days = None
    for window in (14, 30):
        seen = set()
        sample = []
        for p in eligible:
            if (TODAY - dt.date.fromisoformat(p["field_end"])).days > window:
                continue
            key = p["pollster"].casefold()
            if key not in seen:
                seen.add(key)
                sample.append(p)
        if len(sample) >= 2:
            chosen, days = sample, window
            break
    aggregate = None
    if chosen:
        dem = sum(p["dem"] for p in chosen) / len(chosen)
        rep = sum(p["rep"] for p in chosen) / len(chosen)
        aggregate = {"dem": round(dem, 1), "rep": round(rep, 1),
                     "margin": round(dem-rep, 1), "pollsters": len(chosen),
                     "window_days": days, "latest_field_end": chosen[0]["field_end"],
                     "method": "Equal-weight mean of the latest nonpartisan wave per pollster within the stated field-end window; NOT a forecast or a statistical confidence interval."}
    return {"summary": aggregate, "latest": observations[:90],
            "source_url": TABLES["generic"], "attribution": "NYT polling data via ElectIndex (CC BY 4.0)"}

def race_polls(rows):
    grouped = {}
    for r in rows:
        day = valid_date(r.get("end_date"))
        code = (r.get("race_code") or "").strip().upper()
        pollster = (r.get("pollster") or "").strip()
        dem, rep = percentage(r.get("dem")), percentage(r.get("rep"))
        if not day or not code or not pollster or dem is None or rep is None:
            continue
        if (TODAY - day).days > 65:
            continue
        parts = code.split("-")
        if len(parts) != 2 or len(parts[0]) != 2 or not parts[0].isalpha():
            continue
        kind = "senate" if parts[1] == "SEN" else "governor" if parts[1] == "GOV" else "house"
        dem_name = (r.get("dem_name") or "").strip()
        rep_name = (r.get("rep_name") or "").strip()
        other = percentage(r.get("oth"))
        entry = {
            "poll_id": (r.get("poll_id") or "").strip(),
            "field_end": day.isoformat(), "pollster": pollster, "dem": dem,
            "rep": rep, "margin": round(dem - rep, 2),
            "sample_size": size(r.get("n")), "partisan_lean": known_lean(r.get("lean")),
            "dem_name": dem_name, "rep_name": rep_name,
            "other": other if other and other > 0 else None,
            "other_name": (r.get("oth_name") or "").strip() or None,
        }
        grouped.setdefault(code, []).append((kind, entry))
    results = []
    for code, pool in grouped.items():
        pool.sort(key=lambda pair: pair[1]["field_end"], reverse=True)
        unique = []
        seen = set()
        for _, p in pool:
            key = (p["poll_id"], p["dem_name"].casefold(), p["rep_name"].casefold())
            if key in seen:
                continue
            seen.add(key)
            unique.append(p)
            if len(unique) >= 60:
                break
        latest = unique[0]
        kind = pool[0][0]
        # Record every poll's exact pairing. Different matchups are never averaged.
        results.append({
            "race_code": code, "race_type": kind, "state": code[:2],
            "district": code.split("-", 1)[1], "latest_field_end": latest["field_end"],
            "latest": latest, "polls": unique, "recent_poll_count": len(unique),
            "source_url": TABLES["races"],
        })
    results.sort(key=lambda x: (x["latest_field_end"], x["recent_poll_count"]), reverse=True)
    return results

def observation_key(race, poll):
    return "|".join([race.get("race_code", ""), str(poll.get("poll_id") or ""),
                     poll.get("field_end", ""), poll.get("pollster", ""),
                     poll.get("dem_name", ""), poll.get("rep_name", ""),
                     str(poll.get("dem", "")), str(poll.get("rep", ""))])

def carry_forward_verified_supplemental(prior_races, new_races):
    """Keep previously ingested, attributed secondary polls through primary refresh.

    A delayed primary vendor must not make a new poll disappear from forecast
    inputs on the following scheduled update. Retain at most the original
    rolling model window and never override newer authoritative primary rows.
    """
    old = {r["race_code"]: r for r in prior_races or []}
    persisted = 0
    for race in new_races:
        previous = old.get(race["race_code"]) or {}
        latest_pair = next(((p.get("dem_name") or "").strip().casefold(),
                            (p.get("rep_name") or "").strip().casefold())
                           for p in race.get("polls", []) if p.get("dem_name")
                           and p.get("rep_name") and
                           "generic" not in (p["dem_name"] + " " + p["rep_name"]).casefold()), None)
        if not latest_pair:
            continue
        seen = {(p.get("poll_id"), p.get("dem_name", "").casefold(),
                 p.get("rep_name", "").casefold()) for p in race["polls"]}
        for p in previous.get("polls") or []:
            if p.get("source_provider") != "PollResults.org":
                continue
            try:
                age = (TODAY - dt.date.fromisoformat(p["field_end"])).days
                if not 0 <= age <= 45:
                    continue
            except (TypeError, ValueError, KeyError):
                continue
            key = (p.get("poll_id"), str(p.get("dem_name") or "").casefold(),
                   str(p.get("rep_name") or "").casefold())
            if key in seen or key[1:] != latest_pair:
                continue
            if not p.get("source_poll_url"):
                continue
            race["polls"].append(dict(p))
            seen.add(key)
            persisted += 1
        race["polls"].sort(key=lambda p: p["field_end"], reverse=True)
        race["polls"] = race["polls"][:60]
        race["latest"] = race["polls"][0]
        race["latest_field_end"] = race["latest"]["field_end"]
        race["recent_poll_count"] = len(race["polls"])
    return persisted


def stamp_poll_first_seen(prior_races, new_races, observed_at):
    """Preserve detection timestamps without pretending they're publication dates.

    On the first run using an old snapshot, existing polls are historical baseline
    with unknown first-seen time. Only a genuinely new poll gets observed_at.
    """
    old = {}
    for race in prior_races or []:
        for poll in race.get("polls", []):
            old[observation_key(race, poll)] = poll.get("first_seen_at")
    has_prior = bool(prior_races)
    count = 0
    for race in new_races:
        for poll in race.get("polls", []):
            key = observation_key(race, poll)
            if key in old:
                poll["first_seen_at"] = old[key]
            elif has_prior and (TODAY - dt.date.fromisoformat(poll["field_end"])).days <= 14:
                # Newly surfaced older archival polls aren't actual newly released surveys.
                poll["first_seen_at"] = observed_at
                count += 1
            else:
                poll["first_seen_at"] = None
            # Upstream CSV provides field-end dates, not public release dates.
            poll["release_date"] = poll.get("release_date") or None
        race["latest"] = race["polls"][0]
    return count

def build_changes(prior, result):
    """Only call a genuinely new poll a change; don't compare different race matchups."""
    old = set()
    for race in prior.get("races", []) or []:
        for poll in race.get("polls", []) or []:
            old.add(observation_key(race, poll))
    current = []
    for race in result.get("races", []) or []:
        for poll in race.get("polls", []) or []:
            key = observation_key(race, poll)
            if key not in old:
                current.append({
                    "race_code": race["race_code"], "race_type": race["race_type"],
                    "pollster": poll["pollster"], "field_end": poll["field_end"],
                    "dem": poll["dem"], "rep": poll["rep"], "margin": poll["margin"],
                    "dem_name": poll.get("dem_name"), "rep_name": poll.get("rep_name"),
                    "sample_size": poll.get("sample_size"),
                    "first_seen_at": poll.get("first_seen_at"),
                    "release_date": poll.get("release_date"),
                    "source_url": race.get("source_url"),
                })
    current.sort(key=lambda p: p["field_end"], reverse=True)
    previous_g = (prior.get("generic_ballot") or {}).get("summary")
    latest_g = (result.get("generic_ballot") or {}).get("summary")
    delta = None
    if previous_g and latest_g and previous_g.get("margin") is not None and latest_g.get("margin") is not None:
        delta = round(latest_g["margin"] - previous_g["margin"], 2)
    return {
        "new_polls": current[:35], "new_poll_count": len(current),
        "generic_margin_change": delta,
        "comparison_at": UTC_NOW,
        "previous_snapshot_at": prior.get("updated_at"),
        "method": "New observations compared with previous fetched snapshot; NOT a measure of electoral swing.",
    }

def update_history(prior, result):
    """Bounded history of distinct daily descriptive generic-ballot snapshots."""
    history = list(prior.get("generic_history") or [])
    summary = (result.get("generic_ballot") or {}).get("summary")
    if summary and summary.get("margin") is not None:
        item = {"date": TODAY.isoformat(), "margin": summary["margin"],
                "dem": summary["dem"], "rep": summary["rep"],
                "pollsters": summary["pollsters"]}
        if history and history[-1].get("date") == item["date"]:
            history[-1] = item
        else:
            history.append(item)
    return history[-120:]

def main():
    try:
        prior = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if not isinstance(prior, dict):
            prior = {}
    except (OSError, ValueError):
        prior = {}
    result = dict(prior)
    errors = []
    success = []
    for key, build in (("generic_ballot", generic_ballot), ("races", race_polls)):
        try:
            rows = fetch_csv(TABLES["generic" if key == "generic_ballot" else "races"])
            parsed = build(rows)
            if key == "races" and not parsed:
                raise ValueError("No current 2026 race polls parsed")
            if key == "generic_ballot" and not parsed["latest"]:
                raise ValueError("No current 2026 generic-ballot polls parsed")
            result[key] = parsed
            success.append(key)
        except Exception as exc:
            errors.append(f"{key}: {type(exc).__name__}: {exc}")
    if "races" in success:
        result["newly_detected_count"] = stamp_poll_first_seen(
            prior.get("races"), result["races"], UTC_NOW
        )
        result["carried_secondary_polls"] = carry_forward_verified_supplemental(
            prior.get("races"), result["races"])
    if "races" in success and prior.get("updated_at"):
        result["changes"] = build_changes(prior, result)
    else:
        result["changes"] = {"new_polls": [], "new_poll_count": 0, "comparison_at": UTC_NOW,
                             "previous_snapshot_at": prior.get("updated_at"),
                             "method": "No prior comparable successful race snapshot."}
    if "generic_ballot" in success:
        result["generic_history"] = update_history(prior, result)
    result["source"] = {
        "publisher": "New York Times polling data / ElectIndex curated tables",
        "license": "CC BY 4.0", "upstream": "https://github.com/ElectIndex/26_us_forecast_data",
        "data_urls": TABLES, "notes": "Descriptive poll observations only; release timestamps aren't supplied by these CSVs. First-seen timestamps are collection times, not official publication dates. Race observations retained up to 60 per race over a rolling 65 days.",
    }
    result["health"] = {"last_attempt_at": UTC_NOW, "successful_sections": success,
                        "errors": errors, "status": "ok" if len(success) == 2 else "partial" if success else "error"}
    if success:
        result["updated_at"] = UTC_NOW
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Sections updated: {success}; race entries: {len(result.get('races', []))}")
    for err in errors:
        print(err, file=sys.stderr)
    if not success:
        sys.exit("All polling sources failed; kept previous validated snapshot.")

if __name__ == "__main__":
    main()
