"""Unit tests for crawler module."""
import pytest
from datetime import datetime
from time import struct_time
from unittest.mock import patch


def test_to_pub_datetime_valid():
    """Test parsing valid date from feedparser entry with published_parsed."""
    from backend.crawler import _to_pub_datetime
    entry = {
        "published_parsed": struct_time((2024, 1, 15, 10, 30, 0, 0, 15, 0)),
    }
    result = _to_pub_datetime(entry)
    assert result is not None
    assert isinstance(result, datetime)
    assert result.year == 2024
    assert result.month == 1
    assert result.day == 15
    assert result.hour == 10
    assert result.minute == 30


def test_to_pub_datetime_updated_parsed():
    """Test fallback to updated_parsed when published_parsed is absent."""
    from backend.crawler import _to_pub_datetime
    entry = {
        "updated_parsed": struct_time((2025, 6, 1, 8, 0, 0, 0, 152, 0)),
    }
    result = _to_pub_datetime(entry)
    assert result is not None
    assert isinstance(result, datetime)
    assert result.year == 2025
    assert result.month == 6


def test_to_pub_datetime_none():
    """Test entry with no date fields returns None."""
    from backend.crawler import _to_pub_datetime
    entry = {}
    result = _to_pub_datetime(entry)
    assert result is None


def test_to_pub_datetime_none_values():
    """Test entry with explicitly None date values returns None."""
    from backend.crawler import _to_pub_datetime
    entry = {"published_parsed": None, "updated_parsed": None}
    result = _to_pub_datetime(entry)
    assert result is None


def test_is_mock_summary_result_mock_via_usage():
    """Test detecting mock summary results via usage.is_mock flag."""
    from backend.crawler import _is_mock_summary_result
    mock_result = {
        "usage": {"is_mock": True},
        "analysis": {
            "summary_text": "Some text",
            "keywords": "AI, Tech",
        },
    }
    assert _is_mock_summary_result(mock_result) is True


def test_is_mock_summary_result_mock_via_keywords():
    """Test detecting mock summary results via 'mock' in keywords."""
    from backend.crawler import _is_mock_summary_result
    mock_result = {
        "usage": {},
        "analysis": {
            "summary_text": "Normal summary text",
            "keywords": "Mock, Demo, Setup",
        },
    }
    assert _is_mock_summary_result(mock_result) is True


def test_is_mock_summary_result_mock_via_summary_text():
    """Test detecting mock summary via Korean mock phrases in summary_text."""
    from backend.crawler import _is_mock_summary_result
    mock_result = {
        "usage": {},
        "analysis": {
            "summary_text": "API \ud0a4 \ubbf8\uc124\uc815\uc73c\ub85c \uc778\ud574 \uc694\uc57d\uc774 \ubd88\uac00\ud569\ub2c8\ub2e4.",
            "keywords": "General",
        },
    }
    assert _is_mock_summary_result(mock_result) is True


def test_is_mock_summary_result_real():
    """Test detecting real summary results."""
    from backend.crawler import _is_mock_summary_result
    real_result = {
        "usage": {"is_mock": False},
        "analysis": {
            "summary_text": "Apple announced new AI features for iOS.",
            "keywords": "Apple, AI, iOS",
            "sentiment_score": 72.5,
            "translated_title": "\uc560\ud50c, iOS\uc5d0 \uc0c8\ub85c\uc6b4 AI \uae30\ub2a5 \ubc1c\ud45c",
            "category": "AI",
        },
    }
    assert _is_mock_summary_result(real_result) is False


def test_has_real_api_key_with_key():
    """Test API key detection when key exists."""
    from backend.crawler import _has_real_api_key
    with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-real-key-12345"}):
        assert _has_real_api_key() is True


def test_has_real_api_key_without_key():
    """Test API key detection when key is empty."""
    from backend.crawler import _has_real_api_key
    with patch.dict("os.environ", {"OPENAI_API_KEY": ""}, clear=False):
        result = _has_real_api_key()
        assert result is False


def test_has_real_api_key_placeholder():
    """Test API key detection when placeholder key is set."""
    from backend.crawler import _has_real_api_key
    with patch.dict("os.environ", {"OPENAI_API_KEY": "your_openai_api_key_here"}, clear=False):
        result = _has_real_api_key()
        assert result is False
