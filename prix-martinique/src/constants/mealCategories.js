// Must match the CHECK constraint on community_recipe_ideas.meal_category
// (community_recipe_ideas_migration.sql). Keep in sync if that constraint changes.
export const MEAL_CATEGORIES = [
    { id: 'petit-dejeuner', label: "Petit-déj'" },
    { id: 'snack-matin', label: 'Snack du matin' },
    { id: 'dejeuner', label: 'Déjeuner' },
    { id: 'gouter', label: 'Goûter' },
    { id: 'diner', label: 'Dîner' },
];

export const mealCategoryLabel = (id) => MEAL_CATEGORIES.find(c => c.id === id)?.label || id;
