#!/usr/bin/env python3
"""Start the unchanged advisory pool at its old step; join it at validation end.

No request, provider retry, child count, concurrency or job timeout is added.
State and per-child logs survive a controller exception for the final join.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import threading
import time
import traceback

import run_ci_source_canaries as runner

ROOT=Path(__file__).resolve().parents[1]
SCHEMA="source-canary-cross-step-v1"

def _json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def _write(path,value,*,exclusive=False):
    path=Path(path)
    content=json.dumps(value,sort_keys=True,indent=2)+"\n"
    if exclusive:
        with path.open("x",encoding="utf-8") as handle:
            handle.write(content);handle.flush();os.fsync(handle.fileno())
    else:
        temporary=path.with_name(path.name+"."+str(os.getpid())+".tmp")
        with temporary.open("x",encoding="utf-8") as handle:
            handle.write(content);handle.flush();os.fsync(handle.fileno())
        os.replace(temporary,path)

def _identity(pid):
    """Birth identity prevents signalling an unrelated reused process ID."""
    if type(pid) is not int or pid<=0:return None
    if os.name=="nt":
        import ctypes
        from ctypes import wintypes
        kernel=ctypes.WinDLL("kernel32",use_last_error=True)
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
        kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.GetProcessTimes.argtypes=[wintypes.HANDLE]+[ctypes.POINTER(wintypes.FILETIME)]*4
        kernel.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD]
        kernel.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=kernel.OpenProcess(0x1000|0x100000,False,pid)
        if not handle:return None
        try:
            values=[wintypes.FILETIME() for _ in range(4)]
            if not kernel.GetProcessTimes(handle,*[ctypes.byref(v) for v in values]):return None
            born=(values[0].dwHighDateTime<<32)|values[0].dwLowDateTime
            return {"pid":pid,"birth":"windows:"+str(born),
                    "alive":kernel.WaitForSingleObject(handle,0)==258}
        finally:kernel.CloseHandle(handle)
    try:
        tail=Path("/proc")/str(pid)/"stat"
        parts=tail.read_text().rsplit(")",1)[1].split()
        return {"pid":pid,"birth":"proc:"+parts[19],"alive":parts[0]!="Z"}
    except (FileNotFoundError,ProcessLookupError):return None

def _same_live(identity):
    actual=_identity(identity["pid"]) if identity else None
    return bool(actual and actual["alive"] and actual["birth"]==identity["birth"])

def _terminate(identity,*,force=False):
    """Only a recorded, still-matching process/group may be terminated."""
    if not _same_live(identity):return
    if os.name=="nt":
        import ctypes
        from ctypes import wintypes
        kernel=ctypes.WinDLL("kernel32",use_last_error=True)
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
        kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.TerminateProcess.argtypes=[wintypes.HANDLE,wintypes.UINT]
        kernel.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=kernel.OpenProcess(0x1000|0x0001,False,identity["pid"])
        if not handle:return
        try:
            # Recheck birth after obtaining a stable OS handle.
            if _same_live(identity):kernel.TerminateProcess(handle,1)
        finally:kernel.CloseHandle(handle)
    else:
        try:os.killpg(identity["pid"],signal.SIGKILL if force else signal.SIGTERM)
        except ProcessLookupError:return
        until=time.monotonic()+1
        while _same_live(identity) and time.monotonic()<until:time.sleep(.01)
        if _same_live(identity):
            try:os.killpg(identity["pid"],signal.SIGKILL)
            except ProcessLookupError:pass

def _plan(state):
    state=Path(state)
    if state.is_symlink():raise ValueError("Source state must not be a symlink")
    plan=_json(state/"plan.json")
    if plan.get("schema")!=SCHEMA:raise ValueError("Unknown source controller state")
    if plan.get("root")!=str(ROOT):raise ValueError("Source controller root changed")
    expected=[{"name":x.name,"script":x.script,"continue_on_error":x.continue_on_error}
              for x in runner.CANARIES]
    if plan.get("canaries")!=expected or plan.get("max_workers")!=runner.MAX_WORKERS:
        raise ValueError("Source commands or concurrency changed")
    return plan

def start(state):
    state=Path(state)
    state.mkdir(mode=0o700,parents=False,exist_ok=False)
    (state/"logs").mkdir()
    plan={"schema":SCHEMA,"token":secrets.token_hex(24),"root":str(ROOT),
          "max_workers":runner.MAX_WORKERS,
          "canaries":[{"name":x.name,"script":x.script,"continue_on_error":x.continue_on_error}
                       for x in runner.CANARIES]}
    _write(state/"plan.json",plan,exclusive=True)
    # All streams are files/DEVNULL so the starting Actions step can finish.
    # RUNNER_TRACKING_ID is inherited; runner-wide cancellation is not bypassed.
    with (state/"worker.log").open("xb") as output:
        options={"cwd":ROOT,"stdin":subprocess.DEVNULL,"stdout":output,
                 "stderr":subprocess.STDOUT,"close_fds":True}
        if os.name=="nt":options["creationflags"]=subprocess.CREATE_NEW_PROCESS_GROUP
        else:options["start_new_session"]=True
        child=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),
                                "worker","--state-dir",str(state)],**options)
        identity=_identity(child.pid)
        if identity is None:
            child.wait()
            raise RuntimeError("Source controller exited before its launch identity was recorded")
        _write(state/"launch.json",{"token":plan["token"],"worker":identity},exclusive=True)
    print("Started the same seven advisory checks at their existing workflow position; max active children remains four.",flush=True)
    return 0

def worker(state):
    state=Path(state);plan=_plan(state);cancelled=threading.Event();done=threading.Event()
    identity=_identity(os.getpid())
    _write(state/"worker.json",{"token":plan["token"],"worker":identity},exclusive=True)
    previous={};observed={}
    def cancel(signum,frame):cancelled.set()
    def watch():
        while not done.wait(.02):
            if (state/"cancel.json").exists():
                cancelled.set();return
    def checkpoint(outcomes):
        rows=[]
        for index,outcome in enumerate(outcomes):
            row={key:value for key,value in outcome.items() if key!="log"}
            if row["pid"] is not None and index not in observed:
                observed[index]=_identity(row["pid"])
            row["identity"]=observed.get(index)
            row["log_file"]="logs/"+str(index).zfill(2)+".log"
            rows.append(row)
        value={"token":plan["token"],"worker":identity,"outcomes":rows}
        with (state/"events.jsonl").open("a",encoding="utf-8") as handle:
            handle.write(json.dumps(value,sort_keys=True)+"\n");handle.flush();os.fsync(handle.fileno())
        _write(state/"progress.json",value)
    thread=threading.Thread(target=watch,daemon=True);thread.start()
    try:
        for sig in (signal.SIGINT,signal.SIGTERM):previous[sig]=signal.signal(sig,cancel)
        report=runner.run_canaries(cancel_event=cancelled,log_dir=state/"logs",checkpoint=checkpoint)
        outcomes=[]
        for index,row in enumerate(report["outcomes"]):
            log=row["log"]
            outcomes.append({**{key:value for key,value in row.items() if key!="log"},
                "identity":observed.get(index),"log_file":"logs/"+str(index).zfill(2)+".log",
                "log_bytes":len(log),"log_sha256":hashlib.sha256(log).hexdigest()})
        saved={**{key:value for key,value in report.items() if key!="outcomes"},"outcomes":outcomes}
        _write(state/"report.json",saved,exclusive=True)
        code=0 if report["status"]=="COMPLETED_ADVISORY_CHECKS" else 1
        _write(state/"finished.json",{"token":plan["token"],"worker":identity,
               "return_code":code,"report_sha256":hashlib.sha256((state/"report.json").read_bytes()).hexdigest()},exclusive=True)
        return code
    except BaseException:
        _write(state/"controller-error.json",{"token":plan["token"],"error":traceback.format_exc()},exclusive=True)
        traceback.print_exc();return 1
    finally:
        done.set();thread.join()
        for sig,handler in previous.items():signal.signal(sig,handler)

def _progress(state,plan):
    try:
        value=_json(state/"progress.json")
        if value.get("token")==plan["token"]:return value
    except (FileNotFoundError,json.JSONDecodeError):pass
    if (state/"events.jsonl").exists():
        for line in reversed((state/"events.jsonl").read_text(encoding="utf-8").splitlines()):
            try:value=json.loads(line)
            except json.JSONDecodeError:continue
            if value.get("token")==plan["token"]:return value
    return None

def _cleanup(state,plan):
    progress=_progress(state,plan)
    worker=None
    for name in ("launch.json","worker.json"):
        try:value=_json(state/name)
        except (FileNotFoundError,json.JSONDecodeError):continue
        if value.get("token")==plan["token"] and value.get("worker"):
            worker=value["worker"];break
    if worker is None and progress:worker=progress.get("worker")
    # Stop the controller first: killing a child first could let a live pool
    # replenish that slot while cleanup is reading an older checkpoint.
    if worker and _same_live(worker):
        if not (state/"cancel.json").exists():
            _write(state/"cancel.json",{"token":plan["token"],"reason":"join cleanup"},exclusive=True)
        _terminate(worker)
    progress=_progress(state,plan)
    if progress and progress.get("token")==plan["token"]:
        for row in progress["outcomes"]:_terminate(row.get("identity"))

def _partial(state,plan):
    progress=_progress(state,plan) or {}
    rows=progress.get("outcomes",[]) if progress.get("token")==plan["token"] else []
    by_name={row["name"]:row for row in rows}
    outcomes=[]
    for index,item in enumerate(runner.CANARIES):
        old=by_name.get(item.name,{})
        log_path=state/"logs"/(str(index).zfill(2)+".log")
        outcomes.append({"name":item.name,"command":"python3 "+item.script,
            "continue_on_error":True,"status":"CONTROLLER_INCOMPLETE_"+old.get("status","NOT_STARTED"),
            "return_code":old.get("return_code"),"pid":old.get("pid"),
            "log":log_path.read_bytes() if log_path.exists() else b""})
    return {"status":"CONTROLLER_FAILURE_NO_COMPLETE_SOURCE_PROOF","max_workers":runner.MAX_WORKERS,
            "outcomes":outcomes}

def join(state,job_status="success"):
    state=Path(state);plan=None;report=None;error=None;code=1;previous={}
    def interrupted(signum,frame):raise RuntimeError("Source join interrupted by runner cancellation")
    try:
        plan=_plan(state)
        _write(state/"join-start.json",{"token":plan["token"],"job_status":job_status},exclusive=True)
        launch=_json(state/"launch.json")
        if launch.get("token")!=plan["token"]:raise ValueError("Missing owned source controller launch")
        for sig in (signal.SIGINT,signal.SIGTERM):previous[sig]=signal.signal(sig,interrupted)
        if job_status!="success":_write(state/"cancel.json",{"token":plan["token"],"reason":job_status},exclusive=True)
        while _same_live(launch["worker"]):time.sleep(.02)
        if (state/"controller-error.json").exists():raise RuntimeError("Source controller failed; retained error/logs follow")
        finished=_json(state/"finished.json")
        if finished.get("token")!=plan["token"] or finished.get("worker",{}).get("birth")!=launch["worker"]["birth"]:
            raise ValueError("Source completion identity mismatch")
        raw=(state/"report.json").read_bytes()
        if hashlib.sha256(raw).hexdigest()!=finished["report_sha256"]:raise ValueError("Source completion report changed")
        candidate=json.loads(raw)
        if len(candidate["outcomes"])!=len(runner.CANARIES):raise ValueError("Source completion omitted an advisory check")
        for index,row in enumerate(candidate["outcomes"]):
            if row["name"]!=runner.CANARIES[index].name:raise ValueError("Source completion reordered advisory checks")
            path=state/"logs"/(str(index).zfill(2)+".log")
            log=path.read_bytes() if path.exists() else b""
            if len(log)!=row["log_bytes"] or hashlib.sha256(log).hexdigest()!=row["log_sha256"]:
                raise ValueError("Source child log changed")
            row["log"]=log
        report=candidate
        if finished["return_code"]!=0 or report["status"]!="COMPLETED_ADVISORY_CHECKS":
            raise RuntimeError("Source pool cancelled; completed and partial outcomes are retained")
        code=0 if job_status=="success" else 1
    except BaseException as exc:
        error=str(exc)
    finally:
        if plan:
            try:_cleanup(state,plan)
            except BaseException as exc:error=(error or "")+"; cleanup: "+str(exc)
        for sig,handler in previous.items():signal.signal(sig,handler)
    if error:
        code=1
        print("::error title=Advisory source controller incomplete::"+error,flush=True)
        if plan and report is None:report=_partial(state,plan)
    if report:runner.emit_report(report)
    if (state/"worker.log").exists() and (state/"worker.log").stat().st_size:
        print("::group::Retained source controller output",flush=True)
        sys.stdout.buffer.write((state/"worker.log").read_bytes());sys.stdout.buffer.flush()
        print("\n::endgroup::",flush=True)
    if plan:_write(state/"join-result.json",{"token":plan["token"],"return_code":code,"error":error},exclusive=True)
    return code

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command",choices=("start","worker","join"))
    parser.add_argument("--state-dir",type=Path,required=True)
    parser.add_argument("--job-status",choices=("success","failure","cancelled","skipped"),default="success")
    args=parser.parse_args()
    if args.command=="start":return start(args.state_dir)
    if args.command=="worker":return worker(args.state_dir)
    return join(args.state_dir,args.job_status)

if __name__=="__main__":sys.exit(main())
