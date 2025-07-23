export function renderLeagueTable(data) {
  const section = document.getElementById("leagueType1");
  const leagues = data.leagues || [];

  if (!leagues.length) {
    section.innerHTML = `<div id="bannerContainerWrapper ">
        <h2 id="competition-types">No leagues found</h2>
      </div>`;
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