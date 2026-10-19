# Redesign build log

Branch `feat/redesign-ui` (worktree `CORA-redesign`), based on `0bf8e87`.
Scope: DESIGN.md §10 Phases 0, 1 (Path only), 2, 3, and from Phase 4 the Progress page and the Landing rewrite.

## Decisions (one line of why each)

- **`components/ui-kit/` instead of `components/ui/`.** macOS's filesystem is case-insensitive, so `ui/` would land inside the existing `UI/` folder while imports said `ui/`; that breaks on Linux (Docker, CI). Same reason the landing rewrite stays in `Landing/` and no `graph/` folder was created (`Graph/` exists).
- **New CSS class names kept the prototype's names** (`.btn`, `.node`, `.option`, ...) after checking nothing in `src/` already used them. Their colours come from `--cora-*` custom properties declared in `@layer components`.
- **`body` now uses IBM Plex Sans app-wide** (`@layer base`), as DESIGN.md 6.2 asks. Admin screens inherit it too; NDL components that set their own font are unaffected.
- **`studentLocation.ts` tests were rewritten**, not just extended: the views changed (`home` → `path`, concept pages → `lesson`/`quiz`). Old links are translated (`view=concepts&concept=X&mode=practice` → quiz), and that is tested.

## Phase 0: Foundations (done)

- Fonts (`frontend/index.html`), `@theme` tokens (`--font-display/body/code`, `--shadow-key-*`, `--shadow-float`), `@layer base` (body font, focus ring, reduced motion) and `@layer components` port of `cora.css` (`frontend/src/index.css`). Checked in the built CSS: `.font-display{font-family:var(--font-display)}`, `.rounded-\[16px\]{border-radius:16px}`, palette utilities present.
- `ui-kit/`: Button (+`buttonClass` for links), StateChip, Badge, MasteryRing, SegmentBar, ProgressBar, EmptyState, Skeleton, InlineError, CitationChip, CoraMark.
- `shell/`: AppShell (sidebar, mobile top bar, tab bar, menu drawer with focus-in / Escape / focus-return), SessionList + `groupSessions`, FocusLayout, `useDialogFocus`.
- `studentLocation.ts`: views `path | ask | lesson | quiz | results | review | progress | graph`, `&concept=`, `&beat=` (lesson), `&session=` (ask), `isFocusView`.
- StudentApp renders inside the new shell and uses `useSession()`; StudentChat uses `useSession()` too.
- Commits: `96f235b` style tokens, `c2840ed` ui-kit, `3dc76f3` URL model, `f940b1f` shell.
- Results: `yarn test` 18 files / 121 tests green; `yarn build` passes; eslint clean on changed files.

## Phase 1: Path (done; auth screens are the other agent's)

- `path/pathModel.ts` (tested): units by `concept.sources[0]`, named from the filename (`NE235_L07_Kinetics.pdf` → "NE235 L07 Kinetics"); unit status complete / current / upcoming / later; current concept = last lesson → server recommendation → first unmastered; weak spot; node abbreviations; greeting.
- `path/`: PathView, ContinueCard (resume at the saved step, or "Suggested next" with the server's reason), UnitBand (four looks), NodeList + ConceptNode (zig-zag via `.path-offset`), ConceptPopover (Guide me / Ask / Quiz me; Escape closes and focus returns to the node), TodayRail (cards due, weak spot, quick Ask; no streak/goal).
- `path/useDashboard.ts`: one `/learning/dashboard` load for the whole app, reloaded when you come back to Path or Progress.
- Retired: `StudentHomeArtboard.tsx`, `ConceptIndex.tsx` and their tests.
- Checked in a browser against real data at 1440 and 375 (guest): renders, popover works.
- Commits: `255b3bc`, `7c44b95`, `0680783`.
- Results: `yarn test` 18 files / 125 tests green; `yarn build` passes; eslint clean.
- Decisions:
  - **The path shows the dashboard's top 50 concepts**, not all of them (the API caps at 50). When the course has more, a line says so and links to the course graph. Why: no fake completeness; no backend change.
  - **Popovers open on click only**, not automatically for the current node as in the prototype. Why: auto-opening would steal keyboard focus on page load.
  - **Provenance line** says "Built from N published passages in M documents" (from the concept), not "5 linked concepts", which would need a neighbourhood request per node.
- Known issue: the unit split is only as good as `sources[0]`; with real data some units have one concept.

## Phase 2: Ask (done)

- `ask/askModel.ts` (tested): parses `/chat_bot` replies defensively → grounded answer / not in the material (no sources) / error (including the server's "Success" envelope with `info.error`); `classifyChatError` → hourly limit (429, keeps the server's wording), guest AI off (503), other; `matchConcept` (longest whole-word published concept name in the text); `titleFrom`.
- `ask/sessionStore.ts` + `useSessionStore.ts` (tested): recent sessions per person in localStorage (`cora.sessions.v1.<email|guest>`), capped at 40, validated on read, pending replies settle to "interrupted" after a reload, Guide/Quiz entries recorded once per concept, cleared on sign-out. Guards against writing one person's list under another's key when the user changes.
- `ask/`: AskView, AnswerTurn (grounded badge, markdown answer, source cards, copy, hand-off), SourceCards, SourceDrawer (desktop panel / phone bottom sheet; focus in, Escape, focus back), Composer (Ask / Guide me / Quiz me with `aria-pressed`; Enter sends), ModeHandoff, ReplyStates (failed / hourly limit / guest unavailable / not in material), `useReveal` (clock-based reveal; instant under reduced motion), `useAskRequest`.
- Guide me / Quiz me in the composer open the lesson / quiz for the concept the text names (or the session's concept); if none matches, a hint lists real concept names. No request is sent.
- StudentApp: Ask is no longer kept mounted; the conversation lives in the store, so an answer that lands after you leave still goes to the right session. Legacy chat contexts (ThemeWrapper, UserCredentials, FileContext, MessageContext, Spotlight) removed from the student app; `StudentChat.tsx` retired.
- Checked in a browser as a guest: the 503 "guest AI off" state renders, the session appears in the sidebar under Today.
- Commits: `5f70e9b` (prettier only), `6084bfd`, `9eaaacd`, `f34ad7d`.
- Results: `yarn test` 22 files / 158 tests green; `yarn build` passes; eslint clean.
- Decisions:
  - **No inline [n] chips** (cut, per instructions). Source cards under every answer.
  - **No scope selector.** The backend always searches all published material for learners, so the header says "Searching all published material" instead of offering a selector that would do nothing.
  - **No "helpful" / "report" / "Tell my TA it's missing" buttons.** There is no endpoint to receive them; a button that does nothing would be fake. Copy is kept.
  - **The source drawer shows a real passage only when Ask is about a concept** (it uses `/learning/sources/{concept}` and the passage from that document). Otherwise it says the passage text isn't available yet. See Backend requests.
- Known issues: in Ask, the first answer of a brand-new session is announced/animated normally; answers restored from storage appear instantly (by design).

## Backend requests

1. **Chat sources with passage text.** `/chat_bot` returns `info.sources` (filenames) and `info.nodedetails.chunkdetails` (`{id, score}` only). The source drawer needs, per chunk: document filename, chunk text, page/position. Either add those to `chunkdetails`, or add a learner-safe `GET /learning/passages/{chunk_id}` (published only). `/fetch_chunktext` and `/chunk_entities` are admin-only.
2. **`/learning/sources/{concept}` passages have no `id`** although the frontend type says `id: string`. Harmless today; worth adding chunk ids so chat chunks and concept passages can be matched.
