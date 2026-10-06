// Who uses the time clock: everyone except admins — plus the owner account,
// which is an admin but still wants the Start/Stop timer.
const TIME_CLOCK_ADMIN_EXEMPT_EMAILS = ["sahilsagvekar230@gmail.com"];

export function usesTimeClock(user?: { role?: string | null; email?: string | null } | null): boolean {
  if (!user) return false;
  if (user.role?.toLowerCase() !== "admin") return true;
  const email = user.email?.trim().toLowerCase();
  return !!email && TIME_CLOCK_ADMIN_EXEMPT_EMAILS.includes(email);
}
