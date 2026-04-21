export type ApplicableLaw = 'ley_vieja' | 'ley_nueva'

export const LEY_NUEVA_CUTOFF = new Date('2017-01-26T00:00:00')

const LEY_VIEJA_MIN_HOURS = 115
const LEY_NUEVA_MIN_HOURS = 130
const LEY_VIEJA_VACATION  = 10  // 1.25 days × 8 hrs
const SHARED_SICK         = 8   // 1 day × 8 hrs

const LEY_NUEVA_VACATION_SCALE: Array<{ minYears: number; hours: number }> = [
  { minYears: 15, hours: 10 },
  { minYears: 5,  hours: 8  },
  { minYears: 1,  hours: 6  },
  { minYears: 0,  hours: 4  },
]

export function assignLaw(hireDate: Date): ApplicableLaw {
  return hireDate < LEY_NUEVA_CUTOFF ? 'ley_vieja' : 'ley_nueva'
}

export function getYearsOfService(hireDate: Date, asOf: Date): number {
  return (asOf.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
}

export interface MonthAccrualInput {
  hireDate: Date
  applicableLaw: ApplicableLaw
  monthYear: Date    // first day of the month
  minutesWorked: number
}

export interface MonthAccrualResult {
  monthYear: string  // 'YYYY-MM-DD'
  hoursWorked: number
  qualified: boolean
  vacationHours: number
  sickHours: number
  yearsOfService: number
  isCurrentMonth: boolean
}

export function calculateMonthAccrual(
  input: MonthAccrualInput,
  isCurrentMonth: boolean
): MonthAccrualResult {
  const hoursWorked = input.minutesWorked / 60
  const minHours = input.applicableLaw === 'ley_vieja' ? LEY_VIEJA_MIN_HOURS : LEY_NUEVA_MIN_HOURS
  const qualified = hoursWorked >= minHours

  // Measure years of service to the last day of the month
  const lastDayOfMonth = new Date(
    input.monthYear.getFullYear(),
    input.monthYear.getMonth() + 1,
    0
  )
  const yearsOfService = Math.max(0, getYearsOfService(input.hireDate, lastDayOfMonth))

  let vacationHours = 0
  let sickHours = 0

  if (qualified) {
    sickHours = SHARED_SICK
    if (input.applicableLaw === 'ley_vieja') {
      vacationHours = LEY_VIEJA_VACATION
    } else {
      const bracket = LEY_NUEVA_VACATION_SCALE.find(b => yearsOfService >= b.minYears)
      vacationHours = bracket?.hours ?? 4
    }
  }

  return {
    monthYear: input.monthYear.toISOString().slice(0, 10),
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    qualified,
    vacationHours,
    sickHours,
    yearsOfService: Math.round(yearsOfService * 100) / 100,
    isCurrentMonth,
  }
}

export function enumerateMonths(from: Date, to: Date): Date[] {
  const months: Date[] = []
  const cur = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cur <= end) {
    months.push(new Date(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}
