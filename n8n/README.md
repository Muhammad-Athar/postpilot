# n8n workflows

Self-hosted n8n (Docker) runs the long-running jobs. The app never calls Gemini for bulk generation itself; it hands n8n a prompt bundle and receives validated drafts back.

| Workflow | Trigger | What it does |
|---|---|---|
| `postpilot-generate.json` | `POST /webhook/postpilot-generate` (Header Auth: `x-postpilot-secret`) | `GET /api/campaigns/:id/bundle` → one `POST /api/campaigns/:id/generate-one` per platform × candidate (one every 6.5 s, 3 retries 30 s apart). The app runs the model with its retry + fallback chain and inserts the draft. |
| `postpilot-errors.json` | Error Trigger (set as the error workflow of the above) | `POST /api/campaigns/:id/fail` with the failing node and message |

## Deploy

```bash
APP_BASE_URL=https://your-app.vercel.app n8n/deploy.sh
```

The script stamps `APP_BASE_URL_HERE` in the workflow JSON and the placeholders in `credentials.template.json` from `web/.env.local`, copies everything to the VM, imports via the n8n CLI inside the container, activates the generate workflow, deletes the stamped copies, and restarts n8n. Nothing secret is committed.

Credentials created on import: `Postpilot app secret` (Header Auth) and `Postpilot Gemini key` (Query Auth). n8n 2.x blocks `$env` in expressions, which is why credentials are used instead of environment variables.
