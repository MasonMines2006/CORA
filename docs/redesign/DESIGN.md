# CORA frontend redesign: design spec

**Status:** proposal, 2026-10-19. Design only; no app source changed.
**Prototype:** [`prototype/index.html`](prototype/index.html) (open with `file://` or any static server; no build step).
**Screenshots:** [`screenshots/`](screenshots/), one `*-desktop.png` (1440 × 900) and one `*-mobile.png` (375 × 812 at 2×) per screen.
**Target:** a complete, shippable product for the showcase on **Friday 2026-10-23** (section 10).

---

## 0. The direction in one paragraph

CORA should feel like a **training tool built by people who respect the subject**: Duolingo's visible path, short steps, tactile buttons and earned momentum, wrapped around ChatGPT's calm conversation, and with one non-negotiable addition for nuclear training: **every claim carries a receipt** you can open. The red-600 / red-50 / slate palette stays. What changes is everything that currently reads as an AI template: the centred hero with blurred orbs, uniform rounded cards, vague "study smarter" copy, and a chat that is a dark legacy widget. The three learning modes (Guide me, Ask, Quiz me) are three doors into **the same concept**, available to every learner at every moment; the only thing that adapts is difficulty, driven by measured mastery.

---

## 1. What makes the current UI feel "AI-ed" (observed 2026-10-19)

Looked at `http://localhost:8080/`, `/student` and `/student?view=ask`, and read `Landing.tsx`, `StudentApp.tsx`, `StudentHomeArtboard.tsx`, `StudentChat.tsx`.

| # | Where | What | Why it reads as generated |
|---|---|---|---|
| 1 | Landing hero | Centred headline "Learn with your **knowledge graph**", red pill eyebrow, two blurred `bg-red-100 blur-3xl` orbs | The single most common generated-landing layout. Names the technology, not the outcome. |
| 2 | Landing features | Three identical cards: icon tile + "Ask with context / See relationships / Learn faster" | Uniform card grid, interchangeable copy that fits any product. "Everything you need to study smarter." |
| 3 | Landing | "Illustration" section with a demo graph | Shows a hairball instead of the thing a student does. |
| 4 | Everywhere | `rounded-full` pills + `rounded-2xl` cards + `shadow-sm` at the same weight | Uniform radius and elevation flatten hierarchy. |
| 5 | Typography | System sans throughout (Space Grotesk only in the artboards) | No voice. Nothing says "engineering". |
| 6 | Student Home (empty) | "0 concepts pulled from your course materials. Start anywhere." above a blank area | Developer language, and an empty state that is just empty. |
| 7 | Ask | The legacy NDL `Chatbot` in a dark theme, a robot avatar, a timestamped welcome ("Welcome to CORA… built off of the Neo4j Knowledge Graph Chat"), no visible composer in the first viewport | Looks like a different product bolted on. Talks about its implementation. |
| 8 | Nav | Four peer tabs (Home / Concepts / Graph / Review) with the graph as a top-level destination | Presents the architecture rather than the learning journey. |
| 9 | Copy | "Learning assistant", "Learn from published material", "Get started" | Generic. No reactor, no scram, no decay heat anywhere on the page. |

---

## 2. Design principles

1. **The work is the first screen.** Signed-in users land on their path with one big "Continue" action. No marketing copy inside the app.
2. **One concept, three ways in.** Guide me, Ask and Quiz me are offered together wherever a concept appears (path popover, continue card, chat hand-off, graph inspector). Switching mode keeps the concept.
3. **Every answer has a receipt.** Citations are inline, monospaced chips (`RTM ch.4 · ¶142`) that open the passage. "Not in the published material" is a first-class answer, never a guess.
4. **Momentum, not pressure.** Streak and daily goal are visible and small. Nothing locks: no hearts, no gated units. A missed day pauses a streak; it never blocks safety content.
5. **Celebrate only what was earned.** Motion and colour bursts happen when mastery actually rises, once, and respect `prefers-reduced-motion`.
6. **Colour is meaning.** Red = action and selection. Emerald = mastered / correct. Amber = in progress / streak. Teal = graph structure. Slate = not started. Never decorative.
7. **Tactile and calm.** Big "key" buttons with a solid bottom edge (Duolingo) for actions; quiet type-led layouts (ChatGPT) for reading.
8. **Real copy.** Reactivity, decay heat, tech specs, scrams. Sample copy in the prototype is illustrative; in the app every fact comes from the published corpus (`docs/STUDENT_UI.md`).

### What we keep from the current direction (`docs/STUDENT_UI.md`)

| Kept | How it shows up |
|---|---|
| **The concept is the unit** | Path nodes are concepts; every mode works on one concept. |
| **Published material drives every mode** | Unchanged and made visible: "Grounded in 3 published passages", source drawer shows publisher and date. |
| **Semantic mastery colours** (emerald / amber / slate / teal / red) | Same hues and the same `MASTERED_AT = 80` threshold from `learningState.ts`. Text uses emerald-700 (not 600) for contrast. |
| **No silent fake data** | Formalised as the states rule in section 5.10. |
| **Graph as a feature, not a destination** | Graph explorer kept, demoted to a secondary nav item and a mode inside the concept inspector. |
| Desktop-first, usable on phones; 44px targets; bottom tab bar on mobile | Unchanged. |

