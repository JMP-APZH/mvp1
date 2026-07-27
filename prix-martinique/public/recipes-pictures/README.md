# Recipe pictures

Drop recipe photos in this folder using **exactly** these filenames (jpg, kebab-case, no accents/apostrophes). Vite serves everything under `public/` at the site root, so a file here becomes reachable at `/recipes-pictures/<filename>` automatically — no code changes needed, just add the file, commit, and run `recipes_photo_urls_migration.sql` in Supabase once (see that file's header comment).

| Filename | Recipe |
|---|---|
| `colombo-de-poulet.jpg` | Colombo de poulet |
| `court-bouillon-de-poisson.jpg` | Court-bouillon de poisson |
| `accras-de-morue.jpg` | Accras de morue |
| `feroce-avocat.jpg` | Féroce d'avocat |
| `matoutou-de-crabe.jpg` | Matoutou de crabe |
| `blaff-de-poisson.jpg` | Blaff de poisson |
| `ragout-de-porc.jpg` | Ragoût de porc |
| `riz-et-pois-rouges.jpg` | Riz et pois rouges |
| `gratin-de-christophine.jpg` | Gratin de christophine |
| `fricassee-de-chatrou.jpg` | Fricassée de chatrou |

If a file uses a different format (`.png`, `.webp`, etc.), update that row's extension in `recipes_photo_urls_migration.sql` to match before running it.
