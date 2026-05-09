# Screen2Issue Demo Recording Guide

This folder contains everything you need to record a demo that shows every Screen2Issue feature end-to-end.

---

## What's in here

| Path | Purpose |
|---|---|
| `app/index.html` | A standalone fake issue tracker ("Tracer") with 4 real, reproducible bugs |
| `har/tracer-session.har` | A pre-made HAR file from a Tracer session — includes a 500 error, a 403, auth headers, and query params |

---

## Before you record

1. Open `app/index.html` directly in Chrome (`File → Open` or drag the file into a tab). No server needed.
2. Set your browser zoom to **110%** so text is legible in the recording.
3. Open **Chrome DevTools → Network tab** (you'll export a live HAR at the end of your recording).
4. Make sure Screen2Issue is running at `http://localhost:5173` (`npm run dev`).
5. Have an AI provider key already configured in Screen2Issue Settings.
6. Use a screen recorder (QuickTime, Loom, or OBS). Record at full 1440px width if possible.

---

## The Bug Script (what to do on screen)

Walk through this sequence. It takes about 45–60 seconds.

### Scene 1 — Arrive at the dashboard (~5s)
Open the Tracer app. Let the table load. The stats cards and issue list are visible.

### Scene 2 — Try the High Priority filter (~8s)
Click the **High Priority** filter chip.

> **Bug visible:** The list goes empty even though BUG-001 and BUG-002 are high priority. The filter logic is inverted — it hides high priority items instead of showing them.

Click **All** to reset.

### Scene 3 — Notice the Invalid Date (~5s)
Scroll your cursor slowly across the **Last Updated** column. Pause on BUG-003 where it shows `Invalid Date` in red.

### Scene 4 — Open the detail panel (~8s)
Click the **BUG-003** row to open the detail panel on the right.

Point out: `Invalid Date` appears again in the metadata section.

Close the detail panel (✕).

### Scene 5 — Create a new issue (fails with 500) (~25s)
Click **New Issue** in the top-right.

Fill in the form:
- **Title:** `Settings page crashes on Firefox when 2FA is enabled`
- **Description:** `Steps: 1. Enable 2FA on account. 2. Navigate to Settings. 3. Page throws unhandled promise rejection.`
- **Priority:** High
- **Assignee:** Alex Morgan (me)
- **Component:** Authentication

Click **Create Issue**.

> **Bug visible:** A spinner appears for ~2 seconds, then an error toast:
> _"Failed to create issue — Server returned 500 Internal Server Error"_

### Scene 6 — Resolve button reverts (~10s)
Click **Resolve** on **BUG-001** in the table.

> **Bug visible:** The status briefly changes to "Resolved", then snaps back to "Open" ~1.5 seconds later with an error toast: _"Could not update BUG status — the change was not saved to the server."_

---

## Export the HAR (during Scene 5)

When you click **Create Issue**, Chrome will fire a POST request that you can capture:

1. In DevTools → Network tab, right-click any request.
2. Select **Save all as HAR with content**.
3. Save as `tracer-live.har`.

Or skip this and use the pre-made **`har/tracer-session.har`** — it has the same 500 error and a 403 already captured.

---

## Now open Screen2Issue

With your screen recording saved as an `.mp4` or `.webm`, go to `http://localhost:5173` and walk through the full flow:

### Step 1 — Upload
Drop your recording in. Show the file size and format in the upload card.

> Say: _"No server. All processing happens locally in the browser."_

### Step 2 — Processing
Watch the progress bar. OCR and cursor detection run automatically.

> Say: _"OCR extracts the text from every frame. Cursor detection flags where clicks happened."_

### Step 3 — Timeline
- **Toggle off** 2–3 irrelevant frames (e.g. the idle state before clicking New Issue).
- **Click a frame** showing the error toast — show the OCR text it extracted.
- **Edit the note** on the frame where the spinner appeared: type `"Create Issue spinner — hung for 2s then 500 error"`.

### Step 4 — Enhancements: HAR import
Click the HAR section. Drop in `har/tracer-session.har` (or your live export).

> Show: the POST /api/issues 500 entry appears. Scroll to show the query params are `[redacted]` and the auth token is stripped.

> Say: _"Sensitive tokens and query params are redacted automatically."_

### Step 5 — Export
Click **Generate Report** (with AI configured).

Then show all three export actions:
1. **Copy AI Prompt** — paste into Claude or ChatGPT. Show the AI responding with a root cause hypothesis.
2. **Download Markdown** — scroll through it quickly. Title, environment, steps to reproduce, timeline notes, HAR summary — all there.
3. **Download ZIP** — mention it includes the frames as PNGs alongside the report.

> Say: _"A developer gets this and has everything they need — without watching the recording."_

---

## HAR file contents (what Screen2Issue will redact)

The pre-made `tracer-session.har` contains:

| What it contains | What Screen2Issue does |
|---|---|
| `Authorization: Bearer eyJ…` header | Stripped from export |
| `session_id` cookie | Stripped from export |
| `?api_key=sk_dev_a1b2c3d4e5f6` query param | Redacted to `[redacted]` |
| POST body with issue title + description | Not exported by default |
| 500 error on POST /api/issues | Shown in HAR summary |
| 403 on PATCH /api/issues/BUG-001 | Shown in HAR summary |

---

## Tips

- **Don't rush the spinner** in Scene 5. Let it hang visibly — that 2-second pause is what makes the bug feel real.
- **Hover your cursor on the error toast** after it appears. OCR will capture the text, which makes the AI report more accurate.
- If OCR misreads something in the timeline, fix it inline before generating the report — that's a feature worth showing.
