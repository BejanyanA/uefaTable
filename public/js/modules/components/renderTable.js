export function renderLeagueTable(data) {
  const section = document.getElementById("gameTableSection");
  section.innerHTML = `
    <h2>${data.league.name}</h2>
    <table class="league-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Round</th>
          <th>Team 1</th>
          <th>Score</th>
          <th>Team 2</th>
        </tr>
      </thead>
      <tbody>
        ${data.leagueInstances.map(match => `
          <tr>
            <td>${match.match_date || "-"}</td>
            <td>${match.round || "-"}</td>
            <td>${match.team1_name || "?"}</td>
            <td>${match.score1 ?? "?"} : ${match.score2 ?? "?"}</td>
            <td>${match.team2_name || "?"}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  section.style.display = "block";
}