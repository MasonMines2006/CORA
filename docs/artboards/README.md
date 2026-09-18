# CORA student UI — artboards, exported for offline / agent reading

**What this is:** the five design artboards that `docs/STUDENT_UI.md` refers to, as
files in the repo instead of a link to a hosted canvas.

**Why:** the canvas that `docs/STUDENT_UI.md` and `HANDOFF.md` linked to
(`https://claude.ai/code/artifact/8e95ce15-…`) is **no longer reachable** — the
API returns "artifact not found — it may have been deleted, or it has not been
shared with you". The `.dc.html` sources that produced it were recovered from the
authoring session's scratch directory under `/private/tmp`, which macOS clears
on its own schedule. Exporting them here is what stops the design from being
lost. Treat these files as the surviving originals.

**Fidelity caveat:** this export reflects the artboards *as they were published*
on 2026-09-18. If anyone edited the canvas in the browser after that (the canvas
editor saves new versions in place), those edits are not here and are not
recoverable.

---

## How to read this export

| You want | Open |
|---|---|
| The design as a picture | `png/*.png` — rendered at 2× |
| The design as a working page | `view/*.html` — plain HTML, open with `file://`, no server |
| Exact hex / px values | `source/*.dc.html` — inline styles, nothing computed |
| The canvas layout + the author's annotations | `canvas.json` |
| A prose build spec | this file, section "The five boards" |

Nothing here needs npm, a build step, or network access. The `view/` pages
reference Google Fonts (Space Grotesk) and fall back to system sans-serif
offline, which is the only visible difference.

### Directory map

```
docs/artboards/
├── README.md         this file — the spec
├── canvas.json       board positions, sizes, and the three annotation notes
├── flatten.py        regenerates view/ from source/
├── source/           *.dc.html — canvas authoring format (the originals)
├── view/             *.html — same designs, plain HTML
└── png/              rendered screenshots, 2× device scale
```

### Regenerating

`source/*.dc.html` are written for the Claude design-canvas runtime: they load a
`support.js` that is not in this repo, wrap the page in `<x-dc>` / `<helmet>`,
and — in `Concept.dc.html` only — use `{{ bindings }}` and `<sc-if>` for the mode
tabs. `flatten.py` rewrites all of that into static HTML:

```bash
python3 docs/artboards/flatten.py
```

The flattened `Concept.html` keeps its tabs working through ~15 lines of vanilla
JS, and accepts a hash so a mode can be opened (or screenshotted) directly:
`view/Concept.html#graph`. Valid: `#learn` `#practice` `#cards` `#graph` `#sources`.

To re-render the PNGs (uses the Chromium that Playwright already cached; no
download):

```bash
cd docs/artboards && BIN=~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-x64/chrome-headless-shell && for m in learn practice cards graph sources; do "$BIN" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1280,900 --screenshot="png/Concept-$m.png" "file://$PWD/view/Concept.html#$m"; done
```

---

## Canvas layout

Three rows, each with a heading and a margin note stating the problem the row
solves. Straight from `canvas.json`:

| Row | Heading | Boards | The note beside it |
|---|---|---|---|
| 1 | Make the concept the unit of navigation | Home, Concept | Today: four peer tabs, concepts buried inside one. Proposed: pick a concept, then Learn / Practice / Cards / Graph / Sources are modes on it. The graph stops being a separate tab and starts driving navigation — which is the whole point of building on one. |
| 2 | Fix the two surfaces that are dead for guests | Explore, Flashcards | Verified: a guest gets 401 on `/chat_bot`, `/graph_query` and `/connect`. Explore silently falls back to a fake 6-node graph with no labels; Chat can't answer at all. So the graph screen needs real data + search + filters, and the noisy extracted types (Institution, Document) should be off by default. |
| 3 | Design the phone first | MobileHome | Attendees scan a QR code, so the phone is the primary target, not an afterthought. Top tabs become a bottom bar, cards get 44px touch targets, and the concept list is one column with mastery inline. |

Board sizes: the four desktop boards are **1280 × 900**; `MobileHome` is
**390 × 844** (iPhone 14/15 logical size).

---

## Shared chrome

Every desktop board opens with the same 64px top bar, so build it once:

- Height 64px, `background #ffffff`, `border-bottom 1px solid #e7e5e4`,
  horizontal padding 48px, `display:flex`, `gap:40px`.
- Left: 28px red rounded square wordmark (`#dc2626`, radius 8px, white "C")
  followed by "Cora" in Space Grotesk 700 / 17px.
- Centre: four nav links — **Home · Concepts · Graph · Review**. Active link is
  `background #fef2f2` / `color #b91c1c`; idle is `color #475569`, no fill.
