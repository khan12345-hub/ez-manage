-- Remove HR / leave system (tables were created outside migrations via db push).
DROP TABLE IF EXISTS "leave_requests" CASCADE;
DROP TABLE IF EXISTS "leave_balances" CASCADE;
DROP TABLE IF EXISTS "leave_policies" CASCADE;
DROP TABLE IF EXISTS "holidays" CASCADE;
DROP TABLE IF EXISTS "hr_employees" CASCADE;

DROP TYPE IF EXISTS "LeaveType";
DROP TYPE IF EXISTS "LeaveStatus";
DROP TYPE IF EXISTS "HalfDayPeriod";
DROP TYPE IF EXISTS "HolidayType";
DROP TYPE IF EXISTS "EmploymentType";
