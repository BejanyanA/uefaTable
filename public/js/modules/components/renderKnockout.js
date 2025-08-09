import { showToast } from '../../utils/toast.js';
import { apiPost } from '../../services/api.js';
import { renderLeagueInstances } from './renderTable.js';
import { LeagueManager } from '../LeagueManager.js';
import { langMap, currentLang } from '../LanguageManager.js';


export function renderKnockoutLeagueTable(data) {
    const translation = langMap[currentLang];
    const section = document.getElementById("leagueType1");
    const leagues = data.leagues || [];

    section.innerHTML = ""; // Clear previous content
    section.style.display = "block";

    // ✅ Add Back Button to /me
    const backBtn = document.createElement("button");
    backBtn.textContent = translation.backButton;
    backBtn.id = "backBtn";

    backBtn.addEventListener("click", async () => {
        const token = localStorage.getItem("authToken");

        try {
            const response = await apiGet("/me", token);
            if (response.success && response.user) {
                document.getElementById("logoutButtn").style.display = "block";
                document.getElementById("stageContainer").style.display = "block";
                document.getElementById("leagueType1").style.display = "none";
            } else {
                localStorage.removeItem("authToken");
                if (authButtons) authButtons.style.display = "flex";
            }
        } catch (err) {
            console.error("🔴 Error in Back button to /me:", err);
            localStorage.removeItem("authToken");
            if (authButtons) authButtons.style.display = "flex";
        }
    });

    section.appendChild(backBtn); // Add Back button

    // ✅ If no leagues
    if (!leagues.length) {
        const translation = langMap[currentLang];
        const noDataMsg = document.createElement("div");
        noDataMsg.innerHTML = `<h2 id="leagueNotExist">${translation.leagueNotExist || "No leagues found"}</h2>`;
        noDataMsg.id = "noLeaguedata";
        section.appendChild(noDataMsg);
        return;
    }

    // ✅ Container for league boxes
    const rowContainer = document.createElement("div");
    rowContainer.className = "league-names-row";
    section.appendChild(rowContainer);

    leagues.forEach(league => {
        const leagueRow = document.createElement("div");
        leagueRow.className = "league-names-row-item";

        const leagueBox = document.createElement("div");
        leagueBox.className = "league-name-box";
        leagueBox.textContent = league.name;
        leagueBox.style.cursor = "pointer";

        leagueBox.addEventListener("click", async () => {
            try {
                const response = await apiPost("/league-instances", { leagueId: league.id });
                if (response.success) {
                    localStorage.setItem("leagueId", league.id);
                    renderLeagueInstances(response.data); // Need to change from renderLeagueInstances to another for only knockout 
                } else {
                    section.innerHTML = `<p>Error loading instances</p>`;
                }
            } catch (err) {
                console.error("Failed to fetch league instances", err);
            }
        });

        leagueRow.appendChild(leagueBox);

        // 👤 Check owner access
        const translation = langMap[currentLang];
        const isOwner = league.accessType === "owner";

        // ✏️ Edit icon
        const editIcon = document.createElement("img");
        editIcon.src = "assets/icons/edit.svg";
        editIcon.alt = "Edit";
        editIcon.className = "league-edit-icon";
        editIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
        editIcon.title = isOwner ? "" : translation.owner_edit || "Only the owner can edit";
        if (!isOwner) {
            editIcon.classList.add("icon-disabled");
        }
        editIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isOwner) {
                LeagueManager.initEdit(league.id, league.name);
            } else {
                showMobileTooltip(editIcon, "owner_edit");
            }
        });


        // 🗑️ Delete icon
        const deleteIcon = document.createElement("img");
        deleteIcon.src = "assets/icons/delete.svg";
        deleteIcon.alt = "Delete";
        deleteIcon.className = "league-delete-icon";
        deleteIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
        deleteIcon.title = isOwner ? "" : translation.owner_delete || "Only the owner can delete";
        if (!isOwner) {
            deleteIcon.classList.add("icon-disabled");
        }
        deleteIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isOwner) {
                LeagueManager.initDelete(league.id);
            } else {
                showMobileTooltip(deleteIcon, "owner_delete");
            }
        });

        leagueRow.appendChild(editIcon);
        leagueRow.appendChild(deleteIcon);

        rowContainer.appendChild(leagueRow);
    });

    function showMobileTooltip(targetElement, messageKey) {
        if (document.querySelector(".mobile-tooltip")) return;

        const translation = langMap[currentLang];
        const message =
            translation[messageKey] ||
            (messageKey === "owner_edit"
                ? "Only the owner can edit"
                : messageKey === "owner_delete"
                    ? "Only the owner can delete"
                    : "Restricted");

        const tooltip = document.createElement("div");
        tooltip.className = "mobile-tooltip";
        tooltip.textContent = message;

        document.body.appendChild(tooltip);

        // Get positions
        const rect = targetElement.getBoundingClientRect();

        // Adjust: move lower and to the left
        const verticalOffset = 8;
        const horizontalOffset = 1;

        const top = rect.bottom + window.scrollY + verticalOffset;
        const left = rect.left + window.scrollX - tooltip.offsetWidth - horizontalOffset;

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;

        setTimeout(() => {
            tooltip.classList.add("show");
            setTimeout(() => {
                tooltip.classList.remove("show");
                setTimeout(() => tooltip.remove(), 300);
            }, 2000);
        }, 10);
    }
}


