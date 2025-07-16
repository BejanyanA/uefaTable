import { API_BASE } from './config.js';


async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  const data = isJson ? await response.json() : {};

  if (!response.ok) {
    const error = {
      status: response.status,
      statusText: response.statusText,
      body: data,
    };
    throw error;
  }

  return data;
}

export async function apiPost(endpoint, body = {}, token = null) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return await handleResponse(response);
  } catch (err) {
    console.error(`[apiPost] ${endpoint} failed:`, err);
    throw err;
  }
}

export async function apiGet(endpoint, token = null) {
  try {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers,
    });

    return await handleResponse(response);
  } catch (err) {
    console.error(`[apiGet] ${endpoint} failed:`, err);
    throw err;
  }
}