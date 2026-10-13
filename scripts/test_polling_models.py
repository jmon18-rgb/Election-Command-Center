#!/usr/bin/env python3
"""Walk-forward comparison of descriptive polling-average methods.

Target is the next published poll margin, NOT the election result. No future polls
are used to compute a prediction. Tests compare equal weights, 21-day recency
half-life, and recency plus sqrt(sample size) weighting. This is a diagnostic,
not a validated election forecasting model.
"""
import json
import math
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "polls.json"
OUTPUT = ROOT / "data" / "model_tests.json"
METHODS = ("equal", "recency", "recency_size")


def valid(p):
    names = (p.get("dem_name") or "") + " " + (p.get("rep_name") or "")
    return (isinstance(p.get("margin"), (int, float))
            and math.isfinite(p["margin"])
            and p.get("field_end") and p.get("pollster")
            and p.get("dem_name") and p.get("rep_name")
            and "generic" not in names.lower()
            and not p.get("partisan_lean"))


def estimate(past, target_date, method):
    seen = set()
    total, weighted = 0.0, 0.0
    for p in reversed(past):
        if p["pollster"].lower() in seen:
            continue
        seen.add(p["pollster"].lower())
        age = (target_date - date.fromisoformat(p["field_end"])).days
        if age < 0:
            raise ValueError("Lookahead detected")
        w = 1.0 if method == "equal" else 0.5 ** (age / 21)
        if method == "recency_size":
            n = p.get("sample_size")
            n = n if isinstance(n, (int, float)) and n > 0 else 600
            w *= math.sqrt(max(200, min(3000, n)) / 600)
        total += w
        weighted += w * p["margin"]
    return weighted / total if total else None


def run(data):
    errors = defaultdict(list)
    groups = 0
    for race in data.get("races", []):
        matchups = defaultdict(list)
        for p in race.get("polls", []):
            if valid(p):
                matchups[(p["dem_name"].lower(), p["rep_name"].lower())].append(p)
        for polls in matchups.values():
            polls.sort(key=lambda p: p["field_end"])
            if len(polls) < 3:
                continue
            groups += 1
            for i in range(2, len(polls)):
                target = polls[i]
                earlier = [p for p in polls[max(0, i - 8):i]
                           if p["field_end"] < target["field_end"]]
                if len(earlier) < 2:
                    continue
                target_date = date.fromisoformat(target["field_end"])
                for method in METHODS:
                    prediction = estimate(earlier, target_date, method)
                    if prediction is not None:
                        errors[method].append(prediction - target["margin"])
    results = {}
    for method in METHODS:
        es = errors[method]
        results[method] = {
            "comparisons": len(es),
            "mae_points": round(sum(abs(e) for e in es) / len(es), 3) if es else None,
            "rmse_points": round(math.sqrt(sum(e * e for e in es) / len(es)), 3) if es else None,
        }
    return {
        "source_poll_snapshot": data.get("updated_at"),
        "test": "Walk-forward next-poll margin comparison",
        "matchup_groups_with_three_or_more_polls": groups,
        "methods": results,
        "limitations": [
            "Predicting a subsequent poll is not the same as predicting an election outcome.",
            "Polls from the same firm, sponsor, or race may have correlated errors.",
            "The dataset retains only a bounded recent poll history per race.",
            "Differences of a few hundredths of a point do not establish model superiority.",
            "No confidence intervals or election win probabilities are estimated.",
        ],
    }


if __name__ == "__main__":
    data = json.loads(INPUT.read_text(encoding="utf-8"))
    result = run(data)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
