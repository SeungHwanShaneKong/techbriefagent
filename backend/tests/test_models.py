from backend import models


def test_news_article_creation(db_session):
    """Test creating a NewsArticle"""
    from datetime import datetime
    article = models.NewsArticle(
        title="Test Article",
        original_url="https://example.com/test",
        publisher="Test Publisher",
        pub_date=datetime.now(),
        category="AI",
        raw_content="Test content",
    )
    db_session.add(article)
    db_session.commit()

    result = db_session.query(models.NewsArticle).first()
    assert result is not None
    assert result.title == "Test Article"
    assert result.category == "AI"


def test_ai_summary_creation(db_session):
    """Test creating an AISummary linked to an article"""
    from datetime import datetime
    article = models.NewsArticle(
        title="Test",
        original_url="https://example.com/test2",
        publisher="Test",
        pub_date=datetime.now(),
        category="AI",
        raw_content="Content",
    )
    db_session.add(article)
    db_session.commit()

    summary = models.AISummary(
        article_id=article.id,
        summary_text="Summary",
        keywords="test,keywords",
        sentiment_score=75.0,
    )
    db_session.add(summary)
    db_session.commit()

    result = db_session.query(models.AISummary).first()
    assert result is not None
    assert result.article_id == article.id
    assert result.sentiment_score == 75.0
