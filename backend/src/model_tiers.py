"""Which LLM a request may use, decided by the server from the learner's role.

Why this exists: the browser used to send a `model` name with every chat
question, and the server used it as-is. A guest (no login) could ask for a paid
OpenAI model and spend the project's money. Now the server picks:

- Guests always get the free model named in GUEST_LLM_MODEL (e.g. Groq or
  OpenRouter through an OpenAI-compatible LLM_MODEL_CONFIG_* entry). If it is
  not set, guest AI features are refused. We never quietly fall back to a paid model.
- Signed-in students and TAs get the course models: LEARNER_CHAT_MODEL for chat,
  LEARNING_MODEL for lessons, quizzes and flashcards.
- Only staff (admin, test_full) may pick a model by name, for testing.

The values are model keys for src/llm.py get_llm(), e.g. "openai_gpt_4o_mini"
looks up LLM_MODEL_CONFIG_OPENAI_GPT_4O_MINI.
"""

import os
from typing import Optional

GUEST_ROLE = "guest"
# Staff can choose a model from the UI's model picker when testing answers.
MODEL_PICKER_ROLES = frozenset({"admin", "test_full"})

DEFAULT_LEARNER_CHAT_MODEL = "openai_gpt_4o_mini"
DEFAULT_LEARNING_MODEL = "openai_gpt_4o"

# Safe to show the public: no setting names or provider details.
GUEST_AI_UNAVAILABLE_MESSAGE = "Guest AI features are not available right now. Please sign in to continue."


class GuestModelNotConfigured(RuntimeError):
    """Raised instead of silently giving a guest a paid model."""


def _setting(name: str, default: str = "") -> str:
    """Read an env setting, treating a blank value the same as a missing one."""
    value = (os.getenv(name) or "").strip()
    return value or default


def guest_model() -> str:
    model = _setting("GUEST_LLM_MODEL")
    if not model:
        raise GuestModelNotConfigured("GUEST_LLM_MODEL is not set, so guest AI features are off")
    # The model's provider line must exist too. example.env ships it blank, and a
    # blank line should switch guests off cleanly, not crash inside get_llm().
    # Same name rule as src/llm.py: upper-case, "." becomes "_".
    config_name = f"LLM_MODEL_CONFIG_{model.upper().replace('.', '_')}"
    if not _setting(config_name):
        raise GuestModelNotConfigured(f"{config_name} is blank, so guest AI features are off")
    return model


def chat_model_for(role: Optional[str], requested_model: Optional[str] = None) -> str:
    """The chat model this learner may use. `requested_model` comes from the browser."""
    if role == GUEST_ROLE:
        return guest_model()
    if role in MODEL_PICKER_ROLES and requested_model:
        return requested_model
    return _setting("LEARNER_CHAT_MODEL", DEFAULT_LEARNER_CHAT_MODEL)


def learning_model_for(role: Optional[str]) -> str:
    """The model that generates lessons, quizzes and flashcards for this learner."""
    if role == GUEST_ROLE:
        return guest_model()
    return _setting("LEARNING_MODEL", DEFAULT_LEARNING_MODEL)


def cache_variant(role: Optional[str], variant: str) -> str:
    """The learning-cache slot for this learner.

    Generated content is cached per concept and shared by everyone. Content a
    guest's free model wrote goes in its own "guest" slot, so signed-in learners
    keep getting the course model's version.
    """
    if role != GUEST_ROLE:
        return variant
    return f"guest:{variant}" if variant else "guest"
