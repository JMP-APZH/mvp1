-- recipes_photo_urls_migration.sql
--
-- Sets photo_url for the 10 seeded recipes to local static assets served
-- from public/recipes-pictures/ (Vite serves everything under public/ at
-- the site root, so a file at public/recipes-pictures/<file> is reachable
-- at /recipes-pictures/<file> in both dev and the deployed Vercel build --
-- no upload step, no external hotlinking).
--
-- Filenames below match what Jean-Marie actually placed in
-- public/recipes-pictures/ on 2026-07-27 (see that folder's README.md) --
-- underscores rather than hyphens, and colombo_de_poulet /
-- court-bouillon_de_poisson are .webp, everything else is .jpg.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: NOT YET APPLIED as of writing (2026-07-27).

update recipes set photo_url = '/recipes-pictures/colombo_de_poulet.webp'              where id = 'a1111111-1111-4111-8111-111111111101'; -- Colombo de poulet
update recipes set photo_url = '/recipes-pictures/court-bouillon_de_poisson.webp'      where id = 'a1111111-1111-4111-8111-111111111102'; -- Court-bouillon de poisson
update recipes set photo_url = '/recipes-pictures/accras_morue.jpg'                    where id = 'a1111111-1111-4111-8111-111111111103'; -- Accras de morue
update recipes set photo_url = '/recipes-pictures/feroce_d_avocat.jpg'                 where id = 'a1111111-1111-4111-8111-111111111104'; -- Féroce d'avocat
update recipes set photo_url = '/recipes-pictures/matoutou_de_crabes.jpg'              where id = 'a1111111-1111-4111-8111-111111111105'; -- Matoutou de crabe
update recipes set photo_url = '/recipes-pictures/blaff_de_poisson.jpg'                where id = 'a1111111-1111-4111-8111-111111111106'; -- Blaff de poisson
update recipes set photo_url = '/recipes-pictures/ragout_de_porc.jpg'                  where id = 'a1111111-1111-4111-8111-111111111107'; -- Ragoût de porc
update recipes set photo_url = '/recipes-pictures/riz_pois_rouge_poulet_grille.jpg'    where id = 'a1111111-1111-4111-8111-111111111108'; -- Riz et pois rouges
update recipes set photo_url = '/recipes-pictures/gratin_de_christophine.jpg'          where id = 'a1111111-1111-4111-8111-111111111109'; -- Gratin de christophine
update recipes set photo_url = '/recipes-pictures/fricassee_de_chatrou.jpg'            where id = 'a1111111-1111-4111-8111-111111111110'; -- Fricassée de chatrou
