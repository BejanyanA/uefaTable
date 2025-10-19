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
    const contentContainer = document.createElement("div");
    contentContainer.className = "profile-container";
    contentContainer.id = "profileContainer";
    section.appendChild(contentContainer);

    // 🎯 State Update: Force activeTab to "personal" and remove localStorage access
    let activeTab = "personal"; // ALWAYS starts on Personal Details

    // 🎯 Tab Switching Logic
    const showProfileTab = (tabName) => {
      activeTab = tabName;
      // localStorage.setItem("activeProfileTab", tabName); <-- REMOVED

      // Set active class on buttons
      [personalTabBtn, achievementTabBtn].forEach(btn => {
        if (btn.dataset.tab === tabName) {
          btn.classList.add(this.ACTIVE);
        } else {
          btn.classList.remove(this.ACTIVE);
        }
      });

      // Render content based on active tab
      contentContainer.innerHTML = ''; // Clear previous content

      if (tabName === "personal") {
        // Fetch data for Personal Details tab
        getUserData.initGetUserPersonalDetailes();
        contentContainer.innerHTML = `<p>${translation.loading || 'Loading personal details...'}</p>`;

      } else if (tabName === "achievements") {
        // Achievements tab content (skipped for now)
        contentContainer.textContent = translation.achievementsContent || 'Achievements content goes here.';
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
        // Pass the active element tracking objects to renderPersonalDetails
        // Use resetActiveEditingState directly
        renderPersonalDetails(userData, contentContainer, translation, {
          setActive: (input, icon) => {
            activeInput = input;
            activeIcon = icon;
          },
          resetActive: resetActiveEditingState
        });
      }
    };
  }, // end _renderProfileView

};


/**
 * Renders the Personal Details view with editable fields.
 * @param {object} userData - The user data object.
 * @param {HTMLElement} container - The element to render the content into.
 * @param {object} translation - The language map.
 * @param {object} stateHandlers - Object containing setActive and resetActive functions.
 */
function renderPersonalDetails(userData, container, translation, stateHandlers) {
  container.innerHTML = ''; // Ensure container is empty

  // Define Icon Paths (redundant if using global, but safer for standalone function)
  const ICON_EDIT = "assets/icons/edit.svg";
  const ICON_SAVE = "assets/icons/save_checkmark.svg";

  const fields = [
    { key: 'id', label: translation.id || 'ID', disabled: true },
    { key: 'username', label: translation.username || 'Username', disabled: false },
    { key: 'email', label: translation.email || 'Email', disabled: false }
  ];

  fields.forEach(({ key, label, disabled }) => {
    const row = document.createElement('div');
    row.className = 'profile-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = key;
    row.appendChild(labelEl);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'profile-row-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = key;
    input.value = userData[key];
    input.dataset.originalValue = userData[key]; // Store original value
    input.className = 'profile-item';

    // --- IMPORTANT: Set initial state ---
    input.disabled = true;
    if (disabled) {
      input.disabled = true;
    }

    inputContainer.appendChild(input);

    // --- Editable Field Logic ---
    if (!disabled) {
      const editIcon = document.createElement("img");
      editIcon.src = ICON_EDIT; // Initial edit icon
      editIcon.alt = "Edit";
      editIcon.className = 'edit-icon';

      let hasChanged = false; // Tracks if input value is different from originalValue

      // Function to handle the icon click (Edit/Save)
      const handleIconClick = () => {
        if (input.disabled) {
          // Case 1: Disabled (non-editable) -> Enable editing

          // 1. Reset any other active editing field first
          stateHandlers.resetActive();

          // 2. Set this field as the new active one
          // 🎯 FIX: Explicitly set the active elements here
          stateHandlers.setActive(input, editIcon);

          // 3. Enable the input
          input.disabled = false;
          input.focus();

          // 4. Update the icon to 'Save' state
          editIcon.src = ICON_SAVE;
          editIcon.alt = translation.save || 'Save';
          editIcon.classList.add('save-icon');

        } else if (hasChanged) {
          // Case 2: Enabled AND has changed -> Save action 

          // ... (API CALL HERE) ...

          // 1. Reset state
          input.disabled = true;
          input.dataset.originalValue = input.value;
          hasChanged = false;

          // 2. Revert icon to 'Edit' state
          editIcon.src = ICON_EDIT;
          editIcon.alt = translation.edit || 'Edit';
          editIcon.classList.remove('save-icon');

          // 3. Clear active elements after saving
          stateHandlers.setActive(null, null);

        } else {
          // Case 3: Enabled but NO changes -> Disable editing (Tapping the edit icon again)
          input.disabled = true;

          // Revert icon to 'Edit' state
          editIcon.src = ICON_EDIT;
          editIcon.alt = translation.edit || 'Edit';
          editIcon.classList.remove('save-icon');

          // Clear active elements
          stateHandlers.setActive(null, null);
        }
      };

      // Input change listener: only changes the icon state if the text changes
      input.addEventListener('input', () => {
        const changed = input.value !== input.dataset.originalValue;

        if (changed && !hasChanged) {
          hasChanged = true;
          editIcon.src = ICON_SAVE; // Show save icon
          editIcon.alt = translation.save || 'Save';
          editIcon.classList.add('save-icon');
        } else if (!changed && hasChanged) {
          hasChanged = false;
          editIcon.src = ICON_EDIT; // Show edit icon
          editIcon.alt = translation.edit || 'Edit';
          editIcon.classList.remove('save-icon');
        }
      });

      // Set up initial click behavior
      editIcon.addEventListener('click', handleIconClick);

      inputContainer.appendChild(editIcon);
    }

    row.appendChild(inputContainer);
    container.appendChild(row);
  });
}