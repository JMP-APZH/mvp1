-- Migration: One-time cleanup of untrimmed user_profiles.city values
--
-- Context: the signup form (AuthModal.jsx) always uses a free-text "Ville"
-- input, even for Martinique (972) residents, and stored it verbatim. A
-- trailing space (e.g. "Fort-de-France ") makes exact-match filters (the
-- Leaderboard city dropdown, which uses clean values from a hardcoded
-- Martinique cities list) silently fail to find the user, even though they
-- appear fine under "Toute la Martinique" (no filter applied).
--
-- App-layer fix (AuthContext.jsx signUp/updateProfile now trim on write)
-- prevents new occurrences. This is the one-time backfill for existing rows.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.

update user_profiles
set city = trim(city)
where city is not null and city <> trim(city);
