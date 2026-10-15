#!/usr/bin/env python3
"""Queue election-integrity news leads for human source verification.

Never converts a headline, number, or search result into a verified incident.
Keeps curated incident records unchanged; preserves review decisions.
"""
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BRIEF=ROOT/"data"/"briefing.json"
QUEUE=ROOT/"data"/"integrity_review_queue.json"
STATES={"Maine":"ME","New Hampshire":"NH","North Carolina":"NC","Michigan":"MI",
"Georgia":"GA","Ohio":"OH","Alaska":"AK","Iowa":"IA","Texas":"TX","Nebraska":"NE",
"Kansas":"KS","Minnesota":"MN","Massachusetts":"MA","Pennsylvania":"PA",
"Wisconsin":"WI","Arizona":"AZ","Nevada":"NV"}
TOPICS={"registration":"registration|voter roll|voter list|purge|eligib|citizenship|save database",
"ballot_access":"ballot|polling place|voting access|early voting|absentee",
"litigation":"lawsuit|litigation|court|injunction|judge|appeal",
"security":"threat|bomb|cyber|ice|intimidat|interferen",
"election_admin":"election|midterm|vote count|recount|canvass|certif|precinct|voter fraud|vote suppress"}
# Keep state classification symmetric for both parties and all states.
# A missing state hint is NOT a claim about where a case did/did not happen.
STATES.update({
 "Alabama":"AL","Arkansas":"AR","California":"CA","Colorado":"CO",
 "Connecticut":"CT","Delaware":"DE","Florida":"FL","Hawaii":"HI",
 "Idaho":"ID","Illinois":"IL","Indiana":"IN","Kentucky":"KY",
 "Louisiana":"LA","Maryland":"MD","Mississippi":"MS","Missouri":"MO",
 "Montana":"MT","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
 "North Dakota":"ND","Oklahoma":"OK","Oregon":"OR","Rhode Island":"RI",
 "South Carolina":"SC","South Dakota":"SD","Tennessee":"TN",
 "Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA",
 "West Virginia":"WV","Wyoming":"WY"
})
STOPWORDS=set("the a an in on at to for of and or as it this those there are was were has have be from by with over into about officials official department administration election elections voter voters voting ballots ballot federal local new today state states us united says say alleges alleged reports report update latest county counties suit lawsuit court wins win trump".split())
def title_words(title):
    # News feeds often append a publisher after a hyphen. Keep the actual
    # event title only; publisher identity never constitutes corroboration.
    subject=title.rsplit(" - ",1)[0].lower()
    return set(w for w in re.findall(r"[a-z]{3,}",subject) if w not in STOPWORDS)

def triage(items):
    """Advisory related-headline buckets, NEVER deduped verified incidents.

    We do not change the status of a lead when a related article is checked.
    Similarity is deliberately conservative: false negatives only waste review
    time, while even a matched bucket remains unverified and source-separated.
    """
    groups=[]
    for item in items:
        if item.get("review_status")=="primary_source_checked":continue
        words=title_words(item.get("title") or "")
        if len(words)<3:continue
        hints=set(item.get("state_hints") or [])
        topics=set(item.get("topic_hints") or [])
        matched=None
        for g in groups:
            if hints and g["_states"] and hints.isdisjoint(g["_states"]):continue
            if topics and g["_topics"] and topics.isdisjoint(g["_topics"]):continue
            common=len(words & g["_words"])
            union=len(words | g["_words"])
            score=common/union if union else 0
            # If both headlines have no state hints, require stronger text
            # evidence rather than merging every generic national story.
            need=.77 if not hints and not g["_states"] else .58
            if common>=3 and score>=need:
                matched=g;break
        if matched is None:
            matched={"lead_id":item["id"],"headline":item.get("title",""),
                "count":0,"_words":words,"_states":hints,"_topics":topics,
                "_publishers":set(),"newest_published":item.get("published_at")}
            groups.append(matched)
        matched["count"]+=1
        matched["_publishers"].add(item.get("publisher") or "Source not specified")
        matched["_states"].update(hints)
        matched["_topics"].update(topics)
    ranked=sorted((g for g in groups if g["count"]>1),
        key=lambda g:(-g["count"],g["newest_published"] or "",g["lead_id"]))
    output=[{"lead_id":g["lead_id"],"headline":g["headline"],
      "possibly_related_articles":g["count"],"distinct_publishers":len(g["_publishers"]),
      "state_hints":sorted(g["_states"]),"topic_hints":sorted(g["_topics"]),
      "review_status":"advisory_overlap_only_not_independently_verified"}
      for g in ranked[:20]]
    return {"total_leads":len(items),
        "awaiting_primary_source":sum(x.get("review_status")=="needs_primary_source" for x in items),
        "primary_source_checked":sum(x.get("review_status")=="primary_source_checked" for x in items),
        "advisory_related_headline_buckets":len(ranked),
        "advisory_related_headlines":sum(g["count"] for g in ranked)},output

def read(path,default):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except (OSError,ValueError):return default
def main():
    briefing=read(BRIEF,{})
    prior=read(QUEUE,{"items":[]})
    old={x["id"]:x for x in prior.get("items",[])}
    now=dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")
    discovered=0
    for article in briefing.get("security",[]):
        url=article.get("url","")
        title=article.get("title","")
        if not url.startswith("https://") or not title:continue
        ident=hashlib.sha256((url+"|"+title.lower()).encode()).hexdigest()[:20]
        if ident in old:continue
        low=title.lower()
        states=[abbr for name,abbr in STATES.items() if re.search(r"\b"+re.escape(name.lower())+r"\b",low)]
        topics=[topic for topic,pattern in TOPICS.items() if re.search(pattern,low)]
        # Security-news feeds sometimes contain unrelated local articles.
        # Exclude from NEW triage leads, not from already-reviewed records.
        if not topics:continue
        # Preserve numbers only as quoted leads; they are NOT verified voter impacts.
        numeric_mentions=re.findall(r"\b\d[\d,]*(?:\.\d+)?\s*(?:million|thousand|voters|ballots|registrations|records)?\b",title,re.I)[:5]
        old[ident]={"id":ident,"title":title,"url":url,"publisher":article.get("source"),
            "published_at":article.get("published_at"),"detected_at":now,
            "state_hints":states,"topic_hints":topics,"headline_numbers_unverified":numeric_mentions,
            "review_status":"needs_primary_source","primary_sources":[],
            "impact_counts_verified":False,"promoted_to_incident_id":None}
        discovered+=1
    items=sorted(old.values(),key=lambda x:x.get("published_at") or "",reverse=True)[:250]
    review_metrics,related=triage(items)
    out={"updated_at":now,"status":"leads_only_not_verified_incidents",
        "policy":"Do not promote or copy any numeric claim into integrity_impact.json without independently checking the primary source, affected units, scope and overlap.",
        "new_leads":discovered,"review_metrics":review_metrics,
        "advisory_related_headlines":related,"items":items}
    QUEUE.write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print("Review queue:",len(items),"leads,",discovered,"new")
if __name__=="__main__":main()
