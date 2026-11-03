#!/usr/bin/env python3
"""Only local fabricated subprocesses; never run any provider source check."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from run_ci_source_canaries import CANARIES,Canary,MAX_WORKERS,run_canaries

class SourceCanaryRunnerTests(unittest.TestCase):
    def fixtures(self,root,*,sleep=.12,fail_index=2):
        entries=[]
        for index in range(7):
            path=root/("child-"+str(index)+".py")
            path.write_text("import json,os,time\nfrom pathlib import Path\n"+
                "p=Path(__file__).parent\n"+
                f"index={index}\n"+
                "with (p/(str(index)+'.start')).open('x',encoding='utf-8') as f:\n"+
                " f.write(json.dumps({'time':time.monotonic(),'pid':os.getpid()}))\n"+
                "(p/(str(index)+'.ready')).touch(exist_ok=False)\n"+
                "if index<4:\n"+
                " until=time.monotonic()+5\n"+
                " while not all((p/(str(n)+'.ready')).exists() for n in range(4)):\n"+
                "  if time.monotonic()>=until:raise RuntimeError('Fabricated first-wave barrier did not receive all four children')\n"+
                "  time.sleep(.01)\n"+
                f"time.sleep({sleep!r})\n"+
                "(p/(str(index)+'.end')).write_text(str(time.monotonic()),encoding='utf-8')\n"+
                "print('fabricated child',index,'complete',flush=True)\n"+
                f"raise SystemExit(7 if index=={fail_index} else 0)\n",encoding="utf-8")
            entries.append(Canary("Fabricated advisory "+str(index),path.name))
        return entries

    def test_seven_commands_once_concurrency_and_individual_failures(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);entries=self.fixtures(root)
            launches=[]
            def spawn(argv,**kwargs):
                launches.append(Path(argv[1]).name)
                return subprocess.Popen(argv,**kwargs)
            report=run_canaries(entries,root=root,spawn=spawn)
            self.assertEqual(launches,[entry.script for entry in entries],"FIFO launch order, no omitted or repeated child")
            self.assertEqual(report["status"],"COMPLETED_ADVISORY_CHECKS")
            self.assertEqual(report["invocations"],7)
            self.assertEqual(report["peak_active_children"],4)
            self.assertEqual([row["return_code"] for row in report["outcomes"]],[0,0,7,0,0,0,0])
            self.assertEqual([row["status"] for row in report["outcomes"]],["PASS","PASS","ADVISORY_FAILURE","PASS","PASS","PASS","PASS"])
            self.assertTrue(all(row["continue_on_error"] is True for row in report["outcomes"]))
            self.assertEqual([row["name"] for row in report["outcomes"]],[entry.name for entry in entries])
            self.assertTrue(all(row["log"].replace(b"\r\n",b"\n")==f"fabricated child {index} complete\n".encode()
                for index,row in enumerate(report["outcomes"])))
            # Independently measured child intervals establish actual overlap,
            # rather than trusting only the runner's own peak counter.
            events=[]
            for index in range(7):
                events.extend([(json.loads((root/(str(index)+".start")).read_text())["time"],1),
                    (float((root/(str(index)+".end")).read_text()),-1)])
            active=peak=0
            for _,change in sorted(events):active+=change;peak=max(peak,active)
            self.assertEqual(active,0)
            self.assertEqual(peak,4,"Actual fabricated child intervals must overlap four ways, never five")

    def test_cancellation_reaps_active_children_without_starting_remaining(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);entries=self.fixtures(root,sleep=30)
            cancelled=threading.Event();children=[];ready=[]
            def spawn(argv,**kwargs):
                child=subprocess.Popen(argv,**kwargs);children.append(child);return child
            def cancel_when_four_started():
                until=time.monotonic()+5
                while time.monotonic()<until:
                    if len(list(root.glob("*.start")))==4:
                        ready.append(True);break
                    time.sleep(.01)
                cancelled.set()
            trigger=threading.Thread(target=cancel_when_four_started)
            trigger.start()
            report=run_canaries(entries,root=root,spawn=spawn,cancel_event=cancelled)
            trigger.join()
            self.assertTrue(ready,"Four real fabricated children must have started before cancellation")
            self.assertEqual(report["status"],"CANCELLED")
            self.assertEqual(report["invocations"],4)
            self.assertEqual([row["status"] for row in report["outcomes"]],["CANCELLED"]*4+["NOT_STARTED"]*3)
            self.assertTrue(all(child.poll() is not None for child in children),"No running child may survive cancellation")
            self.assertFalse(list(root.glob("*.end")),"Cancelled children must not reach their normal completion")

    def test_concurrency_cannot_exceed_four_or_wrap_required_assertions(self):
        self.assertEqual(MAX_WORKERS,4)
        self.assertEqual(len(CANARIES),7)
        self.assertEqual(len({item.script for item in CANARIES}),7)
        for invalid in (0,5,True,1.5):
            with self.assertRaises(ValueError):run_canaries([],max_workers=invalid)
        with self.assertRaises(ValueError):run_canaries([Canary("Required test","never-execute.py",False)])
        with self.assertRaises(ValueError):run_canaries([Canary("Duplicate","a.py"),Canary("Duplicate","b.py")])

if __name__=="__main__":unittest.main()
