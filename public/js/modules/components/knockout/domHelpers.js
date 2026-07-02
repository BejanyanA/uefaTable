// Fully variant-agnostic leaf helpers shared by every knockout bracket renderer
// (club/national x stage/onlyKnockouts). Confirmed byte-identical (or trivially
// parameterized) across all 4 original implementations.

export const normRound = r => String(r || '').toLowerCase().replace(/\s+/g, '');

export const appendSafe = (parent, ...nodes) => {
  nodes.forEach(n => { if (n && n.nodeType) parent.appendChild(n); });
};

export const letterOf = (g) => {
  const m = /group\s*([A-P])/i.exec(g || "");
  return m ? m[1].toUpperCase() : null;
};

export const normGroup = (g) => (g ? String(g).replace(/\s+/g, '').toUpperCase() : null);

export function parsePh(phText) {
  if (!phText) return { group: null, rank: null };
  const g = /Group\s+([A-P])/i.exec(phText);
  const r = /([12])(?:st|nd)/i.exec(phText);
  return { group: g ? `Group ${g[1].toUpperCase()}` : null, rank: r ? +r[1] : null };
}

export function placeholderFirstRound(i, GROUPS) {
  const pair = Math.floor(i / 2);
  const even = (i % 2) === 0;
  const g1 = GROUPS[pair * 2], g2 = GROUPS[pair * 2 + 1];
  if (!g1 || !g2) return { t1: `Qualifier ${i * 2 + 1}`, t2: `Qualifier ${i * 2 + 2}` };
  return even ? { t1: `Group ${g1} 1st`, t2: `Group ${g2} 2nd` }
    : { t1: `Group ${g2} 1st`, t2: `Group ${g1} 2nd` };
}

export function renderPlaceholderCard({ t1, t2 }) {
  const card = document.createElement("div");
  card.className = "ko-card ko-placeholder";
  const row = document.createElement("div");
  row.className = "ko-placeholder-row";
  row.textContent = `${t1}   vs   ${t2}`;
  card.appendChild(row);
  return card;
}

export function renderPlaceholderCardFinal({ t1, t2 }) {
  const card = document.createElement("div");
  card.className = "ko-card ko-placeholder";
  const row = document.createElement("div");
  row.className = "ko-placeholder-row";
  const span1 = document.createElement("span");
  span1.id = "leftSFWinner";
  span1.textContent = t1 || "TBD";
  const vs = document.createElement("span");
  vs.textContent = "   vs   ";
  const span2 = document.createElement("span");
  span2.id = "rightSFWinner";
  span2.textContent = t2 || "TBD";
  row.append(span1, vs, span2);
  card.appendChild(row);
  return card;
}

export const ROUND_PLAYOFF_IDS = {
  "1/16": "round32Round",
  "1/8": "round16Round",
  "1/4": "quarterFinalRound",
  "1/2": "semiFinalRound",
  "Final": "finalRound",
};

export const CUP_SRC = {
  1: "assets/images/champ1.avif",
  2: "assets/images/eur2.avif",
  3: "assets/images/europ3.avif",
  4: "assets/images/wrld4.avif",
};
