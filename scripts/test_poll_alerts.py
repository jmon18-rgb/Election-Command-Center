#!/usr/bin/env python3
import sys
from unittest.mock import patch
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import notify_new_polls as n

class PollAlerts(unittest.TestCase):
    def fixture(self,**kw):
        p={"race_code":"TX-SEN","race_type":"senate","poll_id":"survey1",
           "question_id":"q1","field_end":"2026-10-13","field_start":"2026-10-10",
           "posted_date":"2026-10-13","pollster":"Example Survey",
           "source_url":"https://example.org/original","dem":48,"rep":46}
        p.update(kw)
        return p
    def test_new_poll_detected(self):
        p=self.fixture()
        self.assertEqual(n.choose([p],set(),"2026-10-13"),[p])
    def test_duplicate_not_repeated(self):
        p=self.fixture()
        self.assertEqual(n.choose([p],{n.identity(p)},"2026-10-13"),[])
    def test_old_postings_never_presented_as_new(self):
        self.assertEqual(n.choose([self.fixture(posted_date="2026-10-08")],set(),"2026-10-13"),[])
    def test_midnight_and_delayed_run_do_not_miss_new_indexing(self):
        p=self.fixture(posted_date="2026-10-13")
        self.assertEqual(n.choose([p],set(),"2026-10-14"),[p])
        self.assertEqual(n.choose([p],{n.identity(p)},"2026-10-14"),[])
    def test_bounded_catchup_and_future_index_dates_rejected(self):
        old=self.fixture(posted_date="2026-10-10")
        future=self.fixture(posted_date="2026-10-15")
        self.assertEqual(n.choose([old,future],set(),"2026-10-14"),[])
    def test_gmail_only_requires_two_secrets(self):
        with patch.dict("os.environ",{"POLL_GMAIL_ADDRESS":"example@gmail.com",
            "POLL_GMAIL_APP_PASSWORD":"abcd efgh ijkl mnop"},clear=True):
            self.assertEqual(n.mail_settings(),(
                "smtp.gmail.com",465,"example@gmail.com","abcdefghijklmnop",
                "example@gmail.com","example@gmail.com"))
    def test_unconfigured_sender_is_inactive(self):
        with patch.dict("os.environ",{},clear=True):
            self.assertIsNone(n.mail_settings())
    def test_shared_survey_different_question_not_collapsed(self):
        a=self.fixture()
        b=self.fixture(race_code="TX-GOV",question_id="q2")
        self.assertNotEqual(n.identity(a),n.identity(b))
    def test_requires_original_url(self):
        self.assertEqual(n.choose([self.fixture(source_url=None)],set(),"2026-10-13"),[])
    def test_email_clearly_distinguishes_source_posting_from_release(self):
        body=n.format_email([self.fixture()])
        self.assertIn("NOT independently verified release times",body)
        self.assertIn("TX-SEN",body)
        self.assertIn("https://example.org/original",body)

if __name__=="__main__":
    unittest.main()
