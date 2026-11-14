export const peso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const DAY = 86_400_000

/** Local yyyy-mm-dd for a Date. */
export const toISODate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const parseISODate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (s: string, n: number) => toISODate(new Date(parseISODate(s).getTime() + n * DAY))

export const today = () => toISODate(new Date())

/** Whole days between two yyyy-mm-dd strings (end exclusive). */
export const daysBetween = (start: string, end: string) =>
  Math.round((parseISODate(end).getTime() - parseISODate(start).getTime()) / DAY)

export const prettyDate = (s: string) =>
  parseISODate(s).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

export const prettyDateTime = (ms: number) =>
  new Date(ms).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Date ranges overlap if a.start < b.end && b.start < a.end (end exclusive). */
export const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart < bEnd && bStart < aEnd

export const shortId = (prefix: string) =>
  prefix + '-' + Math.random().toString(36).slice(2, 7).toUpperCase()
