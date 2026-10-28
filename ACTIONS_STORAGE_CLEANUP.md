# Reviewed one-off Actions storage cleanup

The owner requested deletion of old, unneeded uploads without enabling paid
storage. The public metadata inventory listed2,110 artifacts totaling
1,573,573,410 bytes; this is repository inventory, not account allowance or a bill.

`data/test_artifact_cleanup_manifest_20261028.json` pins50 specific artifacts
with a reviewed total of324,536,415 bytes. Largest files come first. It includes
eight obsolete routine briefing deployment packages and42 duplicate synthetic
browser-test uploads. It does not discover additional deletion targets.

Synthetic uploads must be from one of six fixed test categories, at least24hours
old, and have a newer successful retained copy from the same workflow. Pages
packages must be at least6hours old, come from the pinned production workflow,
have an actual successful deploy job, and belong to a routine
`Update sourced election briefing` commit. Merge/release packages are excluded.
GitHub's [Pages upload action](https://github.com/actions/upload-pages-artifact)
normally expires these intermediate deployment packages after one day.

Current/previous successful copies, category baselines, pinned release runs and
heads, current main and active reviews remain protected. Unknown artifact names,
native/source originals, historical/research evidence, workflow logs/runs,
caches, repository files, guide materials, owner media/CSVs and recovery keys
are outside the cleanup. Git history and canonical data snapshots remain intact.

The scoped workflow runs offline tests and a read-only live preflight on the PR.
Only its first protected-main push can apply the dated plan; manual dispatch is
read-only. It uses a temporary repository token, with Actions write permission
only in the cleanup job. There is no schedule, artifact upload, paid runner,
billing change or archive activation.

Every delete rechecks exact identity/digest, the newer retained copy, completed
run state and current/open-review protections. Recent reruns are excluded. A
changed protection snapshot or unexpected response stops the remaining work;
confirmed deletions and partial errors remain in the job log/summary. Deletions
are paced and never automatically retried. The50-item cap respects GitHub's
[repository-token API limit](https://docs.github.com/en/actions/reference/limits).

Deletion reduces current storage; it does not erase already accrued usage or
prove available allowance. GitHub documents that billing figures can lag6–12hours
in [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
The approved first-night archive stays off until its separate capacity and
no-paid-usage requirements are verified.
