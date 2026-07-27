# Recipe pictures

Real photos, committed with the app (no Supabase Storage upload needed — Vite serves everything under `public/` at the site root, so a file here becomes reachable at `/recipes-pictures/<filename>` automatically). `recipes_photo_urls_migration.sql` wires each recipe's `photo_url` to the exact filenames below — apply it in the Supabase SQL Editor once new images land here.

| Filename | Recipe |
|---|---|
| `colombo_de_poulet.webp` | Colombo de poulet |
| `court-bouillon_de_poisson.webp` | Court-bouillon de poisson |
| `accras_morue.jpg` | Accras de morue |
| `feroce_d_avocat.jpg` | Féroce d'avocat |
| `matoutou_de_crabes.jpg` | Matoutou de crabe |
| `blaff_de_poisson.jpg` | Blaff de poisson |
| `ragout_de_porc.jpg` | Ragoût de porc |
| `riz_pois_rouge_poulet_grille.jpg` | Riz et pois rouges |
| `gratin_de_christophine.jpg` | Gratin de christophine |
| `fricassee_de_chatrou.jpg` | Fricassée de chatrou |

If you replace or add a photo, update the matching row in `recipes_photo_urls_migration.sql` (filename and extension both need to match exactly) and re-run it.
