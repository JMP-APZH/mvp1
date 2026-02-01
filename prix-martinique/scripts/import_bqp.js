import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve('.env.local') });
dotenv.config(); // fallback to .env if needed

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env or .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importBQPData() {
    const filePath = path.resolve('bqp_data.json');
    console.log(`Reading data from: ${filePath}`);

    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const bqpData = JSON.parse(rawData);

        // Arrays to hold all categories
        let allCategories = [];

        // Helper to process a list type
        const processList = (listKey, listType) => {
            const list = bqpData.lists[listKey];
            if (!list || !list.categories) return;

            console.log(`Processing ${listType} (${list.categories.length} items)...`);

            list.categories.forEach(item => {
                allCategories.push({
                    code: item.id,
                    section: item.section,
                    label: item.label,
                    unit_standard: item.unit,
                    is_local: item.local,
                    list_type: listType
                });
            });
        };

        // Process each list type
        processList('hypermarket_134', 'hypermarket');
        processList('supermarket_72', 'supermarket');
        processList('superette_35', 'superette');

        console.log(`Total categories found: ${allCategories.length}`);

        if (allCategories.length === 0) {
            console.log('No data to import.');
            return;
        }

        // Insert into Supabase
        const { data, error } = await supabase
            .from('bqp_categories')
            .upsert(allCategories, { onConflict: 'code' })
            .select();

        if (error) {
            console.error('Error importing data:', error);
        } else {
            console.log(`Successfully upserted ${data.length} records.`);
        }

    } catch (err) {
        console.error('Import failed:', err);
    }
}

importBQPData();
