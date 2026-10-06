import { describe, expect, it } from 'vitest'
import { foldLanguages } from './InsightsPanel'

const lang = (name, lines, percent) => ({ name, files: 1, lines, percent })

describe('foldLanguages', () => {
  it('leaves short lists untouched', () => {
    const list = [lang('Python', 10, 100)]
    expect(foldLanguages(list, 3)).toBe(list)
  })

  it('folds the tail into a single Other row', () => {
    const list = [lang('A', 50, 50), lang('B', 30, 30), lang('C', 15, 15), lang('D', 5, 5)]
    const folded = foldLanguages(list, 3)
    expect(folded.map(l => l.name)).toEqual(['A', 'B', 'Other (2)'])
    expect(folded[2]).toMatchObject({ lines: 20, files: 2, percent: 20 })
  })
})
