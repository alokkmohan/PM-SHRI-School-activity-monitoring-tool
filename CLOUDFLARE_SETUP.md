# Cloudflare Worker Setup

This setup is deprecated for this project.

The project has been moved back to Google Apps Script mode to avoid service account private key setup and Cloudflare Worker secrets.

Use [DEPLOY.md](DEPLOY.md) instead.

Current recommended setup:

```text
Browser -> Google Apps Script -> Google Sheets + Google Drive
```

Cloudflare Worker files are still present in `cloudflare-worker/` for reference, but they are not required for the free Apps Script deployment.
