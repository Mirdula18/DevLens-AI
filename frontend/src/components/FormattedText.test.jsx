import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import FormattedText from './FormattedText'

const render = text => renderToStaticMarkup(<FormattedText text={text} />)

describe('FormattedText', () => {
  it('renders nothing for empty text', () => {
    expect(render('')).toBe('')
  })

  it('renders fenced code blocks without markdown processing', () => {
    const html = render('Intro\n```python\nx = **1**\n```\nAfter')
    expect(html).toContain('<pre')
    expect(html).toContain('x = **1**')
    expect(html).not.toContain('```')
  })

  it('renders an unclosed fence (mid-stream) as code', () => {
    expect(render('```js\nconst a = 1')).toContain('<code>const a = 1</code>')
  })

  it('formats headings, bold, and inline code', () => {
    const html = render('### Summary\nUses **FastAPI** and `uvicorn`')
    expect(html).toContain('Summary')
    expect(html).not.toContain('###')
    expect(html).toContain('<strong class="text-white">FastAPI</strong>')
    expect(html).toMatch(/<code[^>]*>uvicorn<\/code>/)
  })

  it('strips list markers, including doubled "* -" bullets', () => {
    const html = render('* - Import statements\n  - nested item\n1. first')
    expect(html).toContain('Import statements')
    expect(html).not.toMatch(/>\s*[*-]\s/)
    expect(html).toContain('1.')
    expect(html).toContain('first')
  })

  it('escapes HTML in model output', () => {
    expect(render('<script>alert(1)</script>')).not.toContain('<script>')
  })
})
