#!/usr/bin/env python3
"""Only fabricated news examples. Never reinterpret a headline as a voter harm."""
from update_integrity_queue import STATES,title_words,triage
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
print("Integrity lead triage PASS: fifty-state hints, conservative related headlines, no automatic claim promotion")
