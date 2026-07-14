import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSampleReport } from './sampleProject'
import { clearProjectDraft, getDraftSummary, loadProjectDraft, saveProjectDraft } from './storage'

beforeEach(async () => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:restored-frame'),
  })
  await clearProjectDraft()
})

describe('project persistence', () => {
  it('round-trips derived report data without storing the original recording', async () => {
    const report = createSampleReport({ state: 'idle' })
    const document = await saveProjectDraft(report, 'timeline')
    const summary = await getDraftSummary()
    const restored = await loadProjectDraft()
    expect(document.source.originalRecordingPersisted).toBe(false)
    expect(summary?.frameCount).toBe(3)
    expect(restored?.report.title).toBe(report.title)
    expect(restored?.report.frames).toHaveLength(3)
    expect(restored?.report.frames[0].imageUrl).toBe('blob:restored-frame')
  })

  it('clears the active project and derived assets', async () => {
    await saveProjectDraft(createSampleReport({ state: 'idle' }), 'timeline')
    await clearProjectDraft()
    expect(await getDraftSummary()).toBeNull()
  })
})
