-- The per-attempt overload predates question-scoped integrity handling. The
-- client now calls only (attempt, question, kind); keeping the old overload
-- exposed adds an unnecessary authenticated RPC that can create events with no
-- question context.

drop function if exists public.record_integrity_event(uuid, text);
