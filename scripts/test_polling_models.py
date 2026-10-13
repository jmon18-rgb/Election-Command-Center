#!/usr/bin/env python3
"""Candidate-specific, leakage-free walk-forward polling-model evaluation.

Predicts subsequent polls (not election outcomes). Evaluation is grouped by
race/matchup so repeat observations don't masquerade as independent tests.
A model is eligible for publication only after historical election-result
backtesting and uncertainty calibration.
"""
import json
import math
import random
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "polls.json"
OUT = ROOT / "data" / "model_tests.json"
QUALITY_DATA=json.loads((ROOT/"data/pollster_quality.json").read_text(encoding="utf-8"))
QUALITY={k.casefold():v for k,v in QUALITY_DATA["entries"].items()}
EXCLUSIONS={k.casefold() for k in QUALITY_DATA.get("explicit_exclusions",{})}
METHODS = ("equal", "recency21", "recency21_size", "recency35_size", "recency21_sponsored_0", "recency21_sponsored_25", "recency21_sponsored_50", "recency21_sponsored_100", "recency21_sponsored_50_quality", "recency21_sponsored_50_quality_size", "recency21_sponsored_50_quality_size_bias17", "recency21_sponsored_50_quality_size_recency14", "recency21_silver_quality_size", "recency21_silver_quality_size_bias50", "recency21_silver_quality_size_bias100")
RNG_SEED = 20261012

# Independently sourced Silver Bulletin January 2026 ratings. This is a
# research-only benchmark until election-outcome validation and alias review.
STAGED = ROOT / "data/silver_ratings_staging.json"
SILVER = {}
if STAGED.exists():
    staged=json.loads(STAGED.read_text(encoding="utf-8"))
    if staged.get("status")=="staged_not_used_in_live_model" and staged.get("matched_to_older_538_aliases",0)>=20:
        entries=staged.get("entries",{})
        for alias,name in staged.get("matches",{}).items():
            key=" ".join(name.casefold().replace("&","and").split())
            match=entries.get(key) or entries.get(name.casefold())
            if match:
                SILVER[alias.casefold()]=match
        for entry in entries.values():
            SILVER.setdefault(entry["pollster"].casefold(),entry)

def silver_terms(p):
    record=SILVER.get(p["pollster"].casefold())
    if not record:
        return 1.0,0.0
    try:
        pm=float(record["predictive_plus_minus_raw"])
        bias=float(record["mean_reverted_bias_raw"])
        history=float(record.get("history_count_raw") or 0)
    except (KeyError,ValueError,TypeError):
        return 1.0,0.0
    if not math.isfinite(pm) or not math.isfinite(bias):
        return 1.0,0.0
    shrink=min(1.0,max(0.0,history)/20.0)
    quality=max(.65,min(1.5,math.exp(-0.12*pm*shrink)))
    return quality, bias



def eligible(p):
    try:
        names = (p["dem_name"] + " " + p["rep_name"]).lower()
        return ("generic" not in names and p["pollster"].casefold() not in EXCLUSIONS
                and math.isfinite(float(p["margin"])) and p.get("pollster")
                and p.get("field_end") and date.fromisoformat(p["field_end"]))
    except (KeyError, ValueError, TypeError):
        return False


def predict(prior, asof, method):
    # All polls on the target field-end date are withheld, including
    # alternative releases from the same polling organization.
    assert all(date.fromisoformat(p["field_end"]) < asof for p in prior)
    unique = {}
    for p in sorted(prior, key=lambda x: x["field_end"], reverse=True):
        firm = p["pollster"].strip().lower()
        if firm not in unique:
            unique[firm] = p
    total = weighted = 0.0
    for p in unique.values():
        age = (asof - date.fromisoformat(p["field_end"])).days
        half_life = 14 if method.endswith("_recency14") else 35 if method == "recency35_size" else 21
        weight = 1.0 if method == "equal" else 0.5 ** (age / half_life)
        sponsor_factor = {"recency21_sponsored_0": 0, "recency21_sponsored_25": .25,
                          "recency21_sponsored_50": .5, "recency21_sponsored_100": 1.0}
        if p.get("partisan_lean"):
            if method.startswith("recency21_sponsored_50_quality") or method.startswith("recency21_silver_"):
                weight *= .5
            elif method in sponsor_factor:
                weight *= sponsor_factor[method]
            else:
                continue
        if "_quality" in method and "silver" not in method:
            rated=QUALITY.get(p["pollster"].casefold())
            if rated:
                shrunk=2+(rated["rating"]-2)*min(1,rated["history_count"]/20)
                weight *= 1+0.25*(shrunk-2)
        if "_quality_size" in method:
            n=p.get("sample_size")
            if isinstance(n,(int,float)) and n>0:
                weight *= (max(300,min(2500,n))/800)**0.20
        elif method.endswith("_size"):
            n = p.get("sample_size") or 600
            weight *= math.sqrt(max(200, min(float(n), 3000)) / 600)
        margin=float(p["margin"])
        if "silver" in method:
            multiplier,bias=silver_terms(p)
            weight*=multiplier
            if method.endswith("_bias50"):margin-=.5*bias
            if method.endswith("_bias100"):margin-=bias
        if method.endswith("_bias17") and p.get("partisan_lean") in ("D","R"):
            # EXPERIMENT ONLY: an a-priori sponsor-aligned 1.7pt margin correction,
            # from Silver's published generic-ballot methodology. Do not promote
            # without a held-out election-results evaluation.
            margin -= 1.7 if p["partisan_lean"]=="D" else -1.7
        weighted += weight * margin
        total += weight
    return weighted / total if total else None


