# CORA Project — Development Standards

## Project Overview
CORA (Cognitive Operator Reactor Assistant) is a student-facing learning tool built on Neo4j knowledge graphs. It has a public landing page, an authenticated student frontend, and an admin app.

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS v4, React Router 6
- **UI Libraries**: Neo4j NDL (`@neo4j-ndl`), Neo4j NVL (`@neo4j-nvl`), Material UI, react-icons
- **Auth**: Auth0 with JWT, role-based (admin, ta, student)
- **Backend**: Python/FastAPI, Neo4j, PostgreSQL

## Tailwind Configuration
- **Preflight is DISABLED** (`corePlugins: { preflight: false }`) — Neo4j NDL handles base styles
- This means NO global `box-sizing: border-box`. Always add `style={{ boxSizing: 'border-box' }}` or Tailwind's `box-border` class on layout roots
- Neo4j NDL Tailwind preset is loaded — some Tailwind defaults may be overridden
- No custom theme extensions — use standard Tailwind color palette

## Design Tokens — Landing Page & Student Frontend

### Colors
- **Primary**: `red-600` (#dc2626) — buttons, CTAs, logo, accents
- **Primary hover**: `red-700` (#b91c1c)
- **Surface tinted**: `red-50` (#fef2f2) — section backgrounds, card tints
- **Border**: `red-100` (#fee2e2) — card borders, dividers
- **Border hover**: `red-200` (#fecaca)
- **Text primary**: `slate-900` (#0f172a)
- **Text secondary**: `slate-500` (#64748b)
- **Text muted**: `slate-400` (#94a3b8)
- **Background light**: `white` — alternates with `red-50` between sections

### Typography
- Hero headings: `text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]`
- Section headings: `text-2xl font-bold tracking-tight`
- Eyebrow labels: `text-xs font-semibold uppercase tracking-wider text-red-500`
- Body: `text-sm leading-relaxed text-slate-500`
- Small labels: `text-[11px] font-semibold uppercase tracking-wider`

### Spacing
- Section vertical padding: `py-16` to `py-24`
- Container horizontal padding: `px-6`
- Max content width: `max-w-5xl` (consistent across all sections)
- Card padding: `p-6`
- Grid gap: `gap-6` to `gap-8`

### Components
- **Buttons (primary)**: `rounded-full bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-red-300 hover:bg-red-700`
- **Buttons (secondary)**: `rounded-full border border-red-200 bg-white px-6 py-3 text-sm font-medium text-red-600 hover:border-red-300`
- **Cards**: `rounded-2xl border border-red-100 bg-white p-6 shadow-sm hover:border-red-200 hover:shadow-md`
- **Icon containers**: `h-10 w-10 rounded-xl bg-red-50 text-red-600`
- **Pill badges**: `rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-600`

### Layout Pattern
- Sections alternate backgrounds: `bg-red-50` → `bg-white` → `bg-red-50` → `bg-white`
- No gradient dividers between sections — the alternating colors provide separation
- Blurred decorative orbs: `absolute rounded-full bg-red-100 blur-3xl` on tinted sections

## File Structure
- `frontend/src/components/Landing/` — Public landing page
- `frontend/src/components/Student/` — Authenticated student frontend (Chat, Explore, Learn tabs)
- `frontend/src/components/Auth/Auth.tsx` — Auth0 guard with role-based routing
- `frontend/src/App.tsx` — Route definitions

## Routing
- `/` — Public landing page (when auth enabled)
- `/app` — Admin/TA app (AuthenticationGuard redirects students to /student)
- `/student` — Student frontend (StudentGuard)
- `/callback` — Auth0 callback
- `/chat-only` — Standalone chat

## Key Patterns
- Student frontend uses **state-based tabs** (not routes) so chat state persists across tab switches
- `envConnectionAPI()` for auto-connecting to Neo4j without a modal
- `useOutletContext` is NOT used in the student frontend — each tab is a standalone component
- Always use `react-icons/hi2` for Heroicons in the landing/student pages
