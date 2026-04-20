-- D'mart Institute Time Clock - Schema v1.0

create extension if not exists "btree_gist";

-- LOCATIONS
create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kiosk_code text unique not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- EMPLOYEES
create table if not exists public.employees (
  id                      uuid primary key default gen_random_uuid(),
  employee_code           text unique not null,
  full_name               text not null,
  quickbooks_display_name text,
  department              text,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- PAY PERIODS
create table if not exists public.pay_periods (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  period_type  text not null check (period_type in ('biweekly', 'semi_monthly')),
  start_date   date not null,
  end_date     date not null,
  is_current   boolean not null default false,
  is_closed    boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint pay_periods_no_overlap exclude using gist (
    daterange(start_date, end_date, '[]') with &&
  )
);

create unique index if not exists idx_pay_periods_current
  on public.pay_periods (is_current)
  where (is_current = true);

-- PUNCH RECORDS
create table if not exists public.punch_records (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete restrict,
  location_id     uuid references public.locations(id),
  punch_type      text not null check (punch_type in ('CLOCK_IN', 'CLOCK_OUT')),
  punched_at      timestamptz not null default now(),
  photo_path      text,
  device_location text,
  created_at      timestamptz not null default now()
);

-- WORK SESSIONS (paired IN+OUT)
create table if not exists public.work_sessions (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees(id) on delete restrict,
  pay_period_id       uuid references public.pay_periods(id),
  clock_in_punch_id   uuid not null references public.punch_records(id),
  clock_out_punch_id  uuid references public.punch_records(id),
  work_date           date not null,
  minutes_worked      integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- HR USERS
create table if not exists public.hr_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  full_name  text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- HELPER FUNCTION
create or replace function public.is_hr_user()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.hr_users
    where user_id = auth.uid() and is_active = true
  );
$$;

-- ROW LEVEL SECURITY
alter table public.locations     enable row level security;
alter table public.employees     enable row level security;
alter table public.pay_periods   enable row level security;
alter table public.punch_records enable row level security;
alter table public.work_sessions enable row level security;
alter table public.hr_users      enable row level security;

create policy "locations_read"  on public.locations for select using (true);
create policy "locations_hr_rw" on public.locations for all    using (public.is_hr_user());

create policy "employees_hr_all"     on public.employees     for all using (public.is_hr_user());
create policy "pay_periods_hr_all"   on public.pay_periods   for all using (public.is_hr_user());
create policy "punch_records_hr_all" on public.punch_records for all using (public.is_hr_user());
create policy "work_sessions_hr_all" on public.work_sessions for all using (public.is_hr_user());
create policy "hr_users_hr_all"      on public.hr_users      for all using (public.is_hr_user());

-- INDEXES
create index if not exists idx_punch_records_employee   on public.punch_records(employee_id);
create index if not exists idx_punch_records_punched_at on public.punch_records(punched_at);
create index if not exists idx_punch_records_emp_date   on public.punch_records(employee_id, punched_at);
create index if not exists idx_employees_code           on public.employees(employee_code);
create index if not exists idx_work_sessions_employee   on public.work_sessions(employee_id);
create index if not exists idx_work_sessions_period     on public.work_sessions(pay_period_id);
create index if not exists idx_work_sessions_date       on public.work_sessions(work_date);
create index if not exists idx_pay_periods_dates        on public.pay_periods(start_date, end_date);

-- SEED: 3 locations
insert into public.locations (name, kiosk_code) values
  ('Vega Alta',             'vega-alta'),
  ('Barranquitas',          'barranquitas'),
  ('Oficinas Corporativas', 'oficinas-corporativas')
on conflict (kiosk_code) do nothing;
