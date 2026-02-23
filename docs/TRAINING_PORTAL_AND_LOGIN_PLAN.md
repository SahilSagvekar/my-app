# Training Portal & Login – Implementation Plan

**Purpose:** Allow admins to upload role-specific training videos and let staff (Editor, QC, Scheduler, etc.) watch them in a Training portal. Temporarily disable password requirement on login until the training section is complete.

---

## 1. Admin: Upload Training Videos by Role

**Goal:** Admins can upload training videos and assign each video to one or more roles (Editor, QC, Scheduler, Manager, Videographer, Sales).

**Scope:**

- **Data model:** New `TrainingVideo` (or similar) table: title, description, video URL (or S3 key), role(s), optional order/sequence, created/updated timestamps.
- **Storage:** Reuse existing S3/upload flow (same as task files) for video files; store only URL/key and metadata in DB.
- **Admin UI:** New “Training Management” tab (or section) in Admin Dashboard where admins can:
  - Upload a video file (or link).
  - Set title and short description.
  - Select target role(s): Editor, QC, Scheduler, Manager, Videographer, Sales.
  - Optionally set display order.
  - List, edit, and delete existing training videos.
- **APIs:** 
  - `POST /api/training/videos` – create (with upload or URL).
  - `GET /api/training/videos` – list (admin: all; others: filtered by role).
  - `PATCH/DELETE` for edit/remove.

**Outcome:** Admins manage a single library of training videos tagged by role.

---

## 2. Training Portal for Staff (Editor, QC, Scheduler, etc.)

**Goal:** Staff see a “Training” page in their role’s sidebar and can watch only the videos assigned to their role.

**Scope:**

- **Access:** Reuse existing “Training” nav item per role (Editor, QC, Scheduler, Manager, Videographer, Sales). Only authenticated users with a role see the page.
- **Content:** Training page shows:
  - List of modules/videos for the current user’s role (from DB, not hardcoded).
  - For each item: title, description, thumbnail (if we add it), and a “Watch” button that opens the video (inline or full-screen).
- **Behaviour:** 
  - Videos are streamed/played via stored URL (e.g. S3 signed URL or public URL).
  - Optional later: mark as “completed” and simple progress (e.g. per-video or per-module).
- **Existing QCTrainingPage:** Can be refactored so QC (and other roles) get dynamic content from the new training API instead of hardcoded modules; any role-specific password (e.g. “QC2024”) can be removed once access is controlled by app login and role.

**Outcome:** Each role has one Training page showing only their assigned videos, with watch and optional progress.

---

## 3. Temporarily Disable Password on Login

**Goal:** Users can sign in with email only (no password check) until the training section is finished; password will be re-enabled later.

**Scope:**

- **Login API:** Already skips password validation (commented out in `/api/login`). Keep as-is: require email in request body; treat password as optional and do not validate.
- **Login screen:** 
  - Hide the password field in the UI, or make it optional and ignore it (e.g. “Password temporarily disabled” message).
  - Ensure “Forgot password” / “Reset password” flows are hidden or disabled so users are not prompted to set/use passwords during this period.
- **Documentation:** Note in code or config that “Password check is temporarily disabled; will be re-enabled after training portal is complete.”
- **Re-enable later:** When training is done: uncomment/restore password validation in `/api/login`, show password field and Forgot/Reset password again.

**Outcome:** Login is email-only for now; no UI or API enforcement of password until we turn it back on.

---

## 4. Implementation Order (Suggested)

| Phase | Task |
|-------|------|
| **A** | Temporarily disable password on login (UI + keep API as-is). |
| **B** | Add `TrainingVideo` model and migrations; implement CRUD APIs and role-based filtering. |
| **C** | Implement video upload (reuse S3/upload) and wire admin “Training Management” UI. |
| **D** | Refactor Training page(s) to load videos from API by role; remove hardcoded modules and training password. |
| **E** | (Optional) Add “completed” / progress tracking for training videos. |
| **F** | Re-enable password on login when training section is finished. |

---

## 5. Summary

- **Admin:** Upload and manage training videos per role (Editor, QC, Scheduler, etc.) in a dedicated Training Management area.
- **Staff:** Access a single Training portal; see and watch only videos for their role.
- **Login:** Password requirement turned off temporarily (email-only); re-enabled after training work is complete.

This plan can be shared with stakeholders and used as the basis for implementation and timeline estimates.
