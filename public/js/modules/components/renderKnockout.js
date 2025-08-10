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

    const editable   = data.accessType === "owner";
    const teamCount  = Number(data.teamCount) || 32;             // 32 or 64
    const koTeams    = teamCount === 64 ? 32 : 16;               // first KO entrants
    const rounds     = koTeams === 32 ? ["1/16","1/8","1/4","1/2"] : ["1/8","1/4","1/2"];
    const firstRound = rounds[0];
    const ROUND_LABELS  = { "1/16":"Round of 32","1/8":"Round of 16","1/4":"Quarter-finals","1/2":"Semi-finals","Final":"Final" };
    const EXPECTED_TIES = { "1/16":16,"1/8":8,"1/4":4,"1/2":2,"Final":1 };

    // Groups for first-round placeholders (A..H or A..P)
    const groupsCnt = Math.max(2, Math.min(16, Math.round(teamCount / 4)));
    const GROUPS = Array.from({ length: groupsCnt }, (_, i) => String.fromCharCode(65 + i));

    const matches = Array.isArray(data.matches) ? data.matches : [];
    const players = (playersRes && playersRes.success) ? (playersRes.data.players || []) : [];

    // All API matches belong to the first round (API has no round field)
    const byRound = new Map();
    byRound.set(firstRound, [...matches]);

    // ---------------- Tie building (IGNORE match_order; pair by unordered team IDs) ----------------
    function pairKeyFromMatch(m) {
      const aId = (typeof m.team1_id === "number") ? m.team1_id : null;
      const bId = (typeof m.team2_id === "number") ? m.team2_id : null;

      if (aId != null && bId != null) {
        const lo = Math.min(aId, bId);
        const hi = Math.max(aId, bId);
        return `id:${lo}-${hi}`; // same tie even if legs swap sides
      }

      // Fallback by names if IDs missing
      const a = (m.team1_name || "").trim().toLowerCase();
      const b = (m.team2_name || "").trim().toLowerCase();
      const [lo, hi] = [a, b].sort();
      return `nm:${lo}::${hi}`;
    }

    function tiesFromMatches(roundMatches) {
      const byTie = new Map();
      for (const m of (roundMatches || [])) {
        const key = pairKeyFromMatch(m);
        if (!byTie.has(key)) {
          // order for stable sorting: lowest team ID then highest (or name)
          const aId = (typeof m.team1_id === "number") ? m.team1_id : Number.MAX_SAFE_INTEGER;
          const bId = (typeof m.team2_id === "number") ? m.team2_id : Number.MAX_SAFE_INTEGER;
          const lo = Math.min(aId, bId), hi = Math.max(aId, bId);
          byTie.set(key, { key, orderA: lo, orderB: hi, legs: [] });
        }
        byTie.get(key).legs.push(m);
      }
      const arr = Array.from(byTie.values());

      // sort legs so “home” then “away” when present; otherwise keep insertion order
      arr.forEach(t => {
        t.legs.sort((a, b) => {
          const ah = String(a.match_type || "").toLowerCase();
          const bh = String(b.match_type || "").toLowerCase();
          const ra = ah === "home" ? 0 : ah === "away" ? 1 : 2;
          const rb = bh === "home" ? 0 : bh === "away" ? 1 : 2;
          return ra - rb;
        });
      });

      // sort ties by IDs (or fallback lexicographically by names through key)
      arr.sort((x, y) => (x.orderA - y.orderA) || (x.orderB - y.orderB) || x.key.localeCompare(y.key));
      return arr;
    }

    // --- Placeholder text for first round (A1 vs B2, B1 vs A2, …)
    function placeholderFirstRound(i) {
      const pair = Math.floor(i / 2);
      const even = (i % 2) === 0;
      const g1 = GROUPS[pair*2], g2 = GROUPS[pair*2+1];
      if (!g1 || !g2) return { t1:`Qualifier ${i*2+1}`, t2:`Qualifier ${i*2+2}` };
      return even ? { t1:`Group ${g1} 1st`, t2:`Group ${g2} 2nd` }
                  : { t1:`Group ${g2} 1st`, t2:`Group ${g1} 2nd` };
    }

    // Alternate ties to sides so partial data fills both
    function splitLeftRightAlt(ties) {
      const left = [], right = [];
      ties.forEach((t,i)=> (i%2===0 ? left : right).push(t));
      return { left, right };
    }

    // --- Frame (left | center | right)
    const frame = document.createElement("div");
    frame.className = "bracket-frame";
    const leftSide   = document.createElement("div"); leftSide.className  = "bracket-side left-side";
    const centerSide = document.createElement("div"); centerSide.className= "bracket-center";
    const rightSide  = document.createElement("div"); rightSide.className = "bracket-side right-side";
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
    finalCol.appendChild(renderPlaceholderCard({ t1: "Winner Left SF", t2: "Winner Right SF" }));

    const cupWrap = document.createElement("div");
    cupWrap.className = "cup-wrap";
    const cupImg = document.createElement("img");
    cupImg.className = "cup-image";
    cupImg.src = cupSrc; cupImg.alt = "Trophy";
    cupWrap.appendChild(cupImg);
    centerSide.append(finalCol, cupWrap);

    // --- Render each side
    function renderSide(sideEl, sideKey) {
      rounds.forEach(rk => {
        const col = document.createElement("div");
        col.className = `side-round round-${rk.replace("/","-")}`;
        const title = document.createElement("h3");
        title.textContent = ROUND_LABELS[rk];
        col.appendChild(title);

        // Real ties only for the first round; others are placeholders
        const baseMatches = rk === firstRound ? (byRound.get(firstRound) || []) : [];
        const allTies = tiesFromMatches(baseMatches);
        const { left, right } = splitLeftRightAlt(allTies);
        const list = sideKey === "left" ? left : right;

        // Render real ties
        list.forEach((tie) => col.appendChild(renderTieTwoRows(tie, sideKey)));

        // Fill placeholders up to expected bracket size
        const expected = EXPECTED_TIES[rk] || 0; // Round of 16 -> 8 ties
        const totalThisRound = rk === firstRound ? Math.max(allTies.length, expected) : expected;
        const perSide = Math.ceil(totalThisRound / 2);
        const missing = perSide - list.length;

        if (missing > 0) {
          for (let i = 0; i < missing; i++) {
            if (rk === firstRound) {
              const baseIndex = (sideKey === "left" ? i : i + perSide);
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

    // -------- UI helpers --------
    function renderPlaceholderCard({ t1, t2 }) {
      const card = document.createElement("div");
      card.className = "ko-card ko-placeholder";
      const row = document.createElement("div");
      row.className = "ko-placeholder-row";
      row.textContent = `${t1}   vs   ${t2}`;
      card.appendChild(row);
      return card;
    }

    // Two-row compact card per tie.
    // Left  side:  row1 [U1][T1][H1][A1]   row2 [U2][T2][A2][H2]
    // Right side:  row1 [H1][A1][T1][U1]   row2 [A2][H2][T2][U2]
    function renderTieTwoRows(tie, sideKey) {
      // Prefer explicit home/away legs; if only one leg present, show that leg and leave the other inputs disabled
      const homeLeg = tie.legs.find(l => String(l.match_type).toLowerCase() === "home") || null;
      const awayLeg = tie.legs.find(l => String(l.match_type).toLowerCase() === "away") || null;
      const anyLeg  = homeLeg || awayLeg || tie.legs[0] || null;

      const t1Name = (homeLeg?.team1_name) || (awayLeg?.team1_name) || (anyLeg?.team1_name) || null;
      const t2Name = (homeLeg?.team2_name) || (awayLeg?.team2_name) || (anyLeg?.team2_name) || null;

      const card = document.createElement("div");
      card.className = "ko-card ko-row-2";

      function buildUserSelect(initialUsername){
        const sel = document.createElement("select");
        sel.className = "user-dropdown";
        sel.disabled = !editable;
        const def = document.createElement("option");
        def.value=""; def.textContent = initialUsername || (translation.selectUser || "Select Player");
        sel.appendChild(def);
        players.forEach(p => { const o=document.createElement("option"); o.value=p.id; o.textContent=p.username; sel.appendChild(o); });
        if (initialUsername) {
          const found = [...sel.options].find(o => o.text.trim()===initialUsername.trim());
          if (found) sel.value = found.value;
        }
        return sel;
      }
      const safe = (v) => (v && String(v).trim()) || (translation.tbd || "TBD");
      function buildTeam(name){
        const d = document.createElement("div");
        d.className="team-name"; d.textContent=safe(name); return d;
      }
      function buildScoreInput(match, which){
        const el = document.createElement("input"); el.type="number"; el.className="score-input";
        el.disabled = !editable || !match;
        el.value = match ? (which==="t1" ? (match.team1_score ?? "") : (match.team2_score ?? "")) : "";
        el.dataset.matchId = match ? match.id : "";
        el.dataset.which = which;
        return el;
      }

      // usernames (from either leg if present)
      const u1 = buildUserSelect((homeLeg?.team1_username) || (awayLeg?.team1_username) || (anyLeg?.team1_username) || "");
      const u2 = buildUserSelect((homeLeg?.team2_username) || (awayLeg?.team2_username) || (anyLeg?.team2_username) || "");
      const t1 = buildTeam(t1Name);
      const t2 = buildTeam(t2Name);

      // Scores (four inputs; those lacking a leg are disabled)
      const H1 = buildScoreInput(homeLeg, "t1");
      const H2 = buildScoreInput(homeLeg, "t2");
      const A1 = buildScoreInput(awayLeg, "t1");
      const A2 = buildScoreInput(awayLeg, "t2");

      const row1 = document.createElement("div");
      const row2 = document.createElement("div");
      row1.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;
      row2.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;

      if (sideKey === "right") {
        row1.append(H1, A1, t1, u1);
        row2.append(A2, H2, t2, u2);
      } else {
        row1.append(u1, t1, H1, A1);
        row2.append(u2, t2, A2, H2);
      }

      if (editable) {
        [H1, H2, A1, A2].forEach(input => {
          input.addEventListener("input", () => {
            if (input.value !== "" && parseInt(input.value,10) < 0) input.value = "";
          });
          input.addEventListener("blur", async () => {
            const matchId = Number(input.dataset.matchId);
            if (!matchId) return;
            const val = input.value;
            if (val === "" || isNaN(+val) || +val < 0) { input.value = ""; return; }
            const payload = { matchId };
            if (input.dataset.which === "t1") payload.team1_score = parseInt(val,10);
            else payload.team2_score = parseInt(val,10);
            try {
              const res = await apiPost("/update-score", payload, { showLoading:false });
              showToast(res.success ? (translation.score_updated || "Score Updated")
                                    : (translation.score_update_failed || "Failed to update score"),
                        res.success ? "success" : "error");
            } catch(e){ console.error(e); }
          });
        });

        const attach = async (sel, legs, teamKey) => {
          const userId = sel.value ? parseInt(sel.value,10) : null;
          for (const leg of legs.filter(Boolean)) {
            const body = { matchId: leg.id, teamId: teamKey==="team1" ? leg.team1_id : leg.team2_id, userId, leagueId };
            const res = await apiPost("/attach-players", body, { showLoading:false });
            if (!res.success) { showToast(translation.player_assign_failed || "Failed to attach user","error"); return; }
          }
          showToast(userId ? (translation.player_success_assigned || "User assigned successfully")
                           : (translation.player_success_unassigned || "User unassigned successfully"),
                    "success");
        };
        // attach to both legs (home and away) when user changes
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