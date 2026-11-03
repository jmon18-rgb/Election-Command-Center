"""Resolve the declared source-check slot independently of runner queue delay."""

from datetime import datetime, timezone
import os
from pathlib import Path


HOURLY_SCHEDULE = "11 * * 10,11 *"
SUPPLEMENTAL_SCHEDULE = "41 * * 10,11 *"


def resolve_window(event_name, schedule, now):
    if event_name not in {"schedule", "push", "workflow_dispatch"}:
        raise ValueError("Unknown source-preflight event")
    if now.tzinfo is None:
        raise ValueError("Source-preflight clock must include a timezone")
    now = now.astimezone(timezone.utc)
    scheduled = event_name == "schedule"
    if scheduled and schedule not in {HOURLY_SCHEDULE, SUPPLEMENTAL_SCHEDULE}:
        raise ValueError("Unknown source-preflight schedule; no requests authorized")
    supplemental = scheduled and schedule == SUPPLEMENTAL_SCHEDULE
    stamp = now.strftime("%Y%m%d")
    counting = (stamp == "20261103" and now.hour >= 23) or (
        stamp == "20261104" and now.hour < 12
    )
    run = not scheduled or stamp <= "20261104"
    if supplemental and not counting:
        run = False
    baseline = not supplemental and not (
        scheduled and stamp not in {"20261103", "20261104"} and now.hour % 4 != 0
    )
    return {"run": run, "baseline": baseline, "supplemental": supplemental}


def main():
    policy = resolve_window(
        os.environ["SOURCE_PREFLIGHT_EVENT"],
        os.environ.get("SOURCE_PREFLIGHT_SCHEDULE", ""),
        datetime.now(timezone.utc),
    )
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as output:
        for key in ("run", "baseline"):
            output.write(f"{key}={str(policy[key]).lower()}\n")
    if policy["supplemental"] and not policy["run"]:
        print("Skipping extra half-hour source check outside active counting")
    elif policy["supplemental"]:
        print("Election Night additional 30-minute identity-only House gap check")
    elif not policy["run"]:
        print("Automated 2026 preflight ended after November 4; manual checks remain available.")
    else:
        print("Source-preflight slot resolved from event schedule, independently of queue delay")


if __name__ == "__main__":
    main()
