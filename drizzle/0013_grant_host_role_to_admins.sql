-- Host Portal: give the two admin accounts the `host` role as a SECONDARY role, so they can
-- be booked onto shoots as hosts, get the booking emails, and open the Host Portal as a
-- real (not just preview) role. Their primary role stays `admin`.
--
-- Must run AFTER 0012_add_host_role_and_shoot_host.sql has been applied and committed:
-- Postgres won't let a newly added enum value be used in the same transaction that adds it.
-- Safe to re-run — it skips accounts that already have the role, and does nothing for an
-- email that has no account.

UPDATE "User"
SET "roles" = array_append(COALESCE("roles", ARRAY[]::"Role"[]), 'host'::"Role")
WHERE lower("email") IN ('sahilsagvekar230@gmail.com', 'eric@e8productions.com')
  AND NOT ('host'::"Role" = ANY(COALESCE("roles", ARRAY[]::"Role"[])));
