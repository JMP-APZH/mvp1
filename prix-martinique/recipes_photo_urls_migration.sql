-- recipes_photo_urls_migration.sql
--
-- Sets photo_url for the 10 seeded recipes to local static assets served
-- from public/recipes-pictures/ (Vite serves everything under public/ at
-- the site root, so a file at public/recipes-pictures/colombo-de-poulet.jpg
-- is reachable at /recipes-pictures/colombo-de-poulet.jpg in both dev and
-- the deployed Vercel build -- no upload step, no external hotlinking).
--
-- Drop your own images into prix-martinique/public/recipes-pictures/ using
-- EXACTLY the filenames below (jpg extension, kebab-case, no accents/
-- apostrophes) before running this. If you used a different format
-- (.png/.webp/etc.) for a given recipe, change that row's extension to
-- match your actual file before running.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run, AFTER the
-- image files have been added to the repo and deployed.
-- Status: NOT YET APPLIED as of writing (2026-07-27).

update recipes set photo_url = '/recipes-pictures/colombo-de-poulet.jpg'          where id = 'a1111111-1111-4111-8111-111111111101'; -- Colombo de poulet
update recipes set photo_url = '/recipes-pictures/court-bouillon-de-poisson.jpg'  where id = 'a1111111-1111-4111-8111-111111111102'; -- Court-bouillon de poisson
update recipes set photo_url = '/recipes-pictures/accras-de-morue.jpg'           where id = 'a1111111-1111-4111-8111-111111111103'; -- Accras de morue
update recipes set photo_url = '/recipes-pictures/feroce-avocat.jpg'             where id = 'a1111111-1111-4111-8111-111111111104'; -- Féroce d'avocat
update recipes set photo_url = '/recipes-pictures/matoutou-de-crabe.jpg'         where id = 'a1111111-1111-4111-8111-111111111105'; -- Matoutou de crabe
update recipes set photo_url = '/recipes-pictures/blaff-de-poisson.jpg'          where id = 'a1111111-1111-4111-8111-111111111106'; -- Blaff de poisson
update recipes set photo_url = '/recipes-pictures/ragout-de-porc.jpg'            where id = 'a1111111-1111-4111-8111-111111111107'; -- Ragoût de porc
update recipes set photo_url = '/recipes-pictures/riz-et-pois-rouges.jpg'        where id = 'a1111111-1111-4111-8111-111111111108'; -- Riz et pois rouges
update recipes set photo_url = '/recipes-pictures/gratin-de-christophine.jpg'    where id = 'a1111111-1111-4111-8111-111111111109'; -- Gratin de christophine
update recipes set photo_url = '/recipes-pictures/fricassee-de-chatrou.jpg'      where id = 'a1111111-1111-4111-8111-111111111110'; -- Fricassée de chatrou
