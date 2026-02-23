# Training Portal – Implementation Plan (V2)

**Purpose:** Admins upload role-specific training videos; staff (Editor, QC, Scheduler, etc.) see them as a **course** in the Training portal. Login uses email-only (password disabled) until training is complete.

**Key requirement (feedback):** Videos must appear in **course format** for each role. Example: if the Editor has a 4-video course, the admin uploads 4 videos for Editor, and when the Editor opens Training they see those 4 videos as one course (ordered, course-style layout).

---

## 1. Admin: Upload Training Videos by Role (Course Building)

**Goal:** Admins upload videos and assign them to roles. Each role’s videos form **one course** (ordered list of videos) for that role.

**Scope:**

- **Data model:** `TrainingVideo` table:
  - `id`, `title`, `description`, `videoUrl` (or S3 key), `role` (single role per video for simplicity: editor, qc, scheduler, manager, videographer, sales), `order` (integer for sequence in course), `createdAt`, `updatedAt`.
  - Order determines how videos appear in the course (Video 1, Video 2, …).
- **Storage:** Reuse existing S3/upload; store video URL/key and metadata in DB.
- **Admin UI – “Training Management” (Admin Dashboard):**
  - **Per role:** Admin can manage “course” for each role (Editor, QC, Scheduler, Manager, Videographer, Sales).
  - **Actions:** Upload video file (or link), set title and description, assign to **one** role, set **order** in that role’s course (e.g. 1, 2, 3, 4 for Editor’s 4 videos).
  - List all training videos (with role and order); reorder (e.g. drag-and-drop or order field); edit title/description/order; delete.
  - Optional: “Course title” per role (e.g. “Editor Training Course”) – can be a single config field or derived from role name.
- **APIs:**
  - `POST /api/training/videos` – create (upload or URL, title, description, role, order).
  - `GET /api/training/videos` – list (admin: all; others: filtered by user’s role, ordered by `order`).
  - `PATCH /api/training/videos/[id]` – update (title, description, order, optionally video URL).
  - `DELETE /api/training/videos/[id]` – remove.

**Outcome:** Admin builds one **course per role** (ordered set of videos). E.g. 4 videos for Editor with order 1–4 → Editor’s course has 4 videos in that order.

---

## 2. Training Portal for Staff – Course Format

**Goal:** When staff (Editor, QC, Scheduler, etc.) open Training, they see **one course** for their role: an ordered list of videos (e.g. “Video 1”, “Video 2”, … or “Module 1”, “Module 2”), not a flat list.

**Scope:**

- **Access:** Use existing “Training” nav item per role. Only authenticated users with that role see the page.
- **Content – course format:**
  - **Course title:** e.g. “Editor Training”, “QC Training”, or “Training – [Role]”.
  - **Ordered list of videos** for that role (from API: `GET /api/training/videos` filtered by role, sorted by `order`).
  - Each item: **position in course** (e.g. “1”, “2”, “3”, “4”), **title**, **description**, **Watch** button (open video inline or full-screen).
  - Example for Editor with 4 videos:
    - **Editor Training**
    - 1. [Title 1] – [Short description] – [Watch]
    - 2. [Title 2] – [Short description] – [Watch]
    - 3. [Title 3] – [Short description] – [Watch]
    - 4. [Title 4] – [Short description] – [Watch]
- **Behaviour:**
  - Playback via stored URL (S3 signed or public).
  - Optional later: mark as “completed” and show progress (e.g. “2/4 completed”).
- **Existing QCTrainingPage:** Refactor so all roles (including QC) get this **course** from the API (dynamic). Remove hardcoded modules and any role-specific training password; access = app login + role.

**Outcome:** Each role sees a single **course** (ordered set of videos). E.g. Editor with 4 uploaded videos sees exactly those 4 in order in course format.

---

## 3. Temporarily Disable Password on Login

**Goal:** Login with email only until the training section is finished; then re-enable password.

**Scope:**

- **Login API:** Keep current behaviour (password check commented out). Require email; do not validate password.
- **Login screen:** Hide password field or show “Password temporarily disabled”; hide/disable “Forgot password” and “Reset password”.
- **Docs:** Note in code that password is disabled until training portal is complete.
- **Later:** Re-enable password validation and Forgot/Reset flows.

**Outcome:** Email-only login for now.

---

## 4. Implementation Order

| Phase | Task |
|-------|------|
| **A** | Temporarily disable password on login (UI + keep API as-is). |
| **B** | Add `TrainingVideo` model (title, description, videoUrl, role, order, timestamps); migrations; CRUD APIs with role-based filtering and ordering. |
| **C** | Video upload (reuse S3) and Admin “Training Management” UI: upload, assign role, set order, list/edit/delete. |
| **D** | Training page: load videos by role (ordered), display in **course format** (course title + ordered list with Watch). Remove hardcoded content and training password. |
| **E** | (Optional) “Completed” / progress per video or per course. |
| **F** | Re-enable password when training section is complete. |

---

## 5. Summary

- **Admin:** Upload and manage training videos per role; set **order** so each role has one **course** (ordered list of videos).
- **Staff:** Open Training → see **one course** for their role (e.g. 4 videos for Editor as Video 1–4 in course format).
- **Login:** Email-only temporarily; password re-enabled after training is done.

This plan reflects the requirement that training is shown in **course format** for each role (e.g. Editor’s 4-video course shown as 4 ordered items when Editor opens Training).
