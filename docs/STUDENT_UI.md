# CORA Student UI — design direction

**Status:** agreed direction, partially implemented.
**Last updated:** 2026-09-18
**Visual reference (five annotated screens, in this repo):**
[docs/artboards/](artboards/README.md) — pictures in `png/`, openable pages in
`view/`, exact values in `source/`, and a written build spec in its README.

> The hosted canvas this file used to link to
> (`https://claude.ai/code/artifact/8e95ce15-…`) is **gone** — the API reports it
> deleted or unshared. The artboards were recovered from the authoring session's
> scratch directory and exported into `docs/artboards/` on 2026-09-18. Use that
> directory; the old link is dead.

This document is the source of truth for the student-facing UI. Read it before
changing anything under `frontend/src/components/Student/`. The artboards hold
five annotated screens (Home, Concept hub, Graph, Spaced review, Phone) — this
file holds the decisions and the reasoning that the pictures cannot carry.

---

## 1. The core decision: the concept is the unit of navigation

**Today:** four peer tabs — Chat, Explore, Learn, Assess — and concepts live
*inside* Learn.

**Direction:** you pick a **concept**, and Learn / Practice / Cards / Graph /
Sources become **modes on that concept**.

Why this matters more than any styling change: CORA's whole differentiator is
that it is built on a knowledge graph, and the tab layout hides that. A linear
four-step text reader with the graph quarantined in a separate tab is a worse
Quizlet. When the concept is the unit, the graph does real work — related
concepts, prerequisites, "you have not opened these neighbours yet" — which is
the one thing a graph-backed tool can do that a flashcard app cannot.

This matches how the education knowledge-graph literature models the problem: a
knowledge map is a directed graph of concepts joined by prerequisite edges, and
that structure is what drives sequencing and recommendation.

### Consequences

- There is a **Home** screen answering "what do I do next?" (continue where you
  left off, cards due, mastery across concepts). There is currently no home at
  all, which is why the app has no sense of place.
- **Chat becomes contextual.** Scoped to the current concept and its passages
  rather than a free-floating tab, so answers stay on-topic and grounded.
- **Explore stops being a destination** and becomes both a mode (the
  neighbourhood of one concept) and a whole-course view.

---

## 2. Screen inventory and status

| Surface | Status | Notes |
|---|---|---|
| Learn — 4-beat guided lesson | Built | Beat 3 is a guaranteed PULSTAR slot; retrieval reserves PULSTAR passages to fill it |
| Assess — adaptive MCQ + mastery | Built | Difficulty selected from a visible per-concept mastery score; graded deterministically, no LLM judge |
| Chat | Built, needs wiring | Backend accepts guests; frontend was not sending the guest header |
| Explore / Graph | Built, weak | Needs real data, search, type filters, click-to-inspect |
| Home / progress dashboard | **Not built** | See artboard `Home.dc.html` |
| Flashcards / spaced review | **Not built** | Planned since the first handoff; see `Flashcards.dc.html` |
| Source viewer | **Not built** | Lessons cite filenames but you cannot read the passage; see the Sources mode |

---

## 3. Anti-patterns this design exists to correct

These were observed in the shipped UI, not hypothetical:

1. **Marketing copy inside the tool.** The Learn tab spent ~60% of a 1440px
   screen on an eyebrow, a heading and a sentence describing what lessons
   contain — to a user already inside the lesson feature. The first viewport
   must be the working interface.
2. **Undifferentiated list.** 18 concepts as identical text links with
   "N source chunks" beneath each. No search, no hierarchy, developer language.
3. **Silent fake data.** `StudentExplore` initialised to a 6-node demo graph and
   kept it when the real fetch failed, so a broken tab looked like a working
   one. Never silently substitute fake data for a failed call.
4. **One-note palette.** Everything red and slate. Color should carry meaning.

---

## 4. Design tokens

The red/slate tokens in `CLAUDE.md` still apply. This adds **semantic colour for
learning state**, which is the dimension the palette was missing:

| Meaning | Colour | Hex |
|---|---|---|
| Mastered | emerald | `#059669` (border `#6ee7b7`, fill `#ecfdf5`, text `#065f46`) |
| In progress | amber | `#b45309` |
| Not started | slate | `#94a3b8` / `#cbd5e1` |
| Graph & relationship affordances | teal | `#0f766e` (fill `#f0fdfa`) |
| Primary action / selection | red | `#dc2626` |

Rule: **colour encodes state, never decoration.** A teal accent means "this is
about graph structure." An amber bar means "you are mid-way." Do not reach for
these hues for visual variety.

---

## 5. Two gotchas that will silently waste your time

Both are documented at more length in `CLAUDE.md`; repeated here because they
have each cost a debugging session.

1. **`@neo4j-ndl/base` ships an unlayered Tailwind preflight.** Unlayered CSS
   outranks Tailwind's `@layer utilities` regardless of specificity. On a
   `<button>`, `p-*`, `border`, `bg-*` and text colours **silently do nothing** —
   no error, class present in the DOM, zero effect. They work fine on a `<div>`.
   Set those four properties inline on buttons. Reference implementation:
   `OPTION_BASE_STYLE` / `optionStateStyle` in `StudentAssess.tsx`.
2. **Only colours listed in `frontend/tailwind.config.js` are generated.**
   Currently red, slate, white, black, gray, emerald. Anything else emits no CSS
   and fails silently. Add the colour to the config before using it.

---

## 6. Guest access model

Conference attendees scan a QR code and use the app with no account.

- `backend/src/auth.py` → `get_learner()` accepts **either** an Auth0
  `Authorization` header **or** an `X-Guest-Id` header holding a **UUID v4**.
  Guests get learner id `guest:<uuid>`. Malformed or missing → 401.
- `get_chat_learner()` adds an hourly per-guest quota
  (`GUEST_CHAT_HOURLY_LIMIT`) because chat costs money per request.
- Mastery and progress are keyed on `learner_id`, so a guest gets real adaptive
  difficulty without an account.

**Every student-facing request must attach the guest header when there is no
Auth0 token.** Attach it in one shared place, not per call site.

---

## 7. Mobile is the primary target

Attendees arrive by QR code on a phone. Desktop is the secondary case.

- Top tabs become a bottom tab bar.
- Touch targets ≥ 44px.
- Two-column layouts collapse to one column.
- The concept list is one column with mastery inline.

---

## 8. What to build next, in order

1. **Home screen** — the highest-value missing piece; the app currently has no
   answer to "what should I do now?"
2. **Explore** — real data, search, entity-type filters, click-to-inspect.
3. **Concept hub** — collapse the four tabs into concept + modes. The largest
   change; do it after the conference.
4. **Flashcards / spaced review** — drawn from the same passages as lessons so
   review and study stay in sync.
5. **Source viewer** — let a student read the passage a claim came from. Cheap,
   and it is the credibility feature for a grounded tool.
