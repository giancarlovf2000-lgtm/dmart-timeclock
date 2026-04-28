import { describe, it, expect } from 'vitest'
import { assignLaw, calculateMonthAccrual, enumerateMonths } from './leave-accrual'

// Helper: build a hire date exactly N years before the end of a reference month
function hireDateYearsAgo(years: number, referenceMonth = new Date('2026-03-01')): Date {
  const lastDay = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth() + 1, 0)
  return new Date(lastDay.getFullYear() - years, lastDay.getMonth(), lastDay.getDate())
}

const MAR_2026 = new Date('2026-03-01')

// ─── assignLaw ───────────────────────────────────────────────────────────────

describe('assignLaw', () => {
  it('returns ley_vieja for hire date before Jan 26 2017', () => {
    expect(assignLaw(new Date('2017-01-25T00:00:00'))).toBe('ley_vieja')
  })

  it('returns ley_nueva for hire date exactly on Jan 26 2017 (cutoff)', () => {
    expect(assignLaw(new Date('2017-01-26T00:00:00'))).toBe('ley_nueva')
  })

  it('returns ley_nueva for hire date after Jan 26 2017', () => {
    expect(assignLaw(new Date('2017-01-27T00:00:00'))).toBe('ley_nueva')
  })
})

// ─── enumerateMonths ─────────────────────────────────────────────────────────

describe('enumerateMonths', () => {
  it('returns 3 months for a Jan–Mar range', () => {
    // Use T00:00:00 to force local-time parsing (same convention as the rest of the system)
    const months = enumerateMonths(new Date('2026-01-01T00:00:00'), new Date('2026-03-01T00:00:00'))
    expect(months).toHaveLength(3)
    expect(months[0].getMonth()).toBe(0) // January
    expect(months[1].getMonth()).toBe(1) // February
    expect(months[2].getMonth()).toBe(2) // March
  })

  it('returns 1 month when from === to', () => {
    const months = enumerateMonths(new Date('2026-03-01'), new Date('2026-03-01'))
    expect(months).toHaveLength(1)
  })
})

// ─── Ley Vieja ────────────────────────────────────────────────────────────────

describe('calculateMonthAccrual — Ley Vieja', () => {
  const hireDate = new Date('2010-06-01T00:00:00')

  it('qualifies at exactly 115 hrs (6900 min) → 10h vacation + 8h sick', () => {
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_vieja', monthYear: MAR_2026, minutesWorked: 6900 },
      false
    )
    expect(result.qualified).toBe(true)
    expect(result.vacation_hours).toBe(10)
    expect(result.sick_hours).toBe(8)
  })

  it('qualifies at 120 hrs (7200 min) → 10h vacation + 8h sick', () => {
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_vieja', monthYear: MAR_2026, minutesWorked: 7200 },
      false
    )
    expect(result.qualified).toBe(true)
    expect(result.vacation_hours).toBe(10)
    expect(result.sick_hours).toBe(8)
  })

  it('does NOT qualify at 110 hrs (6600 min) → 0h vacation + 0h sick', () => {
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_vieja', monthYear: MAR_2026, minutesWorked: 6600 },
      false
    )
    expect(result.qualified).toBe(false)
    expect(result.vacation_hours).toBe(0)
    expect(result.sick_hours).toBe(0)
  })

  it('does NOT qualify at 114 hrs 59 min (6899 min)', () => {
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_vieja', monthYear: MAR_2026, minutesWorked: 6899 },
      false
    )
    expect(result.qualified).toBe(false)
  })
})

// ─── Ley Nueva ────────────────────────────────────────────────────────────────

describe('calculateMonthAccrual — Ley Nueva', () => {
  const QUALIFYING_MIN = 8100 // 135 hrs

  it('qualifies at exactly 130 hrs (7800 min)', () => {
    const hireDate = hireDateYearsAgo(2)
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: 7800 },
      false
    )
    expect(result.qualified).toBe(true)
  })

  it('does NOT qualify at 129 hrs 59 min (7799 min)', () => {
    const hireDate = hireDateYearsAgo(2)
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: 7799 },
      false
    )
    expect(result.qualified).toBe(false)
    expect(result.vacation_hours).toBe(0)
    expect(result.sick_hours).toBe(0)
  })

  it('0–1 yr service → 4h vacation + 8h sick', () => {
    const hireDate = hireDateYearsAgo(0.5)
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: QUALIFYING_MIN },
      false
    )
    expect(result.qualified).toBe(true)
    expect(result.vacation_hours).toBe(4)
    expect(result.sick_hours).toBe(8)
  })

  it('1–5 yrs service → 6h vacation + 8h sick', () => {
    const hireDate = hireDateYearsAgo(2)
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: QUALIFYING_MIN },
      false
    )
    expect(result.vacation_hours).toBe(6)
    expect(result.sick_hours).toBe(8)
  })

  it('5–15 yrs service → 8h vacation + 8h sick', () => {
    const hireDate = hireDateYearsAgo(7)
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: QUALIFYING_MIN },
      false
    )
    expect(result.vacation_hours).toBe(8)
    expect(result.sick_hours).toBe(8)
  })

  it('15+ yrs service → 10h vacation + 8h sick', () => {
    const hireDate = hireDateYearsAgo(16)
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: QUALIFYING_MIN },
      false
    )
    expect(result.vacation_hours).toBe(10)
    expect(result.sick_hours).toBe(8)
  })

  it('just over 1 yr service → 6h (1–5 yr bracket)', () => {
    // Hired 14 months ago — clearly in 1–5 yr bracket
    const hireDate = new Date('2025-01-01T00:00:00')
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: QUALIFYING_MIN },
      false
    )
    expect(result.vacation_hours).toBe(6)
  })

  it('just over 5 yrs service → 8h (5–15 yr bracket)', () => {
    // Hired ~5.5 years ago — clearly in 5–15 yr bracket
    const hireDate = new Date('2020-09-01T00:00:00')
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: QUALIFYING_MIN },
      false
    )
    expect(result.vacation_hours).toBe(8)
  })

  it('just over 15 yrs service → 10h (15+ yr bracket)', () => {
    // Hired ~15.5 years ago — clearly in 15+ yr bracket
    const hireDate = new Date('2010-09-01T00:00:00')
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_nueva', monthYear: MAR_2026, minutesWorked: QUALIFYING_MIN },
      false
    )
    expect(result.vacation_hours).toBe(10)
  })
})

// ─── Current month flag ───────────────────────────────────────────────────────

describe('calculateMonthAccrual — is_current_month', () => {
  it('marks current month correctly', () => {
    const hireDate = new Date('2020-01-01T00:00:00')
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_vieja', monthYear: MAR_2026, minutesWorked: 7200 },
      true
    )
    expect(result.is_current_month).toBe(true)
  })

  it('marks non-current month correctly', () => {
    const hireDate = new Date('2020-01-01T00:00:00')
    const result = calculateMonthAccrual(
      { hireDate, applicableLaw: 'ley_vieja', monthYear: MAR_2026, minutesWorked: 7200 },
      false
    )
    expect(result.is_current_month).toBe(false)
  })
})
