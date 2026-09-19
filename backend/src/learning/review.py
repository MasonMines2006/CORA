"""Spaced-review scheduling: a small, documented SM-2 variant.

Pure functions only -- no clock, no database. The caller passes `now`, which
keeps every rule testable and lets `preview_intervals` show each grade button's
outcome by simply running the scheduler once per grade.

How a card moves
----------------
A card's `reps` counts how many times in a row it has been recalled. While
`reps` is 0 the card is new (never graded) or relearning after a miss, and it
takes the fixed FIRST-STEP intervals. Once recalled, intervals grow by the
card's `ease`:

    grade   reps == 0 (new / relearning)   reps >= 1 (recalled before)
    again   1 minute                       1 minute, counts as a lapse
    hard    1 day                          max(1 day, interval x 1.2)
    good    1 day                          max(3 days, interval x ease)
    easy    4 days                         good's interval x 1.3

Ease changes on every grade (again -0.20, hard -0.15, easy +0.15, never below
1.3), so a card the student keeps finding hard grows more slowly from then on.
"""

from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Literal, Optional, get_args

Grade = Literal["again", "hard", "good", "easy"]
GRADES: tuple[str, ...] = get_args(Grade)

CardStatus = Literal["new", "learning", "review"]

MINUTE = 60
DAY = 24 * 60 * MINUTE

# SM-2's starting ease: a card recalled with "good" every time roughly 2.5x's
# its interval. The floor stops a hard card from collapsing to near-daily
# reviews forever (SM-2 uses the same 1.3).
DEFAULT_EASE = 2.5
MIN_EASE = 1.3

AGAIN_EASE_PENALTY = 0.20
HARD_EASE_PENALTY = 0.15
EASY_EASE_BONUS = 0.15

# A miss brings the card back within the same study session.
RELEARN_INTERVAL_SECONDS = MINUTE

# First-step intervals for a card with no successful recall yet. Hard and Good
# share "tomorrow" -- they differ in the ease they leave behind.
FIRST_HARD_SECONDS = DAY
FIRST_GOOD_SECONDS = DAY
FIRST_EASY_SECONDS = 4 * DAY

# The second successful Good waits at least this long. 1 day x 2.5 would be
# 2.5 days; a few days is SM-2's classic second step, and the floor also keeps
# Good ahead of Hard after an Easy first step.
SECOND_GOOD_MIN_SECONDS = 3 * DAY

# Hard still grows the interval a little -- the card was recalled, just slowly.
HARD_MULTIPLIER = 1.2
# Easy lands later than Good by this factor.
EASY_MULTIPLIER = 1.3

# A course runs a semester; nothing needs to wait longer than a year. The cap
# also stops repeated Easy grades from overflowing `timedelta` (~16 in a row).
MAX_INTERVAL_SECONDS = 365 * DAY


@dataclass(frozen=True)
class CardState:
    """One learner's schedule for one card. Frozen: `schedule` returns a new one."""

    ease: float = DEFAULT_EASE
    interval_seconds: int = 0
    reps: int = 0
    lapses: int = 0
    due_at: Optional[datetime] = None
    last_reviewed_at: Optional[datetime] = None


def card_status(state: Optional[CardState]) -> CardStatus:
    """Classify a card for the UI: never graded, being (re)learned, or in review."""
    if state is None or state.last_reviewed_at is None:
        return "new"
    if state.interval_seconds < DAY:
        return "learning"
    return "review"


def _next_ease(ease: float, grade: str) -> float:
    change = {
        "again": -AGAIN_EASE_PENALTY,
        "hard": -HARD_EASE_PENALTY,
        "good": 0.0,
        "easy": EASY_EASE_BONUS,
    }[grade]
    # Rounded so repeated +/- steps do not drift to 2.3499999...
    return round(max(MIN_EASE, ease + change), 2)


def _next_interval_seconds(state: CardState, grade: str) -> float:
    if grade == "again":
        return RELEARN_INTERVAL_SECONDS

    if state.reps == 0:
        return {
            "hard": FIRST_HARD_SECONDS,
            "good": FIRST_GOOD_SECONDS,
            "easy": FIRST_EASY_SECONDS,
        }[grade]

    # Growth uses the ease the card had *before* this grade.
    good_interval = max(SECOND_GOOD_MIN_SECONDS, state.interval_seconds * state.ease)
    if grade == "hard":
        return max(DAY, state.interval_seconds * HARD_MULTIPLIER)
    if grade == "good":
        return good_interval
    return good_interval * EASY_MULTIPLIER


def schedule(state: CardState, grade: str, now: datetime) -> CardState:
    """Return the card's new schedule after the learner grades it at `now`."""
    if grade not in GRADES:
        raise ValueError(f"Unknown grade {grade!r}; expected one of {', '.join(GRADES)}")

    interval = min(MAX_INTERVAL_SECONDS, round(_next_interval_seconds(state, grade)))
    missed = grade == "again"
    return replace(
        state,
        ease=_next_ease(state.ease, grade),
        interval_seconds=interval,
        reps=0 if missed else state.reps + 1,
        # A lapse is forgetting something already recalled, not failing a new card.
        lapses=state.lapses + 1 if missed and state.reps > 0 else state.lapses,
        due_at=now + timedelta(seconds=interval),
        last_reviewed_at=now,
    )


def preview_intervals(state: CardState, now: datetime) -> dict[str, int]:
    """The interval, in seconds, that each grade button would schedule."""
    return {grade: schedule(state, grade, now).interval_seconds for grade in GRADES}
