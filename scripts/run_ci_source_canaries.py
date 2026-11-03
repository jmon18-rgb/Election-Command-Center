#!/usr/bin/env python3
"""Run the seven existing advisory source checks within the same CI deadline.

Only independent scripts overlap. Each unchanged script keeps its own request
order, validation, retry and failure behavior. No results are admitted here.
"""
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import time

ROOT=Path(__file__).resolve().parents[1]
MAX_WORKERS=4

@dataclass(frozen=True)
class Canary:
    name: str
    script: str
    continue_on_error: bool=True

CANARIES=(
    Canary("Nonpublishing secondary civicAPI 2026 coverage and CORS probe", "scripts/probe_civicapi.py"),
    Canary("Probe four new states for indexed 2026 civicAPI contests", "scripts/probe_civicapi_oh_wi_ne_ks.py"),
    Canary("Discover five additional 2026 civicAPI state race sources", "scripts/probe_civicapi_il_ky_nj_ny_or.py"),
    Canary("Advisory four-state civicAPI source indexing health", "scripts/probe_civicapi_batch.py"),
    Canary("Advisory civicAPI live-provider health and CORS", "scripts/test_civicapi_live_source.py"),
    Canary("Discover five more uncovered 2026 states in real civicAPI", "scripts/probe_civicapi_al_mt_nm_ok_tn.py"),
    Canary("Probe civicAPI statewide 2026 source IDs in CA DE MS SD WY", "scripts/probe_civicapi_ca_de_ms_sd_wy.py"),
)

def _stop_children(processes):
    """Reap active children on job cancellation or a runner error."""
    for process in processes:
        if process.poll() is not None:continue
        try:
            if os.name=="nt":process.terminate()
            else:os.killpg(process.pid,signal.SIGTERM)
        except ProcessLookupError:pass
    until=time.monotonic()+1
    while any(process.poll() is None for process in processes) and time.monotonic()<until:
        time.sleep(.01)
    for process in processes:
        if process.poll() is None:
            try:
                if os.name=="nt":process.kill()
                else:os.killpg(process.pid,signal.SIGKILL)
            except ProcessLookupError:pass
        process.wait()

def run_canaries(canaries=CANARIES,*,root=ROOT,max_workers=MAX_WORKERS,cancel_event=None,spawn=subprocess.Popen,log_dir=None,checkpoint=None):
    """FIFO launches with at most four synchronous source scripts active."""
    if type(max_workers) is not int or not 1<=max_workers<=MAX_WORKERS:
        raise ValueError("Source canary concurrency must be between one and four")
    if len({item.name for item in canaries})!=len(canaries):
        raise ValueError("Source canary names must be unique")
    if not all(item.continue_on_error is True for item in canaries):
        raise ValueError("Only the existing advisory source checks belong here")
    cancel_event=cancel_event if cancel_event is not None else threading.Event()
    root=Path(root)
    log_dir=Path(log_dir) if log_dir is not None else None
    if log_dir is not None and not log_dir.is_dir():
        raise ValueError("Durable source log directory must already exist")
    if checkpoint is not None and not callable(checkpoint):
        raise ValueError("Source checkpoint must be callable")
    outcomes=[{"name":item.name,"command":"python3 "+item.script,
        "continue_on_error":item.continue_on_error,"status":"NOT_STARTED",
        "return_code":None,"pid":None,"log":b""} for item in canaries]
    active={};started=[];logs={};next_index=0;peak=0
    if checkpoint is not None:checkpoint(outcomes)
    try:
        while next_index<len(canaries) or active:
            if cancel_event.is_set():break
            while next_index<len(canaries) and len(active)<max_workers and not cancel_event.is_set():
                index=next_index;item=canaries[index]
                log=tempfile.TemporaryFile() if log_dir is None else (log_dir/(str(index).zfill(2)+".log")).open("x+b")
                logs[index]=log
                options={"cwd":root,"stdout":log,"stderr":subprocess.STDOUT}
                if os.name=="nt":options["creationflags"]=subprocess.CREATE_NEW_PROCESS_GROUP
                else:options["start_new_session"]=True
                process=spawn([sys.executable,str(root/item.script)],**options)
                active[index]=process;started.append(process);next_index+=1
                outcomes[index].update(status="RUNNING",pid=process.pid,started_monotonic=time.monotonic())
                peak=max(peak,len(active))
                if checkpoint is not None:checkpoint(outcomes)
            finished=False
            for index,process in list(active.items()):
                code=process.poll()
                if code is None:continue
                process.wait()
                outcomes[index].update(status="PASS" if code==0 else "ADVISORY_FAILURE",
                    return_code=code,finished_monotonic=time.monotonic())
                del active[index];finished=True
                if checkpoint is not None:checkpoint(outcomes)
            if not finished and active:cancel_event.wait(.02)
    finally:
        _stop_children(started)
        for index,process in active.items():
            outcomes[index].update(status="CANCELLED",return_code=process.returncode,finished_monotonic=time.monotonic())
        for index,log in logs.items():
            log.seek(0);outcomes[index]["log"]=log.read();log.close()
        if checkpoint is not None:checkpoint(outcomes)
    cancelled=cancel_event.is_set()
    if not cancelled and (next_index!=len(canaries) or any(row["return_code"] is None for row in outcomes)):
        raise RuntimeError("Every advisory child must produce an outcome")
    return {"status":"CANCELLED" if cancelled else "COMPLETED_ADVISORY_CHECKS",
        "max_workers":max_workers,"peak_active_children":peak,"invocations":len(started),"outcomes":outcomes}

def emit_report(report):
    """Keep all original advisory names, independent logs and actual exits."""
    summaries=[]
    for outcome in report["outcomes"]:
        print("::group::"+outcome["name"],flush=True)
        log=outcome["log"]
        if log:
            sys.stdout.buffer.write(log)
            if not log.endswith(b"\n"):sys.stdout.buffer.write(b"\n")
            sys.stdout.buffer.flush()
        summary={key:value for key,value in outcome.items() if key!="log"}
        summary.update(log_bytes=len(log),log_sha256=hashlib.sha256(log).hexdigest())
        print(json.dumps(summary,sort_keys=True),flush=True)
        print("::endgroup::",flush=True)
        if outcome["status"]=="ADVISORY_FAILURE":
            print("::warning title=Advisory source check failed::"+outcome["name"]+
                " exited "+str(outcome["return_code"])+"; existing continue-on-error policy retained",flush=True)
        summaries.append(summary)
    print(json.dumps({**{key:value for key,value in report.items() if key!="outcomes"},
        "outcomes":summaries,"scope":"Advisory source metadata only; no vote, call, rights or coverage admission"},sort_keys=True),flush=True)

def main():
    cancelled=threading.Event();received=[];previous={}
    def cancel(signum,frame):
        received.append(signum);cancelled.set()
    try:
        for sig in (signal.SIGINT,signal.SIGTERM):
            previous[sig]=signal.signal(sig,cancel)
        report=run_canaries(cancel_event=cancelled)
    finally:
        for sig,handler in previous.items():signal.signal(sig,handler)
    emit_report(report)
    return 128+received[0] if received else (1 if report["status"]=="CANCELLED" else 0)

if __name__=="__main__":
    sys.exit(main())
