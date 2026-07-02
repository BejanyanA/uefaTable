import { letterOf, normGroup, parsePh } from './domHelpers.js';

const isNum = v => Number.isFinite(v);
const firstTruthyLetter = (sources) => {
  for (const g of sources) { const l = letterOf(g); if (l) return l; }
  return null;
};

// ---------------------------------------------------------------------------
// Leg-mode behaviors: club (two-legged, home+away aggregate) vs national
// (single neutral match). These own every place the tie-object SHAPE matters.
// ---------------------------------------------------------------------------

const clubLeg = {
  singleLegCssClass: false,

  getTeamA: (tie) => tie.home?.team1 || tie.away?.team2 || {},
  getTeamB: (tie) => tie.home?.team2 || tie.away?.team1 || {},

  getTieKey: (tie) => tie?.home?.id ?? tie?.away?.id ?? tie?.id ?? tie?.matchOrder,

  getTieSignature: (m) => {
    const H = m?.home || {}, A = m?.away || {};
    const hs = H.score || {}, as = A.score || {};
    const idOrName = (x) => (x && (x.id ?? (x.name || ""))) ?? "";
    return [
      idOrName(H.team1), idOrName(H.team2), idOrName(A.team1), idOrName(A.team2),
      m?.winnerTeamId ?? "",
      isNum(hs.team1) ? hs.team1 : "", isNum(hs.team2) ? hs.team2 : "",
      isNum(as.team1) ? as.team1 : "", isNum(as.team2) ? as.team2 : "",
    ].join("|");
  },

  getScoreState: (tie, isFinal) => {
    if (isFinal) {
      const H = tie.home?.score || {};
      if (!(isNum(H.team1) && isNum(H.team2))) return { complete: false, draw: false, leadsA: null };
      const draw = H.team1 === H.team2;
      return { complete: true, draw, leadsA: draw ? null : H.team1 > H.team2 };
    }
    const H = tie.home?.score || {};
    const A = tie.away?.score || {};
    if (!(isNum(H.team1) && isNum(H.team2) && isNum(A.team1) && isNum(A.team2))) {
      return { complete: false, draw: false, leadsA: null };
    }
    const aggA = H.team1 + A.team2;
    const aggB = H.team2 + A.team1;
    const draw = aggA === aggB;
    return { complete: true, draw, leadsA: draw ? null : aggA > aggB };
  },

  getScoreInputSpecs: (tie, isFinal) => {
    const hasBothTeams = (leg) => !!(
      leg?.team1 && (leg.team1.id || (leg.team1.name && leg.team1.name.trim())) &&
      leg?.team2 && (leg.team2.id || (leg.team2.name && leg.team2.name.trim()))
    );
    const mk = (leg, which) => ({ leg, which, matchId: leg?.id, hasBothTeams: hasBothTeams(leg) });
    const specs = [mk(tie.home, "t1"), mk(tie.home, "t2")];
    if (!isFinal) specs.push(mk(tie.away, "t2"), mk(tie.away, "t1"));
    return specs;
  },

  getAttachPayloads: (tie, role, { userId, leagueId }) => {
    const legs = [];
    if (tie.home?.id) legs.push({ matchId: tie.home.id, teamId: role === "A" ? tie.home?.team1?.id : tie.home?.team2?.id });
    if (tie.away?.id) legs.push({ matchId: tie.away.id, teamId: role === "A" ? tie.away?.team2?.id : tie.away?.team1?.id });
    return legs.filter(l => l.matchId && l.teamId).map(l => ({ matchId: l.matchId, teamId: l.teamId, userId, leagueId }));
  },

  // Raw leg-order group-name sources (home.team1, home.team2, away.team1, away.team2) --
  // used by the shared stage seeding algorithm.
  getRawGroupNameSources: (tie) => [
    tie?.home?.team1?.groupName, tie?.home?.team2?.groupName,
    tie?.away?.team1?.groupName, tie?.away?.team2?.groupName,
  ],
  getGroupNameSourcesA: (tie) => [tie?.home?.team1?.groupName, tie?.away?.team2?.groupName],
  getGroupNameSourcesB: (tie) => [tie?.home?.team2?.groupName, tie?.away?.team1?.groupName],

  computeGroupLabels: (tie, teamA, teamB, ph) => {
    const p1 = parsePh(ph?.t1), p2 = parsePh(ph?.t2);
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
    return { grpA, grpB };
  },
};

