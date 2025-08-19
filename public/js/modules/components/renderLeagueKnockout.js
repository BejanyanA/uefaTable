import { showToast } from '../../utils/toast.js';
import { apiPost } from '../../services/api.js';
import { renderLeagueInstances } from './renderLeagueTable.js';
import { LeagueManager } from '../LeagueManager.js';
import { langMap, currentLang } from '../LanguageManager.js';


// export function renderLeagueOnlyKnockoutLeagues(data) {
//   const translation = langMap[currentLang];
//   const section = document.getElementById("leagueType1");
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
//         document.getElementById("leagueType1").style.display = "none";
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
//           renderLeagueInstances(response.data); // Need to change from renderLeagueInstances to another for only knockout 
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

export async function renderLeagueKnockoutsStage(leagueId, rootEl) {
  const root = rootEl ?? document.getElementById("knockoutTab") ?? document.getElementById("leagueType1");
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


    // Helper for rendering if needed
    const nextRoundOf = (rk) => {
      const i = rounds.indexOf(rk || firstRound);
      return i >= 0 && i + 1 < rounds.length ? rounds[i + 1] : null;
    };

    const tieLikelySettled = (tie) => {
      if (tie && tie.winnerTeamId) return true;

      const H = tie?.home?.score || {};
      const A = tie?.away?.score || {};
      const isNum = v => Number.isFinite(v);

      const isFinal = String(tie?.round || "").toLowerCase() === "final";
      if (isFinal) return isNum(H.team1) && isNum(H.team2) && H.team1 !== H.team2;

      const haveAll = isNum(H.team1) && isNum(H.team2) && isNum(A.team1) && isNum(A.team2);
      if (!haveAll) return false;
      const aggA = (H.team1 || 0) + (A.team2 || 0);
      const aggB = (H.team2 || 0) + (A.team1 || 0);
      return aggA !== aggB;
    };

    // 🔁 Re-render only when the *next* round actually changed (ids/participants/winner/scores)
    // Works for all rounds (incl. Final) and handles "Final"/"final" casing.
    async function maybeReloadNextRound(tie) {
      const rk = tie?.round || firstRound;
      const next = nextRoundOf(rk);
      if (!next) return;

      const nextNorm = normRound(next);

      // Gather "old" next-round ties from byRound using normalized keys
      const getRoundList = (roundName, sourceMap) => {
        const rn = normRound(roundName);
        const out = [];
        sourceMap.forEach((list, key) => { if (normRound(key) === rn) out.push(...list); });
        return out;
      };
      const oldNext = getRoundList(next, byRound);

      const keyOf = (m) =>
        String(m?.home?.id ?? m?.away?.id ?? m?.id ?? `${m.round || next}:${m.matchOrder}`);

      const idOrName = (x) => (x && (x.id ?? (x.name || ""))) ?? "";

      const sigOf = (m) => {
        const H = m?.home || {}, A = m?.away || {};
        const hs = H.score || {}, as = A.score || {};
        return [
          idOrName(H.team1), idOrName(H.team2),
          idOrName(A.team1), idOrName(A.team2),
          m?.winnerTeamId ?? "",
          // include scores so next-round score changes also trigger refresh
          Number.isFinite(hs.team1) ? hs.team1 : "",
          Number.isFinite(hs.team2) ? hs.team2 : "",
          Number.isFinite(as.team1) ? as.team1 : "",
          Number.isFinite(as.team2) ? as.team2 : "",
        ].join("|");
      };

      try {
        const res = await apiPost("/group-knockouts", { leagueId }, { showLoading: false });
        if (!res?.success || !res.data) return;

        // "New" next-round ties (normalized)
        const newerNext = (res.data.matches || []).filter(
          m => normRound(m.round || next) === nextNorm
        );

        // Count change → re-render
        if (newerNext.length !== oldNext.length) {
          await renderLeagueKnockoutsStage(leagueId, rootEl);
          return;
        }

        // Signature change → re-render
        const oldMap = new Map(oldNext.map(m => [keyOf(m), sigOf(m)]));
        const newMap = new Map(newerNext.map(m => [keyOf(m), sigOf(m)]));

        if (oldMap.size !== newMap.size) {
          await renderLeagueKnockoutsStage(leagueId, rootEl);
          return;
        }
        for (const [k, oldSig] of oldMap) {
          if (!newMap.has(k) || newMap.get(k) !== oldSig) {
            await renderLeagueKnockoutsStage(leagueId, rootEl);
            return;
          }
        }
        // no material change → keep local UI

      } catch (e) {
        console.error(e);
      }
    }


    const editable = data.accessType === "owner";
    const teamCount = Number(data.teamCount) || 32;
    const koTeams = teamCount === 64 ? 32 : 16;
    const rounds = koTeams === 32 ? ["1/16", "1/8", "1/4", "1/2", "Final"] : ["1/8", "1/4", "1/2", "Final"];
    const firstRound = rounds[0];

    const ROUND_LABELS = { "1/16": "Round of 32", "1/8": "Round of 16", "1/4": "Quarter-finals", "1/2": "Semi-finals", "Final": "Final" };
    const EXPECTED_TIES = { "1/16": 16, "1/8": 8, "1/4": 4, "1/2": 2, "Final": 1 };
    const players = (playersRes && playersRes.success) ? (playersRes.data.players || []) : [];

    // ---------- Helpers ----------
    const getNameOrNull = v => (v && String(v).trim()) || null;
    const toNum = n => (n == null || isNaN(n)) ? 0 : +n;
    const appendSafe = (parent, ...nodes) => { nodes.forEach(n => { if (n && n.nodeType) parent.appendChild(n); }); };
    const letterOf = (g) => { const m = /group\s*([A-P])/i.exec(g || ""); return m ? m[1].toUpperCase() : null; };
    const normRound = r => String(r || '').toLowerCase().replace(/\s+/g, '');

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

    // -------- core: split for round (first round by groups; others unchanged) --------
    function splitForRound(ties, rk, firstRound, expectedPerSide) {
      const all = (ties || []).slice();
      const expected = expectedPerSide ?? Math.ceil((EXPECTED_TIES[rk] || all.length) / 2);
      const perSide = expected;

      const letterOf = (g) => {
        const m = /group\s*([A-P])/i.exec(g || "");
        return m ? m[1].toUpperCase() : null;
      };

      // ===== FIRST ROUND (Ro16/Ro32): place by group letters (A–D left, E–H right) =====
      if (rk === firstRound) {
        const pairCountTotal = Math.floor(GROUPS.length / 2);   // AB, CD, EF, GH, ...
        const pairsPerSide = Math.ceil(pairCountTotal / 2);   // 2 for Ro16
        const leftSlots = Array(perSide).fill(null);
        const rightSlots = Array(perSide).fill(null);

        for (const t of all) {
          // collect any letters
          const letters = [
            letterOf(t?.home?.team1?.groupName),
            letterOf(t?.home?.team2?.groupName),
            letterOf(t?.away?.team1?.groupName),
            letterOf(t?.away?.team2?.groupName),
          ].filter(Boolean);

          let sideArr, globalPairIdx;
          if (letters.length) {
            const gIdx = letters.map(ch => ch.charCodeAt(0) - 65).sort((a, b) => a - b)[0];
            const pairIdx = Math.floor(gIdx / 2);
            const isLeft = pairIdx < pairsPerSide;
            sideArr = isLeft ? leftSlots : rightSlots;
            globalPairIdx = pairIdx;
          } else {
            // no group info → fallback to original matchOrder side mapping, but keep to this side
            const mo = +(t.matchOrder || Number.MAX_SAFE_INTEGER);
            sideArr = (mo >= 1 && mo <= perSide) ? leftSlots : rightSlots;
            const idxWithinSide = ((mo - 1) % perSide + perSide) % perSide;
            const bucketIdxWithinSide = Math.floor(idxWithinSide / 2);
            globalPairIdx = (sideArr === leftSlots)
              ? bucketIdxWithinSide
              : bucketIdxWithinSide + pairsPerSide;
          }

          const firstLetter = GROUPS[globalPairIdx * 2];       // e.g. 'E'
          const secondLetter = GROUPS[globalPairIdx * 2 + 1];   // e.g. 'F'
          const base = ((globalPairIdx % pairsPerSide) * 2);    // start index inside this side (0,2,...)

          // Decide which tie in the pair we have
          let target = base;

          // Read group letters from home first; if missing, fall back to away.
          // (away.team2 maps to home.team1; away.team1 maps to home.team2)
          let h1L = letterOf(t?.home?.team1?.groupName) || letterOf(t?.away?.team2?.groupName);
          let h2L = letterOf(t?.home?.team2?.groupName) || letterOf(t?.away?.team1?.groupName);

          // Normal case: firstLetter present
          if (h1L === firstLetter) target = base;        // A1–B2
          else if (h2L === firstLetter) target = base + 1;    // B1–A2
          // Fallback when only secondLetter is present (firstLetter team not yet known)
          else if (h1L === secondLetter) target = base + 1;    // B1–A2
          else if (h2L === secondLetter) target = base;        // A1–B2

          // Place with a small collision fallback inside the pair
          if (sideArr[target] == null) sideArr[target] = t;
          else if (target === base && sideArr[base + 1] == null) sideArr[base + 1] = t;
          else if (target === base + 1 && sideArr[base] == null) sideArr[base] = t;
          else {
            let p = base;
            while (p < Math.min(base + 2, sideArr.length) && sideArr[p] != null) p++;
            if (p < base + 2) sideArr[p] = t;
          }
        }

        return { left: leftSlots, right: rightSlots, perSide };
      }

      // ===== OTHER ROUNDS =====
      const groupsCnt = Math.max(2, GROUPS.length);
      const firstIdx = rounds.indexOf(firstRound);
      const rkIdx = rounds.indexOf(rk);
      const depth = Math.max(0, rkIdx - firstIdx);
      const clusterSize = Math.pow(2, depth + 1); // AB=2, QF:4, SF:8 ...

      // Only use group buckets when they actually split into ≥2 buckets across the whole tree.
      const useGroupBuckets = clusterSize < groupsCnt;

      const groupLetterToIndex = (g) => {
        if (!g) return null;
        const m = /group\s*([A-P])/i.exec(g);
        if (!m) return null;
        return m[1].toUpperCase().charCodeAt(0) - 65;
      };
      const primaryGroupIndex = (tie) =>
        groupLetterToIndex(tie?.home?.team1?.groupName) ??
        groupLetterToIndex(tie?.home?.team2?.groupName) ??
        groupLetterToIndex(tie?.away?.team1?.groupName) ??
        groupLetterToIndex(tie?.away?.team2?.groupName) ??
        null;

      const bucketOf = (gIdx) => (gIdx === null ? null : Math.floor(gIdx / clusterSize));

      const leftSlots = Array(perSide).fill(null);
      const rightSlots = Array(perSide).fill(null);
      const leftCounts = new Map();
      const rightCounts = new Map();
      const halfBuckets = Math.ceil((groupsCnt / clusterSize) / 2);

      for (const t of all) {
        if (!useGroupBuckets) {
          // Prefer side by any present team group letter (A–D → left, E–H → right)
          const letters = [
            letterOf(t?.home?.team1?.groupName),
            letterOf(t?.home?.team2?.groupName),
            letterOf(t?.away?.team1?.groupName),
            letterOf(t?.away?.team2?.groupName),
          ].filter(Boolean);

          const half = Math.ceil(GROUPS.length / 2);
          let sideArr;

          if (letters.length) {
            const idxs = letters.map(ch => ch.charCodeAt(0) - 65); // 'A'->0
            const minIdx = Math.min(...idxs);
            sideArr = (minIdx < half) ? leftSlots : rightSlots;     // A–D left, E–H right
          } else {
            // no group hints → fallback to simple balancing
            const leftFree = leftSlots.some(x => x === null);
            const rightFree = rightSlots.some(x => x === null);
            sideArr = leftFree ? leftSlots : (rightFree ? rightSlots : leftSlots);
          }

          // If chosen side is full (edge case), spill to the other side
          const other = (sideArr === leftSlots) ? rightSlots : leftSlots;
          if (sideArr.every(x => x !== null) && other.some(x => x === null)) {
            sideArr = other;
          }

          // place compactly on that side
          let pos = sideArr.findIndex(x => x === null);
          if (pos === -1) pos = sideArr.length - 1;
          sideArr[pos] = t;
          continue;
        }

        const pIdx = primaryGroupIndex(t);
        const bucket = bucketOf(pIdx);

        if (bucket === null) {
          // fallback: choose side by matchOrder, but spill to the other side if chosen is full
          const mo = +(t.matchOrder || Number.MAX_SAFE_INTEGER);
          let sideArr = (mo >= 1 && mo <= perSide) ? leftSlots : rightSlots;
          const other = (sideArr === leftSlots) ? rightSlots : leftSlots;

          if (sideArr.every(x => x !== null) && other.some(x => x === null)) {
            sideArr = other;
          }
          let pos = sideArr.findIndex(x => x === null);
          if (pos === -1) pos = sideArr.length - 1;
          sideArr[pos] = t;
          continue;
        }

        // --- deterministic slot inside the bucket ---
        // For QF: clusterSize = 4, so two pairs per bucket:
        //   - first pair (E/F or A/B)  -> index 0 within the bucket
        //   - second pair (G/H or C/D) -> index 1 within the bucket
        const isLeftSide = bucket < halfBuckets;
        const localBucket = isLeftSide ? bucket : (bucket - halfBuckets);
        const sideArr = isLeftSide ? leftSlots : rightSlots;

        // Relative index within this bucket (0..clusterSize-1)
        const rel = (pIdx % clusterSize);

        // 0 for the first pair in the bucket (AB or EF), 1 for the second (CD or GH)
        const pairWithinBucket = Math.floor(rel / (clusterSize / 2)); // 0 or 1

        // Two ties per bucket on a side → positions base 0/2/4... within that side
        const pos = Math.min(localBucket * 2 + pairWithinBucket, sideArr.length - 1);

        // Place with a tiny collision fallback
        if (sideArr[pos] == null) {
          sideArr[pos] = t;
        } else {
          let p = pos;
          while (p < sideArr.length && sideArr[p] != null) p++;
          if (p < sideArr.length) sideArr[p] = t;
        }
      }

      return { left: leftSlots, right: rightSlots, perSide };
    }

    // Bucket ties by round
    const byRound = new Map();
    (data.matches || []).forEach(m => {
      const r = m.round || firstRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    });

    // --- side-aware locks ---
    const locksGlobal = new Set();                           // applies to both sides (e.g. Final -> lock 1/4)
    const locksSide = { left: new Set(), right: new Set() };
    const present = (r) => Array.from(byRound.keys()).some(k => normRound(k) === normRound(r));

    const teamPresent = (tm) => !!(tm && (tm.id != null || (tm.name && String(tm.name).trim())));
    const tieHasBothParticipants = (tie) => {
      if (!tie) return false;
      const top = tie?.home?.team1 || tie?.away?.team2;
      const bottom = tie?.home?.team2 || tie?.away?.team1;
      return teamPresent(top) && teamPresent(bottom);
    };

    // Lock 1/8 per side ONLY when that side’s SF has both teams
    if (present("1/2")) {
      const semiTies = byRound.get("1/2") || [];
      const expectedPerSide = Math.ceil((EXPECTED_TIES["1/2"] || semiTies.length) / 2);

      // Use the correct signature for your file:
      const { left: sfLeft, right: sfRight } = splitForRound(semiTies, "1/2", firstRound, expectedPerSide); // group-knockouts

      if (tieHasBothParticipants(sfLeft.find(Boolean))) locksSide.left.add(normRound("1/8"));
      if (tieHasBothParticipants(sfRight.find(Boolean))) locksSide.right.add(normRound("1/8"));
    }

    // If Final has both teams, lock 1/4 only on the side that contains a finalist
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

      // Use the correct signature for your file:
      const { left: sfLeft, right: sfRight } = splitForRound(semiTies, "1/2", firstRound, expectedPerSide); // group-knockouts

      const sideHasFinalist = (arr) => {
        const t = arr.find(Boolean); if (!t) return false;
        const ids = [t?.home?.team1, t?.home?.team2, t?.away?.team1, t?.away?.team2]
          .filter(Boolean).map(x => +x.id);
        return ids.some(id => finalIds.has(id));
      };

      if (sideHasFinalist(sfLeft)) locksSide.left.add(normRound("1/4"));
      if (sideHasFinalist(sfRight)) locksSide.right.add(normRound("1/4"));
    })();

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

    // finals (null-safe)
    const finalsRaw = byRound.get("Final") || byRound.get("final") || [];
    const finalTie = finalsRaw.find(Boolean) || null;
    if (finalTie) finalCol.appendChild(renderTie(finalTie, "center"));
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
      const firstRoundTiesTotal = EXPECTED_TIES[firstRound] || ((byRound.get(firstRound) || []).length);
      const lanes = Math.max(1, Math.ceil(firstRoundTiesTotal / 2));

      const BASE_SPAN = 4;
      const ROW_H_PX = 18;
      const TOTAL_ROWS = lanes * BASE_SPAN;

      rounds
        .filter(r => r !== "Final")
        .forEach((rk, rIdx) => {
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

          const tiesAll = byRound.get(rk) || [];
          const expected = EXPECTED_TIES[rk] || tiesAll.length || 0;
          const expectedPerSide = Math.ceil(expected / 2);

          const { left, right, perSide } = splitForRound(tiesAll, rk, firstRound, expectedPerSide);
          const list = sideKey === "left" ? left : right;

          // Build cards aligned to fixed slots
          const cards = [];
          const useGroupFallback = (rk === firstRound);

          for (let i = 0; i < perSide; i++) {
            const tie = list[i]; // can be null
            let ph = null;
            if (rk === firstRound) {
              const baseIndex = (sideKey === "left" ? i : i + perSide);
              ph = placeholderFirstRound(baseIndex);
            }
            const card = renderTie(tie, sideKey, ph, useGroupFallback);
            card.style.margin = "0";
            cards.push(card);
          }

          // Precise placement inside FIXED-ROW grid
          cards.forEach((card, j) => {
            const start = j * (BASE_SPAN * Math.pow(2, rIdx)) + (Math.pow(2, rIdx + 1) - 1);
            card.style.gridRow = `${start} / span ${BASE_SPAN}`;
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
      // null-safe: if empty slot → placeholder card
      if (!tie) return renderPlaceholderCard(ph || { t1: "TBD", t2: "TBD" });

      const roundKey = normRound(tie.round || firstRound);
      const sideLockSet =
        sideKey === "left" ? locksSide.left :
          sideKey === "right" ? locksSide.right : null;
      const isLocked = (sideLockSet ? sideLockSet.has(roundKey) : false) || locksGlobal.has(roundKey);
      const canEdit = editable && !isLocked;

      const knockoutId = tie?.home?.id ?? tie?.away?.id ?? tie?.id ?? tie?.matchOrder;
      const isFinal = String(tie.round || "").toLowerCase() === "final";
      const { teamA, teamB, draw, homeDone, awayDone } = calcAggregate(tie);

      const card = document.createElement("div");
      card.className = "ko-card ko-row-2";

      // --- builders ---
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
              await renderLeagueKnockoutsStage(leagueId, rootEl);
            } catch (e) {
              console.error(e);
              showToast(t.player_assign_failed || "Failed to attach user", "error");
            }
          });
        }
        return sel;
      };

      function buildTeam(teamObj, position, groupName, phText) {
        const d = document.createElement("div");
        d.className = "team-name";
        const name = teamObj?.name && String(teamObj.name).trim() ? teamObj.name : null;
        const grp = (groupName && String(groupName).trim())
          || (teamObj?.groupName && String(teamObj.groupName).trim())
          || null;

        if (name) d.textContent = name;
        else if (useGroupFallback && grp) { d.textContent = `${grp} Team ${position}`; d.classList.add("placeholder-text"); }
        else { d.textContent = t.tbd || "TBD"; d.classList.add("placeholder-text"); }
        return d;
      }

      const buildScore = (leg, which) => {
        const el = document.createElement("input");
        el.type = "number";
        el.className = "score-input";

        const initial = leg?.score ? (which === "t1" ? (leg.score.team1 ?? "") : (leg.score.team2 ?? "")) : "";
        el.value = initial;
        el.dataset.initial = String(initial);

        const hasBothTeams = !!(
          leg?.team1 && (leg.team1.id || (leg.team1.name && leg.team1.name.trim())) &&
          leg?.team2 && (leg.team2.id || (leg.team2.name && leg.team2.name.trim()))
        );

        el.disabled = !canEdit || !leg?.id || !hasBothTeams;
        el.dataset.matchId = leg?.id || "";
        el.dataset.which = which;

        if (canEdit && leg?.id && hasBothTeams) {
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
              const res = await apiPost("/update-knock-matches", payload, { showLoading: false });
              if (res.success) el.dataset.initial = String(n);
              showToast(res.success ? (t.score_updated || "Score Updated") : (t.score_update_failed || "Failed to update score"),
                res.success ? "success" : "error");

              if (res.success) el.dataset.initial = String(n);
              if (!leg.score) leg.score = {};
              if (el.dataset.which === "t1") leg.score.team1 = n; else leg.score.team2 = n;
              refreshTieUI();;

              if (tieLikelySettled(tie)) {
                await maybeReloadNextRound(tie);
              }
            } catch (e) { console.error(e); }
          });
        }
        return el;
      };

      // score inputs
      const H_top = buildScore(tie.home, "t1");
      const H_bottom = buildScore(tie.home, "t2");
      const A_top = isFinal ? null : buildScore(tie.away, "t2");
      const A_bottom = isFinal ? null : buildScore(tie.away, "t1");

      const u1 = buildUserSelect(teamA, "A");
      const u2 = buildUserSelect(teamB, "B");

      const p1 = parsePh(ph?.t1);
      const p2 = parsePh(ph?.t2);

      let grpA = teamA?.groupName || tie.home?.team1?.groupName || tie.away?.team2?.groupName || null;
      let grpB = teamB?.groupName || tie.home?.team2?.groupName || tie.away?.team1?.groupName || null;

      if (!grpA || !grpB) {
        const gA = p1.group, gB = p2.group;
        const tb = normGroup(teamB?.groupName);
        const ta = normGroup(teamA?.groupName);
        const ngA = normGroup(gA), ngB = normGroup(gB);
        if (!grpA) { if (tb && ngA && tb === ngA) grpA = gB; else if (tb && ngB && tb === ngB) grpA = gA; else grpA = gA || grpA; }
        if (!grpB) { if (ta && ngA && ta === ngA) grpB = gB; else if (ta && ngB && ta === ngB) grpB = gA; else grpB = gB || grpB; }
      }

      const tn1 = buildTeam(teamA, 1, grpA, ph?.t1 || null);
      const tn2 = buildTeam(teamB, 2, grpB, ph?.t2 || null);

      const isNum = v => Number.isFinite(v);
      const h = tie.home?.score || {};
      const a = tie.away?.score || {};

      let canPickWinner;
      if (isFinal) {
        const drawFinal = isNum(h.team1) && isNum(h.team2) && h.team1 === h.team2;
        canPickWinner = canEdit && drawFinal;
      } else {
        const haveAll = isNum(h.team1) && isNum(h.team2) && isNum(a.team1) && isNum(a.team2);
        const drawAgg = haveAll && (h.team1 + a.team2 === h.team2 + a.team1);
        canPickWinner = canEdit && drawAgg;
      }

      const cbA = document.createElement("input"); cbA.type = "checkbox"; cbA.className = "winner-checkbox"; cbA.disabled = !canPickWinner;
      const cbB = document.createElement("input"); cbB.type = "checkbox"; cbB.className = "winner-checkbox"; cbB.disabled = !canPickWinner;

      if (canPickWinner) {
        const pick = async (winnerId, otherCb) => {
          try {
            otherCb.checked = false;
            const res = await apiPost("/update-knock-winner", { knockoutId, winner_team_id: winnerId }, { showLoading: false });
            showToast(res.success ? (t.score_updated || "Score Updated") : (t.score_update_failed || "Failed to update score"),
              res.success ? "success" : "error");

            if (res.success) tie.winnerTeamId = winnerId; // patch local model
            refreshTieUI();
            await maybeReloadNextRound(tie);

          } catch (e) { console.error(e); }
        };
        cbA.addEventListener("change", () => { if (cbA.checked) pick(teamA?.id, cbB); });
        cbB.addEventListener("change", () => { if (cbB.checked) pick(teamB?.id, cbA); });
      }

      const row1 = document.createElement("div");
      const row2 = document.createElement("div");
      row1.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;
      row2.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;


      function refreshTieUI() {
        // Re-read scores from the tie object (they may have just changed)
        const H = tie.home?.score || {};
        const A = tie.away?.score || {};
        const isNum = v => Number.isFinite(v);

        // Enable/disable winner checkboxes
        let canPick;
        if (isFinal) {
          const drawFinal = isNum(H.team1) && isNum(H.team2) && H.team1 === H.team2;
          canPick = editable && drawFinal;
        } else {
          const haveAll = isNum(H.team1) && isNum(H.team2) && isNum(A.team1) && isNum(A.team2);
          const drawAgg = haveAll && ((H.team1 || 0) + (A.team2 || 0) === (H.team2 || 0) + (A.team1 || 0));
          canPick = editable && drawAgg;
        }
        cbA.disabled = cbB.disabled = !canPick;

        // Winner highlight
        row1.classList.remove('winner-row');
        row2.classList.remove('winner-row');

        if (tie.winnerTeamId) {
          if (tie.winnerTeamId === (tie.home?.team1?.id || tie.away?.team2?.id)) row1.classList.add('winner-row');
          if (tie.winnerTeamId === (tie.home?.team2?.id || tie.away?.team1?.id)) row2.classList.add('winner-row');
        } else {
          if (isFinal && isNum(H.team1) && isNum(H.team2) && H.team1 !== H.team2) {
            (H.team1 > H.team2 ? row1 : row2).classList.add('winner-row');
          } else if (!isFinal && isNum(H.team1) && isNum(H.team2) && isNum(A.team1) && isNum(A.team2)) {
            const aggA = (H.team1 || 0) + (A.team2 || 0);
            const aggB = (H.team2 || 0) + (A.team1 || 0);
            if (aggA !== aggB) (aggA > aggB ? row1 : row2).classList.add('winner-row');
          }
        }
      }

      if (sideKey === "right") {
        appendSafe(row1, isFinal ? null : A_top, H_top, tn1, u1); row1.prepend(cbA);
        appendSafe(row2, isFinal ? null : A_bottom, H_bottom, tn2, u2); row2.prepend(cbB);
      } else {
        appendSafe(row1, u1, tn1, H_top, isFinal ? null : A_top, cbA);
        appendSafe(row2, u2, tn2, H_bottom, isFinal ? null : A_bottom, cbB);
      }

      refreshTieUI();

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