### What we replace

| Replaced | With |
|---|---|
| Concept-first **navigation** (Home grid → concept hub with 5 tabs) | **Path-first** navigation: units → concepts on a visible path. The concept hub's tabs dissolve into the three modes plus a source drawer. |
| Four peer top tabs | Left sidebar (desktop) / 4-item bottom bar (mobile): Path, Ask, Review, Progress. Graph is secondary. |
| Legacy `Chatbot` inside the student app | A native Ask surface (section 5.4). Admin keeps the legacy chat for debugging. |
| Guest-first access (QR demo) | Invite-only accounts with in-house login (section 3). Guest mode becomes an open question (section 11). |

---

## 3. Information architecture

### 3.1 Roles and entry

```
Public  ─ Landing ── Sign in ─────────────┐
                 └─ Join (invite link) ────┤
                 └─ Forgot / reset ────────┤
                                           ▼
                       role from app_users (CORA JWT)
                 ┌─────────────┬───────────┴───────────┐
              student          TA                    admin
                 │              │                       │
          Student app     Student app            Student app
                          + Admin: Materials,    + Admin: Materials,
                            Analytics              Analytics, Users
```

TAs and admins can always "View as student". Students never see admin routes (server-enforced; the UI only hides links).

### 3.2 Student nav map

```
Sidebar (≥1024px)                 Bottom bar (<1024px)
───────────────────               ─────────────────────
[+ New session]                   Path · Ask · Review(7) · Progress
Path            ← home            Menu (☰) opens the sidebar as a drawer:
Ask                                 sessions, Course graph, account
Review (7 due)
Progress
Course graph    ← secondary
── Recent sessions ──             Focus mode (no chrome):
 ASK  Why decay heat matters…       Lesson, Quiz, Quiz results
 QUIZ Reactor period · 4 q          X returns to where you came from
 GUIDE Delayed neutron fraction
── 6-day streak · 2 of 3 today ──
```

Flows:

- **Path → concept popover → Guide me / Ask / Quiz me.**
- **Continue card → Lesson (focus) → Quick check → Quiz (focus) → Results → Path.**
- **Ask → "Keep going on Decay heat" → Quiz me / Guide me** (hand-off keeps the concept).
- **Citation chip → source drawer → "Open in document" / concept in graph.**
- **Review (due cards)** reuses the Quiz player chrome with flashcard grading.

### 3.3 Admin nav map

```
Admin sidebar: Materials (2 to review) · Analytics · Users · View as student
Materials: filter chips (All, Published, Needs review, Processing, Failed, Unpublished)
           table → review panel → Publish / Keep private
Analytics: headline numbers · hardest concepts · questions the material couldn't answer · student flags
Users:     invite by email (role) → invite links · role select · menu: issue reset link, view progress, deactivate
```

### 3.4 Routing recommendation

Keep the existing `?view=` state model (`studentLocation.ts`) so chat state persists across views, and add views rather than switching to nested routes before Friday: `path` (default), `ask`, `lesson`, `quiz`, `results`, `review`, `progress`, `graph`, each with `&concept=<id>` where relevant. Auth pages become real routes: `/signin`, `/join/:token`, `/reset/:token`, `/reset`. Admin stays under `/admin` with `?view=materials|analytics|users`.

---

## 4. Typography, layout and motion

### 4.1 Font pairing

| Role | Font | Why |
|---|---|---|
| Display (headings, big numbers) | **Bricolage Grotesque** 600–800, optical sizing | Warm, slightly quirky grotesque with real character at large sizes. It carries the Duolingo friendliness without a cartoon face, and it is clearly not the default AI-template Inter / Space Grotesk. |
| Body and UI | **IBM Plex Sans** 400–700 | Designed by IBM for engineering documentation. Excellent at 14–16px, clear figures, sub/superscripts look right (k<sub>eff</sub>, λ<sub>eff</sub>). Signals "technical manual", which is the right register for reactor training. |
| Citations, formulas, units, filenames | **IBM Plex Mono** 400–600 | Same skeleton as Plex Sans, so mixing them mid-sentence is seamless. Monospace makes citations look like references (`RTM ch.4 · ¶142`) and formulas line up in worked examples. |

Plex Sans + Plex Mono are one superfamily, so this is effectively a two-family system. Load from Google Fonts with `display=swap`; preload only Plex Sans 400 and Bricolage 700.

Type scale (px): display 56/40 (landing), 36/30 (page title), 28/24 (question), 22/20 (section), body 16 (reading) / 15 (UI) / 14 (secondary) / 13 (meta) / 12 (eyebrow, uppercase +0.08em). Headings use `text-wrap: balance`; short paragraphs `pretty`; every changing number uses `tabular-nums`.

### 4.2 Layout

- App shell: 272px sidebar + fluid main. Reading column 680–720px (lesson, chat). Path column ≤ 820px with a 300px "Today" rail at ≥1280px.
- Radius scale with intent, not one radius everywhere: 8px chips, 12px buttons and inputs, 14–16px panels, 20px hero cards, full circles only for path nodes and avatars.
- Separation by border (red-100 for brand surfaces, slate-200 for neutral ones); elevation only for things that float (popover, drawer, menu).
- White / red-50 alternation is kept for landing sections and used inside the app for "context" bands (continue card footer, upcoming unit, worked example).

