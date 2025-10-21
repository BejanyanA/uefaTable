import { langMap, currentLang } from './LanguageManager.js';
import { getUserData } from './GetUserData.js';
import { apiGet, apiPost } from '../services/api.js';
import { showToast } from '../utils/toast.js';
import { isValidEmail, isValidPassword, detectSpace } from '../utils/validators.js';
import { setError, clearErrors } from '../utils/helper.js';

const ACTIVE_CLASS = "active-tab";

export const ProfileManager = {

  // Helper to get the correct active class name
  get ACTIVE() {
    return (typeof window !== "undefined" && window.ACTIVE_CLASS) || "active-tab";
  },

  openProfile: async function () {
    const profileLink = document.getElementById("profile");
    // Ensure the click handler is attached only once to prevent multiple executions
    if (!profileLink.__profile_view_initialized) {
      profileLink.__profile_view_initialized = true;

      profileLink.addEventListener("click", () => {
        this._renderProfileView();
      });
    }
  },

  // New method to encapsulate the core rendering logic for the Profile page
  _renderProfileView: function () {
    const translation = langMap[currentLang];
    const section = document.getElementById("profileContainer");

    // Clear previous content
    section.innerHTML = "";

    // --- 🎯 New State Variables for External Click Handling ---
    let activeInput = null;
    let activeIcon = null;

    // Define Icon Paths
    const ICON_EDIT = "assets/icons/edit.svg";
    const ICON_SAVE = "assets/icons/save_checkmark.svg"; // Your checkmark SVG/Image

    // -----------------------------------------------------------

    // Helper function to reset the editing state
    const resetActiveEditingState = () => {
      if (!activeInput) return; // Exit if nothing is active

      // Check if content has changed from its original value
      const contentHasChanged = activeInput.value !== activeInput.dataset.originalValue;

      // If the content *hasn't* changed, or if it has changed but the icon is still the pencil (shouldn't happen),
      // revert the state to disabled and show the pencil.
      if (!contentHasChanged) {
        activeInput.disabled = true;
        activeInput.value = activeInput.dataset.originalValue; // Optional: revert any partial typing

        activeIcon.src = ICON_EDIT;
        activeIcon.alt = translation.edit || 'Edit';
        activeIcon.classList.remove('save-icon');

        // Clear active elements
        activeInput = null;
        activeIcon = null;
      }
    };

    // --- 3. Global Outside Click Handler ---
    // We attach this listener once to the document when the profile view is rendered
    if (!document.__profile_outside_click_listener) {
      document.__profile_outside_click_listener = true;

      document.addEventListener('click', (event) => {
        // If there's no active editing, or the input is already disabled, do nothing
        if (!activeInput || activeInput.disabled) return;

        // Check if the click target is the active input or the active icon
        const isClickInside = activeInput.contains(event.target) || activeIcon.contains(event.target);

        if (!isClickInside) {
          // Click was outside, reset the state (disables input, reverts to pencil)
          // This function will only proceed if contentHasChanged is false.
          resetActiveEditingState();
        }
      });
    }

    // Clear previous content
    section.innerHTML = "";

    // --- 1. Home Button Logic (First required block) ---
    const homeButton = document.createElement("button");
    homeButton.textContent = translation.homeButton;
    homeButton.id = "homeButton";

    homeButton.addEventListener("click", async () => {
      const token = localStorage.getItem("authToken");

      try {
        const response = await apiGet("/me", token);
        if (response.success && response.user) {
          // Start of first required block logic
          document.getElementById("headerUsername").style.display = "block";
          document.getElementById("profileMenu").style.display = "block";
          document.getElementById("homePage").style.display = "block";
          document.getElementById("bannerContainer").style.display = "block";
          document.getElementById("stageContainer").style.display = "none";
          document.getElementById("leagueType1").style.display = "none";
          document.getElementById("leagueType2").style.display = "none";
          document.getElementById("loginBtn").style.display = "none";
          document.getElementById("registerBtn").style.display = "none";
          document.getElementById("profileContainer").style.display = "none";
          document.getElementById("friendsContainer").style.display = "none";
          // End of first required block logic
        } else {
          localStorage.removeItem("authToken");
          if (authButtons) authButtons.style.display = "flex";
          document.getElementById("bannerContainer").style.display = "none";
        }
      } catch (err) {
        console.error("🔴 Error in Back button to /me:", err);
        localStorage.removeItem("authToken");
        if (authButtons) authButtons.style.display = "flex";
      }
    });

    section.appendChild(homeButton);

    // --- 2. Initial View State Setup (Second required block) ---
    // Start of second required block logic
    document.getElementById("headerUsername").style.display = "block";
    document.getElementById("profileMenu").style.display = "block";
    document.getElementById("profileContainer").style.display = "block";
    document.getElementById("friendsContainer").style.display = "none";
    document.getElementById("bannerContainer").style.display = "none";
    document.getElementById("stageContainer").style.display = "none";
    document.getElementById("leagueType1").style.display = "none";
    document.getElementById("leagueType2").style.display = "none";
    localStorage.removeItem("lastActiveLeagueTab");
    localStorage.removeItem("leaguesActiveTab");
    localStorage.removeItem("lastActiveNationalLeagueTab");
    localStorage.removeItem("currentBannerId");
    localStorage.removeItem("leagueId");
    localStorage.removeItem("selectedStageType");
    // End of second required block logic

    // Initial data fetch for the default tab
    // This is where the old code called getUserData.initGetUserPersonalDetailes()
    // We will call it inside showProfileTab for the "personal" tab.
    // getUserData.initGetUserPersonalDetailes(); // Called below

    // ✅ Tabs header
    const tabsHeader = document.createElement("div");
    tabsHeader.className = "tab-switcher tabs-container";
    tabsHeader.id = "profileTabsHeader";

    // Build tab buttons
    const personalTabBtn = document.createElement("button");
    personalTabBtn.className = "tab-btn";
    personalTabBtn.dataset.tab = "personal";
    personalTabBtn.id = "personalDetailsBtn";
    personalTabBtn.textContent = translation.personalDetails || "Personal Details";

    const achievementTabBtn = document.createElement("button");
    achievementTabBtn.className = "tab-btn";
    achievementTabBtn.dataset.tab = "achievements";
    achievementTabBtn.id = "achievementsBtn";
    achievementTabBtn.textContent = translation.achievements || "Achievements";

    tabsHeader.appendChild(personalTabBtn);
    tabsHeader.appendChild(achievementTabBtn);
    section.appendChild(tabsHeader);

    // Container for tab content
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "profile-container";
    contentWrapper.id = "profileContent"; // The flex container for the two columns
    section.appendChild(contentWrapper);

    // 1. Column for Personal Info (Left)
    const personalInfoColumn = document.createElement("div");
    personalInfoColumn.className = "profile-column";
    personalInfoColumn.id = "personalInfoColumn";
    contentWrapper.appendChild(personalInfoColumn);

    // 2. Column for Password Change (Right)
    const passwordChangeColumn = document.createElement("div");
    passwordChangeColumn.className = "profile-column";
    passwordChangeColumn.id = "passwordChangeColumn";
    contentWrapper.appendChild(passwordChangeColumn);

    let activeTab = "personal";

    // 🎯 Tab Switching Logic - NOW MANAGES COLUMN VISIBILITY
    const showProfileTab = (tabName) => {
      activeTab = tabName;

      // Set active class on buttons
      [personalTabBtn, achievementTabBtn].forEach(btn => {
        if (btn.dataset.tab === tabName) {
          btn.classList.add(this.ACTIVE);
        } else {
          btn.classList.remove(this.ACTIVE);
        }
      });

      if (tabName === "personal") {
        personalInfoColumn.style.display = 'block';
        passwordChangeColumn.style.display = 'block';
        personalInfoColumn.innerHTML = '';
        passwordChangeColumn.innerHTML = ''; // Clear right column initially
        getUserData.initGetUserPersonalDetailes();

      } else if (tabName === "achievements") {
        personalInfoColumn.style.display = 'none';
        passwordChangeColumn.style.display = 'none';
        // Display achievements content directly in the main contentWrapper (or create a new container)
        contentWrapper.innerHTML = `<div style="flex-basis: 100%;">${translation.achievementsContent || 'Achievements content goes here.'}</div>`;
      }
    };

    // Click handlers for tabs
    [personalTabBtn, achievementTabBtn].forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains(this.ACTIVE)) return;
        showProfileTab(btn.dataset.tab);
      });
    });

    // Initialize the view with the personal tab
    showProfileTab(activeTab); // activeTab is hardcoded to "personal"

    // 🎯 Global Callback Hook for Personal Details data
    window.__setPersonalDetails = function (payload) {
      const userData = payload?.data?.user;

      if (userData && activeTab === "personal") {
        // Render Left Column (ID, Username, Email)
        renderPersonalDetails(userData, personalInfoColumn, translation, { setActive: (input, icon) => { activeInput = input; activeIcon = icon; }, resetActive: resetActiveEditingState });

        // Render Right Column (Password Fields)
        renderPasswordDetails(userData, passwordChangeColumn, translation);
      }
    };
  }, // end _renderProfileView

};


