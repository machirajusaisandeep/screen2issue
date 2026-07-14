import { nanoid } from 'nanoid'
import type { BugReport, ExtractedFrame } from '@/types/report'
import type { LocalEngineStatus } from '@/lib/localEngine/types'
import { captureEnvironmentMetadata } from '@/lib/report/captureEnvironment'

const SAMPLE_MOMENTS = [
  {
    timestampMs: 2140,
    differenceScore: 0.31,
    title: 'Checkout ready',
    note: 'User selects express delivery and moves to the primary checkout action.',
    ocrText: 'Checkout · Express delivery · Place order',
    status: 'Ready to place order',
    accent: '#d6a634',
  },
  {
    timestampMs: 8920,
    differenceScore: 0.67,
    title: 'Action becomes unresponsive',
    note: 'The primary checkout action stops responding after it is clicked.',
    ocrText: 'Checkout · Processing…',
    status: 'Request still pending',
    accent: '#e0ad39',
  },
  {
    timestampMs: 12480,
    differenceScore: 0.42,
    title: 'Request fails',
    note: 'The request returns 500 without a recoverable error message in the interface.',
    ocrText: 'Something went wrong · Try again',
    status: 'POST /checkout → 500',
    accent: '#df6b5f',
  },
] as const

export function createSampleReport(localEngineStatus: LocalEngineStatus): BugReport {
  const frames: ExtractedFrame[] = SAMPLE_MOMENTS.map((moment, index) => ({
    id: nanoid(),
    timestampMs: moment.timestampMs,
    imageUrl: makeFrameSvg(moment.title, moment.status, moment.accent, index + 1),
    width: 1280,
    height: 720,
    differenceScore: moment.differenceScore,
    included: true,
    note: moment.note,
    ocrText: moment.ocrText,
    ocrConfidence: 94,
  }))

  return {
    title: 'Checkout button freezes after click',
    summary:
      'The checkout action becomes unresponsive after express delivery is selected. The final request returns a server error without a clear recovery path.',
    videoName: 'sanitized-checkout-example.mp4',
    videoType: 'video/mp4',
    videoSizeBytes: 8_400_000,
    videoDurationMs: 12_480,
    createdAt: new Date().toISOString(),
    environment: captureEnvironmentMetadata(),
    frames,
    observedBehavior: 'The button remains in a processing state and the request returns HTTP 500.',
    expectedBehavior: 'Show a recoverable error and keep the checkout action available for retry.',
    reproductionSteps: [
      'Open checkout with an item in the cart.',
      'Select express delivery.',
      'Choose Place order and wait for the request.',
    ],
    browserCursorEvents: [
      {
        id: nanoid(),
        timestampMs: 8920,
        type: 'possible_click',
        x: 76.2,
        y: 74.8,
        confidence: 0.88,
        note: 'Click on the primary checkout action.',
      },
    ],
    enhancedCursorEvents: [],
    transcriptSegments: [],
    localEngineStatus,
    enhancementWarnings: [],
  }
}

function makeFrameSvg(title: string, status: string, accent: string, index: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#0d0c0b"/>
    <rect x="36" y="28" width="1208" height="60" rx="12" fill="#1b1917" stroke="#3d3934"/>
    <rect x="60" y="49" width="28" height="18" rx="4" fill="${accent}"/>
    <text x="102" y="64" fill="#f3efe7" font-family="Inter,Arial" font-size="20" font-weight="700">Sample shop</text>
    <rect x="64" y="126" width="760" height="520" rx="18" fill="#171513" stroke="#3d3934"/>
    <text x="96" y="178" fill="#f3efe7" font-family="Inter,Arial" font-size="30" font-weight="700">Checkout</text>
    <text x="96" y="222" fill="#aaa49a" font-family="Inter,Arial" font-size="18">Delivery method</text>
    <rect x="96" y="246" width="696" height="88" rx="12" fill="#25221f" stroke="${accent}" stroke-width="2"/>
    <circle cx="128" cy="290" r="10" fill="${accent}"/>
    <text x="154" y="284" fill="#f3efe7" font-family="Inter,Arial" font-size="18" font-weight="700">Express delivery</text>
    <text x="154" y="310" fill="#aaa49a" font-family="Inter,Arial" font-size="15">Arrives tomorrow · $12.00</text>
    <rect x="96" y="510" width="696" height="70" rx="12" fill="${accent}"/>
    <text x="444" y="553" text-anchor="middle" fill="#19150d" font-family="Inter,Arial" font-size="19" font-weight="700">Place order</text>
    <rect x="856" y="126" width="360" height="520" rx="18" fill="#171513" stroke="#3d3934"/>
    <text x="888" y="178" fill="#f3efe7" font-family="Inter,Arial" font-size="23" font-weight="700">Evidence ${index}</text>
    <text x="888" y="224" fill="${accent}" font-family="JetBrains Mono,monospace" font-size="14">${escapeXml(status)}</text>
    <line x1="888" y1="252" x2="1184" y2="252" stroke="#3d3934"/>
    <text x="888" y="298" fill="#aaa49a" font-family="Inter,Arial" font-size="16">${escapeXml(title)}</text>
    <text x="888" y="590" fill="#777168" font-family="JetBrains Mono,monospace" font-size="13">SANITIZED SAMPLE · LOCAL ONLY</text>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] ?? character)
}
