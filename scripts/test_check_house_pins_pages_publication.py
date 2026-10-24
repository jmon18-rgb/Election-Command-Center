import unittest
from datetime import datetime, timezone
from check_house_pins_pages_publication import identities, needs_publication

def report(ids, at="2026-10-24T03:00:00Z"):
    return {
        "schema_version": "1.0",
        "election": "2026-11-03",
        "status": "VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS",
        "generated_at": at,
        "races": [
            {"district": district, "race_id": number,
             "checked_window_utc": at}
            for district, number in ids.items()
        ]
    }

class Checks(unittest.TestCase):
    def test_timestamps_do_not_trigger_hourly_pages_build(self):
        previous=report({"NY-17": 41201,"ME-02":41202})
        current=report({"ME-02":41202,"NY-17":41201},"2026-10-24T04:00:00Z")
        now=datetime(2026,10,24,4,15,tzinfo=timezone.utc)
        self.assertFalse(needs_publication(previous,current,now=now))
        self.assertFalse(needs_publication(current,current,now=now))

    def test_refresh_unchanged_ids_before_48_hour_browser_expiry(self):
        old=report({"NY-17":41201},"2026-10-24T03:00:00Z")
        new=report({"NY-17":41201},"2026-10-25T11:00:00Z")
        early=datetime(2026,10,25,8,0,tzinfo=timezone.utc)
        due=datetime(2026,10,25,11,30,tzinfo=timezone.utc)
        self.assertFalse(needs_publication(old,new,now=early),
                         "No hourly Pages rebuild for unchanged pin IDs")
        self.assertTrue(needs_publication(old,new,now=due),
                        "Force a Pages build before the browser's 48h TTL")
        self.assertFalse(needs_publication(old,old,now=due),
                         "A non-newer local manifest cannot silently fix expiry")
        future=datetime(2026,10,24,2,0,tzinfo=timezone.utc)
        self.assertTrue(needs_publication(old,new,now=future),
                        "Future-dated Pages manifest cannot be trusted")
        malformed={**old,"generated_at":"not-a-date"}
        self.assertTrue(needs_publication(malformed,new,now=due))
        self.assertTrue(needs_publication({**old,"generated_at":"2026-10-24T03:00:00"},
                                          new,now=due))

    def test_new_removed_or_reassigned_exact_source_requires_build(self):
        original=report({"NY-17":41201})
        for changed in (
            report({"NY-17":41201,"ME-02":41202}),
            report({}),
            report({"NY-17":41203}),
        ):
            self.assertTrue(needs_publication(original,changed))
        self.assertTrue(needs_publication(None,original))
        self.assertTrue(needs_publication({},original))
        self.assertTrue(needs_publication({"schema_version":"0.1"},original))

    def test_source_id_and_district_invariants(self):
        bad=report({"NY-17":41201})
        bad["races"].append({"district":"NY-18","race_id":41201})
        with self.assertRaisesRegex(ValueError,"Duplicated"):
            identities(bad)
        with self.assertRaises(ValueError):
            identities(report({"NY-XX":41201}))
        with self.assertRaises(ValueError):
            identities(report({"NY-17":-3}))
        with self.assertRaises(ValueError):
            identities(report({"NY-17":True}))
        with self.assertRaises(ValueError):
            identities({"schema_version":"1.0","election":"2024-11-05",
                        "status":"VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS",
                        "races":[]})

if __name__ == "__main__":
    unittest.main()
