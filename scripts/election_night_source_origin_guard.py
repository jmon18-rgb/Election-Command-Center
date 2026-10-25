#!/usr/bin/env python3
"""Require final provider responses from the exact independently approved URL.

urllib automatically follows cross-host HTTPS redirects. A 200+CORS+plausible
JSON document from a DIFFERENT origin/path is not proof that Open America
or civicAPI themselves supplied the election results. No redirect can silently
replace a declared source's provenance, even if its schema looks familiar.
"""


def require_exact_response_url(expected, response):
    getter = getattr(response, "geturl", None)
    if not callable(getter):
        raise ValueError("Provider response final URL cannot be verified")
    actual = getter()
    if not isinstance(actual, str) or actual != expected:
        # Avoid echoing untrusted redirect URLs or query strings in logs.
        raise ValueError("Election result provider redirected from approved URL")
    return True
