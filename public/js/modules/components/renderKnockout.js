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
  const t = langMap[currentLang];

  try {
    const [{ success, data }, playersRes] = await Promise.all([
      apiPost("/group-knockouts", { leagueId }),
      apiPost("/league-players", { leagueId }, { showLoading: false }),
    ]);
    if (!success || !data) {
      root.innerHTML = `<p style="color:#fff">${t.not_found || "Knockout data not found"}</p>`;
      return;
    }

    const editable = data.accessType === "owner";
    const teamCount = Number(data.teamCount) || 32;
    const koTeams = teamCount === 64 ? 32 : 16;
    const rounds = koTeams === 32 ? ["1/16", "1/8", "1/4", "1/2", "Final"] : ["1/8", "1/4", "1/2", "Final"];
    const firstRound = rounds[0];

    const ROUND_LABELS = { "1/16": "Round of 32", "1/8": "Round of 16", "1/4": "Quarter-finals", "1/2": "Semi-finals", "Final": "Final" };
    const EXPECTED_TIES = { "1/16": 16, "1/8": 8, "1/4": 4, "1/2": 2, "Final": 1 };
    const players = (playersRes && playersRes.success) ? (playersRes.data.players || []) : [];

    // ---------- Helpers (declare BEFORE anything uses them) ----------
    const getNameOrNull = v => (v && String(v).trim()) || null;   // return null if missing
    const toNum = n => (n == null || isNaN(n)) ? 0 : +n;

    function splitLeftRightAlt(arr) { const L = [], R = []; arr.forEach((x, i) => (i % 2 === 0 ? L : R).push(x)); return { left: L, right: R }; }

    function scoresFilled(leg) {
      return !!(leg && leg.score &&
        typeof leg.score.team1 === "number" &&
        typeof leg.score.team2 === "number");
    }

    function calcAggregate(tie) {
      const H = tie.home?.score || {};
      const A = tie.away?.score || {};
      const teamA = tie.home?.team1 || tie.away?.team2 || {};
      const teamB = tie.home?.team2 || tie.away?.team1 || {};

      // Aggregate uses: A = home.t1 + away.t2,  B = home.t2 + away.t1
      const aggA = (typeof H.team1 === "number" ? H.team1 : 0) + (typeof A.team2 === "number" ? A.team2 : 0);
      const aggB = (typeof H.team2 === "number" ? H.team2 : 0) + (typeof A.team1 === "number" ? A.team1 : 0);

      const homeDone = scoresFilled(tie.home);
      const awayDone = scoresFilled(tie.away);
      const draw = homeDone && awayDone && aggA === aggB;

      return { teamA, teamB, aggA, aggB, draw, homeDone, awayDone };
    }

    // First-round placeholders (A1 vs B2, then B1 vs A2, …)
    const groupsCnt = Math.max(2, Math.min(16, Math.round(teamCount / 4)));
    const GROUPS = Array.from({ length: groupsCnt }, (_, i) => String.fromCharCode(65 + i));
    function placeholderFirstRound(i) {
      const pair = Math.floor(i / 2);
      const even = (i % 2) === 0;
      const g1 = GROUPS[pair * 2], g2 = GROUPS[pair * 2 + 1];
      if (!g1 || !g2) return { t1: `Qualifier ${i * 2 + 1}`, t2: `Qualifier ${i * 2 + 2}` };
      return even ? { t1: `Group ${g1} 1st`, t2: `Group ${g2} 2nd` }
        : { t1: `Group ${g2} 1st`, t2: `Group ${g1} 2nd` };
    }

    function renderPlaceholderCard({ t1, t2 }) {
      const card = document.createElement("div");
      card.className = "ko-card ko-placeholder";
      const row = document.createElement("div");
      row.className = "ko-placeholder-row";
      row.textContent = `${t1}   vs   ${t2}`;
      card.appendChild(row);
      return card;
    }
    
    function splitForRound(ties, rk, firstRound, expectedPerSide) {
      // Always work on a sorted copy
      const sorted = (ties || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));

      if (rk === firstRound) {
        // Block split for the opening KO round:
        // left = first half (A..D or A..H), right = second half (E..H or I..P)
        const perSide = expectedPerSide ?? Math.ceil(sorted.length / 2);
        return { left: sorted.slice(0, perSide), right: sorted.slice(perSide), perSide };
      }

      // Later rounds: keep alternating so both sides fill nicely
      const left = [], right = [];
      sorted.forEach((t, i) => (i % 2 === 0 ? left : right).push(t));
      const perSide = expectedPerSide ?? Math.ceil(sorted.length / 2);
      return { left, right, perSide };
    }

    // Bucket ties by round
    const byRound = new Map();
    (data.matches || []).forEach(m => {
      const r = m.round || firstRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    });

    // Frame
    const frame = document.createElement("div");
    frame.className = "bracket-frame";
    const leftSide = document.createElement("div"); leftSide.className = "bracket-side left-side";
    const centerSide = document.createElement("div"); centerSide.className = "bracket-center";
    const rightSide = document.createElement("div"); rightSide.className = "bracket-side right-side";
    frame.append(leftSide, centerSide, rightSide);
    root.appendChild(frame);

    // Cup + Final
    const cupSrc = ({
      1: "public/assets/images/champ1.png",
      2: "public/assets/images/eur2.png",
      3: "public/assets/images/europ3.png",
      4: "public/assets/images/wrld4.png",
    })[Number(data.leagueType) || Number(localStorage.getItem("leagueType")) || 1];

    const finalCol = document.createElement("div");
    finalCol.className = "center-final";
    const finalTitle = document.createElement("h3"); finalTitle.textContent = ROUND_LABELS["Final"];
    finalCol.appendChild(finalTitle);
    const finals = byRound.get("Final") || [];
    if (finals.length) finalCol.appendChild(renderTie(finals[0], "center"));
    else finalCol.appendChild(renderPlaceholderCard({ t1: "Winner Left SF", t2: "Winner Right SF" }));

    const cupWrap = document.createElement("div");
    cupWrap.className = "cup-wrap";
    const img = document.createElement("img");
    img.className = "cup-image"; img.src = cupSrc; img.alt = "Trophy";
    cupWrap.appendChild(img);
    centerSide.append(finalCol, cupWrap);

    // Sides
    renderSide(leftSide, "left");
    renderSide(rightSide, "right");

    function renderSide(sideEl, sideKey) {
      rounds.filter(r => r !== "Final").forEach(rk => {
        const col = document.createElement("div");
        col.className = `side-round round-${rk.replace("/", "-")}`;
        const title = document.createElement("h3"); title.textContent = ROUND_LABELS[rk];
        col.appendChild(title);

        const tiesAll = byRound.get(rk) || [];
        const expected = EXPECTED_TIES[rk] || tiesAll.length || 0;
        const expectedPerSide = Math.ceil(expected / 2);

        // Use block split for the first round, alternating for later rounds
        const { left, right, perSide } = splitForRound(tiesAll, rk, firstRound, expectedPerSide);
        const list = sideKey === "left" ? left : right;

        // Real ties
        list.forEach(tie => col.appendChild(renderTie(tie, sideKey)));

        // Pad placeholders up to bracket width
        const missing = (perSide) - list.length;
        if (missing > 0) {
          for (let i = 0; i < missing; i++) {
            if (rk === firstRound) {
              // Index so that A..D land on left and E..H (or I..P) on right
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

    // ===== Tie card =====
    function renderTie(tie, sideKey) {
      // Must send the knockout id from /group-knockouts
      const knockoutId = tie.id ?? tie.matchOrder;

      const { teamA, teamB, draw, homeDone, awayDone } = calcAggregate(tie);

      const card = document.createElement("div");
      card.className = "ko-card ko-row-2";

      if (tie.winnerTeamId && tie.winnerTeamName) {
        const wb = document.createElement("div");
        wb.style.textAlign = "center";
        wb.style.fontWeight = "700";
        wb.style.marginBottom = "4px";
        wb.textContent = `${t.winner || "Winner"}: ${tie.winnerTeamName}`;
        card.appendChild(wb);
      }

      // --- builders (unchanged) ---
      const buildUserSelect = (team, role) => {
        const sel = document.createElement("select");
        sel.className = "user-dropdown";
        sel.disabled = !editable || !team?.id;

        const def = document.createElement("option");
        def.value = ""; def.textContent = t.selectUser || "Select Player";
        sel.appendChild(def);
        players.forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.username; sel.appendChild(o); });
        if (team?.userId) sel.value = String(team.userId);

        if (editable && team?.id) {
          sel.addEventListener("change", async () => {
            const userId = sel.value ? parseInt(sel.value, 10) : null;
            const legs = [];
            if (tie.home?.id) legs.push({ matchId: tie.home.id, teamId: role === "A" ? tie.home?.team1?.id : tie.home?.team2?.id });
            if (tie.away?.id) legs.push({ matchId: tie.away.id, teamId: role === "A" ? tie.away?.team2?.id : tie.away?.team1?.id });
            try {
              for (const l of legs.filter(x => x.matchId && x.teamId)) {
                await apiPost("/attach-knock-players", { matchId: l.matchId, teamId: l.teamId, userId, leagueId }, { showLoading: false });
              }
              showToast(userId ? (t.player_success_assigned || "User assigned successfully")
                : (t.player_success_unassigned || "User unassigned successfully"),
                "success");
            } catch (e) { console.error(e); showToast(t.player_assign_failed || "Failed to attach user", "error"); }
          });
        }
        return sel;
      };

      const buildTeam = (name) => {
        const d = document.createElement("div");
        d.className = "team-name";
        d.textContent = getNameOrNull(name) ?? (t.tbd || "TBD");
        return d;
      };

      const buildScore = (leg, which) => {
        const el = document.createElement("input"); el.type = "number"; el.className = "score-input";
        const initial = leg?.score ? (which === "t1" ? (leg.score.team1 ?? "") : (leg.score.team2 ?? "")) : "";
        el.value = initial; el.dataset.initial = String(initial);
        el.disabled = !editable || !leg?.id;
        el.dataset.matchId = leg?.id || ""; el.dataset.which = which;

        if (editable && leg?.id) {
          el.addEventListener("input", () => { if (el.value !== "" && +el.value < 0) el.value = ""; });
          el.addEventListener("blur", async () => {
            const matchId = Number(el.dataset.matchId);
            const val = el.value.trim();
            if (!matchId) return;
            if (val === "") return;
            if (val === el.dataset.initial) return;
            const n = Number(val);
            if (!Number.isFinite(n) || n < 0) return;

            const payload = { matchId };
            if (el.dataset.which === "t1") payload.team1_score = n; else payload.team2_score = n;

            try {
              const res = await apiPost("/update-knock-matches", payload, { showLoading: false });
              if (res.success) el.dataset.initial = String(n);
              showToast(res.success ? (t.score_updated || "Score Updated")
                : (t.score_update_failed || "Failed to update score"),
                res.success ? "success" : "error");
            } catch (e) { console.error(e); }
          });
        }
        return el;
      };

      // --- score inputs mapped to your vertical/column rules ---
      // Home leg (same matchId for both cells)
      const H_top = buildScore(tie.home, "t1"); // top row: home.team1
      const H_bottom = buildScore(tie.home, "t2"); // bottom row: home.team2

      // Away leg (same matchId for both cells) — note the flip
      const A_top = buildScore(tie.away, "t2"); // top row: away.team2
      const A_bottom = buildScore(tie.away, "t1"); // bottom row: away.team1

      const u1 = buildUserSelect(teamA, "A");
      const u2 = buildUserSelect(teamB, "B");
      const tn1 = buildTeam(teamA?.name);
      const tn2 = buildTeam(teamB?.name);

      // Checkboxes only when both legs have scores AND aggregate draw
      const canPickWinner = editable && !tie.winnerTeamId && homeDone && awayDone && draw;
      const cbA = document.createElement("input"); cbA.type = "checkbox"; cbA.className = "winner-checkbox"; cbA.disabled = !canPickWinner;
      const cbB = document.createElement("input"); cbB.type = "checkbox"; cbB.className = "winner-checkbox"; cbB.disabled = !canPickWinner;

      if (canPickWinner) {
        const pick = async (winnerId, otherCb) => {
          try {
            otherCb.checked = false;
            const res = await apiPost("/update-winner", { knockoutId, winner_team_id: winnerId }, { showLoading: false });
            showToast(res.success ? (t.score_updated || "Score Updated")
              : (t.score_update_failed || "Failed to update score"),
              res.success ? "success" : "error");
          } catch (e) { console.error(e); }
        };
        cbA.addEventListener("change", () => { if (cbA.checked) pick(teamA?.id, cbB); });
        cbB.addEventListener("change", () => { if (cbB.checked) pick(teamB?.id, cbA); });
      }

      // --- rows ---
      const row1 = document.createElement("div");
      const row2 = document.createElement("div");
      row1.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;
      row2.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;

      if (sideKey === "right") {
        // RIGHT: [CB][Home(top)][Away(top)][Team][User]
        row1.append(H_top, A_top, tn1, u1); row1.prepend(cbA);
        // RIGHT: [CB][Home(bottom)][Away(bottom)][Team][User]
        row2.append(H_bottom, A_bottom, tn2, u2); row2.prepend(cbB);
      } else {
        // LEFT: [User][Team][Home(top)][Away(top)][CB]
        row1.append(u1, tn1, H_top, A_top, cbA);
        // LEFT: [User][Team][Home(bottom)][Away(bottom)][CB]
        row2.append(u2, tn2, H_bottom, A_bottom, cbB);
      }

      card.append(row1, row2);
      return card;
    }
  } catch (err) {
    console.error("Knockouts render error:", err);
    root.innerHTML = `<p style="color:#fff">${t.something_went_wrong || "Something went wrong"}</p>`;
  }
}