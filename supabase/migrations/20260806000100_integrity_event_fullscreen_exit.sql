-- Leaving fullscreen is its own kind of event. Recording it as `context_menu`
-- would mislabel the instructor's integrity log, especially now that
-- right-clicking is blocked silently and never records anything at all.
--
-- Separate migration because a new enum value cannot be used in the same
-- transaction that adds it.
alter type public.integrity_event_kind add value if not exists 'fullscreen_exit';