/**
 * Renders the Personal Details view with editable fields and validation.
 * @param {object} userData - The user data object.
 * @param {HTMLElement} container - The element to render the content into.
 * @param {object} translation - The language map.
 * @param {object} stateHandlers - Object containing setActive and resetActive functions.
 */
function renderPersonalDetails(userData, container, translation, stateHandlers) {
  container.innerHTML = '';

  // Define Icon Paths (for context)
  const ICON_EDIT = "assets/icons/edit.svg";
  const ICON_SAVE = "assets/icons/save_checkmark.svg";

  // Assume helper functions are globally available:
  // detectSpace(value), isValidEmail(value), setError(elementId, message), clearErrors(elementIds), apiPost(url, data, token), showToast(message, type)

  const fields = [
    { key: 'id', label: translation.id || 'ID', disabled: true },
    { key: 'username', label: translation.username || 'Username', disabled: false },
    { key: 'email', label: translation.email || 'Email', disabled: false }
  ];

  // --- Core Validation Logic ---
  const validateField = (key, value, errorEl) => {
    // Clear previous errors for this field
    if (typeof clearErrors === 'function') clearErrors([errorEl.id]);
    errorEl.textContent = ""; // Clear visual text

    let hasError = false;

    if (key === 'username') {
      if (!value.trim()) {
        setError(errorEl.id, translation.required);
        hasError = true;
      } else if (value.trim().length < 3) {
        setError(errorEl.id, translation.shortUsername);
        hasError = true;
      } else if (value.trim().length > 15) {
        setError(errorEl.id, translation.longUsername);
        hasError = true;
      } else if (typeof detectSpace === 'function' && detectSpace(value.trim())) {
        setError(errorEl.id, translation.no_spaces_allowed);
        hasError = true;
      }
    }

    if (key === 'email') {
      if (!value.trim()) {
        setError(errorEl.id, translation.required);
        hasError = true;
      } else if (typeof isValidEmail === 'function' && !isValidEmail(value)) {
        setError(errorEl.id, translation.invalidEmail);
        hasError = true;
      }
    }

    return hasError;
  };
  // ---------------------------

  fields.forEach(({ key, label, disabled }) => {
    const row = document.createElement('div');
    row.className = 'profile-row';

    // --- 1. Label Element (Goes into 'label' area) ---
    const labelEl = document.createElement('label');
    labelEl.textContent = label + ':'; // Added colon for visual separation
    labelEl.htmlFor = `profileInput-${key}`;
    row.appendChild(labelEl); // Append label first

    // --- 2. Input Container (Goes into 'input-group' area) ---
    const inputContainer = document.createElement('div');
    inputContainer.className = 'profile-row-item';

    const input = document.createElement('input');
    input.type = (key === 'email' ? 'email' : 'text'); // Better practice for email
    input.id = `profileInput-${key}`; // Unique ID for input
    input.value = userData[key];
    input.dataset.originalValue = userData[key];
    input.className = 'profile-item';

    input.disabled = true;
    if (disabled) {
      input.disabled = true;
    }

    inputContainer.appendChild(input);

    // --- 3. Error Element (Goes into 'error' area) ---
    const errorEl = document.createElement('div');
    errorEl.id = `profileError-${key}`; // Unique ID for error message
    errorEl.className = 'validation-error-message';
    // Note: The error element is added outside the inputContainer for proper layout

    // --- Editable Field Logic ---
    if (!disabled) {
      const editIcon = document.createElement("img");
      editIcon.src = ICON_EDIT;
      editIcon.alt = "Edit";
      editIcon.className = 'edit-icon';

      let hasChanged = false;

      // Function to handle the icon click (Edit/Save)
      const handleIconClick = async () => {
        if (input.disabled) {
          // Case 1: Disabled -> Enable editing
          stateHandlers.resetActive();
          stateHandlers.setActive(input, editIcon);

          input.disabled = false;
          input.focus();

          editIcon.src = ICON_SAVE;
          editIcon.alt = translation.save || 'Save';
          editIcon.classList.add('save-icon');

        } else if (hasChanged) {
          // Case 2: Enabled AND has changed -> Save action 

          const currentValue = input.value;

          // 1. Run client-side validation
          const validationFailed = validateField(key, currentValue, errorEl);
          if (validationFailed) {
            // Stop the save process if validation fails
            return;
          }

          // 2. Disable input temporarily while sending
          input.disabled = true;

          try {
            const token = localStorage.getItem("authToken");

            // 3. Send API request only for the field being edited
            const payload = { [key]: currentValue };
            const updateData = await apiPost("/user-update", payload, token); // Assuming a generic update endpoint

            if (updateData.success) {
              showToast(translation.updated_success || "Successfully Updated", "success");

              // 4. Final Reset State (Success)
              input.dataset.originalValue = currentValue;
              hasChanged = false;

            } else {
              // 5. Handle Server Errors (e.g., username/email exists)
              const errors = updateData.errors;

              // --- 🎯 MODIFIED BLOCK START ---
              if (errors) {
                let fieldError = null;

                if (key === 'username' && errors.username) {
                  fieldError = translation.username_exists;
                } else if (key === 'email' && errors.email) {
                  fieldError = translation.email_exists;
                }
                // Note: Password error is irrelevant here as it's not being edited

                if (fieldError) {
                  // Error is specific to the field being edited
                  setError(errorEl.id, fieldError);

                  // Keep field open for user correction
                  hasChanged = true;
                  input.disabled = false;
                  input.focus();
                  return;
                } else {
                  // Generic update failure or error for a different field
                  showToast(updateData.message || translation.update_failed || "Update failed", "error");
                }

              } else {
                // Fallback for a non-json/non-error response from API
                showToast(translation.update_failed || "Update failed", "error");
              }
              // --- 🎯 MODIFIED BLOCK END ---

              // Re-enable input if update failed for a general reason
              input.disabled = false;
              input.focus();
              return;
            }
          } catch (err) {
            showToast(translation.something_went_wrong, "error");
            console.error("Update Error:", err);
            input.disabled = false; // Re-enable on failure
            input.focus();
            return;
          }

          // 6. Final UI Reset after successful save
          editIcon.src = ICON_EDIT;
          editIcon.alt = translation.edit || 'Edit';
          editIcon.classList.remove('save-icon');
          stateHandlers.setActive(null, null);

        } else {
          // Case 3: Enabled but NO changes -> Disable editing 
          input.disabled = true;

          // Clear any lingering errors if the user didn't change anything
          if (typeof clearErrors === 'function') clearErrors([errorEl.id]);
          errorEl.textContent = "";

          editIcon.src = ICON_EDIT;
          editIcon.alt = translation.edit || 'Edit';
          editIcon.classList.remove('save-icon');

          stateHandlers.setActive(null, null);
        }
      };

      // Input change listener: turn icon to save state if text changes
      input.addEventListener('input', () => {
        const changed = input.value !== input.dataset.originalValue;

        // Clear errors on change if the input is valid again
        if (typeof clearErrors === 'function') clearErrors([errorEl.id]);
        errorEl.textContent = "";

        if (changed && !hasChanged) {
          hasChanged = true;
          editIcon.src = ICON_SAVE;
          editIcon.alt = translation.save || 'Save';
          editIcon.classList.add('save-icon');
        } else if (!changed && hasChanged) {
          hasChanged = false;
          editIcon.src = ICON_EDIT;
          editIcon.alt = translation.edit || 'Edit';
          editIcon.classList.remove('save-icon');
        }
      });

      editIcon.addEventListener('click', handleIconClick);

      inputContainer.appendChild(editIcon);
    }

    row.appendChild(inputContainer);

    // Add error element below the input row for better visibility
    if (!disabled) {
      row.appendChild(errorEl);
    }

    container.appendChild(row);
  });
}

