#!/usr/bin/env python3
"""Attribute and validate an external JOINT House/Senate model forecast.

DDHQ supplies actual same-draw control-outcome forecasts. JackStradamus does
NOT yet have geographically complete calibrated model inputs; do not claim
DDHQ probabilities are calculated from our polling means. Blue Tsunami is
not published as a distinct probability by DDHQ. Keep that cell null.
"""
import datetime as dt
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE="https://votes.decisiondeskhq.com/forecast/2026"
OUTPUT=ROOT/"data/congress_scenarios.json"
NAMES={
  "both_dem":r"DEM\s+Senate\s+and\s+DEM\s+House",
  "senate_only":r"DEM\s+Senate\s+and\s+GOP\s+House",
  "house_only":r"GOP\s+Senate\s+and\s+DEM\s+House",
  "both_rep":r"GOP\s+Senate\s+and\s+GOP\s+House",
}
class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sections=[];self.ignore=0
    def handle_starttag(self,tag,attrs):
        if tag in ("script","style","noscript","svg"):self.ignore+=1
    def handle_endtag(self,tag):
        if tag in ("script","style","noscript","svg") and self.ignore:self.ignore-=1
    def handle_data(self,data):
        if not self.ignore and data.strip():self.sections.append(data.strip())

def parse(html,clock=None):
    if not isinstance(html,str) or len(html)<1000:raise ValueError("HTML page too short")
    collector=VisibleText()
    collector.feed(html)
    # Separate tags with spaces to prevent '54.0%' attaching to next heading.
    text=" ".join(collector.sections)
    if "2026 Election Forecast Overview" not in text:
        raise ValueError("Unrecognized DDHQ 2026 forecast overview page")
    values={}
    for key,label in NAMES.items():
        pattern=rf"{label}\s+(\d{{1,3}}(?:\.\d+)?)\s*%"
        found=re.findall(pattern,text,flags=re.IGNORECASE)
        if len(found)!=1:raise ValueError(f"Missing/duplicate DDHQ joint-outcome field {key}: {found}")
        val=float(found[0])
        if not 0<=val<=100:raise ValueError("Invalid probability")
        values[key]=val
    total=sum(values.values())
    if not 97.5<=total<=102.5:
        raise ValueError(f"Joint forecast sums to {total}% (not a plausible rounding total)")
    match=re.search(r"Last updated\s+([A-Za-z]{3,9}\s+\d{1,2},?\s*\d{1,2}:\d{2}\s*[AP]M)",text,re.I)
    if not match:raise ValueError("DDHQ last-updated timestamp missing")
    now=(clock or dt.datetime.now(dt.timezone.utc))
    field=match.group(1).replace(",","")
    date=dt.datetime.strptime(field+f" {now.year}","%b %d %I:%M %p %Y")
    # DDHQ site displays a wall clock with unspecified zone.
    # A current cycle source should not go backwards by more than 5 days
    # without showing an explicit stale status in the dashboard.
    updated=date.date()
    if updated > now.date()+dt.timedelta(days=1):
        date=date.replace(year=now.year-1)
    if date.year!=2026:raise ValueError("Wrong election/model year")
    # Prefer the provider's separately displayed chamber marginals. Adding
    # already-rounded joint outcomes can disagree by 1 percentage point.
    def find_marginal(chamber):
        pat=rf"{chamber}\s+Control\s+Democrats\s+(\d{{1,3}}(?:\.\d+)?)\s*%"
        matches=re.findall(pat,text,flags=re.I)
        if len(matches)!=1:raise ValueError(f"Cannot validate DDHQ {chamber} marginal: {matches}")
        n=float(matches[0])
        if not 0<=n<=100:raise ValueError("Invalid DDHQ control marginal")
        return n
    house_dem=find_marginal("House")
    senate_dem=find_marginal("Senate")
    if abs(house_dem-(values["both_dem"]+values["house_only"]))>2 or abs(senate_dem-(values["both_dem"]+values["senate_only"]))>2:
        raise ValueError("Published marginals contradict joint outcome cells")
    return {"source_displayed_updated":date.strftime("%Y-%m-%d %I:%M %p"),
      "source_date":date.date().isoformat(),"joint":values,
      "house_dem_control":house_dem,"senate_dem_control":senate_dem,
      "rounded_sum":total}

