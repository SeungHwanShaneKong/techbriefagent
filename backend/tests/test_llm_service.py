"""Unit tests for LLM service module."""
import pytest


def test_estimate_cost_usd():
    """Test cost calculation."""
    from backend.llm_service import estimate_cost_usd
    cost = estimate_cost_usd(1000, 500)
    assert isinstance(cost, float)
    assert cost >= 0.0


def test_estimate_cost_usd_zero():
    """Test cost with zero tokens."""
    from backend.llm_service import estimate_cost_usd
    cost = estimate_cost_usd(0, 0)
    assert cost == 0.0


def test_normalize_chatbot_bullets_normal():
    """Test normalizing exactly 3 bullet points."""
    from backend.llm_service import _normalize_chatbot_bullets
    text = "\u2022 Point one\n\u2022 Point two\n\u2022 Point three"
    result = _normalize_chatbot_bullets(text)
    lines = result.strip().split("\n")
    assert len(lines) == 3


def test_normalize_chatbot_bullets_excess():
    """Test normalizing more than 3 bullets to exactly 3."""
    from backend.llm_service import _normalize_chatbot_bullets
    text = "\u2022 One\n\u2022 Two\n\u2022 Three\n\u2022 Four\n\u2022 Five"
    result = _normalize_chatbot_bullets(text)
    lines = result.strip().split("\n")
    assert len(lines) == 3


def test_normalize_chatbot_bullets_insufficient():
    """Test padding when fewer than 3 bullets."""
    from backend.llm_service import _normalize_chatbot_bullets
    text = "\u2022 Only one point"
    result = _normalize_chatbot_bullets(text)
    lines = result.strip().split("\n")
    assert len(lines) == 3


def test_normalize_chatbot_bullets_various_formats():
    """Test that various bullet formats are normalized to the bullet character."""
    from backend.llm_service import _normalize_chatbot_bullets
    text = "- Dash bullet\n* Star bullet\n\u2022 Circle bullet\n\u25cf Filled bullet"
    result = _normalize_chatbot_bullets(text)
    lines = result.strip().split("\n")
    assert len(lines) == 3
    for line in lines:
        assert line.startswith("\u2022 ")


def test_normalize_summary_lines():
    """Test normalizing summary lines to 10."""
    from backend.llm_service import normalize_summary_lines
    lines = ["Line " + str(i) for i in range(15)]
    result = normalize_summary_lines(lines)
    assert len(result) == 10


def test_normalize_summary_lines_short():
    """Test padding when fewer than 10 lines."""
    from backend.llm_service import normalize_summary_lines
    lines = ["Line 1", "Line 2"]
    result = normalize_summary_lines(lines)
    assert len(result) == 10


def test_normalize_summary_lines_strips_numbering():
    """Test that leading numbering and bullet characters are stripped."""
    from backend.llm_service import normalize_summary_lines
    lines = ["1. First point", "2. Second point", "- Third point"]
    result = normalize_summary_lines(lines)
    assert len(result) == 10
    # The numbering prefix should be stripped
    assert not result[0].startswith("1.")
    assert not result[1].startswith("2.")
    assert not result[2].startswith("-")


def test_build_mock_response():
    """Test mock response has required fields."""
    from backend.llm_service import build_mock_response
    result = build_mock_response("Test title")
    assert "summary_text" in result
    assert "keywords" in result
    assert "sentiment_score" in result
    assert isinstance(result["sentiment_score"], (int, float))
    assert "category" in result
    assert result["category"] == "General Tech"


def test_build_mock_response_translated_title():
    """Test mock response uses title as translated_title."""
    from backend.llm_service import build_mock_response
    result = build_mock_response("Apple launches new AI chip")
    assert result["translated_title"] == "Apple launches new AI chip"


def test_build_mock_response_empty_title():
    """Test mock response with empty title sets translated_title to None."""
    from backend.llm_service import build_mock_response
    result = build_mock_response("")
    assert result["translated_title"] is None
