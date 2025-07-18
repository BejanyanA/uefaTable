export function renderLeagueTable(data) {
  const section = document.getElementById("gameTableSection");
  const leagues = data.leagues || [];

  if (!leagues.length) {
    section.innerHTML = `<p>No leagues found.</p>`;
    section.style.display = "block";
    return;
  }

  // Render league names side by side
  section.innerHTML = `
    <div class="league-names-row">
      ${leagues.map(league => `
        <div class="league-name-box">
          ${league.name}
        </div>
      `).join("")}
    </div>
  `;

  section.style.display = "block";
}