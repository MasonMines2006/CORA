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

## Phase 3: Lesson, Quiz, Results, Review (done)

- `quiz/quizModel.ts` (tested): reducer `answering → grading → feedback → results` (+ `gradeError` that keeps answers, `reset` for a new quiz); `keyToAction` (1–4 choose, Enter checks/continues, ignored while grading or on results); `masteryChange`, `shouldCelebrate` (only when the score rose: never flat or falling), `resultsHeadline`, `difficultyNote`.
- `quiz/`: QuizPlayer (focus mode, option keys as `role=radio` in a `radiogroup`, difficulty chip "Medium · picked from your 60% mastery", "I don't know yet" → Ask, states: generating skeleton, not enough material (Guide/Ask instead), signed out, grading failed with retry), FeedbackSheet (emerald / red-50 footer, icon + words + letter fill), QuizResults (true delta headline, MasteryDelta bar with the 80% marker, Celebration burst only on a rise and off under reduced motion, correct + time tiles, every missed question with Talk it through / Re-read), `useQuizSession`.
- `lesson/`: LessonPlayer (focus mode, `Step n of 4` + progressbar, markdown beats so formulas / worked examples in code fences get the red-50 block, quick check that reveals on tap with words, "Written from" source files, AskRail at ≥1280px, sticky Back / Ask / Continue → "Quiz me on it"), `useLesson` (saves progress on every step), states (writing skeleton, too few passages → Ask, signed out, failure → Retry/Ask), `lessonModel.ts` (tested).
- `Student/loadError.ts` (tested): 409 → not enough material, 404 → not found, 401 → signed out.
- ReviewSession re-skinned with the quiz chrome (segments or a bar past 12 cards, dark concept tag, display-type prompt, `.option` grade keys with intervals, kbd hints, All caught up). Logic and its tests unchanged.
- StudentApp: lesson / quiz / results render in FocusLayout outside the shell; X returns to the screen you came from; lesson → quiz and quiz → results replace history so Back doesn't land on a graded quiz; Guide/Quiz sessions recorded in the sidebar; dashboard reloads after a quiz. Results after a refresh show an explanation and a link to Progress (no fake numbers). Retired ConceptHub, ConceptHubRail, ConceptLesson, StudentAssess, ConceptSources, ConceptNeighbourhoodGraph (+ tests). `conceptHubModel.ts` stays (Review uses `formatInterval`).
- Checked in a browser as a guest: lesson shows the failure state with Retry / Ask instead (guest AI is off in this dev stack, so content generation 503s).
- Commits: `cfcddf2`, `8a27940`, `0b065e3`, `fa62835`, `7ca2e1b`.
- Results: `yarn test` 26 files / 182 tests green; `yarn build` passes; eslint clean.
- Decisions:
  - **Feedback after the last answer, not after each one.** `/learning/quiz/grade` grades the whole quiz once (a second call is a 409) and the answer key is never sent early, so per-question "Check" can't know the answer. The button says "Next question" / "Check answers", the first question says "You'll see how you did after the last question", and then each question gets its feedback sheet in turn. See Backend requests.
  - **No streak tile on Results** and no "Added to your review cards" line: there is no streak data, and quiz grading doesn't itself create review cards.
  - **Lesson "Flag it for your TA" left out**: no endpoint.

## Phase 4 subset: Progress and Landing (done)

- `progress/progressModel.ts` (tested): mastered / started / cards due / course concept count, "needs work" (started, unmastered, weakest first, max 5), mastery by unit (same units as the Path).
- `progress/`: ProgressView (profile header, stat strip with "–" and "Finish your first check to start" for a new learner, mastery by unit as stacked emerald/amber bars with a text label, needs-work list with Quiz buttons, account card with Sign in / Sign out), loading skeleton and error with Retry.
- `Landing/`: rewritten (Landing.tsx + LandingSections.tsx + test). Left-aligned claim, an example answer with its source beside it, "One concept, three ways in", "Every answer has a receipt", dark CTA strip. Sign in goes through `useSession().signIn('/student')`; signed-in visitors get "Open CORA". No orbs, demo graph, "AI-powered" or sparkles.
- Checked in a browser at 1440 and 375: no horizontal scroll on Landing, Path, Ask, Review, Progress, lesson, quiz, graph (one Progress overflow found and fixed in `a4eefb0`).
- Commits: `937f52c`, `342c161`, `a4eefb0`, `dc8da1f`.
- Decisions:
  - **Progress shows Mastered / Started / Cards due / In the course**, not streak / checks this week / questions asked / heatmap: there is no activity data (DESIGN.md cut item 6). Mastered and Started say they cover "the N most-connected concepts", because the dashboard computes them over its 50-concept sample (see Backend requests).
  - **No "Change password" or daily-goal editor** on the account card: those belong to the in-house auth work and an activity endpoint that don't exist on this branch.
  - **Landing keeps "Look around as a guest"** next to Sign in, because guest access still works today (DESIGN.md open question 2). Remove the button if guests are dropped.
  - **Landing has no library counts**: `GET /public/stats` doesn't exist, and the rule is to hide counts rather than show zeros or made-up numbers. The example answer in the hero uses a "Source 1" chip, not a made-up document reference.