def grouped_tests(data):
    grouped = defaultdict(list)
    for race in data.get("races", []):
        for p in race.get("polls", []):
            if eligible(p):
                key = (race["race_code"], p["dem_name"].strip().lower(),
                       p["rep_name"].strip().lower())
                grouped[key].append(p)
    observations = defaultdict(list)
    eligible_groups = 0
    for key, polls in grouped.items():
        dates = sorted(set(p["field_end"] for p in polls))
        if len(dates) < 3:
            continue
        eligible_groups += 1
        for target_day in dates[2:]:
            asof = date.fromisoformat(target_day)
            past = [p for p in polls if p["field_end"] < target_day
                    and (asof - date.fromisoformat(p["field_end"])).days <= 90]
            # All methods must be evaluated on the same targets, including
            # those that exclude sponsored polls. Avoid different sample sizes.
            if len(set(p["pollster"].lower() for p in past if not p.get("partisan_lean"))) < 2:
                continue
            # Hold out independent surveys only: a partisan target may reflect sponsor selection.
            targets = [p for p in polls if p["field_end"] == target_day and not p.get("partisan_lean")]
            if not targets:
                continue
            # Same-day polls are evaluated together, not as separate time steps.
            actual = sum(float(p["margin"]) for p in targets) / len(targets)
            for method in METHODS:
                estimate = predict(past, asof, method)
                if estimate is not None:
                    observations[method].append((key, estimate - actual))
    return observations, eligible_groups


def summarize(observations, nboot=1000):
    output = {}
    rng = random.Random(RNG_SEED)
    for method, values in observations.items():
        by_race = defaultdict(list)
        for key, error in values:
            by_race[key].append(error)
        keys = sorted(by_race)
        if not values:
            continue
        errors = [e for _, e in values]
        maes = []
        # Cluster bootstrap resamples matchups, not individual observations.
        for _ in range(nboot):
            sample = [rng.choice(keys) for _ in keys]
            es = [e for key in sample for e in by_race[key]]
            maes.append(sum(abs(e) for e in es) / len(es))
        maes.sort()
        output[method] = {
            "comparisons": len(errors),
            "independent_matchup_clusters": len(keys),
            "mae_points": round(sum(abs(e) for e in errors) / len(errors), 3),
            "rmse_points": round(math.sqrt(sum(e * e for e in errors) / len(errors)), 3),
            "cluster_bootstrap_mae_95pct_range": [
                round(maes[int(.025 * nboot)], 3),
                round(maes[int(.975 * nboot) - 1], 3),
            ],
        }
    return output


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    observations, groups = grouped_tests(data)
    results = summarize(observations)
    # Every weighting strategy must see the same held-out target observations.
    sample_sizes={v["comparisons"] for v in results.values()}
    assert len(sample_sizes)<=1, f"Incomparable model test samples: {sample_sizes}"
    winner = min(results, key=lambda k: results[k]["mae_points"]) if results else None
    output = {
        "source_snapshot": data.get("updated_at"),
        "test": "Strict walk-forward, held-out next poll, grouped by candidate matchup",
        "eligible_matchup_groups": groups,
        "methods": results,
        "lowest_observed_mae": winner,
        "production_model_status": "NOT VALIDATED FOR ELECTION-RESULT FORECASTING",
        "model_selection_policy": "No model is promoted from this test. Require historical election-result holdout validation, calibration, and correlated error assessment.",
        "limitations": [
            "Targets are future polls, not actual election results.",
            "Short rolling upstream history can bias which races are testable.",
            "Within-race and cross-race systematic polling errors remain.",
            "Bootstrap interval describes evaluation metric variability, not a race forecast confidence interval.",
            "No win probabilities, calibrated pollster house effects or election-security adjustments inferred.",
            "Sponsored-poll weight factors are experimental; target surveys remain non-sponsored only.",
            "Pollster quality comes from 538 archived pre-2026 grades, not an updated Silver Bulletin 2026 recalibration.",
            "Test currently compares future independent polls, and overfitting to this cycle must be avoided.",
            "January 2026 Silver Bulletin plus-minus and signed bias tests are experimental and do not alter live polling estimates; 2026 rolling next-poll tests are not final-outcome validation.",
            "Alternative half-lives and the Silver-inspired 1.7-point signed sponsor correction are test-only; no new coefficient is deployed on the live average.",
        ],
    }
    OUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