export async function renderLeagueOnlyKnockouts(leagueId, rootEl) {
  const root = rootEl ?? document.getElementById("knockoutTab") ?? document.getElementById("leagueType1");
  root.innerHTML = "";
  const t = langMap[currentLang];

  try {
    const [{ success, data }, playersRes] = await Promise.all([
      apiPost("/round-knockouts", { leagueId }),
      apiPost("/league-players", { leagueId }, { showLoading: false }),
    ]);
    if (!success || !data) {
      root.innerHTML = `<p style="color:#fff">${t.not_found || "Knockout data not found"}</p>`;
      return;
    }

    const editable = data.accessType === "owner";
    const teamCount = Number(data.teamCount) || 32;
    const koTeams = teamCount === 64 ? 32 : 16; // teams that reach the KOs
    const rounds = koTeams === 32 ? ["1/16", "1/8", "1/4", "1/2", "Final"] : ["1/8", "1/4", "1/2", "Final"];
    const firstRound = rounds[0];

    const ROUND_LABELS = { "1/16": "Round of 32", "1/8": "Round of 16", "1/4": "Quarter-finals", "1/2": "Semi-finals", "Final": "Final" };
    const EXPECTED_TIES = { "1/16": 16, "1/8": 8, "1/4": 4, "1/2": 2, "Final": 1 };
    const players = (playersRes && playersRes.success) ? (playersRes.data.players || []) : [];

    // --------------------------- helpers ---------------------------
    const normRound = r => String(r || '').toLowerCase().replace(/\s+/g, '');
    const appendSafe = (parent, ...nodes) => nodes.forEach(n => { if (n && n.nodeType) parent.appendChild(n); });

    const scoresFilled = (leg) =>
      !!(leg && leg.score && typeof leg.score.team1 === "number" && typeof leg.score.team2 === "number");

    const calcAggregate = (tie) => {
      const H = tie.home?.score || {};
      const A = tie.away?.score || {};
      const teamA = tie.home?.team1 || tie.away?.team2 || {};
      const teamB = tie.home?.team2 || tie.away?.team1 || {};

      const aggA = (typeof H.team1 === "number" ? H.team1 : 0) + (typeof A.team2 === "number" ? A.team2 : 0);
      const aggB = (typeof H.team2 === "number" ? H.team2 : 0) + (typeof A.team1 === "number" ? A.team1 : 0);

      const homeDone = scoresFilled(tie.home);
      const awayDone = scoresFilled(tie.away);
      const draw = homeDone && awayDone && aggA === aggB;

      return { teamA, teamB, aggA, aggB, draw, homeDone, awayDone };
    };

    function renderPlaceholderCard({ t1, t2 }) {
      const card = document.createElement("div");
      card.className = "ko-card ko-placeholder";
      const row = document.createElement("div");
      row.className = "ko-placeholder-row";
      row.textContent = `${t1}   vs   ${t2}`;
      card.appendChild(row);
      return card;
    }

    // Build round -> ties map (keep original order for matchOrder)
    const byRound = new Map();
    (data.matches || []).forEach(m => {
      const r = m.round || firstRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    });

    // ===== Seed the Round of 16 (or the first round) =====
    // We assign each team a half (L/R) and a seed index within that half (0..FR_PER_SIDE-1).
    const firstRoundTies = (byRound.get(firstRound) || [])
      .slice()
      .sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));

    const FR_EXPECTED = EXPECTED_TIES[firstRound] || firstRoundTies.length || 0;
    const FR_PER_SIDE = Math.max(1, Math.ceil(FR_EXPECTED / 2));

    const teamHalf = new Map();      // id -> 'L' | 'R'   (kept for compatibility)
    const teamMeta = new Map();      // id -> { half: 'L'|'R', seed: number }

    function tagMeta(team, half, seed) {
      if (!team || team.id == null) return;
      const id = +team.id;
      teamHalf.set(id, half);
      teamMeta.set(id, { half, seed });
    }

    firstRoundTies.forEach((t, idx) => {
      const half = (idx < FR_PER_SIDE) ? 'L' : 'R';
      const seed = (idx < FR_PER_SIDE) ? idx : (idx - FR_PER_SIDE);
      tagMeta(t?.home?.team1, half, seed);
      tagMeta(t?.home?.team2, half, seed);
      tagMeta(t?.away?.team1, half, seed);
      tagMeta(t?.away?.team2, half, seed);
    });

    // ===== Seed-aware splitter =====
    // Ensures ties go to the correct SIDE and SLOT within that side based on Ro16 seeds.
    function splitForRound(ties, rk, expectedPerSide) {
      const sorted = (ties || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
      const perSide = expectedPerSide ?? Math.ceil(sorted.length / 2);

      const left = Array(perSide).fill(null);
      const right = Array(perSide).fill(null);

      const firstIdx = rounds.indexOf(firstRound);
      const rkIdx = rounds.indexOf(rk);
      const depth = Math.max(0, rkIdx - firstIdx); // 0=firstRd, 1=QF, 2=SF, ...
      const cluster = Math.pow(2, depth);            // QF:2, SF:4, ...


      const chooseSide = (t) => {
        let l = 0, r = 0;

        const bump = (meta) => {
          if (!meta) return;
          if (meta.half === 'L') l++;
          else r++;
        };

        bump(teamMeta.get(t?.home?.team1?.id));
        bump(teamMeta.get(t?.home?.team2?.id));
        bump(teamMeta.get(t?.away?.team1?.id));
        bump(teamMeta.get(t?.away?.team2?.id));

        if (l > r) return 'L';
        if (r > l) return 'R';

        const mo = +(t.matchOrder ?? Number.MAX_SAFE_INTEGER);
        return (mo >= 1 && mo <= perSide) ? 'L' : 'R';
      };

      const placeAt = (arr, pos, tie) => {
        if (Number.isInteger(pos) && pos >= 0 && pos < arr.length && arr[pos] == null) {
          arr[pos] = tie; return;
        }
        // fallback: first free slot
        let i = arr.findIndex(x => x === null);
        if (i === -1) i = arr.length - 1;
        arr[i] = tie;
      };

      for (const t of sorted) {
        const side = chooseSide(t);
        const arr = (side === 'R') ? right : left;

        // collect any seeds we know for teams in this tie
        const seeds = [
          teamMeta.get(t?.home?.team1?.id)?.seed,
          teamMeta.get(t?.home?.team2?.id)?.seed,
          teamMeta.get(t?.away?.team1?.id)?.seed,
          teamMeta.get(t?.away?.team2?.id)?.seed,
        ].filter(s => Number.isInteger(s));

        if (seeds.length) {
          const minSeed = Math.min(...seeds);          // stable even if only one team known
          const localPos = Math.floor(minSeed / cluster); // 0..perSide-1 at this depth
          placeAt(arr, localPos, t);
        } else {
          placeAt(arr, null, t);
        }
      }
      return { left, right, perSide };
    }

    // --------- SIDE-AWARE LOCKS (no global blanket locks) ----------
    const locksSide = { left: new Set(), right: new Set() };
    const present = (r) => Array.from(byRound.keys()).some(k => normRound(k) === normRound(r));

    const teamPresent = (tm) => !!(tm && (tm.id != null || (tm.name && String(tm.name).trim())));
    const tieHasBothParticipants = (tie) => {
      if (!tie) return false;
      const top = tie?.home?.team1 || tie?.away?.team2;
      const bottom = tie?.home?.team2 || tie?.away?.team1;
      return teamPresent(top) && teamPresent(bottom);
    };

    // Lock 1/8 per side ONLY when that side’s SF has both teams
    if (present("1/2")) {
      const semiTies = byRound.get("1/2") || [];
      const expectedPerSide = Math.ceil((EXPECTED_TIES["1/2"] || semiTies.length) / 2);
      const { left: sfLeft, right: sfRight } = splitForRound(semiTies, "1/2", expectedPerSide);
      if (tieHasBothParticipants(sfLeft.find(Boolean))) locksSide.left.add(normRound("1/8"));
      if (tieHasBothParticipants(sfRight.find(Boolean))) locksSide.right.add(normRound("1/8"));
    }

    // If Final has both teams, lock 1/4 only on the side that contains a finalist
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

    // ----------------------------- UI frame -----------------------------
    const frame = document.createElement("div");
    frame.className = "bracket-frame";
    const leftSide = document.createElement("div"); leftSide.className = "bracket-side left-side";
    const center = document.createElement("div"); center.className = "bracket-center";
    const rightSide = document.createElement("div"); rightSide.className = "bracket-side right-side";
    frame.append(leftSide, center, rightSide);
    root.appendChild(frame);

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

    const finalsRaw = byRound.get("Final") || byRound.get("final") || [];
    const finalTie0 = finalsRaw.find(Boolean) || null;
    if (finalTie0) finalCol.appendChild(renderTie(finalTie0, "center"));
    else finalCol.appendChild(renderPlaceholderCard({ t1: "Winner Left SF", t2: "Winner Right SF" }));

    const cupWrap = document.createElement("div");
    cupWrap.className = "cup-wrap";
    const img = document.createElement("img");
    img.className = "cup-image"; img.src = cupSrc; img.alt = "Trophy";
    cupWrap.appendChild(img);
    center.append(finalCol, cupWrap);

    // ----------------------------- rounds per side -----------------------------
    renderSide(leftSide, "left");
    renderSide(rightSide, "right");

    function renderSide(sideEl, sideKey) {
      const firstRoundTiesTotal = EXPECTED_TIES[firstRound] || ((byRound.get(firstRound) || []).length);
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

        // de-dup by stable key (prevents duplicate cards)
        const raw = byRound.get(rk) || [];
        const seen = new Set();
        const tiesAll = [];
        for (const m of raw) {
          const key = String(m?.home?.id ?? m?.away?.id ?? m?.id ?? `${m.round || rk}:${m.matchOrder}`);
          if (seen.has(key)) continue;
          seen.add(key);
          tiesAll.push(m);
        }
        const expected = EXPECTED_TIES[rk] || tiesAll.length || 0;
        const expectedPerSide = Math.ceil(expected / 2);

        const { left, right, perSide } = splitForRound(tiesAll, rk, expectedPerSide);
        const list = sideKey === "left" ? left : right;

        const cards = [];
        for (let i = 0; i < perSide; i++) {
          const tie = list[i] || null;
          const card = tie
            ? renderTie(tie, sideKey)
            : renderPlaceholderCard({ t1: "TBD", t2: "TBD" });
          card.style.margin = "0";
          cards.push(card);
        }

        // precise placement in fixed-row grid
        cards.forEach((card, j) => {
          const start = j * (BASE_SPAN * Math.pow(2, rIdx)) + (Math.pow(2, rIdx + 1) - 1);
          card.style.gridRow = `${start} / span ${BASE_SPAN}`;
          card.style.height = `calc(var(--rowH) * ${BASE_SPAN})`;
          body.appendChild(card);
        });

        sideEl.appendChild(col);
      });
    }

    // ------------------------------ mini refresh helpers ------------------------------
    const nextRoundOf = (rk) => {
      const i = rounds.indexOf(rk || firstRound);
      return i >= 0 && i + 1 < rounds.length ? rounds[i + 1] : null;
    };

    const tieLikelySettled = (tie) => {
      if (tie && tie.winnerTeamId) return true;
      const H = tie?.home?.score || {};
      const A = tie?.away?.score || {};
      const isNum = (v) => Number.isFinite(v);
      const isFinal = String(tie?.round || "").toLowerCase() === "final";
      if (isFinal) return isNum(H.team1) && isNum(H.team2) && H.team1 !== H.team2;
      const haveAll = isNum(H.team1) && isNum(H.team2) && isNum(A.team1) && isNum(A.team2);
      if (!haveAll) return false;
      const aggA = (H.team1 || 0) + (A.team2 || 0);
      const aggB = (H.team2 || 0) + (A.team1 || 0);
      return aggA !== aggB;
    };

    // Re-render only when next round *content* changed (ids OR participants/winner/scores).
    async function maybeReloadNextRound(tie) {
      const rk = tie?.round || firstRound;
      const next = nextRoundOf(rk);
      if (!next) return;

      const nextNorm = normRound(next);

      // Collect old ties for the next round using normalized round names
      const getRoundList = (roundName, sourceMap) => {
        const rn = normRound(roundName);
        const out = [];
        sourceMap.forEach((v, k) => { if (normRound(k) === rn) out.push(...v); });
        return out;
      };
      const oldNext = getRoundList(next, byRound);

      const keyOf = (m) =>
        String(m?.home?.id ?? m?.away?.id ?? m?.id ?? `${m.round || next}:${m.matchOrder}`);

      const idOrName = (x) => (x && (x.id ?? (x.name || ""))) ?? "";

      const sigOf = (m) => {
        const H = m?.home || {}, A = m?.away || {};
        const hs = H.score || {}, as = A.score || {};
        return [
          idOrName(H.team1), idOrName(H.team2),
          idOrName(A.team1), idOrName(A.team2),
          m?.winnerTeamId ?? "",
          Number.isFinite(hs.team1) ? hs.team1 : "",
          Number.isFinite(hs.team2) ? hs.team2 : "",
          Number.isFinite(as.team1) ? as.team1 : "",
          Number.isFinite(as.team2) ? as.team2 : "",
        ].join("|");
      };

      try {
        const res = await apiPost("/round-knockouts", { leagueId }, { showLoading: false });
        if (!res?.success || !res.data) return;

        const newerNext = (res.data.matches || []).filter(
          m => normRound(m.round || next) === nextNorm
        );

        if (newerNext.length !== oldNext.length) {
          await renderLeagueOnlyKnockouts(leagueId, rootEl);
          return;
        }

        const oldMap = new Map(oldNext.map(m => [keyOf(m), sigOf(m)]));
        const newMap = new Map(newerNext.map(m => [keyOf(m), sigOf(m)]));

        if (oldMap.size !== newMap.size) {
          await renderLeagueOnlyKnockouts(leagueId, rootEl);
          return;
        }
        for (const [k, oldSig] of oldMap) {
          if (!newMap.has(k) || newMap.get(k) !== oldSig) {
            await renderLeagueOnlyKnockouts(leagueId, rootEl);
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    // ================ TIE CARD =================
    function renderTie(tie, sideKey) {
      if (!tie) return renderPlaceholderCard({ t1: "TBD", t2: "TBD" });

      const roundKey = normRound(tie.round || firstRound);
      const canEdit = editable && !(locksSide[sideKey] && locksSide[sideKey].has(roundKey));

      const knockoutId = tie?.home?.id ?? tie?.away?.id ?? tie?.id ?? tie?.matchOrder;
      const isFinal = String(tie.round || "").toLowerCase() === "final";
      const { teamA, teamB } = calcAggregate(tie);

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
            const userId = sel.value ? parseInt(sel.value, 10) : null;
            const legs = [];
            if (tie.home?.id) legs.push({ matchId: tie.home.id, teamId: role === "A" ? tie.home?.team1?.id : tie.home?.team2?.id });
            if (tie.away?.id) legs.push({ matchId: tie.away.id, teamId: role === "A" ? tie.away?.team2?.id : tie.away?.team1?.id });
            try {
              for (const l of legs.filter(x => x.matchId && x.teamId)) {
                await apiPost("/attach-round-knock-players", { matchId: l.matchId, teamId: l.teamId, userId, leagueId }, { showLoading: false });
              }
              showToast(userId ? (t.player_success_assigned || "User assigned successfully")
                : (t.player_success_unassigned || "User unassigned successfully"), "success");
              if (tie.home?.id && (role === "A" ? tie.home?.team1?.id : tie.home?.team2?.id)) {
                if (role === "A") (tie.home.team1 || tie.home.team2).userId = userId;
              }
              if (tie.away?.id && (role === "A" ? tie.away?.team2?.id : tie.away?.team1?.id)) {
                if (role === "A") (tie.away.team2 || tie.away.team1).userId = userId;
              }
            } catch (e) { console.error(e); }
          });
        }
        return sel;
      };

      const buildTeam = (teamObj) => {
        const d = document.createElement("div");
        d.className = "team-name";
        const name = teamObj?.name && String(teamObj.name).trim() ? teamObj.name : null;
        d.textContent = name || (t.tbd || "TBD");
        if (!name) d.classList.add("placeholder-text");
        return d;
      };

      const buildScore = (leg, which) => {
        const el = document.createElement("input");
        el.type = "number";
        el.className = "score-input";

        const initial = leg?.score ? (which === "t1" ? (leg.score.team1 ?? "") : (leg.score.team2 ?? "")) : "";
        el.value = initial;
        el.dataset.initial = String(initial);

        const hasBothTeams = !!(
          leg?.team1 && (leg.team1.id || (leg.team1.name && leg.team1.name.trim())) &&
          leg?.team2 && (leg.team2.id || (leg.team2.name && leg.team2.name.trim()))
        );

        el.disabled = !canEdit || !leg?.id || !hasBothTeams;
        el.dataset.matchId = leg?.id || "";
        el.dataset.which = which;

        if (canEdit && leg?.id && hasBothTeams) {
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
              const res = await apiPost("/update-round-knock-matches", payload, { showLoading: false });
              showToast(res.success ? (t.score_updated || "Score Updated")
                : (t.score_update_failed || "Failed to update score"),
                res.success ? "success" : "error");
              if (res.success) {
                el.dataset.initial = String(n);
                if (!leg.score) leg.score = {};
                if (el.dataset.which === "t1") leg.score.team1 = n; else leg.score.team2 = n;
                refreshTieUI();
                if (tieLikelySettled(tie)) await maybeReloadNextRound(tie);
              }
            } catch (e) { console.error(e); }
          });
        }
        return el;
      };

      const H_top = buildScore(tie.home, "t1");
      const H_bottom = buildScore(tie.home, "t2");
      const A_top = isFinal ? null : buildScore(tie.away, "t2");
      const A_bottom = isFinal ? null : buildScore(tie.away, "t1");

      const u1 = buildUserSelect(teamA, "A");
      const u2 = buildUserSelect(teamB, "B");

      const isNum = v => Number.isFinite(v);
      const h = tie.home?.score || {};
      const a = tie.away?.score || {};
      let canPickWinner;
      if (isFinal) {
        const drawFinal = isNum(h.team1) && isNum(h.team2) && h.team1 === h.team2;
        canPickWinner = canEdit && drawFinal;
      } else {
        const haveAll = isNum(h.team1) && isNum(h.team2) && isNum(a.team1) && isNum(a.team2);
        const drawAgg = haveAll && (h.team1 + a.team2 === h.team2 + a.team1);
        canPickWinner = canEdit && drawAgg;
      }

      const cbA = document.createElement("input"); cbA.type = "checkbox"; cbA.className = "winner-checkbox"; cbA.disabled = !canPickWinner;
      const cbB = document.createElement("input"); cbB.type = "checkbox"; cbB.className = "winner-checkbox"; cbB.disabled = !canPickWinner;

      if (canPickWinner) {
        const pick = async (winnerId, otherCb) => {
          try {
            otherCb.checked = false;
            const res = await apiPost("/update-round-knock-winner", { knockoutId, winner_team_id: winnerId }, { showLoading: false });
            showToast(res.success ? (t.score_updated || "Score Updated")
              : (t.score_update_failed || "Failed to update score"),
              res.success ? "success" : "error");
            if (res.success) {
              tie.winnerTeamId = winnerId;
              refreshTieUI();
              await maybeReloadNextRound(tie);
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

      function refreshTieUI() {
        const H = tie.home?.score || {};
        const A = tie.away?.score || {};
        const isNum = v => Number.isFinite(v);

        let canPick;
        if (isFinal) {
          const drawFinal = isNum(H.team1) && isNum(H.team2) && H.team1 === H.team2;
          canPick = canEdit && drawFinal;
        } else {
          const haveAll = isNum(H.team1) && isNum(H.team2) && isNum(A.team1) && isNum(A.team2);
          const drawAgg = haveAll && ((H.team1 || 0) + (A.team2 || 0) === (H.team2 || 0) + (A.team1 || 0));
          canPick = canEdit && drawAgg;
        }
        cbA.disabled = cbB.disabled = !canPick;

        row1.classList.remove("winner-row");
        row2.classList.remove("winner-row");
        if (tie.winnerTeamId) {
          if (tie.winnerTeamId === (tie.home?.team1?.id || tie.away?.team2?.id)) row1.classList.add("winner-row");
          if (tie.winnerTeamId === (tie.home?.team2?.id || tie.away?.team1?.id)) row2.classList.add("winner-row");
        } else {
          if (isFinal && isNum(H.team1) && isNum(H.team2) && H.team1 !== H.team2) {
            (H.team1 > H.team2 ? row1 : row2).classList.add("winner-row");
          } else if (!isFinal && isNum(H.team1) && isNum(H.team2) && isNum(A.team1) && isNum(A.team2)) {
            const aggA = (H.team1 || 0) + (A.team2 || 0);
            const aggB = (H.team2 || 0) + (A.team1 || 0);
            if (aggA !== aggB) (aggA > aggB ? row1 : row2).classList.add("winner-row");
          }
        }
      }

      const tn1 = buildTeam(teamA);
      const tn2 = buildTeam(teamB);

      if (sideKey === "right") {
        appendSafe(row1, isFinal ? null : A_top, H_top, tn1, u1); row1.prepend(cbA);
        appendSafe(row2, isFinal ? null : A_bottom, H_bottom, tn2, u2); row2.prepend(cbB);
      } else {
        appendSafe(row1, u1, tn1, H_top, isFinal ? null : A_top, cbA);
        appendSafe(row2, u2, tn2, H_bottom, isFinal ? null : A_bottom, cbB);
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