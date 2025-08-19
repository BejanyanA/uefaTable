import { showToast } from '../../utils/toast.js';
import { apiPost } from '../../services/api.js';
import { renderNationalInstances } from './renderNationalTable.js';
import { LeagueManager } from '../LeagueManager.js';
import { langMap, currentLang } from '../LanguageManager.js';


// export function renderNationalOnlyKnockoutLeagues(data) {
//   const translation = langMap[currentLang];
//   const section = document.getElementById("leagueType2");
//   const leagues = data.leagues || [];

//   section.innerHTML = ""; // Clear previous content
//   section.style.display = "block";

//   // ✅ Add Back Button to /me
//   const backBtn = document.createElement("button");
//   backBtn.textContent = translation.backButton;
//   backBtn.id = "backBtn";

//   backBtn.addEventListener("click", async () => {
//     const token = localStorage.getItem("authToken");

//     try {
//       const response = await apiGet("/me", token);
//       if (response.success && response.user) {
//         document.getElementById("logoutButtn").style.display = "block";
//         document.getElementById("stageContainer").style.display = "block";
//         document.getElementById("leagueType2").style.display = "none";
//       } else {
//         localStorage.removeItem("authToken");
//         if (authButtons) authButtons.style.display = "flex";
//       }
//     } catch (err) {
//       console.error("🔴 Error in Back button to /me:", err);
//       localStorage.removeItem("authToken");
//       if (authButtons) authButtons.style.display = "flex";
//     }
//   });

//   section.appendChild(backBtn); // Add Back button

//   // ✅ If no leagues
//   if (!leagues.length) {
//     const translation = langMap[currentLang];
//     const noDataMsg = document.createElement("div");
//     noDataMsg.innerHTML = `<h2 id="leagueNotExist">${translation.leagueNotExist || "No leagues found"}</h2>`;
//     noDataMsg.id = "noLeaguedata";
//     section.appendChild(noDataMsg);
//     return;
//   }

//   // ✅ Container for league boxes
//   const rowContainer = document.createElement("div");
//   rowContainer.className = "league-names-row";
//   section.appendChild(rowContainer);

//   leagues.forEach(league => {
//     const leagueRow = document.createElement("div");
//     leagueRow.className = "league-names-row-item";

//     const leagueBox = document.createElement("div");
//     leagueBox.className = "league-name-box";
//     leagueBox.textContent = league.name;
//     leagueBox.style.cursor = "pointer";

//     leagueBox.addEventListener("click", async () => {
//       try {
//         const response = await apiPost("/league-instances", { leagueId: league.id });
//         if (response.success) {
//           localStorage.setItem("leagueId", league.id);
//           renderNationalInstances(response.data);
//         } else {
//           section.innerHTML = `<p>Error loading instances</p>`;
//         }
//       } catch (err) {
//         console.error("Failed to fetch league instances", err);
//       }
//     });

//     leagueRow.appendChild(leagueBox);

//     // 👤 Check owner access
//     const translation = langMap[currentLang];
//     const isOwner = league.accessType === "owner";

//     // ✏️ Edit icon
//     const editIcon = document.createElement("img");
//     editIcon.src = "assets/icons/edit.svg";
//     editIcon.alt = "Edit";
//     editIcon.className = "league-edit-icon";
//     editIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
//     editIcon.title = isOwner ? "" : translation.owner_edit || "Only the owner can edit";
//     if (!isOwner) {
//       editIcon.classList.add("icon-disabled");
//     }
//     editIcon.addEventListener("click", (e) => {
//       e.stopPropagation();
//       if (isOwner) {
//         LeagueManager.initEdit(league.id, league.name);
//       } else {
//         showMobileTooltip(editIcon, "owner_edit");
//       }
//     });


//     // 🗑️ Delete icon
//     const deleteIcon = document.createElement("img");
//     deleteIcon.src = "assets/icons/delete.svg";
//     deleteIcon.alt = "Delete";
//     deleteIcon.className = "league-delete-icon";
//     deleteIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
//     deleteIcon.title = isOwner ? "" : translation.owner_delete || "Only the owner can delete";
//     if (!isOwner) {
//       deleteIcon.classList.add("icon-disabled");
//     }
//     deleteIcon.addEventListener("click", (e) => {
//       e.stopPropagation();
//       if (isOwner) {
//         LeagueManager.initDelete(league.id);
//       } else {
//         showMobileTooltip(deleteIcon, "owner_delete");
//       }
//     });

//     leagueRow.appendChild(editIcon);
//     leagueRow.appendChild(deleteIcon);

//     rowContainer.appendChild(leagueRow);
//   });

//   function showMobileTooltip(targetElement, messageKey) {
//     if (document.querySelector(".mobile-tooltip")) return;

//     const translation = langMap[currentLang];
//     const message =
//       translation[messageKey] ||
//       (messageKey === "owner_edit"
//         ? "Only the owner can edit"
//         : messageKey === "owner_delete"
//           ? "Only the owner can delete"
//           : "Restricted");

//     const tooltip = document.createElement("div");
//     tooltip.className = "mobile-tooltip";
//     tooltip.textContent = message;

//     document.body.appendChild(tooltip);

//     // Get positions
//     const rect = targetElement.getBoundingClientRect();

//     // Adjust: move lower and to the left
//     const verticalOffset = 8;
//     const horizontalOffset = 1;

//     const top = rect.bottom + window.scrollY + verticalOffset;
//     const left = rect.left + window.scrollX - tooltip.offsetWidth - horizontalOffset;

