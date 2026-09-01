-- QA cleanup: live write-path test of the new "Idées de la communauté"
-- submission flow (Aug 7, 2026), run against production as JMP2_972 to
-- verify RecipesHubModal.jsx's submit/like/favorite actions actually persist.
--
-- Created and immediately liked/favorited (both since reverted via the app UI,
-- confirmed 0 rows left in community_recipe_idea_likes for this idea) one real
-- row: "TEST QA Jus de fruits de la passion" in community_recipe_ideas.
-- community_recipe_ideas has no delete policy (append-only, same convention as
-- product_comments), so this can only be removed via the SQL Editor.
--
-- Apply via Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Status: APPLIED 2026-09-01 (Jean-Marie, Supabase SQL Editor).

delete from community_recipe_idea_favorites
  where idea_id in (select id from community_recipe_ideas where title ilike 'TEST QA Jus de fruits%');

delete from community_recipe_idea_likes
  where idea_id in (select id from community_recipe_ideas where title ilike 'TEST QA Jus de fruits%');

delete from community_recipe_ideas
  where title ilike 'TEST QA Jus de fruits%';
