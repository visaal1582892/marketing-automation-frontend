/**
 * Shared layout helpers for full-width scrollable data tables.
 * Percent col widths prevent header/filter rows from shrinking when tbody is empty.
 */

export const DATA_TABLE_CLASS =
  'w-full min-w-full table-fixed border-separate border-spacing-0 text-xs'

export function dataTableStyle(minWidthPx) {
  return { width: '100%', minWidth: minWidthPx }
}

export function toPercentColWidths(pxWidths) {
  const total = pxWidths.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return pxWidths.map(() => '0%')
  return pxWidths.map((w) => `${((w / total) * 100).toFixed(4)}%`)
}

export function DataTableColGroup({ widths }) {
  const pcts = toPercentColWidths(widths)
  return (
    <colgroup>
      {pcts.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  )
}

/** Sticky Actions column — solid flat bg (no shadow / side border). */
export const ACTIONS_STICKY_HEADER =
  'sticky right-0 z-30 bg-slate-200'
export const ACTIONS_STICKY_BODY =
  'sticky right-0 z-[1] bg-slate-100'

export function TableStatusRow({ colSpan, children, className = '' }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`bg-white py-14 text-center text-slate-500 ${className}`}
      >
        {children}
      </td>
    </tr>
  )
}
