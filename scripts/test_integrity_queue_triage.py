#!/usr/bin/env python3
"""Only fabricated news examples. Never reinterpret a headline as a voter harm."""
import copy as deep_copy
import datetime as dt
import hashlib
import io
import json
import tempfile
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
import update_integrity_queue as queue
from update_integrity_queue import STATES,title_words,triage,select_queue_items
assert len(set(STATES.values()))==50, "All 50 states should be classifiable"
assert STATES["California"]=="CA" and STATES["New York"]=="NY"
def article(num,title,state,status="needs_primary_source",topic="registration"):
    return {"id":f"example-{num}","title":title,"publisher":f"News {num}",
            "published_at":"2026-10-15T18:00:00Z","review_status":status,
            "state_hints":[state],"topic_hints":[topic],
            "headline_numbers_unverified":["500000 voters"]}
data=[
 article(1,"California election office delays registration mailing","CA"),
 article(2,"California election office delays registration mailing - Another paper","CA"),
 article(3,"Nevada election office delays registration mailing","NV"),
 article(4,"California election office delays registration mailing","CA","primary_source_checked"),
 article(5,"California another unrelated registration issue emerges","CA")
]
copy=[dict(x) for x in data]
metrics,groups=triage(data)
assert metrics["total_leads"]==5
assert metrics["awaiting_primary_source"]==4
assert metrics["primary_source_checked"]==1
assert metrics["advisory_related_headline_buckets"]==1
assert len(groups)==1 and groups[0]["possibly_related_articles"]==2
assert groups[0]["distinct_publishers"]==2
assert groups[0]["review_status"]=="advisory_overlap_only_not_independently_verified"
assert groups[0]["state_hints"]==["CA"]
assert data==copy,"Triage must not mutate a source item, review status or impact count"
assert title_words("California ballot deadline") != title_words("Nevada ballot deadline")
assert triage([])[0]["total_leads"]==0

# Real turnover mechanics with fabricated articles: seventy newer headlines
# must not displace ten older human decisions from the 250-row window.
def lead(num,checked=False):
    title=f"California election registration fixture {num}"
    url=f"https://example.invalid/queue-fixture/{'checked' if checked else 'pending'}/{num}"
    item={"id":hashlib.sha256((url+"|"+title.lower()).encode()).hexdigest()[:20],
        "title":title,"url":url,"publisher":"Fabricated example",
        "published_at":(dt.datetime(2026,9 if checked else 10,1,tzinfo=dt.timezone.utc)+dt.timedelta(minutes=num)).isoformat().replace("+00:00","Z"),
        "detected_at":"2026-10-01T00:00:00Z","state_hints":["CA"],
        "topic_hints":["registration"],"headline_numbers_unverified":["500000 voters"],
        "review_status":"primary_source_checked" if checked else "needs_primary_source",
        "primary_sources":[],"impact_counts_verified":False,"promoted_to_incident_id":None}
    if checked:
        item.update(primary_sources=[{"publisher":"Fictional source", "url":url+"/source",
            "limits":{"whole_election_verified":False}}],
            review_notes="Fabricated review; no voter impact verified.",reviewed_as_of="2026-10-02",
            promoted_to_incident_id="fixture-existing-pointer-"+str(num),
            extra_review_field={"unchanged":[num,False,None]})
    return item

checked=[lead(n,True) for n in range(10)]
pending=[lead(n) for n in range(240)]
prior_items=pending+checked
prior_copy=deep_copy.deepcopy(prior_items)
fresh=[{"title":f"California election registration new fixture {n}",
    "url":f"https://example.invalid/new-fixture/{n}","source":"Fabricated new example",
    "published_at":(dt.datetime(2026,11,1,tzinfo=dt.timezone.utc)+dt.timedelta(minutes=n)).isoformat().replace("+00:00","Z")}
    for n in range(70)]
repeat={"title":checked[0]["title"],"url":checked[0]["url"],
    "source":"Changed feed attribution must not overwrite review", "published_at":"2026-11-02T00:00:00Z"}
