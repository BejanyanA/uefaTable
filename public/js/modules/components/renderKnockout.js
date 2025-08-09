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

    // KO sizing
    const teamCount = Number(data.teamCount) || 32;       // 32 or 64
    const koTeams = teamCount === 64 ? 32 : 16;         // first KO entrants
    const rounds = koTeams === 32 ? ["1/16", "1/8", "1/4", "1/2"] : ["1/8", "1/4", "1/2"];
    const ROUND_LABELS = { "1/16": "Round of 32", "1/8": "Round of 16", "1/4": "Quarter-finals", "1/2": "Semi-finals", "Final": "Final" };
    const EXPECTED_TIES = { "1/16": 16, "1/8": 8, "1/4": 4, "1/2": 2, "Final": 1 };

    // Group labels for first-round placeholders (A..H or A..P)
    const groupsCnt = Math.max(2, Math.min(16, Math.round(teamCount / 4)));
    const GROUPS = Array.from({ length: groupsCnt }, (_, i) => String.fromCharCode(65 + i));

    const matches = Array.isArray(data.matches) ? data.matches : [];
    const players = (playersRes && playersRes.success) ? (playersRes.data.players || []) : [];

    // --- Bucket by round (default to first round if missing)
    const firstRound = rounds[0];
    const byRound = new Map();
    for (const m of matches) {
      const r = m.round || firstRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    }

    // --- Build ties from matches (pair legs by match_order)
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

    // --- Placeholder text for first round (A1 vs B2, B1 vs A2, …)
    function placeholderFirstRound(i) {
      const pair = Math.floor(i / 2);
      const even = (i % 2) === 0;
      const g1 = GROUPS[pair * 2], g2 = GROUPS[pair * 2 + 1];
      if (!g1 || !g2) return { t1: `Qualifier ${i * 2 + 1}`, t2: `Qualifier ${i * 2 + 2}` };
      return even ? { t1: `Group ${g1} 1st`, t2: `Group ${g2} 2nd` }
        : { t1: `Group ${g2} 1st`, t2: `Group ${g1} 2nd` };
    }

    // --- Alternate ties to sides so partial data fills both
    function splitLeftRightAlt(ties) {
      const left = [], right = [];
      ties.forEach((t, i) => (i % 2 === 0 ? left : right).push(t));
      return { left, right };
    }

    // --- Frame (left | center | right)
    const frame = document.createElement("div");
    frame.className = "bracket-frame";
    const leftSide = document.createElement("div"); leftSide.className = "bracket-side left-side";
    const centerSide = document.createElement("div"); centerSide.className = "bracket-center";
    const rightSide = document.createElement("div"); rightSide.className = "bracket-side right-side";
    frame.append(leftSide, centerSide, rightSide);
    root.appendChild(frame);

    // --- Cup by leagueType
    const leagueType = Number(data.leagueType ?? localStorage.getItem("leagueType")) || 1;
    const CUP_MAP = {
      1: "public/assets/images/champ1.png",
      2: "public/assets/images/eur2.png",
      3: "public/assets/images/europ3.png",
      4: "public/assets/images/wrld4.png"
    };
    const cupSrc = CUP_MAP[leagueType] || CUP_MAP[1];

    const finalCol = document.createElement("div");
    finalCol.className = "center-final";
    const finalTitle = document.createElement("h3");
    finalTitle.textContent = ROUND_LABELS["Final"];
    finalCol.appendChild(finalTitle);

    const finals = byRound.get("Final") ? tiesFromMatches(byRound.get("Final")) : [];
    if (finals.length) finalCol.appendChild(renderTieRowOneLine(finals[0], "center", "Final"));
    else finalCol.appendChild(renderPlaceholderCard({ t1: "Winner Left SF", t2: "Winner Right SF" }));

    const cupWrap = document.createElement("div");
    cupWrap.className = "cup-wrap";
    const cupImg = document.createElement("img");
    cupImg.className = "cup-image";
    cupImg.src = cupSrc;
    cupImg.alt = "Trophy";
    cupWrap.appendChild(cupImg);

    centerSide.append(finalCol, cupWrap);

    // --- Render each side
    function renderSide(sideEl, sideKey) {
      rounds.forEach(rk => {
        const col = document.createElement("div");
        col.className = `side-round round-${rk.replace("/", "-")}`;
        const title = document.createElement("h3");
        title.textContent = ROUND_LABELS[rk];
        col.appendChild(title);

        const allTies = tiesFromMatches(byRound.get(rk) || []);
        const { left, right } = splitLeftRightAlt(allTies);
        const list = sideKey === "left" ? left : right;

        // Real ties
        list.forEach((tie) => col.appendChild(renderTieRowOneLine(tie, sideKey, rk)));

        // Placeholders
        const expectedOnSide = (EXPECTED_TIES[rk] || 0) / 2;
        const missing = expectedOnSide - list.length;
        if (missing > 0) {
          for (let i = 0; i < missing; i++) {
            if (rk === firstRound) {
              const baseIndex = (sideKey === "left" ? i : i + expectedOnSide);
              col.appendChild(renderPlaceholderCard(placeholderFirstRound(baseIndex)));
            } else {
              col.appendChild(renderPlaceholderCard({ t1: "TBD", t2: "TBD" }));
            }
          }
        }

        sideEl.appendChild(col);
      });
    }

    renderSide(leftSide, "left");
    renderSide(rightSide, "right");

    // ------------- UI helpers -------------

    function renderPlaceholderCard({ t1, t2 }) {
      const card = document.createElement("div");
      card.className = "ko-card ko-placeholder";
      const row = document.createElement("div");
      row.className = "ko-placeholder-row";
      row.textContent = `${t1}   vs   ${t2}`;
      card.appendChild(row);
      return card;
    }

    // One line per tie.
    // Left:  [U1][T1][H1][H2][A1][A2][T2][U2]
    // Right: [H1][H2][A1][A2][T1][T2][U1][U2]
    // Center final uses left order.
    function renderTieRowOneLine(tie, sideKey, roundKey) {
      const homeLeg = tie.legs.find(l => (l.match_type || "").toLowerCase() === "home");
      const awayLeg = tie.legs.find(l => (l.match_type || "").toLowerCase() === "away");
      const legA = homeLeg || tie.legs[0] || null;                    // home leg if present
      const legB = awayLeg || (tie.legs.length > 1 ? tie.legs[1] : null); // away leg if present

      const t1Name = (legA?.team1_name) || (legB?.team1_name) || null;
      const t2Name = (legA?.team2_name) || (legB?.team2_name) || null;
      if (!t1Name && !t2Name) return document.createDocumentFragment();

      const card = document.createElement("div");
      card.className = "ko-card ko-row-2";

      function buildUserSelect(initialUsername) {
        const sel = document.createElement("select");
        sel.className = "user-dropdown";
        sel.disabled = !editable;
        const def = document.createElement("option");
        def.value = ""; def.textContent = initialUsername || (translation.selectUser || "Select Player");
        sel.appendChild(def);
        players.forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.username; sel.appendChild(o); });
        if (initialUsername) {
          const found = [...sel.options].find(o => o.text.trim() === initialUsername.trim());
          if (found) sel.value = found.value;
        }
        return sel;
      }
      function buildTeam(name) {
        const d = document.createElement("div");
        d.className = "team-name"; d.textContent = name || (translation.tbd || "TBD"); return d;
      }
      function buildScoreInput(match, which) {
        const el = document.createElement("input"); el.type = "number"; el.className = "score-input";
        el.disabled = !editable || !match;
        el.value = match ? (which === "t1" ? (match.team1_score ?? "") : (match.team2_score ?? "")) : "";
        el.dataset.matchId = match ? match.id : "";
        el.dataset.which = which;
        return el;
      }

      const u1 = buildUserSelect(legA?.team1_username || legB?.team1_username || "");
      const u2 = buildUserSelect(legA?.team2_username || legB?.team2_username || "");
      const t1 = buildTeam(t1Name);
      const t2 = buildTeam(t2Name);

      // Scores (exactly four inputs: two legs x two teams)
      const H1 = buildScoreInput(legA, "t1");  // Team1 home
      const H2 = buildScoreInput(legA, "t2");  // Team2 home
      const A1 = buildScoreInput(legB, "t1");  // Team1 away
      const A2 = buildScoreInput(legB, "t2");  // Team2 away

      // Row containers
      const row1 = document.createElement("div");
      const row2 = document.createElement("div");
      row1.className = `ko-team-row ${sideKey}`;
      row2.className = `ko-team-row ${sideKey}`;

      if (sideKey === "right") {
        // rotated: scores → team → dropdowns
        row1.append(H1, A1, t1, u1);
        row2.append(A2, H2, t2, u2);
      } else {
        // desired: dropdowns → team → scores (home then away for T1; away then home for T2)
        row1.append(u1, t1, H1, A1); // Team1: Home, then Away
        row2.append(u2, t2, A2, H2); // Team2: Away, then Home
      }

      // Save handlers (same logic, just bind once)
      if (editable) {
        [H1, H2, A1, A2].forEach(input => {
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
            } catch (e) { console.error(e); }
          });
        });

        const attach = async (sel, legs, teamKey) => {
          const userId = sel.value ? parseInt(sel.value, 10) : null;
          for (const leg of legs.filter(Boolean)) {
            const body = { matchId: leg.id, teamId: teamKey === "team1" ? leg.team1_id : leg.team2_id, userId, leagueId };
            const res = await apiPost("/attach-players", body, { showLoading: false });
            if (!res.success) { showToast(translation.player_assign_failed || "Failed to attach user", "error"); return; }
          }
          showToast(userId ? (translation.player_success_assigned || "User assigned successfully")
            : (translation.player_success_unassigned || "User unassigned successfully"),
            "success");
        };
        u1.addEventListener("change", () => attach(u1, [homeLeg, awayLeg], "team1"));
        u2.addEventListener("change", () => attach(u2, [homeLeg, awayLeg], "team2"));
      }

      card.append(row1, row2);
      return card;
    }
  } catch (err) {
    console.error("Knockouts fetch/render error:", err);
    root.innerHTML = `<p style="color:#fff">${translation.something_went_wrong || "Something went wrong"}</p>`;
  }
}