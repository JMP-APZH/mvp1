# Outcome of the App Review - Feb 8th, 2026

## 1 - Section “Scanner”
*   **Manual product input**: Include a question to ask the user if the current product is marked BQP (currently only appears when scanning).
*   **New Data Input Flow**:
    1.  **Shop Location**: First, try geolocation. If manual, ask for City -> Shop (dropdown with filtered search).
    2.  **Product Logic**:
        *   If product is new: Standard input of details.
        *   If product exists: Ask if the price is still valid.
        *   Options: Confirm current price OR input new price + photo of price tag.
*   **Button Rename**: Change "Ajouter une photo de l'étiquette" to "Ajouter une photo de l'étiquette (incluant le code barres et son numéro lisible)".

## 2 - Comparer
*   **Image UX**: Fix image size/scrolling bug where touching the image area moves it instead of scrolling the list.
*   **Pagination**: Implement pagination and allow users to choose items per page.
*   **Navigation**: Add an icon menu (similar to BQP categories) for "Par produits" / "Par magasins".
*   **Rankings (Brainstorming)**:
    *   Products: Most scanned, most purchased, price ranking by shops.
    *   Shops: Products scanned by category, top cheap (rank 1/2), BQP volume, local product volume.
    *   Future: Imported vs Local "competition" comparison.

## 3 - Communauté
*   **Spacing**: Fix margin/padding on mobile (avoid closeness to nav bar).
*   **UI Controls**: Switch menu to immediate button choices instead of just tabs.
*   **Leaderboards**:
    *   Top price hunter by city.
    *   Top products by category and city.
*   **Sociological Data (Future)**: User profile integration (age range, city of residence) for hyper-local stats.
*   **Renaming**: “Voter (Features)” -> “Améliorations et ajouts”.
*   **Bug Fix**: Fix "Proposer" form close icon (weird circle).
*   **Sovereignty Score**: Define calculation criteria (Brainstorm required).

## 4 - Mon panier
*   **Categorization**: Show product categories in decreasing order by item count.
*   **Item Details**: Show price evolution chart by shop (focus on user's favorite shops).

## 5 - BQP
*   **Messaging**:
    *   Add: “Ici on challenge la pertinence du BQP pour la population” after title.
    *   Replace description with: “Données initiales provenant du dernier accord BQP en vigueur. De vos ajouts dépend la force de notre évaluation et son impact”.
    *   Keep: “Recherchez un produit pour voir sa catégorie” on a separate line.
*   **Categorization**: Sort by decreasing item count.
*   **Interaction**: Allow voting and commenting on item categories.

## 6 - Info
*   **Sync**: Update based on brainstorming and UI changes from other sections.

## 7 - User Profile
*   **“Mes économies” Logic**: Suggestion: Calculation based on favorite basket (initial price vs current average/best price).
*   **Renaming**: "Série (jours)" -> "Mes contributions à l'effort collectif".
*   **“Perso stats” Section**: First scans, updates/confirmations, badges, clear criteria for progression.
*   **New Profile Inputs**:
    *   City of residence.
    *   Top 3 shops (selectable from database).
    *   Monthly grocery budget range (Min/Max) to compare with basket.
*   **Detailed Profile Page**:
    *   Best offers by shop (related to favorites).
    *   General best offers filtered by category, price, or shop comparison.

## 9 - Admin Dashboard
*   **Brainstorming**: Define KPIs for administrators to monitor app health and data trends.