/**
 * Renders the Password Change section.
 * @param {object} userData - The user data object (for context/API).
 * @param {HTMLElement} container - The column element to render the content into (Right Column).
 * @param {object} translation - The language map.
 */
function renderPasswordDetails(userData, container, translation) {
  container.innerHTML = ''; // Clear the container

  const ICON_EYE = "assets/icons/eye.png";
  const ICON_EYE_OFF = "assets/icons/eye-off.png";

  function createVisibilityToggle(inputElement) {
    const icon = document.createElement('img');
    icon.src = ICON_EYE_OFF; // Start with the 'off' icon (password hidden)
    icon.alt = 'Toggle Password Visibility';
    icon.className = 'visibility-toggle-icon'; // Use a new class for styling

    // 🎯 Toggling Functionality
    icon.addEventListener('click', () => {
      if (inputElement.type === 'password') {
        inputElement.type = 'text';
        icon.src = ICON_EYE;
      } else {
        inputElement.type = 'password';
        icon.src = ICON_EYE_OFF;
      }
    });

    return icon;
  }

  // 1. Define fields (no edit icon needed for the password block, it's one atomic action)
  const fields = [
    { key: 'currentPassword', label: translation.current_password || 'Current Password', type: 'password', required: true },
    { key: 'newPassword', label: translation.new_password || 'New Password', type: 'password', required: true, dependent: true },
    { key: 'confirmNewPassword', label: translation.confirm_password || 'Confirm New Password', type: 'password', required: true, dependent: true }
  ];

  // Create a centralized button element that will handle the save action for this whole block
  const saveButton = document.createElement('button');
  saveButton.textContent = translation.change_password || 'Change Password';
  saveButton.className = 'profile-save-button';

  // Store references for conditional enabling and validation
  const inputs = {};
  const errorEls = {};

  // --- Render Fields ---
  fields.forEach(({ key, label, type, dependent }) => {
    const row = document.createElement('div');
    row.className = 'profile-row password-row'; // Use a special class for password rows

    const labelEl = document.createElement('label');
    labelEl.textContent = label + ':';
    labelEl.htmlFor = key;
    row.appendChild(labelEl);

    // --- Error Element Creation ---
    const errorEl = document.createElement('div');
    errorEl.id = `profileError-${key}`;
    errorEl.className = 'validation-error-message';
    row.appendChild(errorEl);
    errorEls[key] = errorEl; // Store reference

    const inputContainer = document.createElement('div');
    inputContainer.className = 'profile-row-item';

    const input = document.createElement('input');
    input.type = 'password'; // Use 'password' type
    input.id = `profileInput-${key}`;
    input.className = 'profile-item';

    const toggleIcon = createVisibilityToggle(input);

    // Initial state: Disable new/confirm fields
    if (dependent) {
      input.disabled = true;
    }

    inputContainer.appendChild(input);
    inputContainer.appendChild(toggleIcon);
    row.appendChild(inputContainer);
    container.appendChild(row);

    inputs[key] = input; // Store reference
  });

  // Append the Save Button
  container.appendChild(saveButton);

  // --- 4. Conditional Enabling Logic (Current Password) ---
  const updateDependentFields = () => {
    const currentPassValue = inputs.currentPassword.value.trim();
    const enable = currentPassValue.length > 0;

    inputs.newPassword.disabled = !enable;
    inputs.confirmNewPassword.disabled = !enable;

    // Clear new/confirm fields and errors if disabling
    if (!enable) {
      inputs.newPassword.value = '';
      inputs.confirmNewPassword.value = '';
      if (typeof clearErrors === 'function') {
        clearErrors([errorEls.newPassword.id, errorEls.confirmNewPassword.id]);
        errorEls.newPassword.textContent = '';
        errorEls.confirmNewPassword.textContent = '';
      }
    }
  };

  // Attach listener to the current password field
  inputs.currentPassword.addEventListener('input', updateDependentFields);


  // --- 5. Validation and Submission Logic (Save Button) ---
  saveButton.addEventListener('click', async () => {
    if (typeof clearErrors === 'function') {
      clearErrors([errorEls.currentPassword.id, errorEls.newPassword.id, errorEls.confirmNewPassword.id]);
    }

    let hasError = false;

    // Validation for the Current Password
    if (!inputs.currentPassword.value.trim()) {
      setError(errorEls.currentPassword.id, translation.required);
      hasError = true;
    }

    // Only validate New/Confirm if Current Password is provided
    if (!hasError && inputs.currentPassword.value.trim().length > 0) {

      // Validation for New Password
      const newPassValue = inputs.newPassword.value.trim();
      const confirmPassValue = inputs.confirmNewPassword.value.trim();
      const usernameValue = userData.username; // Get username for match check

      if (!newPassValue) {
        setError(errorEls.newPassword.id, translation.required);
        hasError = true;
      } else if (newPassValue === usernameValue) {
        setError(errorEls.newPassword.id, translation.passMatchUsername);
        hasError = true;
      } else if (typeof isValidPassword === 'function' && !isValidPassword(newPassValue)) {
        setError(errorEls.newPassword.id, translation.invalidPassword);
        hasError = true;
      } else if (newPassValue.length > 30) {
        setError(errorEls.newPassword.id, translation.longPassword);
        hasError = true;
      } else if (typeof detectSpace === 'function' && detectSpace(newPassValue)) {
        setError(errorEls.newPassword.id, translation.no_spaces_allowed);
        hasError = true;
      }

      // Validation for Confirm New Password (Only if New Password validation passed)
      if (!hasError) {
        if (!confirmPassValue) {
          setError(errorEls.confirmNewPassword.id, translation.required);
          hasError = true;
        } else if (newPassValue !== confirmPassValue) {
          setError(errorEls.confirmNewPassword.id, translation.mismatch);
          hasError = true;
        } else if (confirmPassValue.length > 30) {
          setError(errorEls.confirmNewPassword.id, translation.longPassword);
          hasError = true;
        } else if (typeof detectSpace === 'function' && detectSpace(confirmPassValue)) {
          setError(errorEls.confirmNewPassword.id, translation.no_spaces_allowed);
          hasError = true;
        }
      }
    }

    if (hasError) return;

    // Attempt API submission
    saveButton.disabled = true; // Prevent double submission

    try {
      const token = localStorage.getItem("authToken");
      const payload = {
        currentPassword: inputs.currentPassword.value,
        newPassword: inputs.newPassword.value,
        confirmNewPassword: inputs.confirmNewPassword.value // API might not need this, but good to include
      };

      const updateData = await apiPost("/change-password", payload, token); // Assuming new API endpoint

      if (updateData.success) {
        showToast(translation.password_updated_success || "Password successfully changed", "success");

        // Clear all fields on success
        inputs.currentPassword.value = '';
        inputs.newPassword.value = '';
        inputs.confirmNewPassword.value = '';
        updateDependentFields(); // Will disable new/confirm fields

      } else {
        const errors = updateData.errors;

        if (errors && errors.currentPassword) {
          setError(errorEls.currentPassword.id, translation.incorrect_current_password || "Incorrect current password.");
        } else {
          showToast(updateData.message || translation.password_update_failed || "Password update failed.", "error");
        }
      }
    } catch (err) {
      showToast(translation.something_went_wrong, "error");
      console.error("Password Update Error:", err);
    } finally {
      saveButton.disabled = false;
    }
  });
}