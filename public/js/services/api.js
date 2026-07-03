import { API_BASE } from './config.js';
import { showLoader, hideLoader } from '../utils/helper.js';
import { logout } from '../modules/MeHomepage.js'
import { setHomeOptionsVisible, setCustomCompetitionVisible } from "../modules/HomeOptions.js";
import { STORAGE_KEYS, clearAuthSession } from '../utils/storageKeys.js';
import { navigateTo } from '../modules/router.js';


async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  let data = {};
  try {
    data = isJson ? await response.json() : {};
  } catch (jsonErr) {
    console.warn("❗ Failed to parse JSON", jsonErr);
  }

  // 🔴 Handle unauthorized
  if (response.status === 401) {
    navigateTo("home");
    logout();
    setHomeOptionsVisible(true);
    setCustomCompetitionVisible(false);

    clearAuthSession();
    return { success: false, status: 401, message: "unauthorized" };
  }
  return data;
}

export async function apiPost(endpoint, body = {}, options = {}) {
  const { showLoading = true } = options;

  if (showLoading) showLoader();

  try {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return await handleResponse(response);
  } catch (err) {
    console.error(`❌ POST ${endpoint} failed:`, err);
    throw err;
  } finally {
    if (showLoading) hideLoader();
  }
}


export async function apiGet(endpoint, options = {}) {
  const { showLoading = true } = options;

  if (showLoading) showLoader();

  try {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers,
    });

    return await handleResponse(response);
  } catch (err) {
    console.error(`❌ GET ${endpoint} failed:`, err);
    throw err;
  } finally {
    if (showLoading) hideLoader();
  }
}