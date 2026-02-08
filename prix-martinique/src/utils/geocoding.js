/**
 * GPS Geolocation utilities for Martinique
 * Converts GPS coordinates to city names
 */

// Martinique cities with approximate coordinates and radius
const MARTINIQUE_CITIES = [
    // Major cities (most stores)
    { name: "Fort-de-France", lat: 14.6099, lon: -61.0792, radius: 5 },
    { name: "Le Lamentin", lat: 14.6100, lon: -60.9967, radius: 5 },
    { name: "Schoelcher", lat: 14.6156, lon: -61.1044, radius: 4 },
    { name: "Ducos", lat: 14.5733, lon: -60.9833, radius: 4 },
    { name: "Le Robert", lat: 14.6767, lon: -60.9333, radius: 4 },

    // South
    { name: "Le Marin", lat: 14.4667, lon: -60.8667, radius: 3 },
    { name: "Sainte-Anne", lat: 14.4333, lon: -60.8833, radius: 3 },
    { name: "Le Vauclin", lat: 14.5500, lon: -60.8333, radius: 3 },
    { name: "Rivière-Pilote", lat: 14.4833, lon: -60.9000, radius: 3 },
    { name: "Sainte-Luce", lat: 14.4667, lon: -60.9333, radius: 3 },
    { name: "Le Diamant", lat: 14.4833, lon: -61.0167, radius: 3 },
    { name: "Les Trois-Îlets", lat: 14.5333, lon: -61.0333, radius: 3 },
    { name: "Rivière-Salée", lat: 14.5333, lon: -60.9667, radius: 3 },

    // Center-North
    { name: "Le François", lat: 14.6167, lon: -60.9000, radius: 3 },
    { name: "La Trinité", lat: 14.7333, lon: -60.9667, radius: 3 },
    { name: "Gros-Morne", lat: 14.8667, lon: -61.0667, radius: 3 },
    { name: "Sainte-Marie", lat: 14.7833, lon: -60.9833, radius: 3 },

    // North
    { name: "Le Lorrain", lat: 14.8333, lon: -61.0500, radius: 3 },
    { name: "Basse-Pointe", lat: 14.8667, lon: -61.1167, radius: 3 },
    { name: "Marigot", lat: 14.7500, lon: -61.0333, radius: 3 },

    // West
    { name: "Saint-Pierre", lat: 14.7433, lon: -61.1783, radius: 3 },
    { name: "Le Carbet", lat: 14.7000, lon: -61.1667, radius: 3 },
    { name: "Case-Pilote", lat: 14.6333, lon: -61.1333, radius: 3 },
    { name: "Morne-Rouge", lat: 14.7667, lon: -61.1167, radius: 3 },

    // Other
    { name: "Saint-Joseph", lat: 14.6667, lon: -61.0333, radius: 3 },
    { name: "Saint-Esprit", lat: 14.5500, lon: -60.9167, radius: 3 },
    { name: "Tartane", lat: 14.7667, lon: -60.9167, radius: 2 },
    { name: "Morne-des-Esses", lat: 14.8000, lon: -61.0167, radius: 2 },
];

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Get city name from GPS coordinates
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {string|null} City name or null if not in Martinique
 */
export async function getCityFromCoordinates(latitude, longitude) {
    try {
        let nearestCity = null;
        let minDistance = Infinity;

        for (const city of MARTINIQUE_CITIES) {
            const distance = calculateDistance(latitude, longitude, city.lat, city.lon);

            if (distance <= city.radius && distance < minDistance) {
                minDistance = distance;
                nearestCity = city.name;
            }
        }

        return nearestCity;
    } catch (error) {
        console.error('Error detecting city:', error);
        return null;
    }
}

/**
 * Request GPS permission and get current location
 * @returns {Promise<{city: string|null, latitude: number, longitude: number, accuracy: number}|null>}
 */
export async function detectUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const city = await getCityFromCoordinates(latitude, longitude);

                resolve({ city, latitude, longitude, accuracy });
            },
            (error) => {
                console.log('GPS error:', error.message);
                resolve(null);
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes cache
            }
        );
    });
}

/**
 * Get list of unique cities from stores database
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<string[]>} Array of city names
 */
export async function getCityList(supabase) {
    try {
        const { data, error } = await supabase
            .from('stores')
            .select('city')
            .eq('is_active', true)
            .order('city');

        if (error) throw error;

        const uniqueCities = [...new Set(data.map(s => s.city))];
        return uniqueCities.sort((a, b) => a.localeCompare(b, 'fr'));
    } catch (error) {
        console.error('Error loading cities:', error);
        return [];
    }
}

/**
 * Sort stores by distance from coordinates
 * @param {Array} stores - List of stores from database
 * @param {number} latitude - User latitude
 * @param {number} longitude - User longitude
 * @returns {Array} Stores with distance field, sorted
 */
export function getStoresSortedByDistance(stores, latitude, longitude) {
    if (!latitude || !longitude || !stores.length) return stores;

    return stores
        .map(store => ({
            ...store,
            distance: calculateDistance(
                latitude,
                longitude,
                parseFloat(store.latitude),
                parseFloat(store.longitude)
            )
        }))
        .sort((a, b) => a.distance - b.distance);
}

export default {
    detectUserLocation,
    getCityFromCoordinates,
    getCityList,
    getStoresSortedByDistance,
    calculateDistance
};
