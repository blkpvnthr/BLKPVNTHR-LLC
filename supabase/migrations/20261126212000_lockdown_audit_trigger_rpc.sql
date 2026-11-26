-- Exposing the `administration` schema to the Data API also exposed the audit
-- TRIGGER function as a REST RPC. Trigger functions fire regardless of EXECUTE
-- grants, so revoking EXECUTE removes the RPC surface without affecting auditing.
revoke execute on function administration.tg_write_audit() from public, anon, authenticated;