- Right: a "Guest session" pill (1px `#e7e5e4` border, radius 999px, 6px emerald
  `#059669` dot) and a "Sign in" button.

The guest pill is a design decision, not decoration: guests are a first-class
state (see `docs/STUDENT_UI.md` §6), so the session type is always on screen.

Page background behind the bar is `#f8f7f6` on every board.

---

## The five boards

### 1. Home — "what do I do next?"

`png/Home.png` · `view/Home.html` · `source/Home.dc.html` · canvas title
*"Home — what do I do next?"*

Two columns under the top bar, body padding `36px 48px`, gap 40px: main column
**804px** fixed, right rail takes the remaining ~340px.

Main column, top to bottom:

1. **Pick up where you left off** — eyebrow label (11px, 700, uppercase,
   `letter-spacing .09em`, `#dc2626`) over a white card (radius 16px, 1px
   `#e7e5e4`, padding 24px) holding: a 72px SVG progress ring showing "60%"
   (track `#f1f0ef`, arc `#b45309` via `stroke-dasharray`), the concept name in
   Space Grotesk 22/700, a subline "Beat 3 of 4 · PULSTAR application · last seen
   12 min ago", a four-segment beat bar (56px × 4px pills, filled `#b45309`,
   empty `#e7e5e4`), and a red pill "Resume lesson".
2. **Cards due** — one short white card: teal `#f0fdfa` icon tile, "7 cards due
   for review", the concept names beneath, and an outlined "Start review" button.
3. **Your concepts** — eyebrow plus an inline legend (`Mastered 3` emerald /
   `In progress 4` amber / `Not started 11` slate). Below it a
   `repeat(3, minmax(0,1fr))` grid, gap 12px, of concept cards: name, mastery
   percentage in Space Grotesk 700 coloured by state, a 4px progress track, and
   a "3 sources · 8 linked concepts" footnote in `#94a3b8`. Last cell is a
   "Browse all 18 concepts" affordance rather than a concept.

Right rail:

