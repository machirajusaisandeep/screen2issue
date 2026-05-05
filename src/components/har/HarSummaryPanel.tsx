import type { HarSummary } from '@/types/report'
import { formatSignedTimestamp } from '@/lib/video/formatTimestamp'
import { formatBytes } from '@/lib/report/reportData'

type HarSummaryPanelProps = {
  summary: HarSummary
}

export function HarSummaryPanel({ summary }: HarSummaryPanelProps) {
  const suspiciousEntries = summary.entries.filter((entry) => entry.isError || entry.isSlow).slice(0, 8)

  return (
    <div className="analysis-card">
      <div className="analysis-card-head">
        <div>
          <h3>Network Summary</h3>
          <p>Sanitized HAR data that can help explain what the browser or API was doing.</p>
        </div>
        <div className="analysis-pill mono">{summary.fileName}</div>
      </div>

      <div className="analysis-kpis">
        <div>
          <strong>{summary.totalRequests}</strong>
          <span>Total requests</span>
        </div>
        <div>
          <strong>{summary.errorCount}</strong>
          <span>Failed requests</span>
        </div>
        <div>
          <strong>{summary.slowRequestCount}</strong>
          <span>Slow requests</span>
        </div>
      </div>

      {suspiciousEntries.length > 0 ? (
        <div className="har-table-wrap">
          <table className="har-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>URL</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {suspiciousEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{typeof entry.offsetMs === 'number' ? formatSignedTimestamp(entry.offsetMs) : 'n/a'}</td>
                  <td>{entry.method}</td>
                  <td className="har-url">{entry.url}</td>
                  <td>{entry.status ?? 'failed'}</td>
                  <td>{typeof entry.durationMs === 'number' ? `${Math.round(entry.durationMs)}ms` : 'n/a'}</td>
                  <td>
                    {typeof entry.responseSizeBytes === 'number'
                      ? formatBytes(entry.responseSizeBytes)
                      : typeof entry.requestSizeBytes === 'number'
                        ? formatBytes(entry.requestSizeBytes)
                        : 'n/a'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="analysis-empty">No suspicious requests were detected in this HAR file.</div>
      )}
    </div>
  )
}
