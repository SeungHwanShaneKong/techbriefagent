import time


def test_health_check(client):
    """Test GET /api/stats returns valid structure"""
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_articles" in data
    assert "categories" in data
    assert "usage" in data


def test_crawl_status(client):
    """Test GET /api/crawl-status returns valid structure"""
    response = client.get("/api/crawl-status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "message" in data


def test_news_dates(client):
    """Test GET /api/news-dates returns list"""
    response = client.get("/api/news-dates")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_news_endpoint(client):
    """Test GET /api/news returns paginated response"""
    response = client.get("/api/news")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "has_more" in data


def test_daily_brief(client):
    """Test GET /api/daily-brief returns valid structure"""
    response = client.get("/api/daily-brief", params={"target_date": "2025-01-01"})
    assert response.status_code == 200
    data = response.json()
    assert "target_date" in data
    assert "total_articles" in data


def test_crawl_rate_limit(client):
    """Test POST /api/crawl rate limiting by simulating a recent crawl timestamp"""
    import backend.main as main_module

    # Simulate that a crawl just happened by setting _last_crawl_time to now
    main_module._last_crawl_time = time.time()

    # Immediate call should be rate limited (429)
    response = client.post("/api/crawl", params={"min_articles": 10})
    assert response.status_code == 429
    data = response.json()
    assert "detail" in data
    assert "초" in data["detail"]


def test_news_pagination(client):
    """Test pagination parameters for /api/news"""
    response = client.get("/api/news", params={"limit": 5, "skip": 0})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "skip" in data
    assert "limit" in data
    assert data["limit"] == 5


def test_stats_structure(client):
    """Test GET /api/stats returns complete usage structure"""
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    usage = data["usage"]
    assert "current_model" in usage
    assert "prompt_tokens" in usage or "completion_tokens" in usage
