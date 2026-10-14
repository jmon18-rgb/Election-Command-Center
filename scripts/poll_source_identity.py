"""Exact source-poll identity required for a published modeled firm wave.

Firm/date/candidate alone is insufficient: a pollster can field multiple
questions or registered/likely-voter samples on the same end date.
"""
def matches_source_poll(p, pick, model_race, is_generic):
    if p.get("pollster","").casefold()!=pick.get("name","").casefold():
        return False
    if p.get("field_end")!=pick.get("field_end"):
        return False
    if is_generic:
        return True  # Generic source table does not supply poll IDs yet.
    if not pick.get("poll_id") or p.get("poll_id")!=pick["poll_id"]:
        return False
    return (p.get("dem_name")==model_race.get("dem_candidate") and
            p.get("rep_name")==model_race.get("rep_candidate"))
