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
