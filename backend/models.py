from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from zoneinfo import ZoneInfo

from .database import Base

def get_kst_time():
    return datetime.now(ZoneInfo('Asia/Seoul'))

class NewsArticle(Base):
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), index=True)
    original_url = Column(String(1000), unique=True, index=True)
    publisher = Column(String(100))
    pub_date = Column(DateTime)
    category = Column(String(100))
    raw_content = Column(Text)
    created_at = Column(DateTime, default=get_kst_time)

    # Relationship to AI Summary
    summary = relationship("AISummary", back_populates="article", uselist=False, cascade="all, delete-orphan")
    usage_logs = relationship("LLMUsageLog", back_populates="article", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_news_pub_date", "pub_date"),
        Index("ix_news_category", "category"),
        Index("ix_news_pub_category", "pub_date", "category"),
        Index("ix_news_publisher", "publisher"),
    )

    def __repr__(self):
        return f"<NewsArticle(id={self.id}, title='{self.title[:50]}...')>"

class AISummary(Base):
    __tablename__ = "ai_summaries"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("news_articles.id"), unique=True, index=True)
    summary_text = Column(Text)
    keywords = Column(String(500)) # Comma separated keywords
    sentiment_score = Column(Float) # From -1.0 to 1.0, or 0.0 to 100.0. Let's use 0-100 score for easier interpretation
    translated_title = Column(String(500), nullable=True)  # Korean translation of the original English title

    article = relationship("NewsArticle", back_populates="summary")

    def __repr__(self):
        return f"<AISummary(id={self.id}, article_id={self.article_id})>"

class LLMUsageLog(Base):
    __tablename__ = "llm_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("news_articles.id"), index=True, nullable=True)
    model_name = Column(String(100), nullable=False, default="gpt-4o-mini")
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=get_kst_time)

    article = relationship("NewsArticle", back_populates="usage_logs")

    __table_args__ = (
        Index("ix_llm_created", "created_at"),
    )

    def __repr__(self):
        return f"<LLMUsageLog(id={self.id}, model={self.model_name}, cost=${self.estimated_cost_usd:.6f})>"
