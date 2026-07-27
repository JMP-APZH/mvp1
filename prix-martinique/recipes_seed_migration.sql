-- recipes_seed_migration.sql
--
-- ~10 iconic Martinique recipes, admin-curated (phase 1 has no open
-- community submission -- see recipes_schema.sql's created_by/
-- is_community_submitted columns for the phase-2 forward-compat note).
--
-- product_id matches were checked against the LIVE products table
-- (queried via the Supabase REST API with the anon key, 2026-07-27 --
-- 22 rows total, mostly packaged/test items, see CLAUDE.md's documented
-- data-completeness gap). Only 2 honest matches were found:
--   - 'Emmental râpé' (Gratin de christophine)   -> 350G EMMENTAL RAPE
--   - 'Huile' / 'Huile de friture' (Féroce d'avocat, Accras de morue)
--                                                  -> Huile tournesol - marque distributeur
-- Every other ingredient below has NO real product in the current catalog
-- (fresh produce, meat, fish, spices aren't tracked yet) and is left
-- product_id = null with a TODO -- do not force a wrong match. Re-run the
-- matching query below periodically as more products get scanned:
--   select id, name from products where name ilike '%<keyword>%' order by name;
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run, AFTER
-- recipes_schema.sql.
-- Status: APPLIED and verified live 2026-07-27.

-- 1. Colombo de poulet
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111101', 'Colombo de poulet', 'Le plat emblématique martiniquais : poulet mijoté dans une pâte de colombo maison avec pommes de terre et christophine.', 4, 60, 'Plat principal', 'moyen', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111101', 'Poulet (morceaux)', null, 1, 'kg', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111101', 'Poudre de colombo', null, 2, 'cuillère(s) à soupe', 2, null),
  ('a1111111-1111-4111-8111-111111111101', 'Pommes de terre', null, 3, 'pièce(s)', 3, null),
  ('a1111111-1111-4111-8111-111111111101', 'Christophine', null, 1, 'pièce(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111101', 'Oignon', null, 1, 'pièce(s)', 5, null),
  ('a1111111-1111-4111-8111-111111111101', 'Ail', null, 2, 'gousse(s)', 6, null),
  ('a1111111-1111-4111-8111-111111111101', 'Citron vert', null, 1, 'pièce(s)', 7, null);

-- 2. Court-bouillon de poisson
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111102', 'Court-bouillon de poisson', 'Poisson mijoté dans un bouillon épicé aux tomates, avec ti-nain et madère.', 4, 45, 'Plat principal', 'moyen', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111102', 'Poisson (dorade ou vivaneau)', null, 1, 'kg', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111102', 'Tomates', null, 3, 'pièce(s)', 2, null),
  ('a1111111-1111-4111-8111-111111111102', 'Oignon', null, 1, 'pièce(s)', 3, null),
  ('a1111111-1111-4111-8111-111111111102', 'Piment végétarien', null, 1, 'pièce(s)', 4, 'ou piment antillais entier'),
  ('a1111111-1111-4111-8111-111111111102', 'Bois d''Inde', null, 3, 'feuille(s)', 5, null),
  ('a1111111-1111-4111-8111-111111111102', 'Citron vert', null, 1, 'pièce(s)', 6, null);

-- 3. Accras de morue
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111103', 'Accras de morue', 'Beignets de morue frits, l''incontournable de l''apéritif créole.', 6, 40, 'Entrée', 'facile', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111103', 'Morue salée', null, 400, 'g', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111103', 'Farine', null, 250, 'g', 2, 'farine de blé classique -- le seul produit "farine" du catalogue actuel est de la farine de blé noir (sarrasin), pas adaptée aux accras'),
  ('a1111111-1111-4111-8111-111111111103', 'Oeufs', null, 2, 'pièce(s)', 3, null),
  ('a1111111-1111-4111-8111-111111111103', 'Oignon', null, 1, 'pièce(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111103', 'Persil', null, 1, 'botte', 5, null),
  ('a1111111-1111-4111-8111-111111111103', 'Piment végétarien', null, 1, 'pièce(s)', 6, null),
  ('a1111111-1111-4111-8111-111111111103', 'Huile de friture', '23d49ad4-6507-4e99-85d0-1e7c99bb70d4', 1, 'L', 7, null); -- matched: Huile tournesol - marque distributeur

-- 4. Féroce d'avocat
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111104', 'Féroce d''avocat', 'Purée d''avocat, morue effilochée et farine de manioc, relevée au piment.', 4, 25, 'Entrée', 'facile', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111104', 'Avocat', null, 2, 'pièce(s)', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111104', 'Morue salée', null, 200, 'g', 2, null),
  ('a1111111-1111-4111-8111-111111111104', 'Farine de manioc', null, 150, 'g', 3, null),
  ('a1111111-1111-4111-8111-111111111104', 'Piment végétarien', null, 1, 'pièce(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111104', 'Citron vert', null, 2, 'pièce(s)', 5, null),
  ('a1111111-1111-4111-8111-111111111104', 'Huile', '23d49ad4-6507-4e99-85d0-1e7c99bb70d4', 3, 'cuillère(s) à soupe', 6, null); -- matched: Huile tournesol - marque distributeur

-- 5. Matoutou de crabe
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111105', 'Matoutou de crabe', 'Crabes mijotés dans une sauce épicée au riz, plat de Pâques traditionnel.', 4, 90, 'Plat principal', 'difficile', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111105', 'Crabes de terre', null, 6, 'pièce(s)', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111105', 'Riz', null, 400, 'g', 2, null),
  ('a1111111-1111-4111-8111-111111111105', 'Tomates', null, 3, 'pièce(s)', 3, null),
  ('a1111111-1111-4111-8111-111111111105', 'Oignon', null, 2, 'pièce(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111105', 'Bois d''Inde', null, 4, 'feuille(s)', 5, null),
  ('a1111111-1111-4111-8111-111111111105', 'Piment végétarien', null, 1, 'pièce(s)', 6, null);

-- 6. Blaff de poisson
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111106', 'Blaff de poisson', 'Poisson poché dans un bouillon parfumé au citron, piment et bois d''Inde.', 4, 35, 'Plat principal', 'facile', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111106', 'Poisson (vivaneau ou thazard)', null, 1, 'kg', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111106', 'Citron vert', null, 2, 'pièce(s)', 2, null),
  ('a1111111-1111-4111-8111-111111111106', 'Oignon', null, 1, 'pièce(s)', 3, null),
  ('a1111111-1111-4111-8111-111111111106', 'Ail', null, 3, 'gousse(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111106', 'Bois d''Inde', null, 3, 'feuille(s)', 5, null),
  ('a1111111-1111-4111-8111-111111111106', 'Piment végétarien', null, 1, 'pièce(s)', 6, null);

-- 7. Ragoût de porc
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111107', 'Ragoût de porc', 'Porc mijoté longuement avec légumes racines dans une sauce colorée au roucou.', 4, 90, 'Plat principal', 'moyen', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111107', 'Porc (épaule, cubes)', null, 1, 'kg', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111107', 'Carottes', null, 3, 'pièce(s)', 2, null),
  ('a1111111-1111-4111-8111-111111111107', 'Igname', null, 500, 'g', 3, null),
  ('a1111111-1111-4111-8111-111111111107', 'Oignon', null, 1, 'pièce(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111107', 'Ail', null, 3, 'gousse(s)', 5, null),
  ('a1111111-1111-4111-8111-111111111107', 'Bois d''Inde', null, 3, 'feuille(s)', 6, null);

-- 8. Riz et pois rouges
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111108', 'Riz et pois rouges', 'L''accompagnement du quotidien créole, riz et haricots rouges mijotés ensemble.', 4, 50, 'Accompagnement', 'facile', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111108', 'Riz', null, 400, 'g', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111108', 'Haricots rouges secs', null, 250, 'g', 2, null),
  ('a1111111-1111-4111-8111-111111111108', 'Oignon', null, 1, 'pièce(s)', 3, null),
  ('a1111111-1111-4111-8111-111111111108', 'Ail', null, 2, 'gousse(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111108', 'Bois d''Inde', null, 2, 'feuille(s)', 5, null);

-- 9. Gratin de christophine
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111109', 'Gratin de christophine', 'Christophine fondante gratinée au fromage, un classique en accompagnement.', 4, 50, 'Accompagnement', 'facile', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111109', 'Christophine', null, 3, 'pièce(s)', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111109', 'Emmental râpé', '116caf22-0ccb-4cd7-89c2-96a3e37a389c', 350, 'g', 2, null), -- matched: 350G EMMENTAL RAPE
  ('a1111111-1111-4111-8111-111111111109', 'Crème fraîche', null, 200, 'mL', 3, null),
  ('a1111111-1111-4111-8111-111111111109', 'Oignon', null, 1, 'pièce(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111109', 'Chapelure', null, 50, 'g', 5, null);

-- 10. Fricassée de chatrou (poulpe)
insert into recipes (id, name, description, servings, prep_time_minutes, category, difficulty, is_active) values
  ('a1111111-1111-4111-8111-111111111110', 'Fricassée de chatrou', 'Poulpe mijoté dans une sauce tomate épicée, servi avec du riz.', 4, 75, 'Plat principal', 'moyen', true);
insert into recipe_ingredients (recipe_id, ingredient_name, product_id, quantity, unit, display_order, notes) values
  ('a1111111-1111-4111-8111-111111111110', 'Poulpe (chatrou)', null, 1, 'kg', 1, null), -- TODO: no matching product yet
  ('a1111111-1111-4111-8111-111111111110', 'Tomates', null, 3, 'pièce(s)', 2, null),
  ('a1111111-1111-4111-8111-111111111110', 'Oignon', null, 1, 'pièce(s)', 3, null),
  ('a1111111-1111-4111-8111-111111111110', 'Ail', null, 3, 'gousse(s)', 4, null),
  ('a1111111-1111-4111-8111-111111111110', 'Piment végétarien', null, 1, 'pièce(s)', 5, null),
  ('a1111111-1111-4111-8111-111111111110', 'Riz', null, 300, 'g', 6, null);
