/**
 * Seed script: creates two TEST employees with backfilled March 2026 work sessions
 * to verify leave accrual calculations visually in the UI.
 *
 * Run:  npx ts-node --project tsconfig.json scripts/seed-leave-test.ts
 *
 * Expected results on Licencias card:
 *   TEST Ley Vieja → Calificó ✓, Vacac. 10h, Enferm. 8h  (for marzo 2026)
 *   TEST Ley Nueva → Calificó ✓, Vacac. 6h,  Enferm. 8h  (for marzo 2026)
 *
 * Clean up: deactivate both employees in the UI then delete them.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wwophautndaefkqstwtr.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// March 2026 weekdays (enough to qualify for both laws)
const VIEJA_DATES = [
  '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06',
  '2026-03-09','2026-03-10','2026-03-11','2026-03-12','2026-03-13',
  '2026-03-16','2026-03-17','2026-03-18','2026-03-19','2026-03-20',
] // 15 days × 8h = 120h → qualifies Ley Vieja (≥115h)

const NUEVA_DATES = [
  '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06',
  '2026-03-09','2026-03-10','2026-03-11','2026-03-12','2026-03-13',
  '2026-03-16','2026-03-17','2026-03-18','2026-03-19','2026-03-20',
  '2026-03-23','2026-03-24',
] // 17 days × 8h = 136h → qualifies Ley Nueva (≥130h)

async function getNextCode(): Promise<string> {
  const { data } = await supabase.from('employees').select('employee_code').order('employee_code')
  const used = new Set((data || []).map((e: { employee_code: string }) => e.employee_code))
  for (let i = 1; i <= 999; i++) {
    const code = String(i).padStart(3, '0')
    if (!used.has(code)) return code
  }
  throw new Error('No codes available')
}

async function createEmployee(params: {
  full_name: string
  hire_date: string
  applicable_law: string
  createdAt: string
}) {
  const code = await getNextCode()
  const { data, error } = await supabase
    .from('employees')
    .insert({
      employee_code: code,
      full_name: params.full_name,
      quickbooks_display_name: params.full_name,
      hire_date: params.hire_date,
      applicable_law: params.applicable_law,
      pay_type: 'regular',
      initial_vacation_hours: 0,
      initial_sick_hours: 0,
      is_active: false, // keep inactive so they don't appear in the kiosk
      created_at: params.createdAt,
    })
    .select('id, employee_code, full_name')
    .single()

  if (error) throw new Error(`Failed to create employee: ${error.message}`)
  return data
}

async function seedSessions(employeeId: string, dates: string[]) {
  for (const date of dates) {
    const clockIn = new Date(`${date}T08:00:00`)
    const clockOut = new Date(`${date}T16:00:00`)

    // Insert clock-in punch
    const { data: inPunch, error: inErr } = await supabase
      .from('punch_records')
      .insert({
        employee_id: employeeId,
        punch_type: 'CLOCK_IN',
        punched_at: clockIn.toISOString(),
        device_location: 'seed-script',
      })
      .select('id')
      .single()
    if (inErr) throw new Error(`clock-in punch: ${inErr.message}`)

    // Insert clock-out punch
    const { data: outPunch, error: outErr } = await supabase
      .from('punch_records')
      .insert({
        employee_id: employeeId,
        punch_type: 'CLOCK_OUT',
        punched_at: clockOut.toISOString(),
        device_location: 'seed-script',
      })
      .select('id')
      .single()
    if (outErr) throw new Error(`clock-out punch: ${outErr.message}`)

    // Insert work session
    const { error: sessErr } = await supabase.from('work_sessions').insert({
      employee_id: employeeId,
      clock_in_punch_id: inPunch.id,
      clock_out_punch_id: outPunch.id,
      work_date: date,
      minutes_worked: 480,
    })
    if (sessErr) throw new Error(`work session: ${sessErr.message}`)
  }
}

async function main() {
  console.log('Creating test employees...\n')

  // Employee A — Ley Vieja (hired 2010, ~16 yrs service)
  // created_at set to 2026-03-01 so accrual log starts from March 2026
  const viejaEmp = await createEmployee({
    full_name: 'TEST Ley Vieja',
    hire_date: '2010-06-01',
    applicable_law: 'ley_vieja',
    createdAt: '2026-03-01T00:00:00.000Z',
  })
  console.log(`✓ Created: ${viejaEmp.full_name} (code ${viejaEmp.employee_code}, id ${viejaEmp.id})`)

  await seedSessions(viejaEmp.id, VIEJA_DATES)
  console.log(`  → ${VIEJA_DATES.length} sessions seeded (${VIEJA_DATES.length * 8}h)`)
  console.log(`  → Expected: Calificó ✓ | Vacac. 10h | Enferm. 8h\n`)

  // Employee B — Ley Nueva (hired 2023-03, ~3 yrs service → 1–5 yr bracket)
  // created_at set to 2026-03-01 so accrual log starts from March 2026
  const nuevaEmp = await createEmployee({
    full_name: 'TEST Ley Nueva',
    hire_date: '2023-01-01',
    applicable_law: 'ley_nueva',
    createdAt: '2026-03-01T00:00:00.000Z',
  })
  console.log(`✓ Created: ${nuevaEmp.full_name} (code ${nuevaEmp.employee_code}, id ${nuevaEmp.id})`)

  await seedSessions(nuevaEmp.id, NUEVA_DATES)
  console.log(`  → ${NUEVA_DATES.length} sessions seeded (${NUEVA_DATES.length * 8}h)`)
  console.log(`  → Expected: Calificó ✓ | Vacac. 6h | Enferm. 8h\n`)

  console.log('Done. Open each employee in the UI and check the Licencias card.')
  console.log('When finished, deactivate both employees and delete them from the Inactivos list.')
}

main().catch(err => { console.error(err); process.exit(1) })