def fetch():
    request=urllib.request.Request(SOURCE,headers={"User-Agent":"InSearchOfBlueWaves/1.0 educational dashboard",
      "Accept":"text/html,*/*"})
    with urllib.request.urlopen(request,timeout=32) as response:
        raw=response.read(2_500_000)
    return raw.decode("utf-8","replace")

def make(parsed,when=None):
    when=when or dt.datetime.now(dt.timezone.utc)
    values=parsed["joint"]
    return {"status":"external_model_attributed_not_jackstradamus_probabilities",
        "generated_at":when.isoformat(),
        "model":"Decision Desk HQ 2026 joint congressional forecast",
        "source_url":SOURCE,
        "source_updated_display":parsed["source_displayed_updated"],
        "source_updated_date":parsed["source_date"],
        "source_timestamp_timezone":"unpublished by provider",
        "raw_joint_outcomes_pct":values,
        "display_outcomes":{
          "red_dawn":{"pct":values["both_rep"],"definition":"Republicans control both chambers"},
          "shrug":{"pct":values["house_only"]+values["senate_only"],
                   "definition":"Democrats control exactly one chamber"},
          "blue_both":{"pct":values["both_dem"],
                   "definition":"Democrats control both chambers, INCLUDING any tsunami"},
          "blue_tsunami":{"pct":None,
                   "definition":"Democrats control both and win ≥90% of a predeclared competitive slate",
                   "reason":"Unavailable: no conditional near-sweep probability in published joint DDHQ model"}
        },
        "house_dem_control_pct":parsed["house_dem_control"],
        "senate_dem_control_pct":parsed["senate_dem_control"],
        "rounding_total_pct":parsed["rounded_sum"],
        "source_as_of_2026":True,
        "limitations":[
          "These are DDHQ's published joint chamber-control probabilities, not JackStradamus model outputs.",
          "BLUE WAVE (both chambers) includes BLUE TSUNAMI; a separate tsunami percentage is unavailable, NOT zero.",
          "Three displayed buckets are mutually exclusive and may sum to 99% or 101% due to original provider rounding.",
          "DDHQ's source last-updated time has no advertised timezone and is preserved as a provider wall-clock value.",
          "Do not invent a tsunami split from marginal seat-control probabilities or treat independent chamber probabilities as joint."
        ]}

def validate(doc):
    assert doc["status"]=="external_model_attributed_not_jackstradamus_probabilities"
    assert doc["display_outcomes"]["blue_tsunami"]["pct"] is None
    j=doc["raw_joint_outcomes_pct"]
    assert 97.5<=sum(j.values())<=102.5
    assert doc["display_outcomes"]["blue_both"]["pct"]==j["both_dem"]
    assert doc["display_outcomes"]["shrug"]["pct"]==j["senate_only"]+j["house_only"]
    assert doc["display_outcomes"]["red_dawn"]["pct"]==j["both_rep"]
    assert abs(doc["house_dem_control_pct"]-(j["both_dem"]+j["house_only"]))<=2
    assert abs(doc["senate_dem_control_pct"]-(j["both_dem"]+j["senate_only"]))<=2

def main():
    parsed=parse(fetch())
    now=dt.datetime.now(dt.timezone.utc)
    age=(now.date()-dt.date.fromisoformat(parsed["source_date"])).days
    if age<0 or age>7:raise ValueError(f"DDHQ source model is {age} days old; refuse silent stale data")
    out=make(parsed,now)
    validate(out)
    OUTPUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("DDHQ source",parsed["source_date"],"joint probabilities",parsed["joint"],
          "rounding total",parsed["rounded_sum"],"Tsunami unavailable (null)")
if __name__=="__main__":main()
