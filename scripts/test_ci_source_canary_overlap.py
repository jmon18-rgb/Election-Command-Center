#!/usr/bin/env python3
"""Fabricated local children only; no provider, model, browser or CI requests."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

HERE=Path(__file__).resolve().parent

class OverlapLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.root=Path(self.temporary.name)
        scripts=self.root/"scripts";scripts.mkdir()
        shutil.copyfile(HERE/"ci_source_canary_overlap.py",scripts/"ci_source_canary_overlap.py")
        shutil.copyfile(HERE/"run_ci_source_canaries.py",scripts/"poolbase.py")
        (scripts/"run_ci_source_canaries.py").write_text(
            "from pathlib import Path\nimport poolbase as base\n"
            "ROOT=Path(__file__).resolve().parents[1]\n"
            "MAX_WORKERS=base.MAX_WORKERS\n"
            "CANARIES=tuple(base.Canary('Fabricated advisory '+str(i),'scripts/fake-'+str(i)+'.py') for i in range(7))\n"
            "def run_canaries(**kwargs):return base.run_canaries(CANARIES,root=ROOT,**kwargs)\n"
            "emit_report=base.emit_report\n",encoding="utf-8")
        for index in range(7):
            (scripts/("fake-"+str(index)+".py")).write_text(
                "import json,os,time\nfrom pathlib import Path\n"
                "root=Path(__file__).resolve().parents[1]\n"+
                f"index={index}\n"+
                "with (root/(str(index)+'.start')).open('x') as f:f.write(json.dumps({'at':time.monotonic(),'pid':os.getpid()}))\n"
                "print('fabricated partial',index,flush=True)\n"
                "(root/(str(index)+'.ready')).touch(exist_ok=False)\n"
                "until=time.monotonic()+8\n"
                "while not (root/'release').exists():\n"
                " if time.monotonic()>until:raise RuntimeError('Fabricated gate not released')\n"
                " time.sleep(.01)\n"
                "(root/(str(index)+'.end')).write_text(str(time.monotonic()))\n"
                "print('fabricated complete',index,flush=True)\n"
                "raise SystemExit(7 if index==2 else 0)\n",encoding="utf-8")
        self.controller=scripts/"ci_source_canary_overlap.py"
        self.state=self.root/"state"
        self.children=[]

    def tearDown(self):
        if (self.state/"plan.json").exists() and not (self.state/"join-result.json").exists():
            subprocess.run([sys.executable,str(self.controller),"join","--state-dir",str(self.state),
                            "--job-status","failure"],cwd=self.root,stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT,timeout=10)
        self.temporary.cleanup()

    def command(self,command,*,status="success"):
        args=[sys.executable,str(self.controller),command,"--state-dir",str(self.state)]
        if command=="join":args.extend(["--job-status",status])
        return subprocess.run(args,cwd=self.root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=12)

    def wait_for(self,predicate):
        until=time.monotonic()+6
        while time.monotonic()<until:
            if predicate():return
            time.sleep(.01)
        self.fail("Fabricated lifecycle predicate did not complete")

    def load_controller(self):
        old_path=sys.path[:]
        saved={name:sys.modules.pop(name,None) for name in ("run_ci_source_canaries","poolbase")}
        try:
            sys.path.insert(0,str(self.controller.parent))
            spec=importlib.util.spec_from_file_location("fabricated_overlap",self.controller)
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            return module
        finally:
            sys.path[:]=old_path
            for name,old in saved.items():
                sys.modules.pop(name,None)
                if old is not None:sys.modules[name]=old

    def started(self):
        result=self.command("start")
        self.assertEqual(result.returncode,0,result.stdout.decode())
        self.wait_for(lambda:len(list(self.root.glob("*.ready")))==4)
        return json.loads((self.state/"launch.json").read_text())

    def assert_children_stopped(self):
        controller=self.load_controller()
        records=[json.loads(p.read_text()) for p in self.root.glob("*.start")]
        self.wait_for(lambda:all(not (controller._identity(r["pid"]) or {}).get("alive",False) for r in records))

    def test_async_overlap_all_seven_once_cap_four_and_advisory_failure(self):
        self.started()
        self.assertFalse((self.state/"finished.json").exists())
        # A foreground offline action can finish while the original pool runs.
        (self.root/"offline-validation-finished").touch()
        (self.root/"release").touch()
        result=self.command("join")
        self.assertEqual(result.returncode,0,result.stdout.decode())
        report=json.loads((self.state/"report.json").read_text())
        self.assertEqual(report["invocations"],7)
        self.assertEqual(report["peak_active_children"],4)
        self.assertEqual([r["return_code"] for r in report["outcomes"]],[0,0,7,0,0,0,0])
        self.assertEqual([r["status"] for r in report["outcomes"]],
                         ["PASS","PASS","ADVISORY_FAILURE","PASS","PASS","PASS","PASS"])
        self.assertEqual([r["command"] for r in report["outcomes"]],
                         ["python3 scripts/fake-"+str(i)+".py" for i in range(7)])
        events=[]
        for index in range(7):
            events.extend([(json.loads((self.root/(str(index)+".start")).read_text())["at"],1),
                           (float((self.root/(str(index)+".end")).read_text()),-1)])
            self.assertEqual((self.state/"logs"/(str(index).zfill(2)+".log")).read_bytes().replace(b"\r\n",b"\n"),
                             f"fabricated partial {index}\nfabricated complete {index}\n".encode())
        active=peak=0
        for _,change in sorted(events):active+=change;peak=max(peak,active)
        self.assertEqual((active,peak),(0,4))
        self.assertIn(b"Advisory source check failed",result.stdout)
        self.assertIn(b"COMPLETED_ADVISORY_CHECKS",result.stdout)
        self.assert_children_stopped()

    def test_foreground_failure_cancels_four_and_preserves_three_unstarted(self):
        self.started()
        result=self.command("join",status="failure")
        self.assertNotEqual(result.returncode,0,result.stdout.decode())
        report=json.loads((self.state/"report.json").read_text())
        self.assertEqual(report["status"],"CANCELLED")
        self.assertEqual(report["invocations"],4)
        self.assertEqual([r["status"] for r in report["outcomes"]],["CANCELLED"]*4+["NOT_STARTED"]*3)
        self.assertTrue(all((self.state/"logs"/(str(i).zfill(2)+".log")).read_bytes() for i in range(4)))
        self.assertFalse(list(self.root.glob("*.end")))
        self.assert_children_stopped()

    def test_worker_crash_preserves_partial_logs_and_reaps_recorded_children(self):
        launch=self.started()
        controller=self.load_controller()
        controller._terminate(launch["worker"],force=True)
        # Losing the latest checkpoint must still recover the append-only events.
        (self.state/"progress.json").unlink()
        result=self.command("join")
        self.assertNotEqual(result.returncode,0,result.stdout.decode())
        self.assertIn(b"CONTROLLER_FAILURE_NO_COMPLETE_SOURCE_PROOF",result.stdout)
        for index in range(4):self.assertIn(f"fabricated partial {index}".encode(),result.stdout)
        self.assertEqual(len(list(self.root.glob("*.start"))),4)
        self.assert_children_stopped()

    def test_missing_completion_is_required_failure_not_advisory_success(self):
        self.started();(self.root/"release").touch()
        self.wait_for(lambda:(self.state/"finished.json").exists())
        controller=self.load_controller()
        launch=json.loads((self.state/"launch.json").read_text())
        self.wait_for(lambda:not controller._same_live(launch["worker"]))
        (self.state/"finished.json").unlink()
        result=self.command("join")
        self.assertNotEqual(result.returncode,0)
        self.assertIn(b"CONTROLLER_FAILURE_NO_COMPLETE_SOURCE_PROOF",result.stdout)
        self.assert_children_stopped()

    def test_missing_launch_still_stops_owned_worker_before_children(self):
        launch=self.started()
        (self.state/"launch.json").unlink()
        result=self.command("join")
        self.assertNotEqual(result.returncode,0,result.stdout.decode())
        self.assertIn(b"CONTROLLER_FAILURE_NO_COMPLETE_SOURCE_PROOF",result.stdout)
        controller=self.load_controller()
        self.wait_for(lambda:not controller._same_live(launch["worker"]))
        self.assertEqual(len(list(self.root.glob("*.start"))),4)
        self.assertFalse(list(self.root.glob("*.end")))
        self.assert_children_stopped()

    def test_second_start_cannot_launch_duplicate_sources(self):
        self.started()
        result=self.command("start")
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(len(list(self.root.glob("*.start"))),4)
        self.assertNotEqual(self.command("join",status="failure").returncode,0)
        self.assert_children_stopped()

    def test_missing_state_and_reused_pid_fail_closed(self):
        result=self.command("join")
        self.assertNotEqual(result.returncode,0)
        controller=self.load_controller()
        with mock.patch.object(controller,"_identity",return_value={"pid":123,"birth":"different","alive":True}):
            with mock.patch.object(controller.os,"killpg",create=True) as kill:
                controller._terminate({"pid":123,"birth":"owned-old","alive":True})
                kill.assert_not_called()

if __name__=="__main__":unittest.main()
