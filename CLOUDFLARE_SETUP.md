# Cloudflare Worker Setup Guide
## PM SHRI School Activity Monitoring Tool

GAS (Google Apps Script) ki jagah Cloudflare Worker use karega.
Do kaam hain: (A) Google Cloud mein Service Account banana, (B) Cloudflare Worker deploy karna.

---

## PART A — Google Cloud Console (Service Account)

### Step 1 — Project banana
1. https://console.cloud.google.com par jayen
2. Top mein **"Select a project"** → **"New Project"**
3. Name: `PM SHRI Monitoring` → **Create**

### Step 2 — APIs enable karna
1. Left menu → **"APIs & Services"** → **"Library"**
2. Search karein: **Google Drive API** → **Enable**
3. Search karein: **Google Sheets API** → **Enable**

### Step 3 — Service Account banana
1. Left menu → **"IAM & Admin"** → **"Service Accounts"**
2. **"Create Service Account"** click karein
3. Name: `pm-shri-worker` → **Create and Continue** → **Done**
4. Service account par click karein → **"Keys"** tab
5. **"Add Key"** → **"Create new key"** → **JSON** → **Create**
6. JSON file download ho jayegi — **sambhal ke rakhein**

JSON file mein ye fields hongi:
```
"client_email": "pm-shri-worker@....iam.gserviceaccount.com"
"private_key":  "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

### Step 4 — Google Sheet share karna
1. Google Sheet kholen: https://docs.google.com/spreadsheets/d/1Xru8dZVrxCQO2e71oKhLr_ISVPJHGKBZlznK1zSxZj8
2. **Share** button → service account email paste karein (`pm-shri-worker@....iam.gserviceaccount.com`)
3. Role: **Editor** → **Send**

### Step 5 — Google Drive folder share karna
1. Google Drive kholen → Photos folder par right click → **Share**
2. Service account email paste karein → Role: **Editor** → **Send**

---

## PART B — Cloudflare Worker Deploy Karna

### Step 1 — Cloudflare account banana
1. https://cloudflare.com par jayen → **Sign Up** (free)
2. Email verify karein

### Step 2 — Worker banana
1. Login ke baad: Left menu → **Workers & Pages**
2. **"Create"** → **"Create Worker"**
3. Worker ka naam: `pm-shri-api`
4. **"Deploy"** click karein (pehle default code aayega)

### Step 3 — Worker code daalna
1. Worker khul jayega → **"Edit Code"** click karein
2. Poora code delete karein
3. `cloudflare-worker/worker.js` ka poora content copy karke paste karein
4. **"Deploy"** click karein
5. Worker URL note karein: `https://pm-shri-api.YOUR-SUBDOMAIN.workers.dev`

### Step 4 — Secrets/Variables add karna
Worker page par → **"Settings"** → **"Variables and Secrets"**

Ye 5 secrets add karein (**"Add"** → Type: **Secret**):

| Variable Name    | Value |
|-----------------|-------|
| `SA_EMAIL`       | service account email (JSON se `client_email`) |
| `SA_PRIVATE_KEY` | private key (JSON se `private_key` — poora copy karein `-----BEGIN...-----END-----` ke saath) |
| `SHEET_ID`       | `1Xru8dZVrxCQO2e71oKhLr_ISVPJHGKBZlznK1zSxZj8` |
| `PHOTOS_FOLDER_ID` | `1LJAqwfPqcCBO77GLFzL0SrZqhum5PptJ` |
| `ADMIN_PASSWORD` | `pmshri@2026` |

Sab add karne ke baad **"Save and Deploy"** click karein.

### Step 5 — Test karna
Browser mein ye URL kholen:
```
https://pm-shri-api.YOUR-SUBDOMAIN.workers.dev/?action=getSchool&udise=09010101101
```
Agar JSON response aaye to Worker sahi kaam kar raha hai.

---

## PART C — GitHub Files Update Karna

Worker URL milne ke baad mujhe batayein:
```
https://pm-shri-api.YOUR-SUBDOMAIN.workers.dev
```

Main `index.html` aur `admin.html` mein GAS_API URL update kar dunga.

---

## Summary

```
PEHLE:  Browser → GAS (unreliable) → Google Sheets/Drive
AB:     Browser → Cloudflare Worker (99.99% uptime) → Google Sheets/Drive
```

Cloudflare Worker ki details:
- Free: 100,000 requests/day
- Uptime: 99.99%
- Mobile/Desktop: same behavior
- CORS: properly handled