const nationalLeg = {
  singleLegCssClass: true,

  getTeamA: (tie) => tie.team1 || {},
  getTeamB: (tie) => tie.team2 || {},

  getTieKey: (tie) => tie?.id ?? tie?.matchOrder,

  getTieSignature: (m) => {
    const s = m?.score || {};
    const idOrName = (x) => (x && (x.id ?? (x.name || ""))) ?? "";
    return [idOrName(m?.team1), idOrName(m?.team2), m?.winnerTeamId ?? "",
      isNum(s.team1) ? s.team1 : "", isNum(s.team2) ? s.team2 : ""].join("|");
  },

  getScoreState: (tie) => {
    const s = tie.score || {};
    if (!(isNum(s.team1) && isNum(s.team2))) return { complete: false, draw: false, leadsA: null };
    const draw = s.team1 === s.team2;
    return { complete: true, draw, leadsA: draw ? null : s.team1 > s.team2 };
  },

  getScoreInputSpecs: (tie) => {
    const teamA = tie.team1, teamB = tie.team2;
    const matchId = tie?.id ?? tie?.matchOrder;
    const hasBothTeams = !!(teamA?.id || teamA?.name) && !!(teamB?.id || teamB?.name);
    return [
      { leg: tie, which: "t1", matchId, hasBothTeams },
      { leg: tie, which: "t2", matchId, hasBothTeams },
    ];
  },

  getAttachPayloads: (tie, role, { userId, leagueId }) => {
    const teamA = tie.team1 || {}, teamB = tie.team2 || {};
    const matchId = tie?.id ?? tie?.matchOrder;
    return [{ matchId, teamId: role === "A" ? teamA?.id : teamB?.id, userId, leagueId }];
  },

  getRawGroupNameSources: (tie) => [tie?.team1?.groupName, tie?.team2?.groupName],
  getGroupNameSourcesA: (tie) => [tie?.team1?.groupName],
  getGroupNameSourcesB: (tie) => [tie?.team2?.groupName],

  computeGroupLabels: (tie, teamA, teamB, ph) => {
    const p1 = parsePh(ph?.t1), p2 = parsePh(ph?.t2);
    return {
      grpA: teamA?.groupName || p1.group || null,
      grpB: teamB?.groupName || p2.group || null,
    };
  },
};

// ---------------------------------------------------------------------------
// Seed-mode behaviors: "stage" (group-derived bracket, seeds round 1 from
// group letters) vs "onlyKnockouts" (bracket-only league, seeds from Round-1
// matchOrder). Stage's seeding ALGORITHM is identical for club/national
// (verified structurally); onlyKnockouts' seeding algorithm genuinely differs
// between club (seed-index clustering) and national (majority-vote + block
// placement) so those stay as two separate, faithful ports rather than being
// force-unified.
// ---------------------------------------------------------------------------

