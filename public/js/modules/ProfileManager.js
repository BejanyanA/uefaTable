import { langMap, currentLang } from './LanguageManager.js';
import { getUserData } from './GetUserData.js';
import { apiGet, apiPost } from '../services/api.js';
import { showToast } from '../utils/toast.js';
import { isValidEmail, isValidPassword, detectSpace } from '../utils/validators.js';
import { setError, clearErrors } from '../utils/helper.js';
import { logout } from '../modules/MeHomepage.js'

const ACTIVE_CLASS = "active-tab";

export const ProfileManager = {

  // Helper to get the correct active class name
  get ACTIVE() {
    return (typeof window !== "undefined" && window.ACTIVE_CLASS) || "active-tab";
  },

  openProfile: async function () {
    const profileLink = document.getElementById("profile");
    if (!profileLink.__profile_view_initialized) {
      profileLink.__profile_view_initialized = true;

      // 🔹 ensure we react to future language changes
      this.installLanguageReset();

      profileLink.addEventListener("click", () => {
        this._renderProfileView();
      });
    }
  },

  // Add inside ProfileManager (same object)
  __langResetInstalled: false,

  /** Clears all validation messages by id or class */
  __clearAllProfileErrors() {
    // specific error ids we know we render
    const errorIds = [
      'profileError-username',
      'profileError-email',
      'profileError-currentPassword',
      'profileError-newPassword',
      'profileError-confirmNewPassword'
    ];
    if (typeof clearErrors === 'function') clearErrors(errorIds);
    errorIds.forEach(id => {
      const n = document.getElementById(id);
      if (n) n.textContent = '';
    });
    // safety net: remove any stray messages with the common class
    document.querySelectorAll('.validation-error-message').forEach(n => n.textContent = '');
  },

  /** Resets personal details (username/email) and icons back to "edit" */
  __resetPersonalInputs() {
    // inputs you create in renderPersonalDetails have class 'profile-item'
    document.querySelectorAll('#profileContent #personalInfoColumn .profile-item').forEach(inp => {
      // revert to original value if we have it
      if (inp.dataset && typeof inp.dataset.originalValue !== 'undefined') {
        inp.value = inp.dataset.originalValue;
      }
      inp.disabled = true;
    });

    // restore edit icons
    document.querySelectorAll('#profileContent #personalInfoColumn .edit-icon').forEach(icon => {
      icon.src = 'assets/icons/edit.svg';
      icon.alt = (langMap[currentLang]?.edit) || 'Edit';
      icon.classList.remove('save-icon');
    });

    // also nuke any globally tracked active editor state, if present
    if (window && typeof window === 'object') {
      // your code keeps these in closure; we defensively clear globals if you exposed them
      window.__activeProfileInput = null;
      window.__activeProfileIcon = null;
    }
  },

  /** Clears password block fields & re-applies dependent disabling */
  __resetPasswordBlock() {
    const cur = document.getElementById('profileInputcurrentPassword');
    const n1 = document.getElementById('profileInputnewPassword');
    const n2 = document.getElementById('profileInputconfirmNewPassword');

    if (cur) cur.value = '';
    if (n1) n1.value = '';
    if (n2) n2.value = '';

    // disable dependents when no current password
    if (n1) n1.disabled = true;
    if (n2) n2.disabled = true;
  },

  /** Public method: fully reset UI state + re-render to pick up new translations */
  resetProfileUIState() {
    this.__clearAllProfileErrors();
    this.__resetPersonalInputs();
    this.__resetPasswordBlock();

    // Re-render to re-apply translated labels & buttons reliably
    // (safe: your code guards the outside-click listener with a flag)
    this._renderProfileView();
  },

  /** Install one-time listener for language changes */
  installLanguageReset() {
    if (this.__langResetInstalled) return;
    this.__langResetInstalled = true;

    document.addEventListener('app:language-changed', () => {
      // Skip if logged out
      if (!localStorage.getItem("authToken")) return;

      // Skip if profile page is not currently active/visible
      const profileEl = document.getElementById("profileContainer");
      const isVisible = profileEl && getComputedStyle(profileEl).display !== "none";
      if (!isVisible) return;

      // Now it's safe to reset/re-render
      this.resetProfileUIState();
    });
  },

  // New method to encapsulate the core rendering logic for the Profile page
  _renderProfileView: function () {
    this.installLanguageReset();

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

    const achievementsContainer = document.createElement("div");
    achievementsContainer.id = "achievementsContentContainer";
    achievementsContainer.className = "profile-column"; // Use profile-column for styling/sizing
    achievementsContainer.style.display = 'none'; // Initially hidden
    achievementsContainer.innerHTML = `<div>${translation.achievementsContent || 'Achievements content goes here.'}</div>`;
    contentWrapper.appendChild(achievementsContainer);

    let activeTab = "personal";

    // ✅ Define the global callback FIRST (so fetches can call it immediately)
    window.__setPersonalDetails = function (payload) {
      const userData = payload?.data?.user;
      if (!userData || activeTab !== "personal") return;

      // guard against DOM not ready (e.g., user switched tab fast)
      const leftCol = document.getElementById("personalInfoColumn");
      const rightCol = document.getElementById("passwordChangeColumn");
      if (!leftCol || !rightCol) return;

      const translation = langMap[currentLang];
      renderPersonalDetails(
        userData,
        leftCol,
        translation,
        {
          setActive: (input, icon) => { /* keep your state hook if needed */ },
          resetActive: () => { /* no-op, handled in new reset */ }
        }
      );
      renderPasswordDetails(userData, rightCol, translation);
    };

    // 🎯 Tab Switching Logic - NOW MANAGES COLUMN VISIBILITY
    const showProfileTab = (tabName) => {
      ProfileManager.__clearAllProfileErrors();
      activeTab = tabName;

      // Set active class on buttons
      [personalTabBtn, achievementTabBtn].forEach(btn => {
        const isActive = btn.dataset.tab === tabName;

        btn.classList.toggle(this.ACTIVE, isActive);
        btn.disabled = isActive;     // ✅ Disable the active one
        if (!isActive) btn.disabled = false; // ✅ Re-enable others
      });

      if (tabName === "personal") {
        personalInfoColumn.style.display = 'block';
        passwordChangeColumn.style.display = 'block';
        achievementsContainer.style.display = 'none';
        personalInfoColumn.innerHTML = '';
        passwordChangeColumn.innerHTML = ''; // Clear right column initially
        getUserData.initGetUserPersonalDetailes();

      } else if (tabName === "achievements") {
        // Hide Personal/Password columns, Show Achievements container
        personalInfoColumn.style.display = 'none';
        passwordChangeColumn.style.display = 'none';
        achievementsContainer.style.display = 'block';
        ProfileManager.showAchievementsTab(translation);
      }
    };

    // Click handlers for tabs
    [personalTabBtn, achievementTabBtn].forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
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
    labelEl.textContent = label; // Added colon for visual separation
    labelEl.id = `${key}`;
    labelEl.htmlFor = `profileInput-${key}`;
    row.appendChild(labelEl); // Append label first

    // --- 2. Input Container (Goes into 'input-group' area) ---
    const inputContainer = document.createElement('div');
    inputContainer.className = 'profile-row-item';

    const input = document.createElement('input');
    input.type = (key === 'email' ? 'email' : 'text'); // Better practice for email
    input.id = `${key}`;
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
              showToast(translation.update_success || "Successfully Updated", "success");

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
    { key: 'currentPassword', label: translation.password || 'Current Password', type: 'password', required: true },
    { key: 'newPassword', label: translation.newPassword || 'New Password', type: 'password', required: true, dependent: true },
    { key: 'confirmNewPassword', label: translation.confirmNewPassword || 'Confirm New Password', type: 'password', required: true, dependent: true }
  ];

  // Create a centralized button element that will handle the save action for this whole block
  const saveButton = document.createElement('button');
  saveButton.textContent = translation.update || 'Change Password';
  saveButton.className = 'profile-save-button';

  // Store references for conditional enabling and validation
  const inputs = {};
  const errorEls = {};

  // --- Render Fields ---
  fields.forEach(({ key, label, type, dependent }) => {
    const row = document.createElement('div');
    row.className = 'profile-row password-row'; // Use a special class for password rows

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = key;
    labelEl.id = `${key}`;
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
    input.type = type
    input.id = `profileInput${key}`;
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
      const currentPassValue = inputs.currentPassword.value.trim();
      const newPassValue = inputs.newPassword.value.trim();
      const confirmPassValue = inputs.confirmNewPassword.value.trim();
      const usernameValue = userData.username; // Get username for match check

      if (!newPassValue) {
        setError(errorEls.newPassword.id, translation.required);
        hasError = true;
      } else if (newPassValue === usernameValue) {
        setError(errorEls.newPassword.id, translation.passMatchUsername);
        hasError = true;
      } else if (newPassValue.length > 30) {
        setError(errorEls.newPassword.id, translation.longPassword);
        hasError = true;
      } else if (typeof isValidPassword === 'function' && !isValidPassword(newPassValue)) {
        setError(errorEls.newPassword.id, translation.invalidPassword);
        hasError = true;
      } else if (typeof detectSpace === 'function' && detectSpace(newPassValue)) {
        setError(errorEls.newPassword.id, translation.no_spaces_allowed);
        hasError = true;
      } else if (newPassValue === currentPassValue) {
        setError(errorEls.newPassword.id, translation.new_password_match_current);
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
      };

      const updateData = await apiPost("/user-update", payload, token); // Assuming new API endpoint

      if (updateData.success) {
        showToast(translation.password_updated_success || "Password successfully changed", "success");

        // Clear all fields on success
        inputs.currentPassword.value = '';
        inputs.newPassword.value = '';
        inputs.confirmNewPassword.value = '';
        updateDependentFields(); // Will disable new/confirm fields
        setTimeout(() => {
          sessionStorage.setItem("postLogoutAction", "openLogin"); // handoff flag
          logout(); // this reloads the page
        }, 2500);

      } else {
        const errors = updateData.errors;

        if (errors && errors.currentPassword === "invalid_current_password") {
          setError(errorEls.currentPassword.id, translation.wrong_current_password || "Current password is wrong");
        } else if (errors && errors.newPassword) {
          setError(errorEls.newPassword.id, translation.new_password_match_current || "New password matches current password");
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

  const BANNER_MAP = [
    { id: 1, name: "Champions League", trophyUrl: 'assets/images/champLeaOnlyCup.png' },
    { id: 2, name: "Europe League", trophyUrl: 'assets/images/eur2OnlyCup.png' },
    { id: 3, name: "EURO Cup", trophyUrl: 'assets/images/europ3OnlyCup.png' },
    { id: 4, name: "World Cup", trophyUrl: 'assets/images/wrld4OnlyCup.png' }
  ];

  function renderAchievementBanners(userAchievements, translation) {
    const trophyGrid = document.getElementById("trophyGrid");
    if (!trophyGrid) return;
    trophyGrid.innerHTML = '';

    const groupedAchievements = userAchievements.reduce((acc, ach) => {
      const id = ach.banner_id;
      (acc[id] ||= []).push(ach);
      return acc;
    }, {});

    // helper that works with or without a global ProfileManager
    const openAchievements = (id, list) => {
      if (typeof ProfileManager !== 'undefined' && ProfileManager.showAchievementList) {
        ProfileManager.showAchievementList(id, list);
      } else if (typeof showAchievementList === 'function') {
        showAchievementList(id, list);
      } else {
        console.warn('showAchievementList not found');
      }
    };

    BANNER_MAP.forEach(banner => {
      const achievements = groupedAchievements[banner.id] || [];
      const count = achievements.length;

      let achievementDetailsHTML = '';
      let bannerClass = 'achievement-card empty-state';

      if (count > 0) {
        const winLabel =
          count === 1
            ? (translation.winCup || "Win")
            : (translation.winCups || "Wins");

        achievementDetailsHTML = `
      <div class="golden-star-summary" data-banner-id="${banner.id}">
          <span class="star-icon">⭐</span>
          <p class="win-count">
          <span class="win-number">${count}</span>
          <span class="win-label">${winLabel}!</span>
          </p>
      </div>
              `;
      } else {
        achievementDetailsHTML = `
    <div class="empty-message">
      <p>${translation.aimForTheStars || "Aim for the stars!"}</p>
      <p>${translation.winFirstTitle || "Win your first"}</p>
    </div>
           `;
      }

      const bannerCard = document.createElement('div');
      bannerCard.id = `banner${banner.id}`;
      bannerCard.className = bannerClass;

      // background image (make it bullet-proof)
      bannerCard.style.setProperty('background-image', `url('${banner.trophyUrl}')`, 'important');

      bannerCard.innerHTML = `
  ${achievementDetailsHTML}
  <div class="trophy-visual">
      <p class="trophy-name">${banner.name}</p>
  </div>
   `;

      // make the summary block clickable too (when present)
      const summary = bannerCard.querySelector('.golden-star-summary');
      if (summary) {
        summary.addEventListener('click', () => openAchievements(banner.id, achievements));
      }

      trophyGrid.appendChild(bannerCard);
    });
  }

  /**
   * Fetches the user's achievement data using the global apiGet utility.
   * Assumes apiGet handles the base URL, authentication, and returns a promise
   * that resolves to the parsed JSON or handles errors/404s gracefully.
   * * @returns {Promise<Object>} The API response object.
   */
  async function fetchUserAchievements() {
    try {
      // Assuming apiGet('/user-achievements') returns the full API response object
      const response = await apiGet('/user-achievements');

      // If apiGet handles 404 by resolving with an empty/error payload, 
      // we ensure we return a structure the renderer can use.
      if (response && response.success && response.data && response.data.achievements) {
        return response;
      } else {
        // Handle successful API call but no data, or a standard failure response
        return { success: true, data: { achievements: [] } };
      }
    } catch (error) {
      console.error("Fetch achievements failed via apiGet:", error);
      // On hard failure (e.g., network error), return empty structure
      return { success: false, data: { achievements: [] } };
    }
  }

  /**
   * Displays a modal listing all achievements for a specific banner type.
   * This is triggered by clicking the Golden Star or "+X More" button.
   * * @param {number} bannerId - The ID of the competition (1, 2, 3, 4).
   * @param {Array<Object>} achievements - The list of achievement objects for this banner.
   */
  ProfileManager.showAchievementList = function (bannerId, achievements) {
    if (!achievements || achievements.length === 0) return;

    // 1. Get competition name for modal title
    const banner = BANNER_MAP.find(b => b.id === bannerId);
    const title = banner ? `${banner.name}` : 'Achievements List';

    // 2. Build the list content HTML
    let listItemsHtml = achievements.map(ach => {
      // Sort achievements by year descending (most recent first)
      const year = ach.created_at ? new Date(ach.created_at).getFullYear() : 'N/A';
      const teamLogo = ach.team_logo_url || 'https://uefaresults.com/assets/logos/defaultLogo.png';

      return `
            <li class="achievement-list-item">
                <span class="achievement-year">${year}</span>
                <img src="${teamLogo}" class="list-team-logo">
                <div class="achievement-info">
                     <span class="achievement-team">${ach.team_name}</span>
                     <span class="achievement-leagueName">- ${ach.league_name}</span>
                </div>
             </li>
        `;
    }).join('');

    // 3. Create the modal structure
    const modalHtml = `
        <div id="achievementModal" class="achievement-modal-overlay">
            <div class="achievement-modal-content">
                <button class="close-btn" onclick="document.getElementById('achievementModal').remove()">&times;</button>
                <h3> ${title} </h3>
                <ul class="achievement-list">
                    ${listItemsHtml}
                </ul>
            </div>
        </div>
    `;

    // 4. Append modal to the body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  ProfileManager.showAchievementsTab = async function (translation) {
    const container = document.getElementById("achievementsContentContainer");

    // 1. Initial Content Setup
    container.innerHTML = `
        <div id="trophyGrid" class="trophy-grid"></div>
        <div id="loadingSpinner" class="loading-spinner">Loading achievements...</div>
    `;

    // 2. Data Fetch
    try {
      const response = await fetchUserAchievements();

      // Remove loading spinner
      const spinner = document.getElementById("loadingSpinner");
      if (spinner) spinner.remove();

      if (response && response.success && response.data.achievements) {
        // Success: PASS the translation object
        renderAchievementBanners(response.data.achievements, translation);
      } else {
        // Empty Data/Soft Failure: PASS the translation object
        renderAchievementBanners([], translation);
      }
    } catch (error) {
      console.error("Error fetching achievements:", error);
      const spinner = document.getElementById("loadingSpinner");
      if (spinner) spinner.textContent = "Error loading achievements. Please try again.";
      // Hard Failure: PASS the translation object
      renderAchievementBanners([], translation);
    }
  };
}