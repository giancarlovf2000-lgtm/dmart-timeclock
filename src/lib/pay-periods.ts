export function getNextPeriodDates(startDate: Date, type: 'biweekly' | 'semi_monthly'): { start: Date; end: Date } {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  if (type === 'biweekly') {
    const end = new Date(start)
    end.setDate(start.getDate() + 13)
    return { start, end }
  }

  // semi_monthly: 1-15 or 16-end of month
  const day = start.getDate()
  if (day === 1) {
    const end = new Date(start.getFullYear(), start.getMonth(), 15)
    return { start, end }
  } else {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    return { start, end }
  }
}

export function formatPeriodLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
  const startStr = start.toLocaleDateString('es-PR', opts)
  const endStr = end.toLocaleDateString('es-PR', opts)
  return `${startStr} – ${endStr}`
}

export function formatDateMMDDYYYY(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${mm}/${dd}/${yyyy}`
}

export function minutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(2)
}

export function minutesToHoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
