#!/usr/bin/env python3
"""Offline source-availability audit tests. Absolutely no network requests."""
from datetime import datetime, timezone
import io
import unittest
import urllib.error
import zipfile

from probe_nc_2026_media_file_candidate import (
    CANDIDATE_URL, LIMIT_BYTES, inspect_zip, probe
)


def archive(member="results_pct_20261103.txt", header=None):
    header=header or ("County\tElection Date\tPrecinct\tContest ID\tContest Name"
                      "\tChoice\tChoice Party\tTotal Votes\n")
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,"w",zipfile.ZIP_DEFLATED) as z:
        z.writestr(member,header+"Alamance\t2026-11-03\t001\tXYZ\tSenate"
                   "\tDemocrat\tD\t42\n")
    return stream.getvalue()


class Response:
    def __init__(self,body=b"",headers=None,status=200):
        self.status=status
        self.headers=headers or {}
        self.body=io.BytesIO(body)
    def read(self,n=None):
        return self.body.read(n)
    def __enter__(self):
        return self
    def __exit__(self,*args):
        return False


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.calls=[]
        self.now=datetime(2026,10,24,tzinfo=timezone.utc)

    def fake(self,status=404,content=None,length=None):
        content=content if content is not None else archive()
        def open_(request,timeout):
            self.assertEqual(request.full_url,CANDIDATE_URL)
            self.assertLessEqual(timeout,20)
            self.assertIn(request.get_method(),("HEAD","GET"))
            self.calls.append(request.get_method())
            if status in (403,404):
                raise urllib.error.HTTPError(request.full_url,status,"No object",{},None)
            if status!=200:
                return Response(status=status)
            if request.get_method()=="HEAD":
                return Response(headers={"Content-Length":str(len(content) if length is None else length)})
            return Response(content)
        return open_

    def test_missing_archival_pattern_is_unknown_not_zero(self):
        r=probe(self.fake(),self.now)
        self.assertEqual(self.calls,["HEAD"])
        self.assertEqual(r["status"],"UNAVAILABLE_OR_NOT_PUBLICLY_AUTHORIZED")
        self.assertEqual(r["http_status"],404)
        self.assertFalse(r["actual_2026_election_night_feed_verified"])
        self.assertFalse(r["live_votes_verified"])
        self.assertFalse(r["may_publish_votes"])

    def test_candidate_exists_but_does_not_authorize_live_results(self):
        r=probe(self.fake(status=200),self.now)
        self.assertEqual(self.calls,["HEAD","GET"])
        self.assertEqual(r["status"],"CANDIDATE_ZIP_LAYOUT_PLAUSIBLE_MANUAL_REVIEW_REQUIRED")
        self.assertEqual(len(r["archive_sha256"]),64)
        self.assertTrue(r["s3_path_only_inferred_from_previous_archives"])
        self.assertFalse(r["publication_url_independently_confirmed"])
        self.assertFalse(r["browser_cors_verified"])
        self.assertFalse(r["may_move_geographic_or_national_needle"])
        self.assertFalse(r["may_publish_votes"])
        self.assertNotIn("candidates",r)
        self.assertNotIn("votes",r)

    def test_wrong_election_archive_not_promoted(self):
        r=probe(self.fake(status=200,content=archive(member="results_pct_20241105.txt")),
                self.now)
        self.assertEqual(r["status"],"FOUND_UNCONFIRMED_ELECTION_MEMBER")
        self.assertFalse(r["actual_2026_election_night_feed_verified"])

    def test_wrong_schema_and_non_zip_not_promoted(self):
        r=probe(self.fake(status=200,content=archive(header="Name\tvotes\n")),self.now)
        self.assertEqual(r["status"],"FOUND_UNVERIFIED_TABULAR_SCHEMA")
        r=probe(self.fake(status=200,content=b"Not a zip file"),self.now)
        self.assertEqual(r["status"],"FOUND_NON_ZIP_OR_TOO_LARGE")

    def test_oversize_head_and_upstream_failures_remain_unknown(self):
        r=probe(self.fake(status=200,length=LIMIT_BYTES+1),self.now)
        self.assertEqual(r["status"],"CANDIDATE_OBJECT_TOO_LARGE_OR_UNTRUSTED")
        self.assertEqual(self.calls,["HEAD"])
        r=probe(self.fake(status=503),self.now)
        self.assertEqual(r["status"],"UPSTREAM_STATUS_UNVERIFIED")

    def test_no_naive_clock(self):
        with self.assertRaises(ValueError):
            probe(self.fake(),datetime(2026,11,3))

    def test_malformed_or_empty_archive(self):
        self.assertEqual(inspect_zip(b"broken")["status"],"FOUND_NON_ZIP_OR_TOO_LARGE")
        self.assertEqual(inspect_zip(archive(member="elsewhere.csv"))["status"],
                         "FOUND_UNCONFIRMED_ELECTION_MEMBER")


if __name__=="__main__":
    unittest.main()
