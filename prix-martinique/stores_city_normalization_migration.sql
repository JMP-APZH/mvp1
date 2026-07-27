-- stores_city_normalization_migration.sql
--
-- Fixes the root cause of the city-selection wizard showing duplicate/
-- split cities: 7 of the 78 stores (the original seed data, ids 1-7) have
-- `city` values combining a postal code + a shortened name
-- ("97200 Fort-de-France", "97231 Robert", "97232 Lamentin") while every
-- other store uses the clean canonical name ("Fort-de-France", "Le Robert",
-- "Le Lamentin") already used throughout the app (see MARTINIQUE_CITIES in
-- src/utils/geocoding.js). Same real city, two different strings -> never
-- deduped by getCityList()'s Set-based dedup, so stores for that city got
-- split across two separate "city" entries in the wizard.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: NOT YET APPLIED as of writing (2026-07-27).

update stores set city = 'Fort-de-France' where city = '97200 Fort-de-France';
update stores set city = 'Ducos'          where city = '97224 Ducos';
update stores set city = 'Le Robert'      where city = '97231 Robert';
update stores set city = 'Le Lamentin'    where city = '97232 Lamentin';
update stores set city = 'Schoelcher'     where city = '97233 Schoelcher';

-- Sanity check after running the updates above -- should return zero rows:
-- select id, name, city from stores where city ~ '^[0-9]{5} ';