export async function renderKnockoutsStage(leagueId, rootEl) {

  const root = rootEl ?? document.getElementById("leagueType2");
  root.innerHTML = "";
  const translation = langMap[currentLang];

  try {
    const [{ success, data }, playersRes] = await Promise.all([
      apiPost("/group-knockouts", { leagueId }),
      apiPost("/league-players", { leagueId }, { showLoading: false })
    ]);

    if (!success || !data) {
      root.innerHTML = `<p style="color:#fff">${translation.not_found || "Knockout data not found"}</p>`;
      return;
    }

    const accessType = data.accessType;
    const editable = accessType === "owner";
    const matches = Array.isArray(data.matches) ? data.matches : [];
    const players = (playersRes && playersRes.success) ? playersRes.data.players || [] : [];

    // ----- Build columnar layout container
    const wrap = document.createElement("div");
    wrap.className = "knockout-wrapper"; // style in your CSS
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "repeat(4, minmax(220px, 1fr))"; // R16, QF, SF, Final
    wrap.style.gap = "16px";

    // Order the rounds left -> right
    const ROUND_ORDER = ["1/8", "1/4", "1/2", "Final"];
    const ROUND_LABELS = { "1/8": "Round of 16", "1/4": "Quarter-finals", "1/2": "Semi-finals", "Final": "Final" };

    // Group matches by round, then by tie (match_order)
    const byRound = new Map();
    for (const m of matches) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round).push(m);
    }

    // helper to pair legs within a tie (home/away)
    function buildTies(roundMatches) {
      const byTie = new Map();
      for (const m of roundMatches) {
        const key = String(m.match_order ?? m.id);
        if (!byTie.has(key)) byTie.set(key, { legs: [], base: m });
        byTie.get(key).legs.push(m);
      }
      // normalize: sort legs by match_type for consistency
      return Array.from(byTie.values()).map(t => {
        t.legs.sort((a, b) => (a.match_type || "").localeCompare(b.match_type || ""));
        return t;
      });
    }

    // Placeholder generator when empty/partial
    // Pairings: A1-B2, B1-A2, C1-D2, D1-C2, E1-F2, F1-E2, G1-H2, H1-G2
    const GROUPS = ["A","B","C","D","E","F","G","H"];
    function placeholderPair(i) {
      // i = 0..7 for Round of 16
      const pairIndex = Math.floor(i / 2); // 0..3 uses pairs AB, CD, EF, GH
      const a = GROUPS[pairIndex * 2];
      const b = GROUPS[pairIndex * 2 + 1];
      const even = i % 2 === 0;
      return even
        ? { t1: `Group ${a} 1st`, t2: `Group ${b} 2nd` }
        : { t1: `Group ${b} 1st`, t2: `Group ${a} 2nd` };
    }

    // Render one round column
    function renderRound(roundKey) {
      const col = document.createElement("div");
      col.className = "knockout-round";
      const h = document.createElement("h3");
      h.textContent = ROUND_LABELS[roundKey] || roundKey;
      h.style.color = "#fff";
      h.style.textAlign = "center";
      h.style.margin = "0 0 8px";
      col.appendChild(h);

      const roundMatches = byRound.get(roundKey) || [];
      const ties = buildTies(roundMatches);

      // If round is empty (or fewer ties than expected), fill with placeholders (R16 expects 8 ties)
      let expectedTies = 0;
      if (roundKey === "1/8") expectedTies = 8;
      if (roundKey === "1/4") expectedTies = 4;
      if (roundKey === "1/2") expectedTies = 2;
      if (roundKey === "Final") expectedTies = 1;

      // Create cards for existing ties
      ties.forEach((tie, idx) => {
        col.appendChild(renderTieCard(tie, idx, roundKey));
      });

      // Add placeholders if needed (only for 1/8 as requested; others optional)
      if (roundKey === "1/8" && ties.length < expectedTies) {
        for (let i = ties.length; i < expectedTies; i++) {
          const ph = placeholderPair(i);
          col.appendChild(renderPlaceholderCard(ph));
        }
      }

      return col;
    }

    // Render a tie card (supports 1 or 2 legs)
    function renderTieCard(tie, idx, roundKey) {
      const card = document.createElement("div");
      card.className = "ko-card";
      card.style.background = "rgba(255,255,255,0.05)";
      card.style.border = "1px solid rgba(255,255,255,0.1)";
      card.style.borderRadius = "10px";
      card.style.padding = "10px";
      card.style.marginBottom = "10px";

      // Title (optional): Tie number
      const title = document.createElement("div");
      title.textContent = `${ROUND_LABELS[roundKey] || roundKey} — Tie ${idx + 1}`;
      title.style.color = "#bbb";
      title.style.fontSize = "12px";
      title.style.marginBottom = "6px";
      card.appendChild(title);

      // Legs
      tie.legs.forEach((leg, legIdx) => {
        card.appendChild(renderLegRow(leg, editable, players, translation, legIdx + 1));
      });

      // If only one leg present but two-legged round, show a placeholder for the missing leg
      if (roundKey !== "Final" && tie.legs.length === 1) {
        const missing = document.createElement("div");
        missing.style.color = "#888";
        missing.style.fontSize = "12px";
        missing.style.marginTop = "6px";
        missing.textContent = translation.second_leg_pending || "Second leg pending…";
        card.appendChild(missing);
      }

      return card;
    }

    // Render a placeholder card when we don't have matches yet
    function renderPlaceholderCard({ t1, t2 }) {
      const card = document.createElement("div");
      card.className = "ko-card ko-placeholder";
      card.style.background = "rgba(255,255,255,0.03)";
      card.style.border = "1px dashed rgba(255,255,255,0.2)";
      card.style.borderRadius = "10px";
      card.style.padding = "10px";
      card.style.marginBottom = "10px";
      card.style.color = "#bbb";

      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto auto 1fr";
      row.style.alignItems = "center";
      row.style.gap = "6px";

      const t1El = document.createElement("div");
      t1El.textContent = t1;
      const vsEl = document.createElement("div");
      vsEl.textContent = "vs";
      vsEl.style.opacity = "0.7";
      const t2El = document.createElement("div");
      t2El.textContent = t2;

      row.appendChild(t1El);
      row.appendChild(vsEl);
      row.appendChild(t2El);

      card.appendChild(row);
      return card;
    }

    // Render one leg row (team1User, team1Name, score1 | score2, team2Name, team2User)
    function renderLegRow(leg, editable, players, translation, legNumber) {
      const row = document.createElement("div");
      row.className = "ko-leg-row";
      row.dataset.matchId = leg.id;
      row.style.display = "grid";
      row.style.gridTemplateColumns = "minmax(120px,1fr) 90px 40px 40px 90px minmax(120px,1fr)";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.marginBottom = "6px";

      const u1 = document.createElement("select");
      u1.className = "user-dropdown";
      u1.name = "team1_user";
      u1.dataset.teamId = leg.team1_id;
      u1.dataset.initialUsername = leg.team1_username || "";
      u1.disabled = !editable;

      const t1 = document.createElement("div");
      t1.textContent = leg.team1_name || translation.tbd || "TBD";
      t1.style.color = "#fff";

      const s1 = document.createElement("input");
      s1.type = "number";
      s1.className = "score-input";
      s1.name = "team1";
      s1.value = leg.team1_score ?? "";
      s1.disabled = !editable;

      const s2 = document.createElement("input");
      s2.type = "number";
      s2.className = "score-input";
      s2.name = "team2";
      s2.value = leg.team2_score ?? "";
      s2.disabled = !editable;

      const t2 = document.createElement("div");
      t2.textContent = leg.team2_name || translation.tbd || "TBD";
      t2.style.color = "#fff";

      const u2 = document.createElement("select");
      u2.className = "user-dropdown";
      u2.name = "team2_user";
      u2.dataset.teamId = leg.team2_id;
      u2.dataset.initialUsername = leg.team2_username || "";
      u2.disabled = !editable;

      // Leg label (optional)
      const legLbl = document.createElement("div");
      legLbl.textContent = (leg.match_type || "").toUpperCase() || `Leg ${legNumber}`;
      legLbl.style.gridColumn = "1 / -1";
      legLbl.style.color = "#9aa";
      legLbl.style.fontSize = "11px";
      legLbl.style.margin = "2px 0 4px";

      // Populate dropdowns
      const defaultOpt1 = document.createElement("option");
      defaultOpt1.value = "";
      defaultOpt1.textContent = leg.team1_username || (translation.selectUser || "Select Player");
      u1.appendChild(defaultOpt1);

      const defaultOpt2 = document.createElement("option");
      defaultOpt2.value = "";
      defaultOpt2.textContent = leg.team2_username || (translation.selectUser || "Select Player");
      u2.appendChild(defaultOpt2);

      players.forEach(p => {
        const o1 = document.createElement("option");
        o1.value = p.id;
        o1.textContent = p.username;
        u1.appendChild(o1);

        const o2 = document.createElement("option");
        o2.value = p.id;
        o2.textContent = p.username;
        u2.appendChild(o2);
      });

      // set initial selection if exists
      if (leg.team1_username) {
        const found = [...u1.options].find(opt => opt.text.trim() === leg.team1_username.trim());
        if (found) u1.value = found.value;
      }
      if (leg.team2_username) {
        const found = [...u2.options].find(opt => opt.text.trim() === leg.team2_username.trim());
        if (found) u2.value = found.value;
      }

      // assemble row
      row.appendChild(u1);
      row.appendChild(t1);
      row.appendChild(s1);
      row.appendChild(s2);
      row.appendChild(t2);
      row.appendChild(u2);

      // score input guards + save on blur
      if (editable) {
        [s1, s2].forEach(input => {
          input.addEventListener("input", () => {
            if (parseInt(input.value) < 0) input.value = "";
          });
          input.addEventListener("blur", async () => {
            const matchId = parseInt(row.dataset.matchId);
            const val = input.value;
            if (val === "" || isNaN(val) || parseInt(val) < 0) {
              input.value = "";
              return;
            }
            const payload = { matchId };
            if (input.name === "team1") payload.team1_score = parseInt(val);
            if (input.name === "team2") payload.team2_score = parseInt(val);

            try {
              const res = await apiPost("/update-score", payload, { showLoading: false });
              if (res.success) {
                showToast((translation.score_updated || "Score Updated"), "success");
              } else {
                showToast((translation.score_update_failed || "Failed to update score"), "error");
              }
            } catch (e) {
              console.error("Score update error:", e);
            }
          });
        });

        // attach players on change (allow unassign to null)
        [u1, u2].forEach(dd => {
          dd.addEventListener("change", async () => {
            const matchId = parseInt(row.dataset.matchId);
            const teamId = parseInt(dd.dataset.teamId);
            const userId = dd.value ? parseInt(dd.value) : null;

            if (!matchId || !teamId || leagueId == null) return;

            try {
              const res = await apiPost("/attach-players", { matchId, teamId, userId, leagueId }, { showLoading: false });
              if (res.success) {
                showToast(
                  (userId ? (translation.player_success_assigned || "User assigned successfully")
                          : (translation.player_success_unassigned || "User unassigned successfully")),
                  "success"
                );
              } else {
                showToast((translation.player_assign_failed || "Failed to attach user"), "error");
              }
            } catch (e) {
              console.error("Attach player error:", e);
            }
          });
        });
      }

      // Wrap with leg label
      const legWrap = document.createElement("div");
      legWrap.appendChild(legLbl);
      legWrap.appendChild(row);
      return legWrap;
    }

    // Build columns for each round
    ROUND_ORDER.forEach(rk => {
      wrap.appendChild(renderRound(rk));
    });

    // mount
    root.appendChild(wrap);

  } catch (err) {
    console.error("Knockouts fetch/render error:", err);
    root.innerHTML = `<p style="color:#fff">${translation.something_went_wrong || "Something went wrong"}</p>`;
  }
}