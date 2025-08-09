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
  const root = rootEl ?? document.getElementById("knockoutTab") ?? document.getElementById("leagueType2");
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
    const teamCount = Number(data.teamCount) || 32;           // 32 or 64
    const koTeams   = teamCount === 64 ? 32 : 16;              // entrants at first KO round
    const groupsCnt = Math.max(2, Math.min(16, Math.round(teamCount / 4)));
    const GROUPS    = Array.from({ length: groupsCnt }, (_, i) => String.fromCharCode(65 + i));

    // Rounds left -> center (left side) and center -> right (right side mirrored)
    const ROUND_ORDER = koTeams === 32
      ? ["1/16", "1/8", "1/4", "1/2"]   // Final is shown center
      : ["1/8", "1/4", "1/2"];

    const ROUND_LABELS = {
      "1/16": "Round of 32",
      "1/8": "Round of 16",
      "1/4": "Quarter-finals",
      "1/2": "Semi-finals",
      "Final": "Final"
    };

    const EXPECTED_TIES = { "1/16": 16, "1/8": 8, "1/4": 4, "1/2": 2, "Final": 1 };

    const matches = Array.isArray(data.matches) ? data.matches : [];
    const players = (playersRes && playersRes.success) ? (playersRes.data.players || []) : [];

    // --- Group matches by round (fallback to first)
    const firstRound = ROUND_ORDER[0];
    const byRound = new Map();
    for (const m of matches) {
      const r = m.round || firstRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    }

    // --- Build ties within a round (pair legs by match_order)
    function tiesFromMatches(roundMatches) {
      const byTie = new Map();
      for (const m of roundMatches) {
        const key = String(m.match_order ?? m.id);
        if (!byTie.has(key)) byTie.set(key, { legs: [], base: m, order: m.match_order ?? m.id });
        byTie.get(key).legs.push(m);
      }
      const arr = Array.from(byTie.values());
      arr.forEach(t => t.legs.sort((a, b) => (a.match_type || "").localeCompare(b.match_type || "")));
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return arr;
    }

    // --- Placeholder text for first round (A1 vs B2, etc.)
    function placeholderFirstRound(i) {
      const pairIndex = Math.floor(i / 2);   // (A,B), (C,D), ...
      const even = i % 2 === 0;
      const g1 = GROUPS[pairIndex * 2];
      const g2 = GROUPS[pairIndex * 2 + 1];
      if (!g1 || !g2) {
        const n1 = i * 2 + 1, n2 = i * 2 + 2;
        return { t1: `Qualifier ${n1}`, t2: `Qualifier ${n2}` };
      }
      return even
        ? { t1: `Group ${g1} 1st`, t2: `Group ${g2} 2nd` }
        : { t1: `Group ${g2} 1st`, t2: `Group ${g1} 2nd` };
    }

    // --- Split a list of ties into left/right halves (by order)
    function splitLeftRight(ties, expectedForRound) {
      const total = expectedForRound;
      const half  = total / 2;
      const left  = ties.slice(0, half);
      const right = ties.slice(half, total); // may be shorter if missing
      return { left, right };
    }

    // --- Create the bracket frame (left | center | right)
    const frame = document.createElement("div");
    frame.className = "bracket-frame";

    const leftSide   = document.createElement("div"); leftSide.className = "bracket-side left-side";
    const centerSide = document.createElement("div"); centerSide.className = "bracket-center";
    const rightSide  = document.createElement("div"); rightSide.className = "bracket-side right-side";

    frame.appendChild(leftSide);
    frame.appendChild(centerSide);
    frame.appendChild(rightSide);
    root.appendChild(frame);

    // --- Center cup + final placeholder (final is center)
    const cupWrap = document.createElement("div");
    cupWrap.className = "cup-wrap";

    const cupImg = document.createElement("img");
    cupImg.className = "cup-image";
    // Use your own asset path here:
    cupImg.src = "/assets/cup.png";
    cupImg.alt = "Trophy";

    const finalCol = document.createElement("div");
    finalCol.className = "center-final";
    const finalTitle = document.createElement("h3");
    finalTitle.textContent = ROUND_LABELS["Final"];
    finalCol.appendChild(finalTitle);

    // If a final match exists, show it; else show a placeholder “Winner of SF L vs Winner of SF R”
    const finals = byRound.get("Final") ? tiesFromMatches(byRound.get("Final")) : [];
    if (finals.length) {
      finalCol.appendChild(renderTieRowCombined(finals[0], 0, "Final"));
    } else {
      finalCol.appendChild(renderPlaceholderCard({ t1: "Winner Left SF", t2: "Winner Right SF" }));
    }

    centerSide.appendChild(finalCol);
    centerSide.appendChild(cupWrap);
    cupWrap.appendChild(cupImg);

    // --- Render one side (sideKey: "left" or "right")
    function renderSide(sideEl, sideKey) {
      // For each round moving towards center, we need a vertical column
      let prevCount = EXPECTED_TIES[firstRound] / 2; // per side R1 count

      ROUND_ORDER.forEach((rk, roundIdx) => {
        const col = document.createElement("div");
        col.className = `side-round round-${rk.replace("/", "-")}`;
        const title = document.createElement("h3");
        title.textContent = ROUND_LABELS[rk];
        col.appendChild(title);

        // Extract ties for this round, split them by side
        const roundTies = tiesFromMatches(byRound.get(rk) || []);
        const expectedTotal = EXPECTED_TIES[rk] || 0;
        const { left: leftTies, right: rightTies } = splitLeftRight(roundTies, expectedTotal);
        const list = sideKey === "left" ? leftTies : rightTies;
        const expectedOnThisSide = expectedTotal / 2;

        // Render real ties first
        list.forEach((tie, idx) => col.appendChild(renderTieRowCombined(tie, idx, rk)));

        // Then placeholders (only for First Round; for later rounds we show placeholders if you want)
        const needPlaceholders = expectedOnThisSide - list.length;
        if (needPlaceholders > 0) {
          for (let i = list.length; i < expectedOnThisSide; i++) {
            if (rk === firstRound) {
              // placeholder by group pairings, offset i by side to avoid duplicated AB pair ordering issues
              const ph = placeholderFirstRound((sideKey === "left" ? i : i + expectedOnThisSide));
              col.appendChild(renderPlaceholderCard(ph));
            } else {
              col.appendChild(renderPlaceholderCard({ t1: "TBD", t2: "TBD" }));
            }
          }
        }

        sideEl.appendChild(col);

        // for spacing/connector proportions you may want prevCount here; kept for future tuning
        prevCount = expectedOnThisSide / 2;
      });
    }

    // --- Build both sides
    renderSide(leftSide, "left");
    renderSide(rightSide, "right");

    // -------------------- UI RENDERERS --------------------
    function renderPlaceholderCard({ t1, t2 }) {
      const card = document.createElement("div");
      card.className = "ko-card ko-placeholder";
      const row = document.createElement("div");
      row.className = "ko-placeholder-row";
      row.textContent = `${t1}   vs   ${t2}`;
      card.appendChild(row);
      return card;
    }

    // Single-line tie (home+away in one row)
    function renderTieRowCombined(tie, idx, roundKey) {
      const homeLeg = tie.legs.find(l => (l.match_type || "").toLowerCase() === "home");
      const awayLeg = tie.legs.find(l => (l.match_type || "").toLowerCase() === "away");
      const legA = homeLeg || tie.legs[0] || null;
      const legB = awayLeg || (tie.legs.length > 1 ? tie.legs[1] : null);

      const t1Name = (legA && legA.team1_name) || (legB && legB.team1_name) || null;
      const t2Name = (legA && legA.team2_name) || (legB && legB.team2_name) || null;
      if (!t1Name && !t2Name) return document.createDocumentFragment();

      const card = document.createElement("div");
      card.className = "ko-card";

      const row = document.createElement("div");
      row.className = "ko-combined-row";

      // dropdown helpers
      function fillUserSelect(sel, initialUsername) {
        const def = document.createElement("option");
        def.value = "";
        def.textContent = initialUsername || (translation.selectUser || "Select Player");
        sel.appendChild(def);
        players.forEach(p => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.username;
          sel.appendChild(o);
        });
        if (initialUsername) {
          const found = [...sel.options].find(o => o.text.trim() === initialUsername.trim());
          if (found) sel.value = found.value;
        }
      }

      const u1 = document.createElement("select");
      u1.className = "user-dropdown";
      u1.name = "team1_user";
      u1.disabled = !editable;
      fillUserSelect(u1, (legA && legA.team1_username) || (legB && legB.team1_username) || "");

      const u2 = document.createElement("select");
      u2.className = "user-dropdown";
      u2.name = "team2_user";
      u2.disabled = !editable;
      fillUserSelect(u2, (legA && legA.team2_username) || (legB && legB.team2_username) || "");

      const t1 = document.createElement("div");
      t1.className = "team-name";
      t1.textContent = t1Name || (translation.tbd || "TBD");

      const t2 = document.createElement("div");
      t2.className = "team-name";
      t2.textContent = t2Name || (translation.tbd || "TBD");

      function makeScoreInput(match, which) {
        const input = document.createElement("input");
        input.type = "number";
        input.className = "score-input";
        input.disabled = !editable || !match;
        input.value = match ? (which === "t1" ? (match.team1_score ?? "") : (match.team2_score ?? "")) : "";
        input.dataset.matchId = match ? match.id : "";
        input.dataset.which = which;
        return input;
      }

      const h_t1 = makeScoreInput(legA, "t1");
      const h_t2 = makeScoreInput(legA, "t2");
      const a_t1 = makeScoreInput(legB, "t1");
      const a_t2 = makeScoreInput(legB, "t2");

      // save handlers
      if (editable) {
        [h_t1, h_t2, a_t1, a_t2].forEach(input => {
          input.addEventListener("input", () => {
            if (input.value !== "" && parseInt(input.value, 10) < 0) input.value = "";
          });
          input.addEventListener("blur", async () => {
            const matchId = Number(input.dataset.matchId);
            if (!matchId) return;
            const val = input.value;
            if (val === "" || isNaN(+val) || +val < 0) { input.value = ""; return; }
            const payload = { matchId };
            if (input.dataset.which === "t1") payload.team1_score = parseInt(val, 10);
            else payload.team2_score = parseInt(val, 10);
            try {
              const res = await apiPost("/update-score", payload, { showLoading: false });
              showToast(res.success ? (translation.score_updated || "Score Updated")
                                    : (translation.score_update_failed || "Failed to update score"),
                        res.success ? "success" : "error");
            } catch (e) { console.error("Score update error:", e); }
          });
        });

        async function attachBothLegs(sel, teamKey) {
          const userId = sel.value ? parseInt(sel.value, 10) : null;
          const legs = [legA, legB].filter(Boolean);
          for (const leg of legs) {
            try {
              const res = await apiPost("/attach-players", {
                matchId: leg.id,
                teamId: teamKey === "team1" ? leg.team1_id : leg.team2_id,
                userId, leagueId
              }, { showLoading: false });
              if (!res.success) { showToast(translation.player_assign_failed || "Failed to attach user", "error"); return; }
            } catch (e) { console.error("Attach player error:", e); }
          }
          showToast(userId ? (translation.player_success_assigned || "User assigned successfully")
                           : (translation.player_success_unassigned || "User unassigned successfully"),
                    "success");
        }
        u1.addEventListener("change", () => attachBothLegs(u1, "team1"));
        u2.addEventListener("change", () => attachBothLegs(u2, "team2"));
      }

      // layout: [U1][Team1] [H t1][H t2] [A t1][A t2] [Team2][U2]
      row.appendChild(u1);
      row.appendChild(t1);
      row.appendChild(h_t1);
      row.appendChild(h_t2);
      row.appendChild(a_t1);
      row.appendChild(a_t2);
      row.appendChild(t2);
      row.appendChild(u2);

      // leg labels below
      const badges = document.createElement("div");
      badges.className = "ko-leg-badges";
      badges.appendChild(document.createElement("div"));
      badges.appendChild(document.createElement("div"));
      const homeLbl = document.createElement("div"); homeLbl.className = "span-home"; homeLbl.textContent = "HOME LEG";
      const awayLbl = document.createElement("div"); awayLbl.className = "span-away"; awayLbl.textContent = "AWAY LEG";
      badges.appendChild(homeLbl);
      badges.appendChild(awayLbl);
      badges.appendChild(document.createElement("div"));
      badges.appendChild(document.createElement("div"));

      card.appendChild(row);
      card.appendChild(badges);
      return card;
    }

  } catch (err) {
    console.error("Knockouts fetch/render error:", err);
    root.innerHTML = `<p style="color:#fff">${translation.something_went_wrong || "Something went wrong"}</p>`;
  }
}
