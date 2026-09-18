"""Regression tests for the entity-extraction transformer configuration.

Background: entity extraction silently produced ZERO entities for every document.
LLMGraphTransformer was built with ignore_tool_usage=True, which parses entities out
of raw model prose instead of a tool-call schema. Combined with ADDITIONAL_INSTRUCTIONS,
the model drifted off the exact JSON shape that parser expects, the parse failure was
swallowed, and every ingest "succeeded" with chunks but no concepts. Nothing failed
loudly, so the whole learning feature had no concept spine to build on.
"""

import asyncio
import unittest
from unittest.mock import patch

from src.llm import get_graph_document_list


class FakeLLM:
    """Stands in for a chat model whose name decides the extraction path."""

    def __init__(self, name):
        self._name = name

    def get_name(self):
        return self._name


class RecordingTransformer:
    """Captures the kwargs the production code passes to LLMGraphTransformer."""

    last_kwargs = None

    def __init__(self, **kwargs):
        RecordingTransformer.last_kwargs = kwargs

    async def aconvert_to_graph_documents(self, documents):
        return []


def build_transformer_with(llm):
    RecordingTransformer.last_kwargs = None
    with patch(
        "langchain_experimental.graph_transformers.LLMGraphTransformer",
        RecordingTransformer,
    ):
        asyncio.run(get_graph_document_list(llm, [], "", "", None, None))
    return RecordingTransformer.last_kwargs


class GraphTransformerConfigTest(unittest.TestCase):
    def test_tool_calling_models_use_structured_output(self):
        """OpenAI/Anthropic/Vertex must extract via tool calls, not prose parsing."""
        for name in ("ChatOpenAI", "AzureChatOpenAI", "ChatAnthropic", "ChatVertexAI"):
            with self.subTest(model=name):
                kwargs = build_transformer_with(FakeLLM(name))
                self.assertFalse(
                    kwargs["ignore_tool_usage"],
                    f"{name} supports tool calling, so the prompt-only parser must stay off",
                )

    def test_models_without_tool_calling_fall_back_to_prompting(self):
        """Models with no tool-call support still need the prose path to work at all."""
        kwargs = build_transformer_with(FakeLLM("ChatOllama"))
        self.assertTrue(kwargs["ignore_tool_usage"])

    def test_additional_instructions_are_still_applied(self):
        """The grounding instructions must survive the switch to tool calling."""
        kwargs = build_transformer_with(FakeLLM("ChatOpenAI"))
        self.assertTrue(kwargs["additional_instructions"].strip())


if __name__ == "__main__":
    unittest.main()