with tempfile.TemporaryDirectory() as temporary:
    fixture_root=Path(temporary)
    fixture_brief=fixture_root/"briefing.json"
    fixture_queue=fixture_root/"queue.json"
    fixture_brief.write_text(json.dumps({"security":fresh+[repeat]}),encoding="utf-8")
    fixture_queue.write_text(json.dumps({"items":prior_items}),encoding="utf-8")
    with patch.object(queue,"BRIEF",fixture_brief),patch.object(queue,"QUEUE",fixture_queue),redirect_stdout(io.StringIO()):
        queue.main()
    result=json.loads(fixture_queue.read_text(encoding="utf-8"))
    assert len(result["items"])==250 and result["new_leads"]==70
    assert result["review_metrics"]["primary_source_checked"]==10
    assert result["review_metrics"]["awaiting_primary_source"]==240
    by_id={item["id"]:item for item in result["items"]}
    assert all(by_id[item["id"]]==item for item in checked),"Turnover must preserve every original human field and nested source limit"
    retained_pending=[item for item in result["items"] if item["id"] in {old["id"] for old in pending}]
    assert retained_pending==list(reversed(pending[70:])),"Keep the newest 170 prior pending rows after seventy new leads"
    assert result["items"][-10:]==list(reversed(checked)),"Older decisions retain descending publication order"
    assert all(item["review_status"]=="needs_primary_source" and item["primary_sources"]==[]
        and item["impact_counts_verified"] is False and item["promoted_to_incident_id"] is None
        for item in result["items"] if item["id"] not in {old["id"] for old in prior_items}),"New headlines remain unverified leads"
    expected_metrics,expected_groups=triage(result["items"])
    assert (result["review_metrics"],result["advisory_related_headlines"])==(expected_metrics,expected_groups)
assert prior_items==prior_copy,"Selection and producer turnover must not mutate supplied review objects"

# A human note/source or a different manual status also reserves its row.
# Retention never changes that status or copies its claims into other items.
manual_variants=[{"review_status":"reviewed_no_action"}, {"review_notes":""},
    {"reviewed_as_of":"2026-10-02"}, {"primary_sources":[{"publisher":"Fixture","url":"https://example.invalid/source"}]},
    {"impact_counts_verified":True}, {"promoted_to_incident_id":"fixture-only"}, {"review_status":None}]
manual=[]
for n,fields in enumerate(manual_variants):
    item=lead(1000+n);item["published_at"]="2026-01-01T00:00:00Z";item.update(fields);manual.append(item)
mixed=pending+[lead(2000+n) for n in range(20)]+manual
mixed_before=deep_copy.deepcopy(mixed)
selected=select_queue_items(mixed)
assert len(selected)==250
assert all(any(item is source for item in selected) for source in manual)
assert mixed==mixed_before,"Manual retention cannot alter status, impact flags, notes or source fields"
ties=[lead(3000+n) for n in range(253)]
for item in ties:item["published_at"]="2026-10-01T00:00:00Z"
assert select_queue_items(ties)==ties[:250],"Equal publication clocks keep their original stable order"
assert select_queue_items([])==[]
assert select_queue_items(checked)==list(reversed(checked))
assert len(select_queue_items([lead(n,True) for n in range(250)]))==250

# Exercise main(), not only the selector: overflow must leave the destination
# bytes untouched, including its formatting, while surfacing a real failure.
with tempfile.TemporaryDirectory() as temporary:
    fixture_root=Path(temporary)
    fixture_brief=fixture_root/"briefing.json"
    fixture_queue=fixture_root/"queue.json"
    fixture_brief.write_text(json.dumps({"security":fresh[:1]}),encoding="utf-8")
    before_bytes=(json.dumps({"items":[lead(n,True) for n in range(251)]},indent=1)+"\n").encode("utf-8")
    fixture_queue.write_bytes(before_bytes)
    with patch.object(queue,"BRIEF",fixture_brief),patch.object(queue,"QUEUE",fixture_queue),redirect_stdout(io.StringIO()):
        try:queue.main()
        except ValueError as error:assert "more than 250 reviewed leads" in str(error)
        else:raise AssertionError("Reviewed overflow must fail, not discard a decision or enlarge the window")
    assert fixture_queue.read_bytes()==before_bytes,"Overflow must fail before any destination write"
print("Integrity lead triage PASS: fifty-state hints, conservative related headlines, no automatic claim promotion")
print("Integrity queue retention PASS: >250 turnover, exact human decisions, newest pending, stable clocks, overflow leaves bytes untouched")
