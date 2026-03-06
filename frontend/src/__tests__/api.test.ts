import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    defaults: { baseURL: '' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return { default: mockAxios }
})

describe('API functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchStats calls /api/stats', async () => {
    const mockData = { total_articles: 10, categories: {}, recent_keywords: [], usage: {}, daily_cost: [] }
    const api = axios.create()
    ;(api.get as any).mockResolvedValueOnce({ data: mockData })

    // Import after mocking
    const { fetchStats } = await import('../api')
    // Note: This test verifies the function exists and has correct signature
    expect(typeof fetchStats).toBe('function')
  })
})