### 4.3 Motion

- Buttons: 120ms transform/box-shadow; press moves 3px down onto its key edge.
- Enter: 260ms opacity + 6px rise + 2px blur (`.enter`). Exit 150ms.
- Streaming: text arrives in small chunks with a red caret; citation chips fade in as they land.
- Celebration: one 900ms burst on Results only when mastery rose. Disabled under reduced motion.
- Never `transition: all`; never animate layout properties.

---

## 5. Screen-by-screen spec

Each screen: purpose, layout, mobile, states, data. The prototype file is in brackets.

### 5.1 Landing [`landing.html`]

- **Purpose:** explain CORA to a student who has an invite, in 10 seconds, and get them signed in.
- **Layout:** left-aligned claim ("Study reactor theory with a tutor that shows its work.") with the real product beside it: a cited answer, the opened passage, and a mastery toast. Then "One concept, three ways in" demonstrating Guide / Ask / Quiz on the same concept (reactor period). Then "Every answer has a receipt" (red-50 band). Then library counts and a dark CTA strip.
- **Copy rules:** name the course and the subject. No "AI-powered", no "supercharge", no sparkles icon.
- **Mobile:** single column; product composite moves under the CTAs; section nav hidden.
- **States:** library counts come from the published corpus; if the API is down, hide the counts row rather than show zeros.
- **Data:** `GET /public/stats` (new, optional; cut to static copy if not built).

### 5.2 Auth: sign in, join, reset [`signin.html`, `join.html`, `reset.html`]

In-house login (email + password, CORA JWT, roles in `app_users`) replaces Auth0.

- **Sign in:** school email, password with Show/Hide, "Keep me signed in", big primary button. Below an "or" rule, a **disabled "Sign in with university SSO" button** with a "Coming soon" tag (SAML SSO later, modelled on the cssgunc/senate Onyen flow). Right panel (desktop only) shows a slice of the path and a cited fact.
  - Error (`#error`): one non-revealing message, "Email or password is incorrect", plus the lockout rule (5 tries, 15 minutes). Never say whether the email exists.
- **Join (invite link):** shows who invited you, to which course, with which role. Email is read-only from the invite. Name + password with live rules (≥12 characters, not a common password). "Invite link expires Oct 26. One account per invite."
  - No token (`#no-invite`): explains invite-only access and what to ask your instructor for. No dead-end form.
- **Reset:** three states. `#forgot`: admin-issued resets for now, so it lists the course's admins/TAs and says email resets are coming. `#set`: arrived from an admin-issued link (shows who issued it and expiry). `#change`: signed-in change from Progress → Account.
- **Mobile:** single column, right panel hidden, fields full width, 48px inputs.
- **Accessibility:** real `<label>`s, `autocomplete` (`username`, `current-password`, `new-password`), errors in `role="alert"`, rules list `aria-live="polite"`, `aria-invalid` on failing fields.
- **Data (assumed API, to confirm with whoever builds the backend):** `POST /auth/login`, `POST /auth/logout`, `GET /auth/invites/:token`, `POST /auth/invites/:token/accept`, `GET /auth/reset/:token`, `POST /auth/reset/:token`, `POST /auth/password`.

### 5.3 Home / Path [`path.html`]

- **Purpose:** answer "what do I do next?" and show where you are in the course.
- **Layout:**
  1. Greeting + course name. "See it as a graph" link (teal).
  2. **Continue card:** mastery ring (amber while in progress), concept, lesson step, 4-segment step bar, big "Continue lesson". Footer band: "Or learn it another way: Ask about reactor period · Quiz me on it".
  3. **Units:** completed units collapse to one emerald row. The current unit shows its concepts as **path nodes** (64px tactile circles, gentle zig-zag) with labels beside them, because technical names need to be read. The current node pulses softly and opens a **concept popover** with Guide me / Ask / Quiz me and its provenance ("Built from 9 published passages · 5 linked concepts"). Upcoming unit is a red-50 band of concept chips. Later units are compact rows.
  4. **Today rail (≥1280px):** daily-goal ring (2/3 checks) with 7 streak dots, cards due, weak spot (with "Quiz me on it"), quick Ask box.
