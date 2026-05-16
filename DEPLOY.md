# Deployment Steps

## Current setup

This project now uses Google Apps Script as the free backend and host for the live app.

```text
Browser -> Google Apps Script -> Google Sheets + Google Drive
```

Cloudflare Worker is no longer required for the working app.

## Files to paste in Apps Script

Create an Apps Script project with these files:

| Apps Script file | Local source file |
| --- | --- |
| `Code.gs` | `appsscript/Code.gs` |
| `Index.html` | `appsscript/Index.html` |
| `Admin.html` | `appsscript/Admin.html` |

## One-time Apps Script deploy

1. Open https://script.google.com/home.
2. Click **New project**.
3. Rename the project to `PM SHRI Activity Monitoring`.
4. Replace `Code.gs` with the content of `appsscript/Code.gs`.
5. Add an HTML file named `Index` and paste `appsscript/Index.html`.
6. Add an HTML file named `Admin` and paste `appsscript/Admin.html`.
7. Click **Save**.
8. Click **Deploy** -> **New deployment**.
9. Select type: **Web app**.
10. Set **Execute as** to **Me**.
11. Set **Who has access** to **Anyone**.
12. Click **Deploy**.
13. Approve the Google permissions.
14. Copy the Web App URL.

## Live URLs

After deployment, the user form is:

```text
https://script.google.com/macros/s/AKfycbxPo5wRnAy_ShXdIAXMeGVUsNjda9eUz-lXN05wxpg8wLy-CkT3PODrmju2zYV70GGV/exec
```

The admin panel is:

```text
https://script.google.com/macros/s/AKfycbxPo5wRnAy_ShXdIAXMeGVUsNjda9eUz-lXN05wxpg8wLy-CkT3PODrmju2zYV70GGV/exec?page=admin
```

## Required Google access

The Apps Script code uses these fixed IDs:

| Item | ID |
| --- | --- |
| Google Sheet | `1Xru8dZVrxCQO2e71oKhLr_ISVPJHGKBZlznK1zSxZj8` |
| Photos folder | `1LJAqwfPqcCBO77GLFzL0SrZqhum5PptJ` |

The Google account that deploys the Apps Script must have access to both.

## Admin password

The admin password is set in `appsscript/Code.gs`:

```js
const ADMIN_PASSWORD = 'pmshri@2026';
```

Change it before deployment if needed.

## Updating later

When code changes:

1. Paste the updated files into Apps Script.
2. Click **Deploy** -> **Manage deployments**.
3. Edit the existing Web App deployment.
4. Select **New version**.
5. Click **Deploy**.

