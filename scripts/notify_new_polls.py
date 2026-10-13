#!/usr/bin/env python3
"""Send opt-in email for newly detected poll observations after a successful refresh.

PollResults timestamps are INDEX POSTING times, not verified release timestamps.
Never describe these alerts as independently confirmed new publications.
"""
import datetime as dt
import hashlib
import json
import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data/pollresults_recent.json"
STATE=ROOT/"data/poll_alert_state.json"
MAX_IDS=6000

def identity(p):
    # Distinguish different ballot questions within the same survey.
    stable=[p.get("race_code"),p.get("poll_id"),p.get("question_id"),
            p.get("field_end"),p.get("dem_name"),p.get("rep_name")]
    return hashlib.sha256(json.dumps(stable,ensure_ascii=False).encode()).hexdigest()[:24]

def choose(observations,known,today):
    result=[]
    for p in observations:
        if identity(p) in known:continue
        # Limit catch-up alerts to recent source-index postings.
        posted=str(p.get("posted_date") or "")[:10]
        try:
            days_old=(dt.date.fromisoformat(today)-dt.date.fromisoformat(posted)).days
        except ValueError:
            continue
        # Four-hour jobs can straddle midnight or be delayed. Use a
        # bounded 48-hour catch-up window, with identity-based deduping.
        if not 0<=days_old<=2:continue
        if not (p.get("race_code") and p.get("pollster") and p.get("source_url")):continue
        result.append(p)
    return sorted(result,key=lambda p:(p.get("posted_source_datetime") or "",p.get("race_code") or ""),reverse=True)

def format_email(polls):
    lines=["Newly indexed election poll observations","",
      "These were newly detected in the source index; their posting timestamps are NOT independently verified release times.",""]
    for p in polls:
        dem=p.get("dem");rep=p.get("rep")
        def fmt(v):return str(v) if v is not None else "?"
        lines.extend([
            f"{p.get('race_code')} ({p.get('race_type','race')}) — {p.get('pollster')}",
            f"{p.get('dem_name','Democratic candidate')}: {fmt(dem)}% | {p.get('rep_name','Republican candidate')}: {fmt(rep)}%",
            f"Fieldwork: {p.get('field_start','?')} to {p.get('field_end','?')} | {str(p.get('sample_population','unknown')).upper()} | n={p.get('sample_size','unknown')}",
            f"Index posting: {p.get('posted_source_datetime') or p.get('posted_date')} (timezone unverified)",
            f"Original source: {p['source_url']}",""])
    lines.extend(["View dashboard: https://jmon18-rgb.github.io/Election-Command-Center/",
      "Source index: https://pollresults.org/"])
    return "\n".join(lines)

def mail_settings():
    """Single-account Gmail needs only two GitHub secrets.

    Keep the existing generic SMTP configuration for non-Gmail providers.
    An optional POLL_ALERT_TO overrides Gmail's self-delivery address.
    """
    gmail=os.getenv("POLL_GMAIL_ADDRESS","").strip()
    app_password=os.getenv("POLL_GMAIL_APP_PASSWORD","").replace(" ","").strip()
    if gmail and app_password:
        return ("smtp.gmail.com",465,gmail,app_password,gmail,
                os.getenv("POLL_ALERT_TO") or gmail)
    host=os.getenv("POLL_SMTP_HOST")
    username=os.getenv("POLL_SMTP_USERNAME")
    password=os.getenv("POLL_SMTP_PASSWORD")
    sender=os.getenv("POLL_ALERT_FROM")
    recipient=os.getenv("POLL_ALERT_TO")
    if all([host,username,password,sender,recipient]):
        return (host,int(os.getenv("POLL_SMTP_PORT") or "465"),
                username,password,sender,recipient)
    return None

def send(body,count):
    settings=mail_settings()
    if not settings:
        print("Email not configured; skipped without claiming delivery.")
        return False
    host,port,username,password,sender,recipient=settings
    msg=EmailMessage()
    msg["Subject"]=f"Election Command Center: {count} newly indexed poll observation(s)"
    msg["From"]=sender
    msg["To"]=recipient
    msg.set_content(body)
    if port==465:
        with smtplib.SMTP_SSL(host,port,timeout=25,context=ssl.create_default_context()) as connection:
            connection.login(username,password);connection.send_message(msg)
    elif port==587:
        with smtplib.SMTP(host,port,timeout=25) as connection:
            connection.starttls(context=ssl.create_default_context())
            connection.login(username,password);connection.send_message(msg)
    else:
        raise ValueError("SMTP must use port 465 (implicit TLS) or 587 (STARTTLS)")
    return True

def main():
    observations=json.loads(DATA.read_text(encoding="utf-8"))["observations"]
    ids=list(dict.fromkeys(identity(p) for p in observations))
    today=dt.datetime.now(dt.timezone.utc).date().isoformat()
    if not STATE.exists():
        # Initialize silently; do not send hundreds of historical polls.
        STATE.write_text(json.dumps({"seen":ids[:MAX_IDS],"initialized_at":today},indent=2)+"\n")
        print("Polling alert baseline initialized without historical email.")
        return
    state=json.loads(STATE.read_text(encoding="utf-8"))
    known=set(state["seen"])
    fresh=choose(observations,known,today)
    # No recipient configured: keep historical state stable so alerting
    # starts fresh once secrets are provided (without a catch-up flood).
    configured=mail_settings() is not None
    if fresh and configured:
        if not send(format_email(fresh),len(fresh)):
            raise RuntimeError("SMTP send did not complete")
        print(f"Delivered email covering {len(fresh)} newly indexed observation(s).")
    elif fresh:
        print(f"{len(fresh)} observations detected, but email not configured.")
    state["seen"]=list(dict.fromkeys(ids+state["seen"]))[:MAX_IDS]
    state["last_checked_at"]=dt.datetime.now(dt.timezone.utc).isoformat()
    STATE.write_text(json.dumps(state,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