function makeStageSplitForRound({ getRawGroupNameSources, getGroupNameSourcesA, getGroupNameSourcesB }) {
  return function splitForRound(ties, rk, expectedPerSide, ctx) {
    const { firstRound, rounds, GROUPS, EXPECTED_TIES } = ctx;
    // Sorted for deterministic collision-fallback placement (see note below).
    const all = (ties || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
    const perSide = expectedPerSide ?? Math.ceil((EXPECTED_TIES[rk] || all.length) / 2);

    // Collision fallback scans the whole side for a free slot rather than only
    // trying the pair's two slots, so a tie is never silently dropped.
    const placeWithFallback = (slots, base, tie) => {
      if (base != null && base >= 0 && base < slots.length && slots[base] == null) { slots[base] = tie; return; }
      if (base != null && base + 1 < slots.length && slots[base + 1] == null) { slots[base + 1] = tie; return; }
      for (let i = 0; i < slots.length; i++) if (slots[i] == null) { slots[i] = tie; return; }
    };

    if (rk === firstRound) {
      const pairCountTotal = Math.floor(GROUPS.length / 2);
      const pairsPerSide = Math.ceil(pairCountTotal / 2);
      const leftSlots = Array(perSide).fill(null);
      const rightSlots = Array(perSide).fill(null);

      for (const tie of all) {
        const letters = getRawGroupNameSources(tie).map(letterOf).filter(Boolean);

        let sideArr, globalPairIdx;
        if (letters.length) {
          const gIdx = letters.map(ch => ch.charCodeAt(0) - 65).sort((a, b) => a - b)[0];
          const pairIdx = Math.floor(gIdx / 2);
          const isLeft = pairIdx < pairsPerSide;
          sideArr = isLeft ? leftSlots : rightSlots;
          globalPairIdx = pairIdx;
        } else {
          const mo = +(tie.matchOrder || Number.MAX_SAFE_INTEGER);
          sideArr = (mo >= 1 && mo <= perSide) ? leftSlots : rightSlots;
          const idxWithinSide = ((mo - 1) % perSide + perSide) % perSide;
          const bucketIdxWithinSide = Math.floor(idxWithinSide / 2);
          globalPairIdx = (sideArr === leftSlots) ? bucketIdxWithinSide : bucketIdxWithinSide + pairsPerSide;
        }

        const firstLetter = GROUPS[globalPairIdx * 2];
        const secondLetter = GROUPS[globalPairIdx * 2 + 1];
        const base = ((globalPairIdx % pairsPerSide) * 2);

        let target = base;
        const h1L = firstTruthyLetter(getGroupNameSourcesA(tie));
        const h2L = firstTruthyLetter(getGroupNameSourcesB(tie));
        if (h1L === firstLetter) target = base;
        else if (h2L === firstLetter) target = base + 1;
        else if (h1L === secondLetter) target = base + 1;
        else if (h2L === secondLetter) target = base;

        placeWithFallback(sideArr, target, tie);
      }
      return { left: leftSlots, right: rightSlots, perSide };
    }

    // ===== OTHER ROUNDS =====
    const groupsCnt = Math.max(2, GROUPS.length);
    const firstIdx = rounds.indexOf(firstRound);
    const rkIdx = rounds.indexOf(rk);
    const depth = Math.max(0, rkIdx - firstIdx);
    const clusterSize = Math.pow(2, depth + 1);
    const useGroupBuckets = clusterSize < groupsCnt;

    const primaryGroupIndex = (tie) => {
      for (const g of getRawGroupNameSources(tie)) {
        const l = letterOf(g);
        if (l) return l.charCodeAt(0) - 65;
      }
      return null;
    };
    const bucketOf = (idx) => (idx == null ? null : Math.floor(idx / clusterSize));

    const leftSlots = Array(perSide).fill(null);
    const rightSlots = Array(perSide).fill(null);
    const halfBuckets = Math.ceil((groupsCnt / clusterSize) / 2);

    for (const tie of all) {
      if (!useGroupBuckets) {
        const letters = getRawGroupNameSources(tie).map(letterOf).filter(Boolean);
        const half = Math.ceil(GROUPS.length / 2);
        let sideArr;
        if (letters.length) {
          const idxs = letters.map(ch => ch.charCodeAt(0) - 65);
          sideArr = (Math.min(...idxs) < half) ? leftSlots : rightSlots;
        } else {
          const leftFree = leftSlots.some(x => x === null);
          const rightFree = rightSlots.some(x => x === null);
          sideArr = leftFree ? leftSlots : (rightFree ? rightSlots : leftSlots);
        }
        const other = (sideArr === leftSlots) ? rightSlots : leftSlots;
        if (sideArr.every(x => x !== null) && other.some(x => x === null)) sideArr = other;
        let pos = sideArr.findIndex(x => x === null);
        if (pos === -1) pos = sideArr.length - 1;
        sideArr[pos] = tie;
        continue;
      }

      const pIdx = primaryGroupIndex(tie);
      const bucket = bucketOf(pIdx);

      if (bucket === null) {
        const mo = +(tie.matchOrder || Number.MAX_SAFE_INTEGER);
        let sideArr = (mo >= 1 && mo <= perSide) ? leftSlots : rightSlots;
        const other = (sideArr === leftSlots) ? rightSlots : leftSlots;
        if (sideArr.every(x => x !== null) && other.some(x => x === null)) sideArr = other;
        let pos = sideArr.findIndex(x => x === null);
        if (pos === -1) pos = sideArr.length - 1;
        sideArr[pos] = tie;
        continue;
      }

      const isLeftSide = bucket < halfBuckets;
      const localBucket = isLeftSide ? bucket : (bucket - halfBuckets);
      const sideArr = isLeftSide ? leftSlots : rightSlots;
      const rel = (pIdx % clusterSize);
      const pairWithinBucket = Math.floor(rel / (clusterSize / 2));
      const pos = Math.min(localBucket * 2 + pairWithinBucket, sideArr.length - 1);

      if (sideArr[pos] == null) {
        sideArr[pos] = tie;
      } else {
        let p = pos;
        while (p < sideArr.length && sideArr[p] != null) p++;
        if (p < sideArr.length) sideArr[p] = tie;
      }
    }

    return { left: leftSlots, right: rightSlots, perSide };
  };
}

// ---- club onlyKnockouts seeding (seed-index clustering) ----
const clubOnlyKnockoutsSeed = {
  buildSeedContext: (byRound, { firstRound, EXPECTED_TIES }) => {
    const firstRoundTies = (byRound.get(firstRound) || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
    const FR_EXPECTED = EXPECTED_TIES[firstRound] || firstRoundTies.length || 0;
    const FR_PER_SIDE = Math.max(1, Math.ceil(FR_EXPECTED / 2));
    const teamMeta = new Map();
    const tagMeta = (team, half, seed) => {
      if (!team || team.id == null) return;
      teamMeta.set(+team.id, { half, seed });
    };
    firstRoundTies.forEach((t, idx) => {
      const half = (idx < FR_PER_SIDE) ? 'L' : 'R';
      const seed = (idx < FR_PER_SIDE) ? idx : (idx - FR_PER_SIDE);
      tagMeta(t?.home?.team1, half, seed);
      tagMeta(t?.home?.team2, half, seed);
      tagMeta(t?.away?.team1, half, seed);
      tagMeta(t?.away?.team2, half, seed);
    });
    return { teamMeta };
  },

  splitForRound: (ties, rk, expectedPerSide, { firstRound, rounds }, seedContext) => {
    const { teamMeta } = seedContext;
    const sorted = (ties || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
    const perSide = expectedPerSide ?? Math.ceil(sorted.length / 2);
    const left = Array(perSide).fill(null);
    const right = Array(perSide).fill(null);

    const firstIdx = rounds.indexOf(firstRound);
    const rkIdx = rounds.indexOf(rk);
    const depth = Math.max(0, rkIdx - firstIdx);
    const cluster = Math.pow(2, depth);

    const chooseSide = (t) => {
      let l = 0, r = 0;
      const bump = (meta) => { if (!meta) return; if (meta.half === 'L') l++; else r++; };
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
      if (Number.isInteger(pos) && pos >= 0 && pos < arr.length && arr[pos] == null) { arr[pos] = tie; return; }
      let i = arr.findIndex(x => x === null);
      if (i === -1) i = arr.length - 1;
      arr[i] = tie;
    };

    for (const t of sorted) {
      const side = chooseSide(t);
      const arr = (side === 'R') ? right : left;
      const seeds = [
        teamMeta.get(t?.home?.team1?.id)?.seed,
        teamMeta.get(t?.home?.team2?.id)?.seed,
        teamMeta.get(t?.away?.team1?.id)?.seed,
        teamMeta.get(t?.away?.team2?.id)?.seed,
      ].filter(s => Number.isInteger(s));

      if (seeds.length) {
        const minSeed = Math.min(...seeds);
        const localPos = Math.floor(minSeed / cluster);
        placeAt(arr, localPos, t);
      } else {
        placeAt(arr, null, t);
      }
    }
    return { left, right, perSide };
  },
};

// ---- national onlyKnockouts seeding (majority-vote + matchOrder block) ----
const nationalOnlyKnockoutsSeed = {
  buildSeedContext: (byRound, { firstRound, EXPECTED_TIES }) => {
    const firstRoundTies = (byRound.get(firstRound) || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
    const FR_EXPECTED = EXPECTED_TIES[firstRound] || firstRoundTies.length || 0;
    const FR_PER_SIDE = Math.max(1, Math.ceil(FR_EXPECTED / 2));
    const teamHalf = new Map();
    firstRoundTies.forEach((m, idx) => {
      const half = (idx < FR_PER_SIDE) ? 'L' : 'R';
      if (m.team1 && m.team1.id != null) teamHalf.set(+m.team1.id, half);
      if (m.team2 && m.team2.id != null) teamHalf.set(+m.team2.id, half);
    });
    return { teamHalf };
  },

  splitForRound: (ties, rk, expectedPerSide, ctx, seedContext) => {
    const { teamHalf } = seedContext;
    const sorted = (ties || []).slice().sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0));
    const perSide = expectedPerSide ?? Math.ceil(sorted.length / 2);
    const left = Array(perSide).fill(null);
    const right = Array(perSide).fill(null);

    const place = (arr, idx, t) => {
      if (idx >= 0 && idx < arr.length && arr[idx] == null) { arr[idx] = t; return; }
      for (let i = 0; i < arr.length; i++) if (arr[i] == null) { arr[i] = t; return; }
    };

    const chooseSide = (m) => {
      let L = 0, R = 0;
      const vote = (tm) => {
        if (!tm || tm.id == null) return;
        const h = teamHalf.get(+tm.id);
        if (h === 'L') L++; else if (h === 'R') R++;
      };
      vote(m.team1); vote(m.team2);
      if (L > R) return 'L';
      if (R > L) return 'R';
      const mo = +(m.matchOrder ?? 1);
      const sideBlock = Math.floor((mo - 1) / perSide);
      return sideBlock === 0 ? 'L' : 'R';
    };

    for (const t of sorted) {
      const side = chooseSide(t);
      const mo = +(t.matchOrder ?? 1);
      const localIdx = ((mo - 1) % perSide + perSide) % perSide;
      if (side === 'R') place(right, localIdx, t); else place(left, localIdx, t);
    }
    return { left, right, perSide };
  },
};

// ---------------------------------------------------------------------------
// Endpoint tables (literal, per variant -- not templated, so each is
// trivially auditable against the backend route registry).
// ---------------------------------------------------------------------------

const endpoints = {
  clubStage: {
    bracket: "/group-knockouts", players: "/league-players",
    attachPlayer: "/attach-knock-players", updateScore: "/update-knock-matches", updateWinner: "/update-knock-winner",
  },
  clubOnlyKnockouts: {
    bracket: "/round-knockouts", players: "/league-players",
    attachPlayer: "/attach-round-knock-players", updateScore: "/update-round-knock-matches", updateWinner: "/update-round-knock-winner",
  },
  nationalStage: {
    bracket: "/national-group-knockouts", players: "/national-players",
    attachPlayer: "/attach-national-knock-players", updateScore: "/update-national-knock-matches", updateWinner: "/update-national-knock-winner",
  },
  nationalOnlyKnockouts: {
    bracket: "/national-round-knockouts", players: "/national-players",
    attachPlayer: "/attach-national-round-knock-players", updateScore: "/update-national-round-knock-matches", updateWinner: "/update-national-round-knock-winner",
  },
};

// ---------------------------------------------------------------------------
// Composed adapters
// ---------------------------------------------------------------------------

export const clubStageAdapter = {
  legMode: "club", seedMode: "stage",
  rootFallbackId: "leagueType1",
  teamFallbackUsesGroupName: true,
  emptySlotFirstRoundUsesGroupPlaceholder: true,
  endpoints: endpoints.clubStage,
  ...clubLeg,
  splitForRound: makeStageSplitForRound(clubLeg),
};

export const clubOnlyKnockoutsAdapter = {
  legMode: "club", seedMode: "onlyKnockouts",
  rootFallbackId: "leagueType1",
  teamFallbackUsesGroupName: false,
  emptySlotFirstRoundUsesGroupPlaceholder: false,
  endpoints: endpoints.clubOnlyKnockouts,
  ...clubLeg,
  ...clubOnlyKnockoutsSeed,
};

export const nationalStageAdapter = {
  legMode: "national", seedMode: "stage",
  rootFallbackId: "leagueType2",
  teamFallbackUsesGroupName: true,
  emptySlotFirstRoundUsesGroupPlaceholder: true,
  endpoints: endpoints.nationalStage,
  ...nationalLeg,
  splitForRound: makeStageSplitForRound(nationalLeg),
};

export const nationalOnlyKnockoutsAdapter = {
  legMode: "national", seedMode: "onlyKnockouts",
  rootFallbackId: "leagueType2",
  teamFallbackUsesGroupName: false,
  emptySlotFirstRoundUsesGroupPlaceholder: true,
  endpoints: endpoints.nationalOnlyKnockouts,
  ...nationalLeg,
  ...nationalOnlyKnockoutsSeed,
};
