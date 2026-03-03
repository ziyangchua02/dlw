# DLW — Digital Learning Workspace

A full-stack AI-powered student learning platform built with React, Node.js and Supabase.

---

## Tech Stack

- **Frontend** — React 19 + Vite (port 5173)
- **Backend** — Node.js + Express ESM (port 3001)
- **Database & Storage** — Supabase (PostgreSQL + S3-compatible storage)
- **AI** — OpenAI GPT-4o

---

## Features

### 👩‍🎓 Student

- **Module dashboard** — view enrolled modules with spider chart stats, mastery scores and task progress bars
- **Module detail** — see upcoming assignments, quizzes, tests and deadlines
- **Question download** — download teacher-uploaded question papers (PDF)
- **PDF submission** — attach and submit answers directly in the browser
- **AI grading** — submission is automatically graded against the teacher's model answer; score (%) and written feedback returned instantly
- **Personalised quiz generation** — after grading, GPT-4o generates 6 MCQ questions targeting the student's specific weak areas
- **Spaced repetition** — revision sessions scheduled at Day 1 → 3 → 7 → 14 → 30 → 60 intervals
- **Revision widget** — dashboard shows all sessions due today; overdue sessions highlighted
- **MCQ quiz modal** — one question at a time, reveal answer, explanation shown, finish screen with score
- **AI chat assistant** — ask questions about any module directly from the dashboard

### 👨‍🏫 Teacher

- **Teacher dashboard** — create and manage modules with custom name, code and colour
- **Module content** — add assignments, quizzes, tests and deadlines; push to all enrolled students instantly
- **Upload question papers** — attach a PDF question paper to any item
- **Upload model answers** — upload a sample answer PDF; text is extracted and cached for AI grading
- **Student management** — search all registered students, enrol or remove them from a module

---

## Getting Started

### 1. Install dependencies

```bash
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Environment variables

Create `backend/.env`:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

### 4. Supabase SQL (run once in SQL editor)

```sql
alter table submissions add column if not exists is_sample boolean not null default false;
alter table submissions add column if not exists extracted_text text;

create table if not exists quiz_banks (
  id uuid primary key default gen_random_uuid(),
  item_id integer not null references module_items(id) on delete cascade,
  module_code text not null,
  student_id uuid not null,
  topic text,
  questions jsonb not null,
  score_at_generation integer,
  created_at timestamptz default now()
);

create table if not exists review_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_bank_id uuid not null references quiz_banks(id) on delete cascade,
  student_id uuid not null,
  item_id integer not null,
  module_code text not null,
  topic text,
  next_due date not null,
  interval_index integer not null default 0,
  score_pct integer,
  completed_at timestamptz,
  created_at timestamptz default now()
);
```