//     tooltip.style.top = `${top}px`;
//     tooltip.style.left = `${left}px`;

//     setTimeout(() => {
//       tooltip.classList.add("show");
//       setTimeout(() => {
//         tooltip.classList.remove("show");
//         setTimeout(() => tooltip.remove(), 300);
//       }, 2000);
//     }, 10);
//   }
// }

export async function renderNationalKnockoutsStage(leagueId, rootEl) {
  const root = rootEl ?? document.getElementById("knockoutTab") ?? document.getElementById("leagueType2");
  root.innerHTML = "";
  const t = langMap[currentLang];

  try {
    const [{ success, data }, playersRes] = await Promise.all([
      apiPost("/national-group-knockouts", { leagueId }),
      apiPost("/national-players", { leagueId }, { showLoading: false }),
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
    const appendSafe = (parent, ...nodes) => {
      nodes.forEach(n => { if (n && n.nodeType) parent.appendChild(n); });
    };


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
      const all = (ties || []).slice();
      const groupsCnt = Math.max(2, GROUPS.length); // A..?
      const expected = expectedPerSide ?? Math.ceil((EXPECTED_TIES[rk] || all.length) / 2);
      const perSide = expected;

      // Round depth from the first knockout round (0 = Ro16/Ro32, 1 = QF, 2 = SF, ...)
      const firstIdx = rounds.indexOf(firstRound);
      const rkIdx = rounds.indexOf(rk);
      const depth = Math.max(0, rkIdx - firstIdx);

      // cluster size used to order ties within a side:
      // Ro16/Ro32 -> 2 (AB, CD, ...)
      // QF        -> 4 (AB vs CD, EF vs GH)
      // SF        -> 8 (A-D vs E-H)
      const clusterSize = Math.pow(2, depth + 1); // 2, 4, 8, ...

      const groupLetterToIndex = (g) => {
        if (!g) return null;
        const m = /group\s*([A-P])/i.exec(g);
        if (!m) return null;
        return m[1].toUpperCase().charCodeAt(0) - 65; // 'A'->0
      };

      // Priority: home->team1, home->team2, away->team1, away->team2
      const primaryGroupIndex = (tie) =>
        groupLetterToIndex(tie?.home?.team1?.groupName) ??
        groupLetterToIndex(tie?.home?.team2?.groupName) ??
        groupLetterToIndex(tie?.away?.team1?.groupName) ??
        groupLetterToIndex(tie?.away?.team2?.groupName) ??
        null;

      // Collect *all* group indices present on the tie (for a stable secondary key)
      const allGroupIdxs = (tie) => {
        const idxs = [];
        const push = (v) => { const i = groupLetterToIndex(v); if (i !== null) idxs.push(i); };
        push(tie?.home?.team1?.groupName);
        push(tie?.home?.team2?.groupName);
        push(tie?.away?.team1?.groupName);
        push(tie?.away?.team2?.groupName);
        idxs.sort((a, b) => a - b);
        return idxs;
      };

      const enriched = all.map(t => {
        const primary = primaryGroupIndex(t);
        const idxs = allGroupIdxs(t);
        const partner = idxs.length > 1 ? idxs[1] : Number.MAX_SAFE_INTEGER;
        const sortBucket = (primary !== null) ? Math.floor(primary / clusterSize) : Number.MAX_SAFE_INTEGER;
        const sideByGroup = (primary !== null) ? (primary < (groupsCnt / 2) ? 'L' : 'R') : null;
        const mo = +t.matchOrder || Number.MAX_SAFE_INTEGER;
        const hId = +(t.home?.id || 0);
        const aId = +(t.away?.id || 0);
        return { t, primary, partner, sortBucket, sideByGroup, mo, hId, aId };
      });

      const left = [], right = [];

      for (const e of enriched) {
        if (e.sideByGroup) {
          (e.sideByGroup === 'L' ? left : right).push(e);
        } else {
          // No group info anywhere -> fallback to previous behavior using matchOrder threshold
          (e.mo >= 1 && e.mo <= perSide ? left : right).push(e);
        }
      }

      // Order inside each side:
      // 1) by sortBucket (AB before CD, EF before GH, etc.)
      // 2) by primary index,
      // 3) by partner index (stable),
      // 4) fallbacks by ids, then matchOrder
      const sortSide = (a, b) => {
        if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
        if (a.primary !== b.primary) return a.primary - b.primary;
        if (a.partner !== b.partner) return a.partner - b.partner;
        if (a.hId !== b.hId) return a.hId - b.hId;
        if (a.aId !== b.aId) return a.aId - b.aId;
        return a.mo - b.mo;
      };

      left.sort(sortSide);
      right.sort(sortSide);

      return { left: left.map(x => x.t), right: right.map(x => x.t), perSide };
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
    const cupSrc = {
      1: "assets/images/champ1.png",
      2: "assets/images/eur2.png",
      3: "assets/images/europ3.png",
      4: "assets/images/wrld4.png",
    }[Number(data.leagueType) || Number(localStorage.getItem("leagueType")) || 1];

    const finalCol = document.createElement("div");
    finalCol.className = "center-final";
    const finalTitle = document.createElement("h3"); finalTitle.textContent = ROUND_LABELS["Final"];
    finalCol.appendChild(finalTitle);

    // ⬇️ old: const finals = byRound.get("Final") || [];
    const finals = byRound.get("Final") || byRound.get("final") || [];
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
      // how many first-round ties per SIDE (4 for R16, 8 for R32)
      const firstRoundTiesTotal =
        EXPECTED_TIES[firstRound] || ((byRound.get(firstRound) || []).length);
      const lanes = Math.max(1, Math.ceil(firstRoundTiesTotal / 2));

      // visual grid config
      const BASE_SPAN = 4;                    // each card spans 4 grid rows
      const ROW_H_PX = 18;                   // height of ONE grid row (tweak to taste)
      const TOTAL_ROWS = lanes * BASE_SPAN;   // total rows in each round column

      rounds
        .filter(r => r !== "Final")
        .forEach((rk, rIdx) => {
          const col = document.createElement("div");
          col.className = `side-round round-${rk.replace("/", "-")}`;

          // Title OUTSIDE the cards grid
          const title = document.createElement("h3");
          title.textContent = ROUND_LABELS[rk];
          col.appendChild(title);

          // Cards grid with FIXED row height & EXACT row count
          const body = document.createElement("div");
          body.className = "round-body";
          body.style.display = "grid";
          body.style.alignContent = "start";
          body.style.gap = "6px";
          body.style.setProperty("--rowH", `${ROW_H_PX}px`);
          body.style.gridTemplateRows = `repeat(${TOTAL_ROWS}, var(--rowH))`;
          col.appendChild(body);

          const tiesAll = byRound.get(rk) || [];
          const expected = EXPECTED_TIES[rk] || tiesAll.length || 0;
          const expectedPerSide = Math.ceil(expected / 2);

          const { left, right, perSide } = splitForRound(tiesAll, rk, firstRound, expectedPerSide);
          const list = sideKey === "left" ? left : right;

          // Build cards (real ties)
          const cards = [];
          const useGroupFallback = (rk === firstRound);

          list.forEach((tie, i) => {
            let ph = null;
            if (rk === firstRound) {
              const baseIndex = (sideKey === "left" ? i : i + perSide);
              ph = placeholderFirstRound(baseIndex);
            }
            const card = renderTie(tie, sideKey, ph, useGroupFallback);
            card.style.margin = "0";                 // grid controls spacing
            cards.push(card);
          });

          // Pad placeholders
          const missing = perSide - list.length;
          if (missing > 0) {
            for (let i = 0; i < missing; i++) {
              let phCard;
              if (rk === firstRound) {
                const indexOnSide = list.length + i;
                const baseIndex = (sideKey === "left" ? indexOnSide : indexOnSide + perSide);
                phCard = renderPlaceholderCard(placeholderFirstRound(baseIndex));
              } else {
                phCard = renderPlaceholderCard({ t1: "TBD", t2: "TBD" });
              }
              phCard.style.margin = "0";
              cards.push(phCard);
            }
          }

          // Precise placement inside FIXED-ROW grid (no title offset needed)
          // startRow = j * (BASE_SPAN * 2^rIdx) + (2^(rIdx+1) - 1)
          cards.forEach((card, j) => {
            const start =
              j * (BASE_SPAN * Math.pow(2, rIdx)) + (Math.pow(2, rIdx + 1) - 1);
            card.style.gridRow = `${start} / span ${BASE_SPAN}`;
            // Let the grid define height; card stretches to its spanned rows
            card.style.height = `calc(var(--rowH) * ${BASE_SPAN})`;
            body.appendChild(card);
          });

          sideEl.appendChild(col);
        });
    }

    // ===== Tie card =====
    function normGroup(g) { return g ? String(g).replace(/\s+/g, '').toUpperCase() : null; }
    function parsePh(phText) {
      if (!phText) return { group: null, rank: null };
      const g = /Group\s+([A-P])/i.exec(phText);
      const r = /([12])(?:st|nd)/i.exec(phText);
      return { group: g ? `Group ${g[1].toUpperCase()}` : null, rank: r ? +r[1] : null };
    }

    function renderTie(tie, sideKey, ph, useGroupFallback = false) {
      const knockoutId = tie?.home?.id ?? tie?.away?.id ?? tie?.id ?? tie?.matchOrder;
      const isFinal = String(tie.round || "").toLowerCase() === "final";
      const { teamA, teamB, draw, homeDone, awayDone } = calcAggregate(tie);

      const card = document.createElement("div");
      card.className = "ko-card ko-row-2";

      // if (tie.winnerTeamId && tie.winnerTeamName) {
      //   const wb = document.createElement("div");
      //   wb.style.textAlign = "center";
      //   wb.style.fontWeight = "700";
      //   wb.style.marginBottom = "4px";
      //   // wb.textContent = `${t.winner || "Winner"}: ${tie.winnerTeamName}`;
      //   card.appendChild(wb);
      // }

      // --- builders ---
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
              // Refresh the page/state after successful request
              await renderNationalKnockoutsStage(leagueId, rootEl);
            } catch (e) {
              console.error(e);
              showToast(t.player_assign_failed || "Failed to attach user", "error");
            }
          });
        }
        return sel;
      };

      // NEW: smarter team label (real name -> group fallback -> TBD)
      function buildTeam(teamObj, position, groupName, phText) {
        const d = document.createElement("div");
        d.className = "team-name";

        const name = teamObj?.name && String(teamObj.name).trim() ? teamObj.name : null;
        const grp = (groupName && String(groupName).trim())
          || (teamObj?.groupName && String(teamObj.groupName).trim())
          || null;

        if (name) {
          d.textContent = name;
        } else if (useGroupFallback && grp) {
          d.textContent = `${grp} Team ${position}`;
          d.classList.add("placeholder-text");
        } else {
          d.textContent = t.tbd || "TBD";
          d.classList.add("placeholder-text");
        }
        return d;
      }

      const buildScore = (leg, which) => {
        const el = document.createElement("input");
        el.type = "number";
        el.className = "score-input";

        const initial = leg?.score ?
          (which === "t1" ? (leg.score.team1 ?? "") : (leg.score.team2 ?? ""))
          : "";
        el.value = initial;
        el.dataset.initial = String(initial);

        // ✅ require BOTH teams to exist
        const hasBothTeams = !!(
          leg?.team1 && (leg.team1.id || (leg.team1.name && leg.team1.name.trim())) &&
          leg?.team2 && (leg.team2.id || (leg.team2.name && leg.team2.name.trim()))
        );

        el.disabled = !editable || !leg?.id || !hasBothTeams;   // ✅ updated
        el.dataset.matchId = leg?.id || "";
        el.dataset.which = which;

        if (editable && leg?.id && hasBothTeams) {              // ✅ updated
          el.addEventListener("input", () => {
            if (el.value !== "" && +el.value < 0) el.value = "";
          });
          el.addEventListener("blur", async () => {
            const matchId = Number(el.dataset.matchId);
            const val = el.value.trim();
            if (!matchId || val === "" || val === el.dataset.initial) return;
            const n = Number(val);
            if (!Number.isFinite(n) || n < 0) return;

            const payload = { matchId };
            if (el.dataset.which === "t1") payload.team1_score = n;
            else payload.team2_score = n;

            try {
              const res = await apiPost("/update-knock-matches", payload, { showLoading: false });
              if (res.success) el.dataset.initial = String(n);
              showToast(
                res.success ? (t.score_updated || "Score Updated") : (t.score_update_failed || "Failed to update score"),
                res.success ? "success" : "error"
              );
              if (res.success) await renderNationalKnockoutsStage(leagueId, rootEl);
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
      const A_top = isFinal ? null : buildScore(tie.away, "t2"); // top row: away.team2
      const A_bottom = isFinal ? null : buildScore(tie.away, "t1"); // bottom row: away.team1

      const u1 = buildUserSelect(teamA, "A");
      const u2 = buildUserSelect(teamB, "B");

      // Try multiple common API keys for group labels; harmless if absent
      const p1 = parsePh(ph?.t1);  // e.g., "Group C 1st"
      const p2 = parsePh(ph?.t2);  // e.g., "Group D 2nd"

      // Decide fallback group for each slot (A = top row, B = bottom row)
      let grpA = teamA?.groupName || tie.home?.team1?.groupName || tie.away?.team2?.groupName || null;
      let grpB = teamB?.groupName || tie.home?.team2?.groupName || tie.away?.team1?.groupName || null;

      if (!grpA || !grpB) {
        const gA = p1.group, gB = p2.group;
        const tb = normGroup(teamB?.groupName);
        const ta = normGroup(teamA?.groupName);
        const ngA = normGroup(gA), ngB = normGroup(gB);

        // If only one side is known, use the paired placeholder group for the other
        if (!grpA) {
          if (tb && ngA && tb === ngA) grpA = gB;
          else if (tb && ngB && tb === ngB) grpA = gA;
          else grpA = gA || grpA; // fallback to ph.t1's group if nothing else
        }
        if (!grpB) {
          if (ta && ngA && ta === ngA) grpB = gB;
          else if (ta && ngB && ta === ngB) grpB = gA;
          else grpB = gB || grpB; // fallback to ph.t2's group if nothing else
        }
      }

      // Build labels (position = 1 for top row, 2 for bottom row)
      const tn1 = buildTeam(
        teamA,
        1,
        grpA,
        ph?.t1 || null  // keep hint for rank if you ever want to use it
      );
      const tn2 = buildTeam(
        teamB,
        2,
        grpB,
        ph?.t2 || null
      );

      // Checkboxes only when both legs have scores AND aggregate draw
      const isNum = v => Number.isFinite(v);
      const h = tie.home?.score || {};
      const a = tie.away?.score || {};

      let canPickWinner;
      if (isFinal) {
        const drawFinal = isNum(h.team1) && isNum(h.team2) && h.team1 === h.team2;
        canPickWinner = editable && drawFinal;
      } else {
        const haveAll = isNum(h.team1) && isNum(h.team2) && isNum(a.team1) && isNum(a.team2);
        const drawAgg = haveAll && (h.team1 + a.team2 === h.team2 + a.team1);
        canPickWinner = editable && drawAgg;
      }

      const cbA = document.createElement("input"); cbA.type = "checkbox"; cbA.className = "winner-checkbox"; cbA.disabled = !canPickWinner;
      const cbB = document.createElement("input"); cbB.type = "checkbox"; cbB.className = "winner-checkbox"; cbB.disabled = !canPickWinner;

      if (canPickWinner) {
        const pick = async (winnerId, otherCb) => {
          try {
            otherCb.checked = false;
            const res = await apiPost("/update-knock-winner", { knockoutId, winner_team_id: winnerId }, { showLoading: false });
            showToast(res.success ? (t.score_updated || "Score Updated")
              : (t.score_update_failed || "Failed to update score"),
              res.success ? "success" : "error");
            // Re-render won't disable the boxes as long as scores remain a draw.
            if (res.success) await renderNationalKnockoutsStage(leagueId, rootEl);
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
        // RIGHT side
        appendSafe(row1, isFinal ? null : A_top, H_top, tn1, u1);
        row1.prepend(cbA);
        appendSafe(row2, isFinal ? null : A_bottom, H_bottom, tn2, u2);
        row2.prepend(cbB);
      } else {
        // LEFT / center
        appendSafe(row1, u1, tn1, H_top, isFinal ? null : A_top, cbA);
        appendSafe(row2, u2, tn2, H_bottom, isFinal ? null : A_bottom, cbB);
      }

      if (tie.winnerTeamId) {
        if (tie.winnerTeamId === teamA?.id) row1.classList.add("winner-row");
        if (tie.winnerTeamId === teamB?.id) row2.classList.add("winner-row");
      }

      card.append(row1, row2);
      return card;
    }
  } catch (err) {
    console.error("Knockouts render error:", err);
    root.innerHTML = `<p style="color:#fff">${t.something_went_wrong || "Something went wrong"}</p>`;
  }
}

export async function renderNationalOnlyKnockouts(leagueId, rootEl) {
  const root = rootEl ?? document.getElementById("knockoutTab") ?? document.getElementById("leagueType2");
  root.innerHTML = "";
  const t = langMap[currentLang];

  try {
    const [{ success, data }, playersRes] = await Promise.all([
      apiPost("/national-round-knockouts", { leagueId }),
      apiPost("/national-players", { leagueId }, { showLoading: false }),
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

    // ---------- helpers ----------
    const normRound = r => String(r || "").toLowerCase().replace(/\s+/g, "");
    const appendSafe = (parent, ...nodes) => nodes.forEach(n => { if (n && n.nodeType) parent.appendChild(n); });
    const teamPresent = tm => !!(tm && (tm.id != null || (tm.name && String(tm.name).trim())));
    const tieHasBothParticipants = m => m && teamPresent(m.team1) && teamPresent(m.team2);

    // Placeholders for the first round (optional, kept same as your base)
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

    // --- bucket matches by round (as delivered by backend) ---
    const byRound = new Map();
    (data.matches || []).forEach(m => {
      const r = m.round || firstRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    });

    // --- map first round team ids to side 'L' | 'R' (for stable placement later) ---
    const firstRoundTies = (byRound.get(firstRound) || [])
      .slice()
      .sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));

    const FR_EXPECTED = EXPECTED_TIES[firstRound] || firstRoundTies.length || 0;
    const FR_PER_SIDE = Math.max(1, Math.ceil(FR_EXPECTED / 2));

    const teamHalf = new Map(); // teamId -> 'L' | 'R'
    firstRoundTies.forEach((m, idx) => {
      const half = (idx < FR_PER_SIDE) ? 'L' : 'R';
      if (m.team1 && m.team1.id != null) teamHalf.set(+m.team1.id, half);
      if (m.team2 && m.team2.id != null) teamHalf.set(+m.team2.id, half);
    });

    // --- side-aware splitter (stable order) ---
    function splitForRound(ties, rk, expectedPerSide) {
      const sorted = (ties || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
      const perSide = expectedPerSide ?? Math.ceil(sorted.length / 2);

      const left = Array(perSide).fill(null);
      const right = Array(perSide).fill(null);

      const place = (arr, idx, t) => {
        // try desired slot, otherwise spill to the next free slot on this side
        if (idx >= 0 && idx < arr.length && arr[idx] == null) { arr[idx] = t; return; }
        for (let i = 0; i < arr.length; i++) if (arr[i] == null) { arr[i] = t; return; }
      };

      const chooseSide = (m) => {
        // vote from known participants (preferred)
        let L = 0, R = 0;
        const vote = (tm) => {
          if (!tm || tm.id == null) return;
          const h = teamHalf.get(+tm.id);
          if (h === 'L') L++;
          else if (h === 'R') R++;
        };
        vote(m.team1); vote(m.team2);
        if (L > R) return 'L';
        if (R > L) return 'R';

        // fallback: derive side from matchOrder block
        const mo = +(m.matchOrder ?? 1);
        const sideBlock = Math.floor((mo - 1) / perSide); // 0 = left block, 1 = right block
        return sideBlock === 0 ? 'L' : 'R';
      };

      for (const t of sorted) {
        const side = chooseSide(t);

        // desired position **inside** the side:
        // 1..N across the whole round -> (mo-1)%perSide gives 0..perSide-1
        const mo = +(t.matchOrder ?? 1);
        const localIdx = ((mo - 1) % perSide + perSide) % perSide;

        if (side === 'R') place(right, localIdx, t);
        else place(left, localIdx, t);
      }

      return { left, right, perSide };
    }

    // --------- side-aware locks ----------
    const locksSide = { left: new Set(), right: new Set() };
    const present = (r) => Array.from(byRound.keys()).some(k => normRound(k) === normRound(r));

    // Lock 1/8 only when that side's SF card has BOTH teams
    if (present("1/2")) {
      const semiTies = byRound.get("1/2") || [];
      const expectedPerSide = Math.ceil((EXPECTED_TIES["1/2"] || semiTies.length) / 2);
      const { left: sfLeft, right: sfRight } = splitForRound(semiTies, "1/2", expectedPerSide);

      if (tieHasBothParticipants(sfLeft.find(Boolean))) locksSide.left.add(normRound("1/8"));
      if (tieHasBothParticipants(sfRight.find(Boolean))) locksSide.right.add(normRound("1/8"));
    }

    // If Final has both teams, lock 1/4 on the side that contains a finalist
    (() => {
      const finalsRaw = byRound.get("Final") || byRound.get("final") || [];
      const finalTie = finalsRaw.find(Boolean);
      if (!finalTie || !tieHasBothParticipants(finalTie)) return;

      const finalIds = new Set(
        [finalTie?.home?.team1, finalTie?.home?.team2, finalTie?.away?.team1, finalTie?.away?.team2]
          .filter(Boolean).map(x => +x.id)
      );

      const semiTies = byRound.get("1/2") || [];
      const expectedPerSide = Math.ceil((EXPECTED_TIES["1/2"] || semiTies.length) / 2);
      const { left: sfLeft, right: sfRight } = splitForRound(semiTies, "1/2", expectedPerSide);

      const sideHasFinalist = (arr) => {
        const t = arr.find(Boolean); if (!t) return false;
        const ids = [t?.home?.team1, t?.home?.team2, t?.away?.team1, t?.away?.team2]
          .filter(Boolean).map(x => +x.id);
        return ids.some(id => finalIds.has(id));
      };

      if (sideHasFinalist(sfLeft)) locksSide.left.add(normRound("1/4"));
      if (sideHasFinalist(sfRight)) locksSide.right.add(normRound("1/4"));
    })();

    // ===== Frame =====
    const frame = document.createElement("div");
    frame.className = "bracket-frame";
    const leftSide = document.createElement("div"); leftSide.className = "bracket-side left-side";
    const centerSide = document.createElement("div"); centerSide.className = "bracket-center";
    const rightSide = document.createElement("div"); rightSide.className = "bracket-side right-side";
    frame.append(leftSide, centerSide, rightSide);
    root.appendChild(frame);

    // Trophy + Final (center)
    const cupSrc = {
      1: "assets/images/champ1.png",
      2: "assets/images/eur2.png",
      3: "assets/images/europ3.png",
      4: "assets/images/wrld4.png",
    }[Number(data.leagueType) || Number(localStorage.getItem("leagueType")) || 1];

    const finalCol = document.createElement("div");
    finalCol.className = "center-final";
    const finalTitle = document.createElement("h3");
    finalTitle.textContent = ROUND_LABELS["Final"];
    finalCol.appendChild(finalTitle);

    const finalsList = byRound.get("Final") || byRound.get("final") || [];
    const finalMatch = finalsList.find(Boolean) || null;
    if (finalMatch) finalCol.appendChild(renderTie(finalMatch, "center"));
    else finalCol.appendChild(renderPlaceholderCard({ t1: "Winner Left SF", t2: "Winner Right SF" }));

    const cupWrap = document.createElement("div");
    cupWrap.className = "cup-wrap";
    const img = document.createElement("img");
    img.className = "cup-image"; img.src = cupSrc; img.alt = "Trophy";
    cupWrap.appendChild(img);
    centerSide.append(finalCol, cupWrap);

    // ===== Sides =====
    renderSide(leftSide, "left");
    renderSide(rightSide, "right");

    function renderSide(sideEl, sideKey) {
      const firstRoundTiesTotal = (EXPECTED_TIES[firstRound] || (byRound.get(firstRound) || []).length);
      const lanes = Math.max(1, Math.ceil(firstRoundTiesTotal / 2));

      const BASE_SPAN = 4;
      const ROW_H_PX = 18;
      const TOTAL_ROWS = lanes * BASE_SPAN;

      rounds.filter(r => r !== "Final").forEach((rk, rIdx) => {
        const col = document.createElement("div");
        col.className = `side-round round-${rk.replace("/", "-")}`;

        const title = document.createElement("h3");
        title.textContent = ROUND_LABELS[rk];
        col.appendChild(title);

        const body = document.createElement("div");
        body.className = "round-body";
        body.style.display = "grid";
        body.style.alignContent = "start";
        body.style.gap = "6px";
        body.style.setProperty("--rowH", `${ROW_H_PX}px`);
        body.style.gridTemplateRows = `repeat(${TOTAL_ROWS}, var(--rowH))`;
        col.appendChild(body);

        // de-dup identical cards (defensive)
        const raw = byRound.get(rk) || [];
        const seen = new Set();
        const tiesAll = [];
        for (const m of raw) {
          const key = String(m?.id ?? `${m.round || rk}:${m.matchOrder}`);
          if (!seen.has(key)) { seen.add(key); tiesAll.push(m); }
        }

        const expected = EXPECTED_TIES[rk] || tiesAll.length || 0;
        const expectedPerSide = Math.ceil(expected / 2);
        const { left, right, perSide } = splitForRound(tiesAll, rk, expectedPerSide);
        const list = sideKey === "left" ? left : right;

        const cards = [];
        for (let i = 0; i < perSide; i++) {
          const match = list[i] || null;
          let card;
          if (match) {
            card = renderTie(match, sideKey, rk === firstRound ? placeholderFirstRound(sideKey === "left" ? i : i + perSide) : null, rk === firstRound);
          } else {
            card = rk === firstRound
              ? renderPlaceholderCard(placeholderFirstRound(sideKey === "left" ? i : i + perSide))
              : renderPlaceholderCard({ t1: "TBD", t2: "TBD" });
          }
          card.style.margin = "0";
          cards.push(card);
        }

        cards.forEach((card, j) => {
          const start = j * (BASE_SPAN * Math.pow(2, rIdx)) + (Math.pow(2, rIdx + 1) - 1);
          card.style.gridRow = `${start} / span ${BASE_SPAN}`;
          card.style.height = `calc(var(--rowH) * ${BASE_SPAN})`;
          body.appendChild(card);
        });

        sideEl.appendChild(col);
      });
    }

    // ---------------- mini refresh helpers (single-leg) ----------------
    const nextRoundOf = (rk) => {
      const i = rounds.indexOf(rk || firstRound);
      return i >= 0 && i + 1 < rounds.length ? rounds[i + 1] : null;
    };
    const tieLikelySettled = (m) => {
      if (m && m.winnerTeamId) return true;
      const s = m?.score || {};
      const isNum = v => Number.isFinite(v);
      return isNum(s.team1) && isNum(s.team2) && s.team1 !== s.team2; // single leg: non-draw decides it
    };

    async function maybeReloadNextRound(tie) {
      const rk = tie?.round || firstRound;
      const rkNorm = normRound(rk);
      const next = nextRoundOf(rk);
      const nextNorm = next ? normRound(next) : null;
      const force = !!tie?.winnerTeamId;

      const collectRound = (roundName, sourceMap) => {
        const rn = normRound(roundName);
        const out = [];
        sourceMap.forEach((v, k) => { if (normRound(k) === rn) out.push(...v); });
        return out;
      };

      const keyOf = (m, fallbackRound) =>
        String(m?.id ?? `${m.round || fallbackRound}:${m.matchOrder}`);

      const idOrName = (x) => (x && (x.id ?? (x.name || ""))) ?? "";

      const sigOf = (m) => {
        const s = m?.score || {};
        return [
          idOrName(m?.team1), idOrName(m?.team2),
          m?.winnerTeamId ?? "",
          Number.isFinite(s.team1) ? s.team1 : "",
          Number.isFinite(s.team2) ? s.team2 : "",
        ].join("|");
      };

      const changed = (oldArr, newArr, fallbackRound) => {
        if (oldArr.length !== newArr.length) return true;
        const oldMap = new Map(oldArr.map(m => [keyOf(m, fallbackRound), sigOf(m)]));
        const newMap = new Map(newArr.map(m => [keyOf(m, fallbackRound), sigOf(m)]));
        if (oldMap.size !== newMap.size) return true;
        for (const [k, v] of oldMap) {
          if (!newMap.has(k) || newMap.get(k) !== v) return true;
        }
        return false;
      };

      try {
        const res = await apiPost("/national-round-knockouts", { leagueId }, { showLoading: false });
        if (!res?.success || !res.data) return;
        const allNew = res.data.matches || [];

        if (nextNorm) {
          const oldNext = collectRound(next, byRound);
          const newNext = allNew.filter(m => normRound(m.round || next) === nextNorm);
          if (changed(oldNext, newNext, next) || force) {
            await renderNationalOnlyKnockouts(leagueId, rootEl);
          }
          return;
        }

        const oldFinal = collectRound("Final", byRound);
        const newFinal = allNew.filter(m => normRound(m.round || "Final") === "final");
        if (changed(oldFinal, newFinal, "Final") || force) {
          await renderNationalOnlyKnockouts(leagueId, rootEl);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // ===== Tie card (single-leg) =====
    function parsePh(phText) {
      if (!phText) return { group: null, rank: null };
      const g = /Group\s+([A-P])/i.exec(phText);
      const r = /([12])(?:st|nd)/i.exec(phText);
      return { group: g ? `Group ${g[1].toUpperCase()}` : null, rank: r ? +r[1] : null };
    }

    function renderTie(match, sideKey, ph, useGroupFallback = false) {
      if (!match) return renderPlaceholderCard({ t1: "TBD", t2: "TBD" });

      const roundKey = normRound(match.round || firstRound);
      const canEdit = editable && !(sideKey === "left" || sideKey === "right")
        ? editable // center (Final) – no side lock
        : !(locksSide[sideKey] && locksSide[sideKey].has(roundKey));

      const knockoutId = match?.id ?? match?.matchOrder;
      const isFinal = String(match.round || "").toLowerCase() === "final";

      const teamA = match.team1 || {};
      const teamB = match.team2 || {};
      const score = match.score || {};

      const card = document.createElement("div");
      card.className = "ko-card ko-row-2";

      const buildUserSelect = (team, role) => {
        const sel = document.createElement("select");
        sel.className = "user-dropdown";
        sel.disabled = !canEdit || !team?.id;

        const def = document.createElement("option");
        def.value = ""; def.textContent = t.selectUser || "Select Player";
        sel.appendChild(def);
        players.forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.username; sel.appendChild(o); });
        if (team?.userId) sel.value = String(team.userId);

        if (canEdit && team?.id) {
          sel.addEventListener("change", async () => {
            try {
              const userId = sel.value ? parseInt(sel.value, 10) : null;
              const teamId = role === "A" ? teamA?.id : teamB?.id;
              await apiPost("/attach-national-round-knock-players", { matchId: knockoutId, teamId, userId, leagueId }, { showLoading: false });
              showToast(userId ? (t.player_success_assigned || "User assigned successfully")
                : (t.player_success_unassigned || "User unassigned successfully"), "success");
              await renderNationalOnlyKnockouts(leagueId, rootEl);
            } catch (e) {
              console.error(e);
              showToast(t.player_assign_failed || "Failed to attach user", "error");
            }
          });
        }
        return sel;
      };

      function buildTeam(teamObj, position, groupName) {
        const d = document.createElement("div");
        d.className = "team-name";
        const name = teamObj?.name && String(teamObj.name).trim() ? teamObj.name : null;
        if (name) d.textContent = name;
        else if (useGroupFallback && groupName) { d.textContent = `${groupName} Team ${position}`; d.classList.add("placeholder-text"); }
        else { d.textContent = t.tbd || "TBD"; d.classList.add("placeholder-text"); }
        return d;
      }

      const buildScore = (which) => {
        const el = document.createElement("input");
        el.type = "number";
        el.className = "score-input";
        const initial = (which === "t1" ? (score.team1 ?? "") : (score.team2 ?? ""));
        el.value = initial;
        el.dataset.initial = String(initial);

        const bothTeamsReady = teamPresent(teamA) && teamPresent(teamB);
        el.disabled = !canEdit || !knockoutId || !bothTeamsReady;
        el.dataset.matchId = knockoutId || "";
        el.dataset.which = which;

        if (canEdit && knockoutId && bothTeamsReady) {
          el.addEventListener("input", () => { if (el.value !== "" && +el.value < 0) el.value = ""; });
          el.addEventListener("blur", async () => {
            const matchId = Number(el.dataset.matchId);
            const val = el.value.trim();
            if (!matchId || val === "" || val === el.dataset.initial) return;
            const n = Number(val);
            if (!Number.isFinite(n) || n < 0) return;

            const payload = { matchId };
            if (el.dataset.which === "t1") payload.team1_score = n; else payload.team2_score = n;

            try {
              const res = await apiPost("/update-national-round-knock-matches", payload, { showLoading: false });
              showToast(res.success ? (t.score_updated || "Score Updated")
                : (t.score_update_failed || "Failed to update score"),
                res.success ? "success" : "error");
              if (res.success) {
                el.dataset.initial = String(n);
                if (!match.score) match.score = {};
                if (which === "t1") match.score.team1 = n; else match.score.team2 = n;
                refreshTieUI();
                if (tieLikelySettled(match)) await maybeReloadNextRound(match);
              }
            } catch (e) { console.error(e); }
          });
        }
        return el;
      };

      const H_top = buildScore("t1");
      const H_bottom = buildScore("t2");
      const u1 = buildUserSelect(teamA, "A");
      const u2 = buildUserSelect(teamB, "B");

      const p1 = parsePh(ph?.t1);
      const p2 = parsePh(ph?.t2);
      const tn1 = buildTeam(teamA, 1, p1.group);
      const tn2 = buildTeam(teamB, 2, p2.group);

      const canPickWinner = (() => {
        const s = match.score || {};
        const isNum = v => Number.isFinite(v);
        return canEdit && isNum(s.team1) && isNum(s.team2) && (s.team1 === s.team2);
      })();

      const cbA = document.createElement("input"); cbA.type = "checkbox"; cbA.className = "winner-checkbox"; cbA.disabled = !canPickWinner;
      const cbB = document.createElement("input"); cbB.type = "checkbox"; cbB.className = "winner-checkbox"; cbB.disabled = !canPickWinner;

      if (canPickWinner) {
        const pick = async (winnerId, otherCb) => {
          try {
            otherCb.checked = false;
            const res = await apiPost("/update-national-round-knock-winner", { knockoutId, winner_team_id: winnerId }, { showLoading: false });
            showToast(res.success ? (t.score_updated || "Score Updated")
              : (t.score_update_failed || "Failed to update score"),
              res.success ? "success" : "error");
            if (res.success) {
              match.winnerTeamId = winnerId;
              refreshTieUI();
              await maybeReloadNextRound(match);
            }
          } catch (e) { console.error(e); }
        };
        cbA.addEventListener("change", () => { if (cbA.checked) pick(teamA?.id, cbB); });
        cbB.addEventListener("change", () => { if (cbB.checked) pick(teamB?.id, cbA); });
      }

      const row1 = document.createElement("div");
      const row2 = document.createElement("div");
      row1.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;
      row2.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;
      row1.classList.add("single-leg");
      row2.classList.add("single-leg");

      function refreshTieUI() {
        const s = match.score || {};
        const isNum = v => Number.isFinite(v);

        cbA.disabled = cbB.disabled = !(canEdit && isNum(s.team1) && isNum(s.team2) && s.team1 === s.team2);

        row1.classList.remove("winner-row");
        row2.classList.remove("winner-row");

        if (match.winnerTeamId) {
          if (match.winnerTeamId === teamA?.id) row1.classList.add("winner-row");
          if (match.winnerTeamId === teamB?.id) row2.classList.add("winner-row");
        } else if (isNum(s.team1) && isNum(s.team2) && s.team1 !== s.team2) {
          (s.team1 > s.team2 ? row1 : row2).classList.add("winner-row");
        }
      }

      if (sideKey === "right") {
        appendSafe(row1, H_top, tn1, u1); row1.prepend(cbA);
        appendSafe(row2, H_bottom, tn2, u2); row2.prepend(cbB);
      } else { // left or center
        appendSafe(row1, u1, tn1, H_top, cbA);
        appendSafe(row2, u2, tn2, H_bottom, cbB);
      }

      refreshTieUI();
      card.append(row1, row2);
      return card;
    }
  } catch (err) {
    console.error("Knockouts render error:", err);
    root.innerHTML = `<p style="color:#fff">${t.something_went_wrong || "Something went wrong"}</p>`;
  }
}