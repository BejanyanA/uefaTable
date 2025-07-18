import { API_BASE } from './config.js';


async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  let data = {};
  try {
    data = isJson ? await response.json() : {};
  } catch (jsonErr) {
    console.warn("❗ Failed to parse JSON", jsonErr);
  }

  // ✅ Network/server error (like 500, 404), no usable response
  if (!response.ok && typeof data !== "object") {
    throw {
      status: response.status,
      body: { message: "something_went_wrong" },
    };
  }

  // ✅ Let your code handle data.success === false
  return data;
}

export async function apiPost(endpoint, body = {}) {
  try {
    const token = localStorage.getItem("jwt")
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return await handleResponse(response);
  } catch (err) {
    throw err;
  }
}

export async function apiGet(endpoint) {
  try {
    const token = localStorage.getItem("jwt")
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers,
    });

    return await handleResponse(response);
  } catch (err) {
    throw err;
  }
}