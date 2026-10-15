#!/usr/bin/env python3
"""Audit 03: live/backtest firm selection must use identical source rules."""
import copy
import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_polling_models as research
import build_polling_estimates as live

TODAY=dt.date(2026,10,14)


def survey(pid, n, dem, rep, pop="lv", day="2026-10-05", firm="YouGov"):
    return {"poll_id":pid,"pollster":firm,"field_end":day,
            "dem_name":"James Talarico","rep_name":"Ken Paxton",
            "sample_population":pop,"sample_size":n,
            "dem":dem,"rep":rep,"margin":dem-rep,"partisan_lean":""}


class FirmWaveBacktestTests(unittest.TestCase):
    def test_model_research_same_day_texas_order_invariant(self):
        a=survey("UT-small",861,50,47)
        b=survey("YouGov-large",3623,50,44)
        older=survey("Other-firm",700,47,47,firm="SurveyUSA",day="2026-09-25")
        values=[]
        for order in ([a,b,older],[b,older,a],[older,a,b]):
            self.assertEqual(live.estimate({"polls":order},TODAY)["dem_minus_rep"],
                             live.estimate({"polls":[b,older]},TODAY)["dem_minus_rep"])
            values.append(tuple(round(research.predict(order,TODAY,method),8)
                                for method in research.METHODS))
        self.assertEqual(values[0],values[1])
        self.assertEqual(values[1],values[2])

    def test_lv_precedes_registered_and_equal_ties_quarantine(self):
        lv=survey("lv",650,49,46)
        rv=survey("rv",1500,52,44,pop="rv")
        for order in ([rv,lv],[lv,rv]):
            expected=research.predict(order,TODAY,"equal")
            self.assertEqual(expected,3)
            self.assertEqual(live.estimate({"polls":order},TODAY)["dem_minus_rep"],3)
        a=survey("a",850,50,42)
        b=survey("b",850,44,49)
        for order in ([a,b],[b,a]):
            self.assertIsNone(research.predict(order,TODAY,"equal"))
            self.assertEqual(live.estimate({"polls":order},TODAY)["status"],
                             "no_recent_qualifying_polls")

    def test_shuffling_backtest_input_does_not_change_metrics(self):
        rows=[
            survey("older-one",900,49,48,day="2026-09-23"),
            survey("older-two",950,50,48,day="2026-09-28"),
            survey("same-date-small",861,50,47,day="2026-10-05"),
            survey("same-date-big",3623,50,44,day="2026-10-05"),
            survey("later",1200,52,47,day="2026-10-12"),
            survey("another-firm",700,46,47,day="2026-09-26",firm="SurveyUSA"),
            survey("another-firm-next",800,48,47,day="2026-10-01",firm="SurveyUSA"),
        ]
        def measure(polls):
            observations,groups=research.grouped_tests({"races":[{
                "race_code":"TX-SEN","polls":copy.deepcopy(polls)}]})
            # Only the SOURCE-order stability is asserted; no method promoted.
            return groups,{k:list(v) for k,v in observations.items()}
        baseline=measure(rows)
        self.assertEqual(measure(list(reversed(rows))),baseline)
        self.assertEqual(measure(rows[3:]+rows[:3]),baseline)


if __name__=="__main__":
    unittest.main()
