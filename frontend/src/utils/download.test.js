import { describe, expect, it } from 'vitest'
import { chatToMarkdown, formatSource, slugify } from './download'

describe('formatSource', () => {
  it('formats single lines and ranges', () => {
    expect(formatSource({ path: 'a.py', start_line: 7, end_line: 7 })).toBe('a.py:L7')
    expect(formatSource({ path: 'a.py', start_line: 12, end_line: 40 })).toBe('a.py:L12-40')
    expect(formatSource({ path: 'a.py' })).toBe('a.py')
  })
})

describe('slugify', () => {
  it('produces safe file-name fragments', () => {
    expect(slugify('Project Summary')).toBe('project-summary')
    expect(slugify('  App.jsx  ')).toBe('app-jsx')
    expect(slugify('')).toBe('devlens')
  })
})

describe('chatToMarkdown', () => {
  it('renders questions, answers, and citations', () => {
    const md = chatToMarkdown('demo', [
      { role: 'user', content: 'Where is auth?' },
      { role: 'assistant', content: 'In auth.py.', sources: [{ path: 'auth.py', start_line: 1, end_line: 9 }] },
    ])
    expect(md).toContain('# DevLens chat – demo')
    expect(md).toContain('## Q: Where is auth?')
    expect(md).toContain('In auth.py.')
    expect(md).toContain('- `auth.py:L1-9`')
  })
})
