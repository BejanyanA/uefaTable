// routes/get_countries.js

import { jsonResponse } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleGetAllWorldCountries(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const allCountries = await env.core_data.prepare(`
    SELECT * FROM all_countries
`).bind().all();

    if (allCountries.results.length === 0) {
        return jsonResponse({ success: false, message: "no_countries_found" }, 404);
    }

    return jsonResponse({
        success: true,
        data: {
            countries: allCountries.results
        }
    }, 200);
}

// Search Countries
export async function handleSearchWorldCountries(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const { search } = await request.json();

    if (!search || typeof search !== 'string' || search.trim().length === 0) {
        return jsonResponse({ success: false, message: "Invalid search input" }, 400);
    }

    const searchResult = await env.core_data.prepare(`
  SELECT id, country_name
  FROM all_countries
  WHERE LOWER(country_name) LIKE '%' || LOWER(?) || '%'
`).bind(search).all();

    if (searchResult.results.length === 0) {
        return jsonResponse({ success: false, message: "no_countries_found" }, 404);
    }

    return jsonResponse({
        success: true,
        data: {
            countries: searchResult.results
                .sort((a, b) => b.country_name - a.country_name)
                .map(({ id, country_name }) => ({
                    id,
                    country_name
                }))
        }
    }, 200);
}


export async function handleGetAllEuropeCountries(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const allCountries = await env.core_data.prepare(`
    SELECT * FROM all_countries
    WHERE is_europe = TRUE
    `).bind().all();

    if (allCountries.results.length === 0) {
        return jsonResponse({ success: false, message: "no_countries_found" }, 404);
    }

    return jsonResponse({
        success: true,
        data: {
            countries: allCountries.results
        }
    }, 200);
}

// Search Countries
export async function handleSearchEuropeCountries(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const { search } = await request.json();

    if (!search || typeof search !== 'string' || search.trim().length === 0) {
        return jsonResponse({ success: false, message: "Invalid search input" }, 400);
    }

    const searchResult = await env.core_data.prepare(`
    SELECT id, country_name
    FROM all_countries
    WHERE is_europe = TRUE AND LOWER(country_name) LIKE '%' || LOWER(?) || '%'
    `).bind(search).all();

    if (searchResult.results.length === 0) {
        return jsonResponse({ success: false, message: "no_countries_found" }, 404);
    }

    return jsonResponse({
        success: true,
        data: {
            countries: searchResult.results
                .sort((a, b) => b.country_name - a.country_name)
                .map(({ id, country_name }) => ({
                    id,
                    country_name
                }))
        }
    }, 200);
}