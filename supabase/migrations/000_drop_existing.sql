-- Drop existing tables if they exist (clean slate)
drop table if exists public.work_sessions cascade;
drop table if exists public.punch_records cascade;
drop table if exists public.hr_users cascade;
drop table if exists public.pay_periods cascade;
drop table if exists public.employees cascade;
drop table if exists public.locations cascade;
drop function if exists public.is_hr_user cascade;
