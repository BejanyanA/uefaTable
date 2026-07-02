import { showToast } from '../../../utils/toast.js';
import { apiPost } from '../../../services/api.js';
import { langMap, currentLang } from '../../LanguageManager.js';
import {
  normRound, appendSafe,
  placeholderFirstRound, renderPlaceholderCard, renderPlaceholderCardFinal,
  ROUND_PLAYOFF_IDS, CUP_SRC,
} from './domHelpers.js';

// Shared rendering engine for all 4 bracket variants (club/national x stage/onlyKnockouts).
// Variant-specific behavior (tie shape, seeding algorithm, endpoints) is supplied via `adapter`
// (see adapters.js). This preserves the DOM/CSS contract of the original 4 implementations
// exactly (ids, classes, grid layout) so knockouts.css keeps working unchanged.
export async function renderKnockoutBracket(leagueId, rootEl, adapter) {
  const root = rootEl ?? document.getElementById("knockoutTab") ?? document.getElementById(adapter.rootFallbackId);
  root.innerHTML = "";
  const t = langMap[currentLang];

  try {
    const [{ success, data }, playersRes] = await Promise.all([
      apiPost(adapter.endpoints.bracket, { leagueId }),
      apiPost(adapter.endpoints.players, { leagueId }, { showLoading: false }),
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

    const ROUND_LABELS = {
      "1/16": "Round of 32",
      "1/8": t.round16 || "Round of 16",
      "1/4": t.quarterFinal || "Quarter-finals",
      "1/2": t.semiFinal || "Semi-finals",
      "Final": t.final || "Final",
    };
    const EXPECTED_TIES = { "1/16": 16, "1/8": 8, "1/4": 4, "1/2": 2, "Final": 1 };
    const players = (playersRes && playersRes.success) ? (playersRes.data.players || []) : [];

    const groupsCnt = Math.max(2, Math.min(16, Math.round(teamCount / 4)));
    const GROUPS = Array.from({ length: groupsCnt }, (_, i) => String.fromCharCode(65 + i));

    const ctx = { firstRound, rounds, GROUPS, EXPECTED_TIES };

    // Bucket ties by round
    const byRound = new Map();
    (data.matches || []).forEach(m => {
      const r = m.round || firstRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(m);
    });

    const seedContext = adapter.buildSeedContext ? adapter.buildSeedContext(byRound, ctx) : null;
    const splitForRound = (ties, rk, expectedPerSide) => adapter.splitForRound(ties, rk, expectedPerSide, ctx, seedContext);

    // ---------- side-aware locks ----------
    const locksSide = { left: new Set(), right: new Set() };
    const present = (r) => Array.from(byRound.keys()).some(k => normRound(k) === normRound(r));
    const teamPresent = (tm) => !!(tm && (tm.id != null || (tm.name && String(tm.name).trim())));
    const tieHasBothParticipants = (tie) => !!tie && teamPresent(adapter.getTeamA(tie)) && teamPresent(adapter.getTeamB(tie));

    // Lock 1/8 per side ONLY when that side's SF has both teams
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

      const idOf = (team) => { const n = +team?.id; return Number.isFinite(n) ? n : null; };
      const finalIds = new Set(
        [adapter.getTeamA(finalTie), adapter.getTeamB(finalTie)].map(idOf).filter(id => id != null)
      );

      const semiTies = byRound.get("1/2") || [];
      const expectedPerSide = Math.ceil((EXPECTED_TIES["1/2"] || semiTies.length) / 2);
      const { left: sfLeft, right: sfRight } = splitForRound(semiTies, "1/2", expectedPerSide);

      const sideHasFinalist = (arr) => {
        const tie = arr.find(Boolean);
        if (!tie) return false;
        const ids = [adapter.getTeamA(tie), adapter.getTeamB(tie)].map(idOf).filter(id => id != null);
        return ids.some(id => finalIds.has(id));
      };

      if (sideHasFinalist(sfLeft)) locksSide.left.add(normRound("1/4"));
      if (sideHasFinalist(sfRight)) locksSide.right.add(normRound("1/4"));
    })();

    // ---------- frame ----------
    const frame = document.createElement("div");
    frame.className = "bracket-frame";
    const leftSide = document.createElement("div"); leftSide.className = "bracket-side left-side";
    const centerSide = document.createElement("div"); centerSide.className = "bracket-center";
    const rightSide = document.createElement("div"); rightSide.className = "bracket-side right-side";
    frame.append(leftSide, centerSide, rightSide);
    root.appendChild(frame);

    const cupSrc = CUP_SRC[Number(data.leagueType) || Number(localStorage.getItem("leagueType")) || 1];

    const finalCol = document.createElement("div");
    finalCol.className = "center-final";
    const finalTitle = document.createElement("h3"); finalTitle.textContent = ROUND_LABELS["Final"];
    finalTitle.id = "finalRound";
    finalCol.appendChild(finalTitle);

    const finalsRaw = byRound.get("Final") || byRound.get("final") || [];
    const finalTie = finalsRaw.find(Boolean) || null;
    if (finalTie) finalCol.appendChild(renderTie(finalTie, "center"));
    else finalCol.appendChild(renderPlaceholderCardFinal({ t1: t.leftSFWinner || "Winner Left SF", t2: t.rightSFWinner || "Winner Right SF" }));

    const cupWrap = document.createElement("div");
    cupWrap.className = "cup-wrap";
    const img = document.createElement("img");
    img.className = "cup-image"; img.src = cupSrc; img.alt = "Trophy";
    cupWrap.appendChild(img);
    centerSide.append(finalCol, cupWrap);

    renderSide(leftSide, "left");
    renderSide(rightSide, "right");

    // ================= renderSide =================
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
          if (ROUND_PLAYOFF_IDS[rk]) title.id = ROUND_PLAYOFF_IDS[rk];
          col.appendChild(title);

          const body = document.createElement("div");
          body.className = "round-body";
          body.style.display = "grid";
          body.style.alignContent = "start";
          body.style.gap = "6px";
          body.style.setProperty("--rowH", `${ROW_H_PX}px`);
          body.style.gridTemplateRows = `repeat(${TOTAL_ROWS}, var(--rowH))`;
          col.appendChild(body);

          // De-dup by stable key (defensive; harmless no-op when the API never repeats a row)
          const raw = byRound.get(rk) || [];
          const seen = new Set();
          const tiesAll = [];
          for (const m of raw) {
            const key = String(adapter.getTieKey(m) ?? `${m.round || rk}:${m.matchOrder}`);
            if (seen.has(key)) continue;
            seen.add(key);
            tiesAll.push(m);
          }

          const expected = EXPECTED_TIES[rk] || tiesAll.length || 0;
          const expectedPerSide = Math.ceil(expected / 2);
          const { left, right, perSide } = splitForRound(tiesAll, rk, expectedPerSide);
          const list = sideKey === "left" ? left : right;

          const cards = [];
          const useGroupFallback = adapter.teamFallbackUsesGroupName && (rk === firstRound);

          for (let i = 0; i < perSide; i++) {
            const tie = list[i] || null;
            let ph = null;
            if (rk === firstRound && (adapter.teamFallbackUsesGroupName || adapter.emptySlotFirstRoundUsesGroupPlaceholder)) {
              const baseIndex = (sideKey === "left" ? i : i + perSide);
              ph = placeholderFirstRound(baseIndex, GROUPS);
            }
            const card = renderTie(tie, sideKey, ph, useGroupFallback);
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

    // ================= re-render-after-diff =================
    const nextRoundOf = (rk) => {
      const i = rounds.indexOf(rk || firstRound);
      return i >= 0 && i + 1 < rounds.length ? rounds[i + 1] : null;
    };

    function tieLikelySettled(tie) {
      if (tie && tie.winnerTeamId) return true;
      const isFinal = normRound(tie?.round) === "final";
      const state = adapter.getScoreState(tie, isFinal);
      return state.complete && !state.draw;
    }

    async function maybeReloadNextRound(tie) {
      const rk = tie?.round || firstRound;
      const next = nextRoundOf(rk);
      const nextNorm = next ? normRound(next) : null;
      const force = !!tie?.winnerTeamId;

      const collectRound = (roundName, sourceMap) => {
        const rn = normRound(roundName);
        const out = [];
        sourceMap.forEach((v, k) => { if (normRound(k) === rn) out.push(...v); });
        return out;
      };
      const keyOf = (m, fallbackRound) => String(adapter.getTieKey(m) ?? `${m.round || fallbackRound}:${m.matchOrder}`);
      const changed = (oldArr, newArr, fallbackRound) => {
        if (oldArr.length !== newArr.length) return true;
        const oldMap = new Map(oldArr.map(m => [keyOf(m, fallbackRound), adapter.getTieSignature(m)]));
        const newMap = new Map(newArr.map(m => [keyOf(m, fallbackRound), adapter.getTieSignature(m)]));
        if (oldMap.size !== newMap.size) return true;
        for (const [k, v] of oldMap) {
          if (!newMap.has(k) || newMap.get(k) !== v) return true;
        }
        return false;
      };

      try {
        const res = await apiPost(adapter.endpoints.bracket, { leagueId }, { showLoading: false });
        if (!res?.success || !res.data) return;
        const allNew = res.data.matches || [];

        if (nextNorm) {
          const oldNext = collectRound(next, byRound);
          const newNext = allNew.filter(m => normRound(m.round || next) === nextNorm);
          if (changed(oldNext, newNext, next) || force) {
            await renderKnockoutBracket(leagueId, rootEl, adapter);
          }
          return;
        }

        const oldFinal = collectRound("Final", byRound);
        const newFinal = allNew.filter(m => normRound(m.round || "Final") === "final");
        if (changed(oldFinal, newFinal, "Final") || force) {
          await renderKnockoutBracket(leagueId, rootEl, adapter);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // ================= tie card =================
    function renderTie(tie, sideKey, ph, useGroupFallback = false) {
      if (!tie) return renderPlaceholderCard(ph || { t1: "TBD", t2: "TBD" });

      const roundKey = normRound(tie.round || firstRound);
      const sideLockSet = sideKey === "left" ? locksSide.left : sideKey === "right" ? locksSide.right : null;
      const isLocked = sideLockSet ? sideLockSet.has(roundKey) : false;
      const canEdit = editable && !isLocked;

      const knockoutId = adapter.getTieKey(tie);
      const isFinal = normRound(tie.round) === "final";
      const teamA = adapter.getTeamA(tie);
      const teamB = adapter.getTeamB(tie);

      const card = document.createElement("div");
      card.className = "ko-card ko-row-2";

      const buildUserSelect = (team, role) => {
        const sel = document.createElement("select");
        sel.className = "user-dropdown";
        sel.disabled = !canEdit || !team?.id;

        const def = document.createElement("option");
        def.id = "selectUserDesk";
        def.value = ""; def.textContent = t.selectUser || "Select Player";
        sel.appendChild(def);
        players.forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.username; sel.appendChild(o); });
        if (team?.userId) sel.value = String(team.userId);

        if (canEdit && team?.id) {
          sel.addEventListener("change", async () => {
            const userId = sel.value ? parseInt(sel.value, 10) : null;
            try {
              const payloads = adapter.getAttachPayloads(tie, role, { userId, leagueId });
              for (const payload of payloads) {
                await apiPost(adapter.endpoints.attachPlayer, payload, { showLoading: false });
              }
              showToast(userId ? (t.player_success_assigned || "User assigned successfully")
                : (t.player_success_unassigned || "User unassigned successfully"), "success");
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
        const grp = (groupName && String(groupName).trim())
          || (teamObj?.groupName && String(teamObj.groupName).trim())
          || null;
        const teamLogo = teamObj?.logo_url || 'https://uefaresults.com/assets/logos/defaultLogo.png';

        if (name) {
          d.innerHTML = `<img src="${teamLogo}" class="team-logo-knockout"> ${name}`;
        } else if (useGroupFallback && grp) {
          d.textContent = `${grp} Team ${position}`;
          d.classList.add("placeholder-text");
        } else {
          d.textContent = t.tbd || "TBD";
          d.classList.add("placeholder-text");
        }
        return d;
      }

      const buildScoreInput = (spec) => {
        const el = document.createElement("input");
        el.type = "number";
        el.className = "score-input";

        const initial = spec.leg?.score ? (spec.which === "t1" ? (spec.leg.score.team1 ?? "") : (spec.leg.score.team2 ?? "")) : "";
        el.value = initial;
        el.dataset.initial = String(initial);

        el.disabled = !canEdit || !spec.matchId || !spec.hasBothTeams;
        el.dataset.matchId = spec.matchId || "";
        el.dataset.which = spec.which;

        if (canEdit && spec.matchId && spec.hasBothTeams) {
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
              const res = await apiPost(adapter.endpoints.updateScore, payload, { showLoading: false });
              showToast(res.success ? (t.score_updated || "Score Updated") : (t.score_update_failed || "Failed to update score"),
                res.success ? "success" : "error");
              if (res.success) {
                el.dataset.initial = String(n);
                if (!spec.leg.score) spec.leg.score = {};
                if (el.dataset.which === "t1") spec.leg.score.team1 = n; else spec.leg.score.team2 = n;
                refreshTieUI();
                if (tieLikelySettled(tie)) await maybeReloadNextRound(tie);
              }
            } catch (e) { console.error(e); }
          });
        }
        return el;
      };

      const scoreSpecs = adapter.getScoreInputSpecs(tie, isFinal);
      const scoreInputs = scoreSpecs.map(buildScoreInput);

      const u1 = buildUserSelect(teamA, "A");
      const u2 = buildUserSelect(teamB, "B");

      let grpA = null, grpB = null;
      if (adapter.teamFallbackUsesGroupName) {
        ({ grpA, grpB } = adapter.computeGroupLabels(tie, teamA, teamB, ph));
      }

      const tn1 = buildTeam(teamA, 1, grpA);
      const tn2 = buildTeam(teamB, 2, grpB);

      const cbA = document.createElement("input"); cbA.type = "checkbox"; cbA.className = "winner-checkbox";
      const cbB = document.createElement("input"); cbB.type = "checkbox"; cbB.className = "winner-checkbox";

      function canPickNow() {
        if (!canEdit) return false;
        const state = adapter.getScoreState(tie, isFinal);
        return state.complete && state.draw;
      }
      function refreshPickersDisabled() {
        cbA.disabled = cbB.disabled = !canPickNow();
      }
      refreshPickersDisabled();

      let picking = false;
      async function doPick(winnerId, otherCb) {
        if (picking) return;
        if (cbA.disabled || cbB.disabled) {
          cbA.checked = cbB.checked = false;
          return;
        }
        try {
          picking = true;
          otherCb.checked = false;

          const res = await apiPost(adapter.endpoints.updateWinner, {
            knockoutId,
            winner_team_id: winnerId,
          }, { showLoading: false });

          showToast(res.success ? (t.score_updated || "Score Updated") : (t.score_update_failed || "Failed to update score"),
            res.success ? "success" : "error");

          if (res.success) {
            tie.winnerTeamId = winnerId;
            refreshTieUI();
            await maybeReloadNextRound(tie);
          } else {
            cbA.checked = cbB.checked = false;
          }
        } catch (e) {
          console.error(e);
          cbA.checked = cbB.checked = false;
        } finally {
          picking = false;
        }
      }

      cbA.addEventListener("change", () => { if (cbA.checked) doPick(teamA?.id, cbB); });
      cbB.addEventListener("change", () => { if (cbB.checked) doPick(teamB?.id, cbA); });

      const row1 = document.createElement("div");
      const row2 = document.createElement("div");
      row1.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;
      row2.className = `ko-team-row ${sideKey === "right" ? "right" : "left"}`;
      if (adapter.singleLegCssClass) {
        row1.classList.add("single-leg");
        row2.classList.add("single-leg");
      }

      function refreshTieUI() {
        const state = adapter.getScoreState(tie, isFinal);
        cbA.disabled = cbB.disabled = !(state.complete && state.draw);

        row1.classList.remove("winner-row");
        row2.classList.remove("winner-row");

        if (tie.winnerTeamId) {
          if (tie.winnerTeamId === teamA?.id) row1.classList.add("winner-row");
          if (tie.winnerTeamId === teamB?.id) row2.classList.add("winner-row");
        } else if (state.complete && !state.draw) {
          (state.leadsA ? row1 : row2).classList.add("winner-row");
        }
      }

      const [H_top, H_bottom, A_top, A_bottom] = scoreInputs;

      if (sideKey === "right") {
        appendSafe(row1, isFinal ? null : A_top, H_top, tn1, u1); row1.prepend(cbA);
        appendSafe(row2, isFinal ? null : A_bottom, H_bottom, tn2, u2); row2.prepend(cbB);
      } else {
        appendSafe(row1, u1, tn1, H_top, isFinal ? null : A_top, cbA);
        appendSafe(row2, u2, tn2, H_bottom, isFinal ? null : A_bottom, cbB);
      }

      refreshTieUI();
      refreshPickersDisabled();

      card.append(row1, row2);
      return card;
    }
  } catch (err) {
    console.error("Knockouts render error:", err);
    root.innerHTML = `<p style="color:#fff">${t.something_went_wrong || "Something went wrong"}</p>`;
  }
}
