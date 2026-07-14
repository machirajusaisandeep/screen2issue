import { describe, expect, it } from 'vitest'
import { validateReport } from './validation'
import { createSampleReport } from '@/lib/project/sampleProject'
import { generateGitHubIssueMarkdown } from './builtins'

describe('report validation and exports', () => {
  const sample = () => createSampleReport({ state: 'idle' })
  it('accepts the complete sample report', () => {
    expect(validateReport(sample())).toEqual([])
  })

  it('identifies blocking missing title and evidence', () => {
    const report = sample()
    report.title = ''
    report.frames = report.frames.map((frame) => ({ ...frame, included: false }))
    expect(validateReport(report).filter((issue) => issue.severity === 'error').map((issue) => issue.id))
      .toEqual(['missing-title', 'missing-evidence'])
  })

  it('generates reviewable GitHub issue Markdown', () => {
    const output = generateGitHubIssueMarkdown(sample())
    expect(output).toContain('Generated locally by Screen2Issue')
    expect(output).toContain('# ')
  })
})
