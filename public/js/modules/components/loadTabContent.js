import { renderStandingsTable } from "./renderStandingsTable.js";
import { renderMatchesTable } from "./renderMatchesTable.js";

export async function loadTabContent(tab, leagueId, groupId) {
  const contentDiv = document.getElementById("tabContent");
  contentDiv.innerHTML = "Loading...";

  try {
    if (tab === "standings") {
      const response = await apiPost("/standings", { leagueId, groupId });
      if (response.success) {
        contentDiv.innerHTML = renderStandingsTable(response.data.standings);
      } else {
        contentDiv.innerHTML = "Failed to load standings.";
      }
    } else if (tab === "matches") {
      const response = await apiPost("/matches", { leagueId, groupId });
      if (response.success) {
        await renderMatchesTable(response.data, leagueId, groupId);
      } else {
        contentDiv.innerHTML = "Failed to load matches.";
      }
    }
  } catch (err) {
    contentDiv.innerHTML = "Error fetching data.";
  }
}