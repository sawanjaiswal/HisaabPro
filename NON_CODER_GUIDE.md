# 📖 HisaabPro Non-Coder Playbook & Operations Guide

> **Welcome!** This guide contains everything you need to run, test, manage, and ship **HisaabPro** without needing to write code from scratch. All commands can be copied and pasted directly into your terminal.

---

## 📑 Table of Contents
1. [⚡ Quick Cheat Sheet (Daily One-Liners)](#1--quick-cheat-sheet-daily-one-liners)
2. [🌐 How to Run the Web App (Mac & Windows)](#2--how-to-run-the-web-app)
3. [📱 How to Run the App on an Android Phone](#3--how-to-run-the-app-on-an-android-phone)
4. [🧪 How to Run `/testme` (Automated Real-Device QA)](#4--how-to-run-testme-automated-real-device-qa)
5. [🌿 Git Workflows (Save, Branch, Merge, Push)](#5--git-workflows-save-branch-merge-push)
6. [🛠️ Troubleshooting & Common Fixes](#6--troubleshooting--common-fixes)

---

## 1. ⚡ Quick Cheat Sheet (Daily One-Liners)

| What You Want to Do | Command to Run | Where It Runs |
|---|---|---|
| **Start Everything (Frontend + Backend)** | `./start-all.sh` | Terminal |
| **Stop All Running Servers** | `./stop-all.sh` | Terminal |
| **Open Web App in Browser** | `http://localhost:5002` | Chrome / Safari |
| **Run Android App on Connected Phone** | `npm run android` | Phone + Android Studio |
| **Run Android Live Reload (Real-Time)** | `npm run android:live` | Phone |
| **Build Release APK (Installable File)** | `npm run release:apk` | Terminal |
| **Run `/testme` Hardware QA Suite** | `npm run test:device` | Phone (0 AI Tokens) |
| **Check Code Health & 18 Safety Gates** | `npm run qa:full` | Terminal |

---

## 2. 🌐 How to Run the Web App

### The 1-Click Method (Recommended)
Open your terminal inside the `HisaabPro` folder and run:
```bash
./start-all.sh
```
- **Frontend URL:** [`http://localhost:5002`](http://localhost:5002)
- **Backend API:** [`http://localhost:5001`](http://localhost:5001)

### To Stop the Servers:
```bash
./stop-all.sh
```

---

## 3. 📱 How to Run the App on an Android Phone

### Step 1: Prepare Your Android Phone
1. Enable **Developer Options**: Go to *Settings → About Phone* → Tap **Build Number** 7 times.
2. Enable **USB Debugging**: Go to *Settings → System → Developer Options* → Turn ON **USB Debugging**.
3. Connect phone to your computer with a USB cable. Tap **"Allow"** when the pop-up appears on your phone.

### Step 2: Run the App on Phone
Run this single command:
```bash
npm run android
```
*What this does automatically:*
1. Compiles the latest frontend code.
2. Syncs files to the Android project (`Capacitor Sync`).
3. Opens Android Studio so you can press the green **▶ Play** button to install on your phone.

### Live-Reload Mode (Instant Code Changes on Phone)
If you are modifying screens and want to see updates on your phone in real-time without rebuilding:
```bash
npm run android:live
```

### Build an Installable APK (To Share with Friends)
```bash
npm run release:apk
```
Your ready-to-install `.apk` file will be created in:
`android/app/build/outputs/apk/release/`

---

## 4. 🧪 How to Run `/testme` (Automated Real-Device QA)

`/testme` is your **0-token autonomous hardware tester**. It connects to your physical Android phone, walks through the entire app like a real human merchant, verifies GST calculations, tests Android keyboard behavior, checks crash recovery, and captures screenshots.

### How to Run:
Make sure your phone is unlocked and connected via USB, then run:
```bash
npm run test:device
```
*(or type `/testme` in the chat with Antigravity)*.

### Understanding the Results:
- **`🟢 RELEASE CANDIDATE PASSED`**: The app passed all 8 Journey Contracts, business calculations, and keyboard checks. It is safe to ship!
- **`🔴 RELEASE CANDIDATE BLOCKED`**: An error or assertion failed. 
  - Look at the generated file **`JOURNEY_AUDIT_REPORT.md`** or tell Antigravity:
  > *"Antigravity, /testme found an issue, please fix it."*
  - Antigravity will view the screenshot, fix the root cause, and re-run `/testme` until green.

---

## 5. 🌿 Git Workflows (Save, Branch, Merge, Push)

Git is your project's time machine. Here is how to perform all daily operations safely:

### A. Check What Changed
```bash
git status
```
*(Shows all modified, added, or deleted files in red/green)*.

---

### B. Save & Commit Your Changes
```bash
# 1. Stage all changes
git add .

# 2. Save with a clear message describing what you did
git commit -m "feat: updated dashboard period selector and styling"
```

---

### C. Push Changes to GitHub
```bash
# Push your current branch to GitHub
git push origin main
```
*(If working on a specific branch like `feature/new-screen`, use `git push origin feature/new-screen`)*.

---

### D. Create a New Branch for a New Feature
Never work directly on `main` when experimenting with large features.
```bash
# Create and switch to a new branch
git checkout -b feature/invoice-templates
```

---

### E. Merge a Feature Branch Back to Main
When your feature is complete and `/testme` passes:
```bash
# 1. Switch to main
git checkout main

# 2. Get latest updates
git pull origin main

# 3. Merge your feature branch
git merge feature/invoice-templates

# 4. Push updated main to GitHub
git push origin main
```

---

### F. Undo Changes / Discard Mistakes
If you made changes that broke something and want to revert back to the last saved version:
```bash
# Discard all unstaged changes in files
git restore .

# Discard everything and reset cleanly
git reset --hard HEAD
```

---

## 6. 🛠️ Troubleshooting & Common Fixes

### ❓ Issue 1: "Port 5001 or 5002 already in use"
**Fix:** Run the port cleaner script:
```bash
./stop-all.sh
```
Or manually free ports:
```bash
sh scripts/free-dev-ports.sh 5001 5002
```

---

### ❓ Issue 2: "No physical Android device connected via ADB"
**Fix:** 
1. Unplug and replug the USB cable.
2. Run:
   ```bash
   adb devices
   ```
3. Look at your phone screen and ensure you tap **"Always Allow from this computer"**.

---

### ❓ Issue 3: "Database connection error / Prisma error"
**Fix:** Re-generate your Prisma client and sync database schema:
```bash
cd server
npx prisma generate
npx prisma db push
cd ..
```

---

### ❓ Issue 4: "TypeScript or Gate Error (enforce.js failed)"
**Fix:** Run the mechanical gate to see exactly which file needs attention:
```bash
node scripts/enforce.js
```
Then ask Antigravity to fix the specific check mentioned in the terminal output.

---

### 💡 Golden Rule for Non-Coders
When in doubt, you only ever need these 3 commands:
1. `./start-all.sh` *(To run and test locally)*
2. `npm run test:device` *(To verify everything on your phone with `/testme`)*
3. `git status` + `git commit -am "your message"` + `git push` *(To save your work)*