## Review pass (after Phase 4)

A read-only code review of `0bf8e87..HEAD` found no critical or high issues. These were fixed: Enter on a focused quiz button was hijacked as "Check", and holding Enter skipped through the feedback (`8f2d3b4`). Focus now moves to each new question (`8f2d3b4`). An empty answer never finished revealing (`f73324c`). A quiz cost two dashboard reloads (`ce96e62`). Review also got a page heading (`ce96e62`).

Final results: `yarn test` 29 files / 194 tests green; `yarn build` passes; eslint clean on every changed file.

## Known issues (not fixed)

- **Quiz options are `role=radio` buttons, not a roving radio group.** Each option is a Tab stop, and arrow keys do nothing (1 to 4 work). During feedback the options are `disabled`. Better: native radios, or a roving tabindex with `aria-disabled`.
- **The mobile menu and the phone source sheet don't trap Tab.** Focus moves in, Escape works and focus comes back, but Tab can reach the page behind. Fix: set `inert` on the main content while they are open.
- **The course graph re-lays out after a lesson or quiz.** Focus views render outside AppShell, so the hidden-but-mounted `StudentExplore` unmounts. Fix: render focus views as an overlay, or hide the shell instead of returning early.
- **Sign in with `VITE_SKIP_AUTH=true`** calls `useSession().signIn()`, which calls Auth0 with no provider and throws in the console. The Landing avoids this by opening `/student`; the student shell button doesn't. This will be resolved by the in-house auth `session.ts`.
- **Results are memory-only.** A refresh on `?view=results` shows an explanation and a link to Progress.
- **Graph explorer restyle** was cut, as planned. `StudentExplore` is reachable from "Course graph" and still uses its older look.

## Where to resume

All in-scope phases are done. The next steps:
1. Fix the known issues above, roughly in that order.
2. Phase 4 Admin (Materials restyle, Users) once the auth agent's work lands.
3. Wire the Backend requests below as they arrive: passage text in the source drawer, per-question quiz checking, activity data for streak/goal/heatmap.

## Backend requests

1. **Chat sources with passage text.** `/chat_bot` returns `info.sources` (filenames) and `info.nodedetails.chunkdetails` (`{id, score}` only). The source drawer needs, per chunk: document filename, chunk text, page/position. Either add those to `chunkdetails`, or add a learner-safe `GET /learning/passages/{chunk_id}` (published only). `/fetch_chunktext` and `/chunk_entities` are admin-only.
2. **`/learning/sources/{concept}` passages have no `id`** although the frontend type says `id: string`. Harmless today; worth adding chunk ids so chat chunks and concept passages can be matched.
3. **Per-question quiz checking.** For the immediate feedback in DESIGN.md 5.6: e.g. `POST /learning/quiz/{quiz_id}/check {question_id, selected_index}` → `{is_correct, correct_index, explanation}`, recording the answer, with mastery updated once at the end as today.
4. **Lesson and quiz generation for guests** returns 503 "Learning content is temporarily unavailable" when no guest model is configured. The UI shows a retry; a distinct status or message (like chat's guest-unavailable 503) would let it say "sign in to use lessons" instead.
5. **Whole-course progress counts.** `/learning/dashboard`'s `started_concepts` / `mastered_concepts` / `average_mastery` are computed over the ranked 50-concept sample, so a concept mastered outside the sample isn't counted. Progress needs whole-course counts (like `course`), and the Path needs either all concepts or a paged list to show every unit.
6. **Activity data** (`GET /learning/activity`: distinct active days from quiz/review attempts) to bring back the streak, daily goal and heatmap.
7. **`GET /public/stats`** (published documents / passages / concepts) if the landing should show library counts.
