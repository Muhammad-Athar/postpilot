# n8n workflows

Part of [Postpilot](../README.md).

Self-hosted n8n (Docker) runs the long-running jobs. The app never calls Gemini for bulk generation itself; it hands n8n a prompt bundle and receives validated drafts back.

| Workflow | Trigger | What it does |
|---|---|---|
| `postpilot-generate.json` | `POST /webhook/postpilot-generate` (Header Auth: `x-postpilot-secret`) | `GET /api/campaigns/:id/bundle` → one `POST /api/campaigns/:id/generate-one` per platform × candidate (one every 6.5 s, 3 retries 30 s apart). The app runs the model with its retry + fallback chain and inserts the draft. |
| `postpilot-publish.json` | Schedule, every 5 min | `POST /api/publish/run` — the app claims due slots, runs the safety pass, publishes through the platform adapters with retries |
| `postpilot-analytics.json` | Schedule, every 6 h | `POST /api/analytics/sync` — the app pulls account and post metrics into `metric_snapshots` |
| `postpilot-notify.json` | `POST /webhook/postpilot-notify` (Header Auth) | Sends an email through the `Postpilot SMTP` credential (approval links). Optional: without `SMTP_USER`/`SMTP_PASS` the app shows the link for manual sharing |
| `postpilot-errors.json` | Error Trigger (set as the error workflow of the above) | `POST /api/campaigns/:id/fail` with the failing node and message |

## Deploy

```bash
APP_BASE_URL=https://your-app.vercel.app n8n/deploy.sh
```

The script stamps `APP_BASE_URL_HERE` in the workflow JSON and the placeholders in `credentials.template.json` from `web/.env.local`, copies everything to the VM, imports via the n8n CLI inside the container, activates the generate workflow, deletes the stamped copies, and restarts n8n. Nothing secret is committed.

Credentials created on import: `Postpilot app secret` (Header Auth), `Postpilot Gemini key` (Query Auth) and `Postpilot SMTP` (Gmail address + app password, optional). n8n 2.x blocks `$env` in expressions, which is why credentials are used instead of environment variables.
