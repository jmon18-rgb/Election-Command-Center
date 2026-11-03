import unittest
from datetime import datetime
from pathlib import Path

from resolve_election_source_preflight import (
    HOURLY_SCHEDULE,
    SUPPLEMENTAL_SCHEDULE,
    resolve_window,
)


def at(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class SourcePreflightScheduleTests(unittest.TestCase):
    def test_delayed_hourly_slot_remains_full_check(self):
        for time in ("2026-11-03T19:11:00Z", "2026-11-03T19:54:00Z", "2026-11-03T20:02:00Z"):
            with self.subTest(time=time):
                self.assertEqual(resolve_window("schedule", HOURLY_SCHEDULE, at(time)),
                                 {"run": True, "baseline": True, "supplemental": False})

    def test_delayed_supplemental_never_becomes_full_check(self):
        for time, expected in (("2026-11-03T19:41:00Z", False),
                               ("2026-11-03T20:02:00Z", False),
                               ("2026-11-03T23:41:00Z", True),
                               ("2026-11-04T00:02:00Z", True)):
            with self.subTest(time=time):
                self.assertEqual(resolve_window("schedule", SUPPLEMENTAL_SCHEDULE, at(time)),
                                 {"run": expected, "baseline": False, "supplemental": True})

    def test_actual_clock_keeps_original_counting_boundaries(self):
        for time, expected in (("2026-11-03T22:59:59Z", False),
                               ("2026-11-03T23:00:00Z", True),
                               ("2026-11-04T11:59:59Z", True),
                               ("2026-11-04T12:00:00Z", False)):
            with self.subTest(time=time):
                self.assertEqual(resolve_window("schedule", SUPPLEMENTAL_SCHEDULE, at(time))["run"], expected)

    def test_campaign_end_and_manual_behavior(self):
        later = at("2026-11-05T00:00:00Z")
        self.assertFalse(resolve_window("schedule", HOURLY_SCHEDULE, later)["run"])
        for event in ("push", "workflow_dispatch"):
            self.assertEqual(resolve_window(event, "", later),
                             {"run": True, "baseline": True, "supplemental": False})

    def test_existing_four_hour_economy_outside_election_days(self):
        for hour, expected in ((0, True), (1, False), (4, True), (19, False)):
            with self.subTest(hour=hour):
                time = at(f"2026-10-30T{hour:02d}:54:00Z")
                policy = resolve_window("schedule", HOURLY_SCHEDULE, time)
                self.assertTrue(policy["run"])
                self.assertEqual(policy["baseline"], expected)

    def test_unknown_event_schedule_or_unzoned_clock_fails_closed(self):
        for schedule in ("", "11,41 * * 10,11 *", "*/15 * * * *"):
            with self.subTest(schedule=schedule), self.assertRaises(ValueError):
                resolve_window("schedule", schedule, at("2026-11-03T20:00:00Z"))
        with self.assertRaises(ValueError):
            resolve_window("pull_request", HOURLY_SCHEDULE, at("2026-11-03T20:00:00Z"))
        with self.assertRaises(ValueError):
            resolve_window("schedule", HOURLY_SCHEDULE, datetime(2026, 11, 3, 20))

    def test_workflow_binds_exact_schedule_instead_of_current_minute(self):
        source = (Path(__file__).resolve().parents[1] / ".github/workflows/election-night-source-preflight.yml").read_text(encoding="utf-8")
        for schedule in (HOURLY_SCHEDULE, SUPPLEMENTAL_SCHEDULE):
            self.assertIn(f"cron: '{schedule}'", source)
        self.assertIn("SOURCE_PREFLIGHT_EVENT: ${{ github.event_name }}", source)
        self.assertIn("SOURCE_PREFLIGHT_SCHEDULE: ${{ github.event.schedule }}", source)
        self.assertIn("python3 scripts/resolve_election_source_preflight.py", source)
        self.assertNotIn("minute=", source)


if __name__ == "__main__":
    unittest.main()
