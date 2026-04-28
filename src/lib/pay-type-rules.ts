export type PayType = 'regular' | 'exempt' | 'professor_exempt' | 'professor_regular'

// Minutes credited per unique work date for payroll (null = actual minutes)
export const DAILY_CREDITED_MINUTES: Record<PayType, number | null> = {
  regular: null,
  exempt: 480,           // 8h
  professor_exempt: 660, // 11h
  professor_regular: null,
}

// Daily actual-hours threshold below which a leave deduction is triggered (null = no deduction)
export const DEDUCTION_THRESHOLD_MINUTES: Record<PayType, number | null> = {
  regular: null,
  exempt: 390,           // 6.5h
  professor_exempt: 660, // 11h
  professor_regular: null,
}

// Max actual minutes per day before overtime warning (null = no limit)
export const DAILY_MAX_MINUTES: Record<PayType, number | null> = {
  regular: null,
  exempt: null,
  professor_exempt: 660, // 11h
  professor_regular: 330, // 5.5h
}

// Max actual minutes per week before overtime warning (null = no limit)
export const WEEKLY_MAX_MINUTES: Record<PayType, number | null> = {
  regular: null,
  exempt: null,
  professor_exempt: 2640, // 44h
  professor_regular: 1320, // 22h
}

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  regular: 'Regular',
  exempt: 'Exento',
  professor_exempt: 'Profesor Exento',
  professor_regular: 'Profesor Regular',
}

export const PAY_TYPE_LABELS_EN: Record<PayType, string> = {
  regular: 'Regular',
  exempt: 'Exempt',
  professor_exempt: 'Professor Exempt',
  professor_regular: 'Professor Regular',
}

/**
 * Minutes from clock-in until the session should be auto-closed.
 * For professor_exempt: clock-in before noon = T1 (ends 13:40), else T2 (ends 22:10).
 */
export function autoCloseAfterMinutes(payType: PayType, clockInAt: Date): number {
  if (payType === 'professor_exempt') {
    const hour = clockInAt.getHours()
    const end = new Date(clockInAt)
    if (hour < 12) {
      end.setHours(13, 40, 0, 0) // T1 ends at 13:40
    } else {
      end.setHours(22, 10, 0, 0) // T2 ends at 22:10
    }
    return Math.max(1, Math.round((end.getTime() - clockInAt.getTime()) / 60000))
  }
  if (payType === 'professor_regular') return 330  // 5.5h
  return 480  // regular + exempt: 8h
}

/**
 * Credited minutes for a day given the pay type and number of unique work dates.
 * For types with a fixed daily credit, returns dates × credit.
 * For hourly types (regular, professor_regular), returns actual minutes.
 */
export function creditedMinutes(
  payType: PayType,
  uniqueDateCount: number,
  actualMinutes: number
): number {
  const credit = DAILY_CREDITED_MINUTES[payType]
  return credit !== null ? uniqueDateCount * credit : actualMinutes
}
