"""Deterministic selection of one qualifying wave per polling firm.

The source feed can contain multiple distinct studies by one firm with the
same field-end date. Neither input row order nor which party leads may
determine which is represented. Release/first-seen dates are not reliable
fields in the 2026 curated feed, so they are *never* tie-breakers here.
"""
from collections import defaultdict
import math


def wave_priority(p):
    population = str(p.get("sample_population") or "").strip().casefold()
    pop_rank = {"lv": 3, "likely voters": 3, "likely_voters": 3,
                "rv": 2, "registered voters": 2, "registered_voters": 2,
                "a": 1, "adults": 1}.get(population, 0)
    n = p.get("sample_size")
    n = float(n) if isinstance(n, (int, float)) and math.isfinite(n) and n > 0 else 0.0
    return pop_rank, n


def select_latest_firm_waves(polls):
    """Return (selected polls, decision audit) in stable firm-name order.

    Prefer newest field end first, LV ahead of RV/adults, then the larger
    sample within the same firm/date/population. A tie in those meaningful
    priorities with conflicting answers is quarantined, not resolved by
    a hash, ingestion timestamp, party or a randomly changing row order.
    Distinct survey IDs remain visible in raw Poll Wire.
    """
    grouped = defaultdict(list)
    for p in polls:
        firm = str(p.get("pollster") or "").strip().casefold()
        if firm:
            grouped[firm].append(p)
    chosen = []
    ties, quarantined = [], []
    for firm in sorted(grouped):
        rows = grouped[firm]
        newest = max(p["field_end"] for p in rows)
        current = [p for p in rows if p["field_end"] == newest]
        best = max(wave_priority(p) for p in current)
        finalists = [p for p in current if wave_priority(p) == best]
        signatures = {(p.get("dem"), p.get("rep"),
                       str(p.get("dem_name") or "").casefold(),
                       str(p.get("rep_name") or "").casefold()) for p in finalists}
        if len(signatures) > 1:
            quarantined.append({"firm": firm, "field_end": newest,
                                "poll_ids": sorted(str(p.get("poll_id") or "") for p in finalists),
                                "reason": "same_priority_conflicting_answers"})
            continue
        # Identical candidate shares are harmless; choose source identity
        # reproducibly and keep only one modeled wave from this firm.
        selected = sorted(finalists, key=lambda p: (
            str(p.get("poll_id") or ""), str(p.get("question_id") or ""),
            str(p.get("source_poll_url") or "")))[0]
        chosen.append(selected)
        if len(current) > 1:
            ties.append({
                "firm": firm, "field_end": newest,
                "selected_poll_id": selected.get("poll_id"),
                "selected_population": selected.get("sample_population"),
                "selected_sample_size": selected.get("sample_size"),
                "excluded_poll_ids": sorted(str(p.get("poll_id") or "")
                                            for p in current if p is not selected),
                "selection_rule": "same_field_end_LV_then_sample_size"
            })
    return chosen, {"resolved_same_day_ties": ties,
                    "quarantined_same_day_firms": quarantined}
