# Learn with Sanu — Admin Dashboard

Admin-only coaching dashboard for **LearnWithSanu IIT** coaching platform.

## Features

- **Sessions** — Schedule, track, and complete coaching sessions. Assign Google Meet links, add notes, copy session details.
- **Communication** — Send emails via Resend using saved templates. Track mail log per student.
- **Enrollment** — View all student enrollments live from Supabase. Filter by plan, date, and status. Open student profiles.
- **Analytics** — Revenue and enrollment trends by plan and year.
- **Earnings** — Earnings breakdown and plan-wise revenue summary.

## Tech Stack

React 18 + TypeScript · Vite 6 · Tailwind CSS v4 · shadcn/ui · MUI · Supabase · Resend · Framer Motion

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the dev server:

```bash
pnpm run dev
```

## Database

Migrations are in `../enrollment_form/supabase/migrations/`. Run them in order in the Supabase SQL Editor before using this app.

An admin user must be created in Supabase Auth, and their UUID inserted into the `admin_profiles` table (see migration 001).

## Deployment

Deploy to Vercel. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel project settings.


