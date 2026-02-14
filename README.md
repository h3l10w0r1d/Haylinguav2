# Haylingua

Haylingua is a Duolingo-style language learning platform focused on Armenian — designed to make learning structured, fast, and genuinely fun.

It consists of:
- **Learner App** (public): users learn through short lessons made of interactive exercises and earn XP/streaks.
- **Haylingua CMS** (admin): content management for lessons and exercises (and later: team access, analytics, etc.).

---

## What users get

### Learning path
- Lessons are arranged in a progression (a “path”).
- Each lesson has a **slug** (used in URLs), a title, a level, and a description.
- Lessons contain a sequence of **exercises**.

### Exercises
Haylingua supports multiple exercise “kinds” (types), e.g.:
- Letter intro
- Sound multiple-choice
- Letter recognition
- Type the letter / word
- Spell word
- Fill in the blank
- Translate multiple-choice
- True/False
- Sentence order (and more as the system expands)

Exercises can reward **XP**, and user progress is tracked per exercise and per lesson.

### Gamification
- XP gain and leveling
- Daily streaks
- Hearts/lives (optional rules, depending on configuration)
- Completion states and retry flows

---

## CMS (Content Management System)

The CMS is used to:
- Create/edit lessons (slug, title, level, description)
- Create/edit exercises for a lesson
- Configure exercise content via structured UI and/or JSON configs (depending on the editor mode)
- (Optionally) Invite admins and enable CMS-only authentication flows

The CMS is intended to run on a subdomain such as:
- `https://cms.haylingua.am`

---

## Architecture overview

### Frontend
- React (Vite)
- TailwindCSS
- Routed SPA that includes:
  - Learner experience (dashboard, lesson player, profile, friends, leaderboard)
  - CMS experience (admin UI)

### Backend
- FastAPI (Python)
- PostgreSQL
- JWT auth for the learner app
- CMS auth is separate and can be enforced via CMS-only middleware/routes

### Storage / Data model (high level)
- **users**: auth + profile
- **lessons**: slug, title, level, description, etc.
- **exercises**: lesson_id, kind, prompt, config (json), xp, sort order
- **user_exercise_logs**: attempts, correctness, xp earned, timestamps
- **user_lesson_progress**: progress snapshots, completion thresholds, etc.

---

## Progress and completion logic

Typical behavior:
- A lesson is completed when the user finishes enough exercises (for example: **≥ 70%** completion threshold).
- XP should be granted based on **XP actually earned**, not simply “full XP if completed”.
- The lesson UI shows:
  - completed exercises (green / replay CTA)
  - current exercise (primary CTA)
  - locked future lessons (grey, no CTA)

These rules are configurable and can evolve as the product grows.

---

## Environments

You will typically have:
- **Backend API**
  - Example: `https://haylinguav2.onrender.com`
- **Learner Frontend**
  - Example: `https://haylingua.am`
- **CMS Frontend**
  - Example: `https://cms.haylingua.am`

The frontend uses environment variables such as:
- `VITE_API_BASE` / `VITE_API_URL` for the API base URL.

---

## Product direction (Phase roadmap)

### Phase 1 — Core learning loop
- Lessons + exercises
- XP/streaks
- Dashboard + lesson player

### Phase 2 — Higher-quality UX + reliability
- Better completion screens and feedback
- Audio feedback for correct/incorrect/completion
- Stronger correctness validation per exercise kind
- Fix edge cases and tracking accuracy

### Phase 3 — CMS maturity
- Stable team access (admin invites)
- 2FA (Google Authenticator)
- Better content editor UX
- Analytics (exercise correctness, completion funnel, retention)

---

## License / Notes
This repository is the working codebase for Haylingua and is intended for internal development and controlled deployments.