- **Nothing is locked.** Order is suggested from prerequisite edges (`/learning/suggestions`).
- **Mobile:** today rail moves into the top bar (streak flame + count) and the Review badge; zig-zag offset shrinks to 45%; popover renders under the node at full width.
- **States:** loading = skeleton of the continue card and three nodes (`states.html` #2). Empty = "Your path is being built" with an admin hint (#1). Error = inline panel with Retry; never fall back to fake concepts.
- **Data:** `GET /learning/dashboard` (concepts, mastery, review summary, recommended), `GET /learning/suggestions`, lesson progress per concept. **Units:** for Friday, group concepts by their primary published source document (`concept.sources[0]`), with the document title as the unit name. Admin-defined units come later.

### 5.4 Ask: Q&A with citations [`ask.html`]

- **Purpose:** freeform discussion that stays grounded and traceable.
- **Layout:** ChatGPT-style. Sidebar shows recent sessions of every mode (mode tag in mono: ASK / GUIDE / QUIZ). Header: session title, scope selector ("All published material" or a concept), and a "Sources 3" toggle. Centred 720px thread: user turns in slate-100 bubbles on the right; CORA's turns unboxed with a small red "C" key-tile avatar, a **"Grounded in N published passages"** badge, the answer with inline **citation chips**, a row of source cards, action icons (copy, helpful, report), and a **mode hand-off** card ("Keep going on Decay heat: Quiz me · 3 questions / Guide me through it").
- **Source drawer:** right panel (380px) on desktop, bottom sheet (70vh) on phones. Shows the document, passage number and page, who published it and when, the passage with the used span highlighted, "Open in document" and the concept link.
- **Composer:** 2px border card, focus turns red. Mode switch: **Ask / Guide me / Quiz me** (segmented). Choosing Guide me or Quiz me with a topic opens the lesson or quiz player for that concept. Footer disclaimer: "CORA answers only from published course material and cites it. It is a study aid: your facility's procedures and qualified instructors are the authority."
- **Streaming:** text streams with a caret; citation chips land as their sentence completes. For Friday the backend still returns a full answer, so the client reveal continues (note the existing rAF hidden-tab gotcha in `CLAUDE.md`); true token streaming (SSE) is after Friday.
- **Mobile:** sidebar becomes the menu drawer; drawer becomes a bottom sheet opened by any chip; mode labels shorten to Ask / Guide / Quiz.
- **States:** not in the material (`states.html` #3: amber "No published source" badge, declines to guess, offers a related question and "Tell my TA it's missing", which feeds Admin Analytics). Stream failure (#4: keep the partial answer, Retry). Hourly limit (#7: suggests review cards instead). Empty session: three suggested questions drawn from published concepts.
- **Data:** existing chat endpoint (published-only vector mode) returning answer + sources/chunks. **Inline [n] chips need the prompt to emit markers mapped to chunk ids.** If that isn't ready Friday, ship source cards under the answer without inline chips (still traceable), and add chips after.

### 5.5 Lesson: Guided Learning [`lesson.html`]

- **Purpose:** step-by-step breakdown of one concept in four beats (core idea → how it works → application → quick check), matching `LessonBeat` in `backend/src/learning/models.py`.
- **Layout:** **focus mode**, with no sidebar or tab bar. Top: close (X), concept + "Guided", "Step 3 of 4", segmented progress. Optional "Switch to Ask". Body at 680px: eyebrow, the step as a question-style heading, short paragraphs, a **formula block** (mono, with validity conditions), a **worked example** (numbered mono lines in a red-50 band), **From the source** quote with its citation chip, and a **"Before you continue" predict prompt** (amber) that reveals the answer on tap. "Flag it for your TA" link at the end.
- **Ask rail (≥1280px):** "Ask about this step", three suggested questions, small composer; scoped to this concept's passages.
- **Sticky action bar:** Back (secondary), Ask (ghost, mobile), Continue (primary, wide). Continue on the last beat goes to the quick check / quiz.
- **Mobile:** single column; Ask rail becomes the Ask button (opens Ask scoped to the concept); action bar respects safe-area inset.
- **States:** loading = skeleton heading + 3 lines + formula block; generation failure = "Couldn't build this step" with Ask instead / Retry; concept with too few passages = say so and offer Ask.
- **Data:** `GET /learning/lesson/{id}`, `POST /learning/lesson/{id}/progress`, `GET /learning/sources/{id}`.

### 5.6 Quiz: Adaptive Assessment, and Results [`quiz.html`, `quiz-results.html`]

- **Purpose:** generated problem sets at the student's current level, with immediate feedback.
- **Quiz layout (focus mode):** close, segmented progress, "3 / 5". Concept tag (dark mono) and a **difficulty chip that explains itself** ("Medium · picked from your 60% mastery"). Question in display type. Four **option keys** (letter tile + text, 2px border, key shadow; selected = red). Footer: "I don't know yet" (ghost, routes to Ask) and **Check** (disabled until a choice). Keyboard: 1–4 to choose, Enter to check.
- **Feedback sheet:** the footer becomes emerald (correct) or red-50 (wrong) with an icon, "Correct." or "Not quite. It is −80 seconds.", an explanation with its citation, and "Ask why it can't go faster →". Button becomes Continue (emerald when correct). Colour is never the only signal: icon + words + letter tile fill.
- **Results:** emerald key-tile check, headline with the real delta ("Reactor period: up 10 points."), **mastery bar** animating from old to new with the 80% "mastered" marker, a plain-language line about what happens next (7 of 10 so far; mastered at 80%; next suggested concept), three stat tiles (correct, time, streak), **"The one you missed"** with your answer, the correct one, its citation, and Talk it through / Re-read. "Added to your review cards for tomorrow." Sticky: See progress / Continue path.
- **Celebration rule:** the burst only fires when mastery rose; no burst for a flat or falling session (the headline then says what to try next).
- **Mobile:** same structure; options full width; sheet covers the bottom.
- **States:** generating = 5 skeleton options; not enough material (`states.html` #5) offers Guide/Ask; session expired mid-quiz keeps answers (#6).
- **Data:** `POST /learning/quiz/generate`, `POST /learning/quiz/grade`, `GET /learning/mastery/{id}`. Numbers in the prototype follow the current model: score = correct / attempts, easy < 40%, medium < 75%, hard ≥ 75%, mastered ≥ 80%.

### 5.7 Course graph explorer (secondary) [`explore.html`]

- **Purpose:** see how concepts connect; jump into any concept.
- **Layout:** three panes. Left: search, state filters with counts, concepts grouped by unit with mastery %. Centre: **neighbourhood** of the selected concept (not all nodes) on a red-50 field: selected node red, mastered emerald, not started outlined slate, teal edges labelled in mono (PREREQUISITE, BUILDS_ON, APPEARS_WITH). "Whole course" toggle for the full view. Legend. Right: inspector with state chip, definition, provenance, the **three mode buttons**, linked concepts with relationship type and mastery, and source documents.
- **Accessibility:** the SVG has a `<desc>` listing every neighbour, and the same information is in the inspector list, so the graph is never the only way to get it.
- **Mobile:** list (search + filters) → graph (330px) → legend → inspector, stacked.
- **States:** no edges for a concept = "No links found in the published material yet"; fetch failure = inline error, no demo graph.
- **Data:** `GET /learning/concepts`, `GET /learning/concepts/{id}/neighbourhood`, `GET /learning/network`.

### 5.8 Progress and profile [`progress.html`]

- **Layout:** profile header (initials tile, name, role, course, email; Account button). Stat strip: streak (amber), mastered (emerald), checks this week (red), questions asked (neutral). 12-week activity heatmap (red ramp). Mastery by unit (stacked emerald/amber bars; "mastery comes only from checks and quizzes, never from reading time"). Needs work list with Quiz buttons. Account card: sign-in method, role, daily goal (editable), Change password, Sign out.
- **Mobile:** single column; heatmap scrolls horizontally inside its card.
- **States:** new student = stat tiles show "–" with "Finish your first check to start a streak"; heatmap shows empty cells, not a blank area.
- **Data:** `/learning/dashboard`; **activity days** need a small endpoint (section 10).

### 5.9 Admin: Materials, Analytics, Users [`admin.html`, `admin-analytics.html`, `admin-users.html`]

- **Materials:** status chips that double as filters (Published 26, Needs review 2, Processing, Failed, Unpublished). Table: document (with type/pages or the failure reason in red), status badge, passages, concepts, updated, action. **Review panel**: concepts it adds or extends (teal chips), extracted passages with a **low text quality** warning on garbled ones, a two-item pre-publish checklist, Keep private / **Publish to students**, and what publishing does. Failed rows say why ("No text layer. Upload a searchable PDF.") and offer Retry.
- **Analytics:** active students, questions asked, quiz checks, and **questions the material couldn't answer** (red), plus hardest concepts by class-wide % correct, the unanswerable questions grouped with counts and a topic tag (each one a hint about what to upload), and student flags with their source.
- **Users:** invite panel (emails pasted from a roster, role select with what each role can do, "Create 3 invite links"; links are single-use, 7-day expiry, copied manually until email sending exists). Search + role filter. Table: person, role (inline select), status (Active / Invited · expires / Deactivated), last active, row menu: **Issue password reset link**, View progress, **Deactivate account** (red; keeps progress, signs out everywhere, reversible). You cannot change your own role.
- **Mobile:** admin is desktop-first; tables scroll horizontally inside their card; the review panel stacks under the table.
- **States:** empty Materials = upload drop zone with accepted types; processing shows progress %; analytics with no activity = "Numbers appear after students start".
- **Data:** existing `/admin/materials*`; new `/admin/users`, `/admin/invites`, `/admin/users/{id}/reset-link`, `/admin/users/{id}` (PATCH role/active); analytics endpoints after Friday.

### 5.10 Empty, loading and error states [`states.html`]

Rule: **never a blank area, never fake data.** Each state says what happened, in plain words, and offers the next useful action (usually another mode). Skeletons keep the final layout's shape so nothing jumps. Errors keep whatever partial work exists (a partial answer, quiz answers so far).

---

## 6. Design tokens: Tailwind v4 mapping

### 6.1 Colour (no new palettes needed)

Everything uses palettes already in `frontend/tailwind.config.js` (red, slate, emerald, amber, teal, stone, white, black), so nothing fails silently.

| Token | Value | Use | Contrast note |
|---|---|---|---|
| primary | red-600 `#dc2626` | primary buttons, selection, focus ring, current node | 4.8:1 on white |
| primary-hover | red-700 `#b91c1c` | hover; **red text on red-50** | use red-700 for text on red-50 |
| primary-edge | red-900 `#7f1d1d` | key-button bottom edge | |
| tint / border | red-50 `#fef2f2` / red-100 `#fee2e2` / red-200 | bands, chips, panel borders | |
| text | slate-900 / slate-700 (reading) / slate-500 (secondary) | | slate-500 is the **minimum** for text |
| muted (decorative only) | slate-400 `#94a3b8` | icons, disabled, never body text | 2.6:1, fails as text |
| mastered | emerald-600 fill, **emerald-700 text**, emerald-50 tint, emerald-300 edge | | emerald-600 is 3.8:1, too low for small text |
| in progress / streak | amber-600 fill, amber-700 text, amber-50 tint, amber-300 edge | | |
| graph | teal-700 text/edges, teal-50 tint | | |
| not started | slate-100 fill, slate-300 edge, slate-500 text | | |

### 6.2 `src/index.css` additions

```css
/* Keep the existing layer order and the NDL import exactly as they are. */
@theme {
  /* New names on purpose: the NDL preset replaces theme.fontFamily
     (sans = "Public Sans", mono = "Fira Code"), so font-sans/font-mono
     do NOT mean Plex in this app. */
  --font-display: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --font-code: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;

  /* Key-button edges and floating surfaces, alongside the existing --shadow-* scale. */
  --shadow-key-red: 0 4px 0 #7f1d1d;
  --shadow-key-slate: 0 3px 0 #e2e8f0;
  --shadow-key-emerald: 0 4px 0 #065f46;
  --shadow-float: 0 12px 32px -16px rgb(15 23 42 / 0.25);
}

@layer base {
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body { font-family: var(--font-body); }   /* set explicitly; don't rely on font-sans */
}

/* Component classes (.btn, .cite, .node, .option, .composer, .mode …) go in
   @layer components, ported from prototype/assets/cora.css. Never unlayered:
   unlayered CSS beats every utility. */
@layer components { /* … */ }
```

### 6.3 Gotchas this redesign must respect

1. **Only configured palettes generate CSS.** The redesign stays inside them. Do not reach for `blue`/`indigo`/`orange`.
2. **`-20` spacing is 20px** (NDL preset). The prototype never uses `*-20`; use `py-[80px]`, `h-[74px]` etc. where you mean 80px.
3. **NDL layering.** Keep `@layer ndl, theme, base, components, utilities;` and the `layer(ndl)` import. New CSS goes in `components`. (`STUDENT_UI.md` §5.1's "set button padding inline" advice predates the layer fix; measure before resorting to inline styles.)
4. **New, found while designing:** the NDL preset also replaces **`borderRadius`** (`rounded-xl` = 10px, `rounded-2xl` = 14px, `rounded-3xl` = 16px) and **`fontFamily`**. The prototype runs on stock Tailwind (`rounded-2xl` = 16px), so when porting use arbitrary radii (`rounded-[16px]`, `rounded-[12px]`) or `@theme` radius tokens, and the `font-display/body/code` names above. Breakpoints match stock Tailwind (sm 640, md 768, lg 1024, xl 1280) plus an extra `xs` 450px.
5. **Measure, don't re-read:** if a class seems to do nothing, check `getComputedStyle` on a probe element.

### 6.4 Prototype → app class map

| Prototype | App |
|---|---|
| `font-display` | `font-display` (from `@theme`) |
| `font-mono` | `font-code` |
| body font (`cora.css`) | `body { font-family: var(--font-body) }` |
| `rounded-2xl` / `rounded-xl` | `rounded-[16px]` / `rounded-[12px]` |
| `.btn*`, `.cite`, `.node*`, `.option`, `.composer`, `.mode`, `.state*`, `.badge*`, `.seg`, `.bar`, `.passage`, `.skel`, `.field` | same names in `@layer components` |

---

## 7. Component inventory

New components (under `frontend/src/components/`) and the existing files they replace. "Retire" means remove from the student path; admin may keep legacy pieces.

| New component | Purpose | Replaces / absorbs |
|---|---|---|
| `ui/Button` (primary, secondary, soft, ghost, success; sm/md/lg) | Tactile key buttons | ad-hoc button classes in `Student/*`, `Landing.tsx`; `UI/CustomButton.tsx` on student surfaces |
| `ui/StateChip`, `ui/Badge`, `ui/MasteryRing`, `ui/SegmentBar`, `ui/ProgressBar` | Mastery and status display | colour logic stays in `Student/learningState.ts` (kept) |
| `ui/CitationChip`, `ui/SourceQuote` | Inline receipts | `ChatBot/SourcesInfo.tsx`, `ChatBot/ChunkInfo.tsx` (student path) |
| `ui/EmptyState`, `ui/Skeleton`, `ui/InlineError`, `ui/NotInMaterial` | States rule | scattered empty/error handling |
| `shell/AppShell`, `Sidebar`, `MobileTopBar`, `TabBar`, `MenuDrawer`, `SessionList`, `StreakMini` | Student and admin chrome | nav and tab bar in `Student/StudentApp.tsx`; `Layout/Header.tsx`, `Layout/SideNav.tsx` for student |
| `shell/FocusLayout` | Chrome-less lesson/quiz | new |
| `path/PathView`, `ContinueCard`, `UnitBand`, `ConceptNode`, `ConceptPopover`, `TodayRail` (`DailyGoalCard`, `DueCardsCard`, `WeakSpotCard`) | Home | `Student/StudentHomeArtboard.tsx`; list role of `Student/ConceptIndex.tsx` |
| `lesson/LessonPlayer`, `FormulaBlock`, `WorkedExample`, `PredictPrompt`, `StepActionBar`, `AskRail` | Guided mode | `Student/ConceptLesson.tsx`; tab frame of `Student/ConceptHub.tsx` + `ConceptHubRail.tsx` |
| `quiz/QuizPlayer`, `OptionKey`, `FeedbackSheet`, `QuizResults`, `MasteryDelta`, `Celebration` | Adaptive mode | `Student/StudentAssess.tsx`; `Student/ReviewSession.tsx` reuses `QuizPlayer` chrome |
| `ask/AskView`, `Thread`, `AnswerTurn`, `SourceCards`, `SourceDrawer`, `Composer`, `ModeSwitch`, `ModeHandoff` | Q&A mode | `Student/StudentChat.tsx` and its use of `ChatBot/Chatbot.tsx`, `ChatModesSwitch.tsx`, `ChatModeToggle.tsx` (admin keeps them) |
| `graph/GraphExplorer`, `ConceptList`, `NeighbourhoodGraph`, `ConceptInspector` | Secondary explorer | `Student/StudentExplore.tsx`, `ExploreFilters.tsx`, `ExploreInspector.tsx`, `ConceptNeighbourhoodGraph.tsx`, `ConceptSources.tsx` |
| `progress/ProgressView`, `StatStrip`, `ActivityHeatmap`, `UnitMastery`, `NeedsWork`, `AccountCard` | Progress and profile | new |
| `auth/AuthLayout`, `SignInForm`, `JoinForm`, `ResetFlow`, `PasswordField`, `SsoButton` | In-house auth | `Login/Index.tsx`, Auth0 parts of `Auth/Auth.tsx`, `Auth/Callback.tsx` |
| `admin/AdminShell`, `MaterialsTable`, `MaterialReviewPanel`, `StatusFilter`, `AnalyticsView`, `UsersView`, `InviteForm`, `UserRowMenu` | Admin | `Admin/AdminMaterials.tsx` (restyled and split) |
| `landing/Landing` (`Hero`, `ProductComposite`, `ModesDemo`, `ReceiptsBand`, `LibraryStats`) | Public page | `Landing/Landing.tsx` (rewritten; drops orbs and demo graph) |

Models and tests that stay as they are: `learningState.ts`, `conceptHubModel.ts`, `exploreModel.ts`, `reviewModel.ts`, `studentLocation.ts` (extended with new views) and their tests.

---

## 8. Accessibility (WCAG 2.2 AA) requirements

- Contrast per section 6.1 (no slate-400 text, emerald-700 for text, red-700 for text on red-50).
- One visible focus style: 2px red-600 outline, 2px offset.
- Targets ≥ 44px for primary controls; citation chips use an invisible hit-area expansion to ≥ 24px (SC 2.5.8).
- Mode switch = `role="group"` + `aria-pressed`; quiz options = `role="radiogroup"` / `role="radio"` + `aria-checked`; progress = `role="progressbar"` with values.
- Streaming answer region is `aria-live="polite"` and announces once on completion, not per token.
- Drawer and menu: focus moves in, Escape closes, focus returns to the trigger.
- Colour is never the only signal: states have words, correct/wrong have icons and text.
- Graph has a text equivalent; heatmap has an `aria-label` summary.
- Skip links on every page; `prefers-reduced-motion` disables press motion, the pulse, the burst and the caret blink.

---

## 9. Why we didn't build a "learning style" quiz

**The short version Mason can say out loud:**

> "We looked at whether CORA should ask students if they're visual or verbal learners and then teach them only that way. The best review of that idea, Pashler, McDaniel, Rohrer and Bjork in 2008, found almost no evidence for it. To prove it works, you'd need to show that visual learners do best with visual teaching *and* verbal learners do best with verbal teaching, on the same test. Very few studies even tested that properly, and several that did found the opposite. So CORA doesn't sort anyone. Every student gets all three modes (Guide me, Ask and Quiz me) on every concept and can switch any time. What adapts is the difficulty, and that's driven by what you actually get right, not by what you say you prefer."

**The detail behind it:**

- The paper calls the popular claim the **meshing hypothesis**: instruction is best when it matches the learner's preferred style. Its test requires a crossover interaction between learning style and teaching method. The authors found "virtually no evidence" for that pattern and concluded there is no adequate basis for using learning-style assessments in education.
- It does *not* say all students learn identically. People do have preferences and differing aptitudes, and the best method can depend on the **subject**. That supports choosing the presentation per concept (a formula block for reactor period, a timeline for xenon), not per person.
- It also points to methods that do have evidence: **spaced practice** and **interleaving**, and it warns that fluent re-reading feels like learning when it isn't. That is why CORA's mastery comes only from checks and quizzes (never reading time), why lessons include a predict-before-reveal prompt, and why missed questions return as spaced review cards.

Source: Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R. (2008). Learning styles: Concepts and evidence. *Psychological Science in the Public Interest*, 9(3), 105–119.

---

## 10. Implementation plan: shippable by Friday 2026-10-23

Assumptions: Mason plus coding agents; another agent is already changing source (including the move off Auth0), so phases are cut along file boundaries to avoid collisions. Each phase ends with the app working. Today is Monday evening, so that leaves about four working days.

### Phase 0: Foundations (Mon evening to Tue morning, ~3 h)

- Fonts (Google Fonts link in `index.html`), `@theme` tokens and `@layer components` port of `cora.css` (section 6.2). Measure `font-display`, `rounded-[16px]`, `.btn-primary` padding/border with `getComputedStyle` before building on them.
- `ui/Button`, `StateChip`, `Badge`, `MasteryRing`, `SegmentBar`, `EmptyState`, `Skeleton`, `InlineError`, `CitationChip`.
- `shell/AppShell` (sidebar, mobile top bar, tab bar, drawer) and `FocusLayout`; extend `studentLocation.ts` with the new views.
- **Done when:** existing student views render inside the new shell with no visual regressions at 375 and 1440.

### Phase 1: Auth screens and Path (Tue)

- Sign in, Join (invite token), Reset (forgot / set / change), SSO button disabled with "Coming soon". Wire to the in-house auth API as it lands; build against the assumed contract in 5.2 and adjust.
- Path: continue card, unit bands (grouped by primary source document), concept nodes + popover with three modes, today rail (goal/streak placeholders hidden until Phase 4 data exists), states.
- **Done when:** a student can sign in from an invite and land on a real path built from published concepts.

### Phase 2: Ask (Wed)

- Native `AskView`: thread, answer turn with "Grounded in N passages", source cards, source drawer / bottom sheet, composer with Ask / Guide me / Quiz me (Guide and Quiz hand off to the players), mode hand-off card, "not in the material" and error states, hourly-limit state.
- Sessions sidebar: in-memory plus `localStorage` keyed by user id, cleared on sign-out (server persistence is after Friday).
- **Done when:** a student can ask, open every source, and jump to a quiz on the same concept. Stretch: inline `[n]` chips if the prompt emits markers.

### Phase 3: Lesson, Quiz, Results (Thu)

- `LessonPlayer` on the existing 4-beat lesson API (formula/worked-example blocks render from markdown; predict prompt only when the beat provides one).
- `QuizPlayer` + `FeedbackSheet` on `quiz/generate` and `quiz/grade`; `QuizResults` with real mastery delta and the celebration rule. `ReviewSession` re-skinned with the same chrome.
- **Done when:** the full loop Path → Lesson → Quiz → Results → Path works on real data.

### Phase 4: Admin, Progress, Landing, polish (Fri until noon, then freeze)

- Admin Users (invite links, role, deactivate, issue reset link) on the new auth API. Materials restyle with the review panel (logic from `AdminMaterials.tsx` kept).
- Progress page from dashboard data. Streak and daily goal from a small `GET /learning/activity` (distinct active days from quiz/review attempts) if the attempt tables have timestamps; otherwise hide those tiles.
- Landing rewrite.
- Sweep: states on every screen, keyboard pass, reduced motion, 375/1440 screenshots against `docs/redesign/screenshots/`.
- **Freeze at noon Friday;** afternoon is rehearsal and bug fixes only.

### What slips to after Friday (in this order if time runs short)

1. Admin **Analytics** screen (keep the "Tell my TA" flag write path if cheap; build the screen later).
2. **True streaming** (SSE). Keep the client-side reveal.
3. **Inline [n] citation chips.** Keep source cards under each answer; traceability is preserved.
4. **Server-persisted chat sessions.** Keep local sessions.
5. **Graph explorer restyle.** Keep the current `StudentExplore` behind the "Course graph" link.
6. **Streak, heatmap and daily goal.** Hide them; keep mastery and due cards.
7. **Landing rewrite.** Ship a minimal sign-in-first landing with the new type and the hero claim.
8. Email-based invites and resets; university SAML SSO (button already says "Coming soon").

**Never cut:** published-only retrieval, visible sources on every answer, the states rule (no fake data), auth correctness (lockout, non-revealing errors, single-use expiring tokens), and keyboard/contrast basics.

---

## 11. Open questions for Mason

1. **Invite vs allowlist.** The design assumes admin-created, single-use **invite links** (no email service needed). The alternative is a Senate-style **allowlist** where students self-register with an allowlisted email. Without email verification, anyone who knows an allowlisted address could claim it. Which do you want for Friday?
2. **Guest access.** Invite-only accounts make the old QR guest mode (`X-Guest-Id`) unreachable. Keep a "Try a sample concept" guest path for the showcase, or drop guests?
3. **Units.** OK to group the path by primary source document for Friday, with admin-defined units later?
4. **Streak data.** Do quiz and review attempts store timestamps? If not, is a small activity log acceptable this week?
5. **Inline citations.** Can the chat prompt be changed to emit `[n]` markers tied to chunk ids this week, or do we ship source cards only?
6. **Generated-content review** (carried over from `STUDENT_UI.md`): must an admin approve generated lessons/questions, or only source documents? The Analytics "flags" list assumes post-hoc review.
7. **Daily goal unit.** "3 checks per day" (answered questions) is the assumption. Minutes, or concepts, instead?
8. **Institution and course naming.** The prototype uses "NE 235" and `@university.edu` placeholders. What course and domain should appear on the showcase build?
