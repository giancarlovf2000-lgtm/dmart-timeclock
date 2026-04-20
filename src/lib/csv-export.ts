import { formatDateMMDDYYYY } from './pay-periods'

interface EmployeeSummary {
  employee_name: string
  quickbooks_display_name: string | null
  total_minutes: number
}

interface PeriodInfo {
  start_date: string
  end_date: string
}

export function buildQuickBooksCSV(employees: EmployeeSummary[], period: PeriodInfo): string {
  const header = 'Employee Name,Pay Period Start,Pay Period End,Total Hours,Pay Type'

  const periodStart = formatDateMMDDYYYY(period.start_date)
  const periodEnd = formatDateMMDDYYYY(period.end_date)

  const rows = employees
    .filter(e => e.total_minutes > 0)
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name))
    .map(e => {
      const name = (e.quickbooks_display_name || e.employee_name).replace(/"/g, '""')
      const hours = (e.total_minutes / 60).toFixed(2)
      return `"${name}",${periodStart},${periodEnd},${hours},Regular`
    })

  return [header, ...rows].join('\r\n')
}