- **Course graph** — a dark panel with the corpus size ("1,797 concepts
  extracted") over three figures: 26 documents, 314 passages, NE235 course. Plus
  an "Open the graph" button. This is the one place the whole graph is advertised.
- **Suggested next** — graph-derived: "Reactivity links to these, and you haven't
  opened them yet." Each row is a concept with the reason underneath — *Reactor
  Period* "prerequisite for 1-over-M", *Xenon* "appears with Reactivity in 4
  passages", *Reactor Safety System* "covered in Lab#2". This is the
  recommendation surface the prerequisite edges exist to power.
- **Ask CORA anything about the course material** — a single input, not a tab.

Data it needs: current lesson position, per-concept mastery, due-card count,
corpus counts, and neighbour concepts the learner has not opened. Backend today
exposes `GET /learning/dashboard` and `GET /learning/concepts`; "suggested next"
has no endpoint yet and is the one genuinely new query.

Implemented today by `frontend/src/components/Student/StudentHome.tsx`.

### 2. Concept hub — five modes on one concept

`png/Concept-*.png` (one per mode) · `view/Concept.html` ·
`source/Concept.dc.html` · canvas title *"Concept hub — five modes, one concept"*
· **the only interactive board**

This is the structural proposal: the concept is the page, and Learn / Practice /
Cards / Graph / Sources are tabs *within* it.

Header block (padding `0 48px`, white, above the tab row):

- Breadcrumb `All concepts / Reactor physics` in 12.5px.
- Concept name in Space Grotesk 34px/700 beside an **IN PROGRESS** state pill
  (`#fffbeb` fill, `#b45309` text, radius 999px; emerald when mastered, slate
  when not started).
- Provenance line: "Appears in 16 passages across 3 documents · linked to 8 other
  concepts" — the graph is stated as fact, not decoration.
- Right: **MASTERY** label, the percentage at 30px in the state colour, and
  "3 of 5 correct · medium" beneath. The difficulty the adaptive quiz will pick
  is visible before you start.

Mode tabs sit on the header's bottom edge, `gap: 2px`, radius `9px 9px 0 0`.
Active tab = `background #f8f7f6`, `color #0f172a`, 700, `border-bottom: 2px
solid #dc2626`. Idle = transparent, `#64748b`, 500, transparent bottom border.
Selecting a tab swaps the content panel only; the header never moves.

Body: content column (flexible) + **276px** right rail, padding `28px 48px`, gap 32px.

| Mode | Content panel |
|---|---|
| **Learn** | "Step 3 of 4" eyebrow + beat pips, the beat heading ("PULSTAR application"), body copy with the key figure bolded inline ("3.9 pcm"), a **From the source** quote block citing `Theory Manual — NE235.pdf · passage 142`, then `← Previous` / `Skip to quick check` / `Next →`. |
| **Practice** | "Question 1 of 3" + a **Medium** chip reading "difficulty set by your mastery". Four MCQ options; the correct one is shown in its answered state (emerald border/fill) with a **Correct** badge and an explanation that quotes the manual, plus "Read the passage →". Footer: "Mastery will update when you finish all 3." and "Next question →". |
| **Cards** | "Card 2 of 7 · Reactivity", the prompt, a "Show answer" button, then the four grading buttons (Again / Hard / Good / Easy). Footnote: "Cards are generated from the same passages as the lesson." |
| **Graph** | "Reactivity in the course graph" with the subtitle **"Only the neighbourhood of this concept — not all 1,797 nodes."** A radial SVG: this concept red at centre with its percentage, six neighbours coloured by mastery state, straight edges. Legend: This concept / Mastered / Not started. |
| **Sources** | "The passages this concept was built from" — one block per document (filename, passage count, an excerpt). Three documents shown. This is the credibility feature: the citation becomes readable text. |

Right rail (same in every mode):

- **Linked concepts** — four rows, each a concept name with its mastery
  percentage or an em-dash when unstarted.
- **Ask about this** — "Chat is scoped to Reactivity and its passages, so answers
  stay on-topic", with two suggested questions as buttons. Chat stops being a
  tab and becomes a per-concept affordance.

Data it needs: `GET /learning/lesson/{concept_id}`, `/learning/quiz/generate` +
`/quiz/grade`, `/learning/mastery/{concept_id}`, `/learning/sources/{concept_id}`,
`/learning/network` — all of which exist in `backend/src/learning/router.py`.
The new work is composition, not endpoints.

Today the same content is split across `StudentLearn.tsx`, `StudentAssess.tsx`
and `StudentStudyTools.tsx` (which already implements `cards` and `sources` as
modes). `StudentApp.tsx` still registers four peer tabs — Home / Study / Graph /
Chat — so the concept-as-page structure is the part not yet built.

### 3. Explore — search, filter, inspect

`png/Explore.png` · `view/Explore.html` · `source/Explore.dc.html` · canvas title
*"Graph — search, filter, inspect"*

Three columns: filter rail **232px**, graph canvas (flexible), inspector **300px**.

- **Filter rail** — a search field, then **Concept type** checkboxes with counts
  (Concept 612, Component 188, Measurement 143, Institution 31, Document 53).
  Institution and Document are unchecked, under the note *"Institution and
  Document are extraction noise. Off by default."* Then **Source document**
  filters (Theory Manual, PULSTAR Tech Specs, Labs 0–6, Homework & quizzes).
- **Canvas** — header reads "Showing 43 of 1,797 concepts", with a
  Neighbourhood / Whole course segmented control. Nodes are sized by passage
  count and coloured by mastery (selected red, mastered teal `#0f766e`, not
  started slate). Legend states `node size = passage count`. The count line is
  load-bearing: it says the view is a filtered subset, never implying you are
  looking at everything.
- **Inspector** — for the selected node: name, "Concept · 16 passages ·
  3 documents", **Learn this** / **Practice** buttons, a mastery block,
  **Relationships** as typed rows (`RELATED_TO → Keff`, `AFFECTED_BY →
  Moderator`, `CONTROLLED_BY → Control Rods`, `GOVERNS → Reactor Period`), and a
  **Top passage** quote with its filename.

The anti-pattern this corrects is recorded in `docs/STUDENT_UI.md` §3.3: the
shipped tab initialised to a 6-node demo graph and kept it when the real fetch
failed. A failed fetch must render an error, never fake data.

Implemented today by `StudentExplore.tsx` against `GET /learning/network`.

### 4. Flashcards / spaced review

`png/Flashcards.png` · `view/Flashcards.html` · `source/Flashcards.dc.html` ·
canvas title *"Spaced review — the missing tool"*

Two columns: card column **600px** centred, session rail **300px**.

- Progress line above the card: "Card 2 of 7" and "about 3 min left".
- Card: concept name + "last seen 3 days ago", the prompt in large type, then the
  revealed **Answer** ("Zero"), an explanation, and the citation
  `Theory Manual — NE235.pdf · passage 87`.
- **How well did you know it?** — four buttons, each with its next interval
  printed under the label: Again `< 1 min`, Hard `2 days`, Good `5 days`,
  Easy `12 days`. Showing the interval is what makes the scheduling legible
  instead of magic.
- Session rail: counters (1 known / 0 shaky / 6 left) and the upcoming **Queue**
  as a list of `Concept — prompt` rows.
- Footnote: "Cards are drawn from the same passages as your lessons, so review
  and study stay in sync."

Partly implemented: `StudentStudyTools.tsx` builds `ReviewCard`s from
`getLearningLesson` / `getLearningSources`. There is no scheduling state yet —
no per-card interval, no due date, no persistence of Again/Hard/Good/Easy. That
is the missing piece, and it needs a store keyed on `learner_id` so guests keep
their schedule.

### 5. Phone — the QR entry point

`png/MobileHome.png` · `view/MobileHome.html` · `source/MobileHome.dc.html` ·
canvas title *"Phone — the QR entry point"* · **390 × 844**

- Compact header: wordmark plus a "Guest" chip.
- "Welcome to NE235" and "18 concepts pulled from your course materials. Start
  anywhere." — the first-run orientation a QR arrival needs.
- **Continue** card: a dark `#0f172a` panel (the only inverted surface in the
  set, so the next action is unmissable on a phone) with a CONTINUE eyebrow,
  the concept name, "Step 3 of 4 · PULSTAR application", an amber progress
  ring and a four-segment beat bar.
- **Review strip**: "7 cards due · about 3 minutes" — the time estimate is what
  makes it tappable on a conference floor.
- **Concepts** list: one column, "18 total", each row a concept name with its
  mastery percentage inline (em-dash when unstarted). No second column, no
  source-count subtitle.
- **Bottom tab bar**: Home · Learn · Review · Graph · Ask — the desktop top bar
  moved to thumb reach, five items, 44px targets.

Not implemented; `StudentApp.tsx` renders top tabs at all widths.

---

## Token appendix — and a warning before you port these

The artboards are written in **inline styles with literal hex values** because
that is what the canvas format requires. Porting them to Tailwind classes is
where this will bite you.

Palette actually used across the five boards:

| Role | Hex | Tailwind name | Generated by `frontend/tailwind.config.js` today? |
|---|---|---|---|
| Primary / selection | `#dc2626` | red-600 | yes |
| Primary hover, links | `#b91c1c` | red-700 | yes |
| Primary tint | `#fef2f2` | red-50 | yes |
| Text primary | `#0f172a` | slate-900 | yes |
| Text secondary | `#64748b` | slate-500 | yes |
| Text muted | `#94a3b8` | slate-400 | yes |
| Mastered | `#059669` / `#065f46` | emerald-600 / emerald-800 | yes |
| **Page background** | `#f8f7f6` | stone-50-ish | **no** |
| **Borders, empty tracks** | `#e7e5e4`, `#f1f0ef`, `#d6d3d1` | stone-200/100/300 | **no** |
| **In progress** | `#b45309`, `#f59e0b`, `#fffbeb` | amber-700, amber-500, amber-50 | **no** |
| **Graph / relationships** | `#0f766e`, `#f0fdfa` | teal-700, teal-50 | **no** |

`tailwind.config.js` generates only `red`, `slate`, `emerald`, `white`, `black`,
`gray`. Every class built on the four bold rows above — `bg-stone-50`,
`text-amber-700`, `bg-teal-50` — emits **no CSS at all and throws no error**. Add
the palette to the config first, or keep the hex values inline. `CLAUDE.md`
documents this; the artboards are the reason it now matters.

The second trap, also from `CLAUDE.md`: `@neo4j-ndl/base` ships an unlayered
Tailwind preflight, so on a `<button>` the utilities `p-*`, `border`, `bg-*` and
text colour silently do nothing. Several artboard elements are buttons —
the mode tabs, the four card-grading buttons, the suggested questions. Set those
four properties inline on buttons, as `OPTION_BASE_STYLE` in `StudentAssess.tsx`
already does.

Other tokens, consistent across the boards:

- **Type**: Space Grotesk 500/600/700 for headings, numerals and the wordmark;
  system sans for everything else. Eyebrows are 11px / 700 / uppercase /
  `letter-spacing .09em`. Body 12.5–14.5px, line-height ~1.5.
- **Radius**: 16px cards, 13px compact cards, 999px pills and buttons, 8–11px
  icon tiles, `9px 9px 0 0` tabs.
- **Borders**: always 1px `#e7e5e4`. No drop shadows anywhere — separation comes
  from the border against `#f8f7f6`.
- **Colour encodes learning state, never decoration** (`docs/STUDENT_UI.md` §4).
  Teal means "this is about graph structure". Amber means "you are mid-way".

---

## What the artboards do not decide

They show one populated happy path each. Before building, decide: empty states
(no concepts ingested, no cards due, first visit), loading, error states
(especially the graph fetch, which must not fall back to fake data), long
concept names, and what a mastered concept's Practice tab offers.

Build order and the reasoning behind these screens live in
`docs/STUDENT_UI.md` §8. That document is the source of truth; these files are
the picture it refers to.
