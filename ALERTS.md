# New-poll email alerts

The Election Command Center checks the supplemental PollResults.org / NYT-derived poll index in the existing **four-hour GitHub Actions refresh**. Alerts are opt-in. They name the exact office, district or state, pollster, candidates, reported shares, fieldwork dates, sample population and size, posting time, and original survey link.

**Important:** PollResults timestamps are index-ingestion timestamps, *not independently verified release/publication dates*. These emails say **newly indexed**, not necessarily newly published. The index covers only a portion of all available polls. A missed or delayed source update can delay or prevent alerts.

## Easiest setup: Gmail (two secrets)

1. Use a personal Gmail account with **2-Step Verification** enabled. Under [Google Account → App passwords](https://myaccount.google.com/apppasswords), create an app password for the Election Command Center. Google does not offer app passwords on every account, including some managed Workspace and Advanced Protection accounts.
2. In [GitHub repository → Settings → Secrets and variables → Actions](https://github.com/jmon18-rgb/Election-Command-Center/settings/secrets/actions), create **repository secrets**:
   - `POLL_GMAIL_ADDRESS` — the Gmail address used to send and (by default) receive alerts.
   - `POLL_GMAIL_APP_PASSWORD` — the Gmail-generated **app password**, not the ordinary Gmail login password.
3. Optionally add `POLL_ALERT_TO` if the alerts should go to a different inbox. Otherwise delivery targets the same Gmail address.
4. After merging this change, use [Actions → Refresh election briefing → Run workflow](https://github.com/jmon18-rgb/Election-Command-Center/actions/workflows/refresh-briefing.yml) to establish the alert baseline. **The first run intentionally sends no catch-up email.** Once a new indexed observation arrives, the subsequent eligible refresh can email it.

**Never enter passwords into the dashboard or commit them to GitHub files.** GitHub Actions secrets are injected only into the mail step. The SMTP connection uses TLS; the source and destination addresses are not publicly visible in dashboard JSON.

If Google app passwords are unavailable, the existing generic SMTP configuration remains supported: `POLL_SMTP_HOST`, `POLL_SMTP_USERNAME`, `POLL_SMTP_PASSWORD`, `POLL_ALERT_FROM`, `POLL_ALERT_TO`; optionally `POLL_SMTP_PORT` (465 default; 587 STARTTLS supported).

## Delivery guarantees and limitations

- The four-hour GitHub cron is approximate; workflows may run late. Polls indexed within the last two calendar days are eligible, and stable poll/question identities prevent repeating already-seen observations.
- Alerts are **not guaranteed instant** or complete. Indexer coverage and lag are outside this project's control.
- The alert state is saved in `data/poll_alert_state.json` during refresh. A successful SMTP send followed by a GitHub publish failure can occasionally result in a duplicate after retry; these are *at-least-once* notifications, not exact-once delivery.
- Without credentials, the workflow skips email sending and does not claim that anything was delivered.
- The source date, not the fieldwork end, determines the detection window. The dashboard still displays the original source and sample details.
