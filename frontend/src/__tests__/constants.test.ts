import { describe, it, expect } from 'vitest'
import { categoryLabel, categoryColor, sentimentBadge, isMockSummary } from '../constants'

describe('categoryLabel', () => {
  it('returns Korean label for known categories', () => {
    expect(categoryLabel('AI')).toBe('인공지능')
    expect(categoryLabel('Robotics')).toBe('로보틱스')
    expect(categoryLabel('Semiconductor')).toBe('반도체')
  })
  it('returns the code itself for unknown categories', () => {
    expect(categoryLabel('Unknown')).toBe('Unknown')
  })
})

describe('categoryColor', () => {
  it('returns color for known categories', () => {
    expect(categoryColor('AI')).toBe('#FF6B35')
    expect(categoryColor('Robotics')).toBe('#34C759')
  })
  it('returns default gray for unknown categories', () => {
    expect(categoryColor('Unknown')).toBe('#8E8E93')
  })
})

describe('sentimentBadge', () => {
  it('returns 긍정 for score > 65', () => {
    expect(sentimentBadge(70).label).toBe('긍정')
    expect(sentimentBadge(70).variant).toBe('success')
  })
  it('returns 부정 for score < 40', () => {
    expect(sentimentBadge(30).label).toBe('부정')
    expect(sentimentBadge(30).variant).toBe('danger')
  })
  it('returns 중립 for score between 40-65', () => {
    expect(sentimentBadge(50).label).toBe('중립')
    expect(sentimentBadge(50).variant).toBe('warning')
  })
})

describe('isMockSummary', () => {
  it('returns false when no summary', () => {
    expect(isMockSummary({ summary: null } as any)).toBe(false)
  })
  it('detects mock keywords', () => {
    expect(isMockSummary({ summary: { keywords: 'mock, test', summary_text: 'real' } } as any)).toBe(true)
  })
  it('detects mock summary text', () => {
    expect(isMockSummary({ summary: { keywords: 'real', summary_text: 'api 키 미설정' } } as any)).toBe(true)
  })
})
