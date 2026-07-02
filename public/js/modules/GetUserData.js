import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiGet, apiPost } from '../services/api.js';

export const getUserData = {
    initGetUserPersonalDetailes: async function () {
        const token = localStorage.getItem("authToken");

        if (!token) {
            // No token, cannot fetch data
            if (typeof showToast !== 'undefined') {
                 showToast("Authentication required to view profile.", "error");
            }
            // Clear loading text if no token
            // A safer method is to call the callback with an empty payload or handle it in the UI
            window.__setPersonalDetails({}); 
            return;
        }

        try {
            // Assuming apiGet is available globally or passed in
            const response = await apiGet("/user-details");
            
            if (response.success && response.data) {
                // 🚀 SUCCESS: Call the global callback defined in ProfileManager.js
                window.__setPersonalDetails(response);
            } else {
                // Failed API call
                if (typeof showToast !== 'undefined') {
                    showToast(response.message || "Failed to load personal details.", "error");
                }
                // Still call the callback to clear the loading state
                window.__setPersonalDetails({}); 
            }
        } catch (error) {
            console.error("Error fetching personal details:", error);
            if (typeof showToast !== 'undefined') {
                showToast("Network error while loading details.", "error");
            }
            // Still call the callback to clear the loading state
            window.__setPersonalDetails({}); 
        }
    }
};