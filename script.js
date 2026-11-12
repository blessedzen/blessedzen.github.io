// WHAT IS THIS FILE?
// JavaScript is the programming language that makes a web page DO things. HTML builds the page and
// CSS styles it, but this file handles the actions: downloading scores and stats from the internet,
// reacting to button clicks, searching players, switching tabs, and saving favorites.
//
// A few beginner terms used throughout:
// - A "variable" is a named box that stores a value. "const" makes one that won't be reassigned.
// - A "function" is a reusable set of instructions with a name. You "call" it to run it.
// - An "API" (Application Programming Interface) is a web service that sends data to programs on request.
//   Here, two APIs provide the NBA data.
// - "JSON" is a common text format for sending data between websites and programs.
// - An "array" is an ordered list of items, written with square brackets like [a, b, c].
// - An "object" is a bundle of named values, written with curly braces like {name: "Bob", age: 30}.
// - A "comment" is a note for humans. The computer ignores any line beginning with //, like this one.

// "use strict" turns on a stricter mode of JavaScript that catches common mistakes early.
"use strict";

// ===== SETTINGS: the web addresses (URLs) the page gets its data from =====

// NBA Stats API: independent community API, no key required.
// This is the base address for player and team season statistics. (A "key" is a password-like code some APIs require.)
const STATS_API = "https://api.server.nbaapi.com/api";
// ESPN is used only for the live scoreboard, not player or team lookup.
const SCORE_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
// A tiny shortcut function: $("scores") finds the HTML element whose id is "scores".
// The "=>" is "arrow function" shorthand: "take id, and give back document.getElementById(id)".
// The "document" is the web page itself.
const $ = id => document.getElementById(id);
// "state" is a storage object that remembers things while the page is open:
// teams = the list of teams, picked = the two players chosen for comparison (empty at first, shown as null),
// season = which season's data we are currently using (2027 means the 2026-27 season).
const state = { teams: [], picked: [null, null], season: 2027 };
// The name under which favorite teams are saved in the browser's built-in storage (called localStorage).
const FAVORITES_KEY = "nbaStatChecker.favoriteTeams";

// The list of all 30 NBA teams, each written as [abbreviation, full name].
// It is built into this file so the team menus work without asking any website for the list.
const TEAMS = [
 ["ATL","Atlanta Hawks"],["BOS","Boston Celtics"],["BKN","Brooklyn Nets"],["CHA","Charlotte Hornets"],["CHI","Chicago Bulls"],
 ["CLE","Cleveland Cavaliers"],["DAL","Dallas Mavericks"],["DEN","Denver Nuggets"],["DET","Detroit Pistons"],["GSW","Golden State Warriors"],
 ["HOU","Houston Rockets"],["IND","Indiana Pacers"],["LAC","LA Clippers"],["LAL","Los Angeles Lakers"],["MEM","Memphis Grizzlies"],
 ["MIA","Miami Heat"],["MIL","Milwaukee Bucks"],["MIN","Minnesota Timberwolves"],["NOP","New Orleans Pelicans"],["NYK","New York Knicks"],
 ["OKC","Oklahoma City Thunder"],["ORL","Orlando Magic"],["PHI","Philadelphia 76ers"],["PHX","Phoenix Suns"],["POR","Portland Trail Blazers"],
 ["SAC","Sacramento Kings"],["SAS","San Antonio Spurs"],["TOR","Toronto Raptors"],["UTA","Utah Jazz"],["WAS","Washington Wizards"]
// ".map(...)" goes through every item in the list and converts each [abbreviation, name] pair into an object
// like {id:"ATL", abbreviation:"ATL", name:"Atlanta Hawks"}, which is easier to work with.
].map(([abbreviation,name])=>({id:abbreviation,abbreviation,name}));
// Store the finished team list in "state" too.
state.teams = TEAMS;

// ===== HELPER FUNCTIONS: small tools used by the rest of the code =====

// "safe" makes text harmless before putting it on the page. It swaps special characters (& < > " ')
// for harmless codes. This protects against "injection", where bad data containing HTML code could
// otherwise run on the page. "??" means "if the value is missing, use an empty string instead".
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// getJSON downloads data from a web address and converts it into something the code can use.
// "async" means the function can wait for slow things (like internet requests) without freezing the page.
// "await" means "pause here until the answer arrives". "fetch" is the browser's tool for requesting data.
async function getJSON(url) {
 const response = await fetch(url, {headers:{Accept:"application/json"}});
 // response.ok is false when the server reports a problem (such as "404 not found"). Stop and report it with "throw".
 if (!response.ok) throw new Error("Data provider returned HTTP " + response.status);
 return response.json();
}
// setConnection updates the status area in the page header: it changes the message text and turns
// the dot green (everything is working) or red (a problem).
function setConnection(ok,message) {
 const label=$("connection"); if(label) label.textContent=message;
 if(label && label.previousElementSibling) label.previousElementSibling.style.background=ok?"var(--green)":"var(--red)";
}
// showError puts a red error message inside the page element with the given id.
function showError(id,message) { $(id).innerHTML='<div class="error">'+safe(message)+'</div>'; }
// teamName picks the best available name for a team from the scoreboard data. "?." safely skips the
// step if the data is missing, and "||" means "or use this next option".
function teamName(team) { return team?.displayName || team?.name || "Team"; }
// eventStatus gets the short game status text, like "Final" or "7:30 PM ET", or "Scheduled" if none exists.
function eventStatus(event) { return event?.status?.type?.shortDetail || event?.status?.type?.description || "Scheduled"; }

// ===== SCOREBOARD: downloads today's games from ESPN and displays them =====
async function loadScores() {
 // Show a loading message and clear any old error while we wait for fresh data.
 $("scores").innerHTML='<div class="loading">Refreshing scoreboard…</div>';
 $("scoreError").innerHTML="";
 // "try" attempts the code inside. If anything goes wrong, the "catch" part at the end runs instead of crashing.
 try {
  const data=await getJSON(SCORE_API+"/scoreboard");
  // "events" is the list of games. If none exist, use an empty list.
  const events=data.events||[];
  // If there are games, build one HTML box per game and join them together. Otherwise show a friendly "no games" message.
  $("scores").innerHTML=events.length?events.map(event=>{
   // Each game has two competitors (teams). Pick out which one is home and which is away.
   const competition=event.competitions?.[0], competitors=competition?.competitors||[];
   const home=competitors.find(x=>x.homeAway==="home")||competitors[0];
   const away=competitors.find(x=>x.homeAway==="away")||competitors[1];
   // "live" is true if the game is in progress right now (ESPN labels this state as "in").
   const live=event.status?.type?.state==="in";
   // Build the HTML for this game's box: status and LIVE/NBA tag, both teams with their scores, and the date/time.
   return '<div class="game"><div class="game-top"><span>'+safe(eventStatus(event))+'</span><span class="'+(live?'tag live':'tag')+'">'+(live?'LIVE':'NBA')+'</span></div><div class="teamrow"><span>'+safe(teamName(away?.team))+'</span><strong>'+safe(away?.score??"—")+'</strong></div><div class="teamrow"><span>'+safe(teamName(home?.team))+'</span><strong>'+safe(home?.score??"—")+'</strong></div><div class="game-foot">'+safe(competition?.date?new Date(competition.date).toLocaleString():"Game date unavailable")+'</div></div>';
  }).join(""):'<div class="placeholder" style="grid-column:1/-1">No games listed for today. Check back on a game day.</div>';
  // Everything worked: set the header light to green and record the time of this check.
  setConnection(true,"Connected");
  $("updated").textContent="Last checked: "+new Date().toLocaleTimeString();
 } catch(error) {
  // Something failed (maybe no internet or ESPN is down). Tell the visitor instead of leaving the page broken.
  $("scores").innerHTML='<div class="placeholder" style="grid-column:1/-1">Could not load the scoreboard.</div>';
  showError("scoreError",error.message+" — Player and team lookup can still work independently.");
  setConnection(false,"Scoreboard unavailable");
 }
}

// ===== PLAYER AND TEAM DATA: downloading season statistics =====

// The player totals API uses the season-ending year (2026 = 2025–26).
// fetchSeasonRows downloads the stat rows (one per player) for one season. Optional filters can narrow
// it by player name or team. URLSearchParams safely builds the "?season=...&pageSize=..." part of the web address.
async function fetchSeasonRows(options={}) {
 const params=new URLSearchParams({season:String(options.season||state.season),pageSize:"1000",page:"1"});
 if(options.playerName) params.set("playerName",options.playerName);
 if(options.team) params.set("team",options.team);
 const result=await getJSON(STATS_API+"/playertotals?"+params.toString());
 // Make sure we return a list even if the API sends something unexpected.
 return Array.isArray(result.data)?result.data:[];
}
// fetchRows tries the newest season (2027) first. If that has no data yet, it falls back to the previous season (2026).
// It also remembers which season worked in "state.season" so the page can display it.
async function fetchRows(options={}) {
 try {
  const rows=await fetchSeasonRows({...options,season:2027});
  if(rows.length){state.season=2027;return rows;}
 } catch(error) { /* Try the latest completed season below. */ }
 const rows=await fetchSeasonRows({...options,season:2026});
 state.season=2026;
 return rows;
}
// perGame converts a season total into a per-game average by dividing by games played (and avoids dividing by zero).
function perGame(value,games) { return games?Number(value||0)/games:0; }
// fmt formats a number to a fixed number of decimal places (default 1), like 25.3.
function fmt(value,digits=1) { return Number(value||0).toFixed(digits); }
// playerAverage gets one stat (like "points") from a player's row and turns it into a per-game average.
function playerAverage(row,key) { return perGame(row[key],row.games); }
// statCards builds the grid of stat tiles shown on a player's profile (points, rebounds, shooting percentages, etc.).
function statCards(row) {
 const games=Number(row.games)||0;
 // Each item is [label, value]. Shooting percentages arrive as decimals (0.45), so multiplying by 100 gives 45%.
 const items=[
  ["Points / game",fmt(playerAverage(row,"points"))],
  ["Rebounds / game",fmt(playerAverage(row,"totalRb"))],
  ["Assists / game",fmt(playerAverage(row,"assists"))],
  ["Steals / game",fmt(playerAverage(row,"steals"))],
  ["Blocks / game",fmt(playerAverage(row,"blocks"))],
  ["FG %",fmt(Number(row.fieldPercent||0)*100,1)+"%"],
  ["3P %",fmt(Number(row.threePercent||0)*100,1)+"%"],
  ["FT %",fmt(Number(row.ftPercent||0)*100,1)+"%"]
 ];
 // Turn every item into an HTML tile, then add a small note about games played and the season.
 return '<div class="stats">'+items.map(([label,value])=>'<div class="stat"><b>'+safe(value)+'</b><span>'+safe(label)+'</span></div>').join("")+'</div><p class="tiny">'+games+' games · '+safe(row.season||state.season)+' season · regular-season totals converted to per-game averages</p>';
}
// aggregateRows combines multiple rows for the same player into one. A player traded mid-season can
// appear on several lines (one per team), so this adds the numbers together and keeps the latest team.
function aggregateRows(rows) {
 // A "Map" is a lookup table: a player's ID (or name) points to their combined stats.
 const groups=new Map();
 rows.forEach(row=>{
  const key=row.playerId||row.playerName;
  // First time seeing this player: store a copy of the row.
  if(!groups.has(key)) groups.set(key,{...row});
  else {
   // Seen before: add each counting stat from this new row to the stored one.
   const old=groups.get(key);
   ["games","gamesStarted","fieldGoals","fieldAttempts","threeFg","threeAttempts","twoFg","twoAttempts","ft","ftAttempts","offensiveRb","defensiveRb","totalRb","assists","steals","blocks","turnovers","personalFouls","points"].forEach(k=>old[k]=(Number(old[k])||0)+(Number(row[k])||0));
   if(row.team) old.team=row.team;
  }
 });
 return [...groups.values()];
}
// showPlayer draws a player's profile (name, team, position, and stat tiles) into the page element named "target".
function showPlayer(row,target) {
 const box=$(target);
 const position=row.position?" · "+row.position:"";
 box.innerHTML='<div class="cardhead"><div><h2>'+safe(row.playerName)+'</h2><div class="tiny">'+safe(row.team||"NBA")+safe(position)+' · '+safe(row.season||state.season)+' season</div></div><span class="tag">PLAYER PROFILE</span></div>'+statCards(row);
}
// searchPlayers looks up players by name and shows up to 12 matches as clickable buttons.
// "query" is what the visitor typed; "target" is the id of the page box where results should appear.
async function searchPlayers(query,target) {
 const box=$(target), q=query.trim();
 // If the search box was empty, ask for a name and stop.
 if(!q){box.innerHTML='<p class="tiny">Enter a player name first.</p>';return;}
 box.innerHTML='<div class="loading">Searching player statistics…</div>';
 try {
  // Download matching rows, merge duplicates, keep names containing the search text (ignoring capital letters),
  // sort so players with the most games come first, and keep only the first 12.
  const rows=aggregateRows(await fetchRows({playerName:q}));
  const matches=rows.filter(row=>(row.playerName||"").toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(b.games||0)-(a.games||0)).slice(0,12);
  if(!matches.length){box.innerHTML='<div class="placeholder">No matching player statistics found for this season. Try a different spelling.</div>';return;}
  // Show each match as a row with a clickable name button and the team/position.
  box.innerHTML=matches.map((row,index)=>'<div class="result"><button type="button" data-row="'+index+'">'+safe(row.playerName)+'</button><span class="tiny">'+safe(row.team||"NBA")+' · '+safe(row.position||"Player")+'</span></div>').join("");
  // Make each name button react to clicks. An "event listener" is code that waits for something to happen (here, a click).
  box.querySelectorAll("[data-row]").forEach(button=>button.addEventListener("click",()=>{
   const selected=matches[Number(button.dataset.row)];
   // On the Compare page, store the player as player one or two. Otherwise show their profile.
   if(target.startsWith("compareResults")){const slot=Number(target.slice(-1))-1;pickPlayer(slot,selected);}
   else showPlayer(selected,target==="dashPlayerResults"?"dashPlayerResults":"playerProfile");
  }));
 } catch(error) {
  // The request failed, so show a friendly message.
  box.innerHTML='<div class="error">Could not search player statistics. The independent data service may be temporarily unavailable. Try again later.</div>';
 }
}

// ===== FAVORITE TEAMS: saved in the visitor's browser =====
// "localStorage" is a small storage space inside the browser that keeps data even after the tab is closed.
// It stays on this device only and does not sync to other devices.

// getFavoriteTeams reads the saved list. JSON.parse converts saved text back into a list. If nothing is
// saved or the data is damaged, it returns an empty list instead of crashing.
function getFavoriteTeams() {
 try { const saved=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]"); return Array.isArray(saved)?saved:[]; }
 catch(error) { return []; }
}
// saveFavoriteTeams writes the list to storage (JSON.stringify converts the list to text). It returns true on success, false if the browser blocks it.
function saveFavoriteTeams(favorites) {
 try { localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites)); return true; }
 catch(error) { return false; }
}
// renderFavoriteTeams draws the "Favorite teams" list on the Teams page.
function renderFavoriteTeams() {
 const box=$("favoriteTeams"); if(!box)return;
 const favorites=getFavoriteTeams();
 if(!favorites.length){box.innerHTML='<p class="tiny">No favorite teams saved yet. Open a team and select “Save team.”</p>';return;}
 // Each saved team gets a name button (opens the team) and a Remove button.
 box.innerHTML=favorites.map(team=>'<div class="result"><button type="button" data-favorite-id="'+safe(team.id)+'">'+safe(team.name)+'</button><button type="button" data-remove-id="'+safe(team.id)+'" aria-label="Remove favorite">Remove</button></div>').join("");
 // Clicking a team name loads that team's stats.
 box.querySelectorAll("[data-favorite-id]").forEach(button=>button.addEventListener("click",()=>loadTeam(button.dataset.favoriteId,"teamProfile")));
 // Clicking Remove deletes that team from the saved list and redraws the list.
 box.querySelectorAll("[data-remove-id]").forEach(button=>button.addEventListener("click",()=>{saveFavoriteTeams(getFavoriteTeams().filter(t=>t.id!==button.dataset.removeId));renderFavoriteTeams();}));
}
// toggleFavoriteTeam adds a team to favorites if it's not there, or removes it if it is (a "toggle" flips between two states).
function toggleFavoriteTeam(team) {
 const favorites=getFavoriteTeams(), exists=favorites.some(item=>item.id===team.id);
 const next=exists?favorites.filter(item=>item.id!==team.id):[...favorites,team];
 // If saving fails (for example, storage is blocked), warn the visitor with a pop-up message.
 if(!saveFavoriteTeams(next)){alert("Your browser could not save favorites. Check its storage settings.");return;}
 // Update the button label (star filled or empty) and refresh the favorites list.
 const button=$("favoriteToggle"); if(button)button.textContent=exists?"☆ Save team":"★ Saved";
 renderFavoriteTeams();
}

// ===== TEAMS =====

// populateTeams fills both team drop-down menus with all 30 teams by creating one <option> per team.
function populateTeams() {
 ["teamSelect","teamQuick"].forEach(id=>{
  const select=$(id); if(!select)return;
  TEAMS.forEach(team=>{const option=document.createElement("option");option.value=team.id;option.textContent=team.name;select.appendChild(option);});
 });
}
// loadTeam downloads a team's players and shows a table of their stats in the page box named "target".
async function loadTeam(id,target) {
 // Find the team by its id. If it doesn't exist (e.g., nothing was chosen), stop.
 const team=TEAMS.find(item=>item.id===id); if(!team)return;
 $(target).innerHTML='<div class="loading">Loading '+safe(team.name)+' season stats…</div>';
 try {
  // Get the team's rows, keep only players currently listed with that team, and sort by total points (highest first).
  const rows=aggregateRows(await fetchRows({team:team.abbreviation}));
  const players=rows.filter(row=>row.team===team.abbreviation).sort((a,b)=>(b.points||0)-(a.points||0));
  // Check whether this team is already saved, so the button shows the correct label.
  const favorite=getFavoriteTeams().some(item=>item.id===team.id);
  // The heading: team name, abbreviation, season, and the Save/Saved button.
  const heading='<div class="cardhead"><div><h2>'+safe(team.name)+'</h2><div class="tiny">'+safe(team.abbreviation)+' · '+safe(state.season)+' season</div></div><button class="btn secondary" id="favoriteToggle" type="button">'+(favorite?'★ Saved':'☆ Save team')+'</button></div>';
  // The table: one row per player (top 20) showing games played, points, rebounds, and assists per game.
  const table=players.length?'<div class="tablewrap"><table><thead><tr><th>Player</th><th class="num">GP</th><th class="num">PTS/G</th><th class="num">REB/G</th><th class="num">AST/G</th></tr></thead><tbody>'+players.slice(0,20).map(p=>'<tr><td>'+safe(p.playerName)+'</td><td class="num">'+safe(p.games)+'</td><td class="num">'+fmt(playerAverage(p,"points"))+'</td><td class="num">'+fmt(playerAverage(p,"totalRb"))+'</td><td class="num">'+fmt(playerAverage(p,"assists"))+'</td></tr>').join("")+'</tbody></table></div>':'<div class="placeholder">No team player statistics were returned for this season. The team is still available in the directory.</div>';
  $(target).innerHTML=heading+table;
  // The Save button was just created, so connect it to its click action now.
  $("favoriteToggle").addEventListener("click",()=>toggleFavoriteTeam({id:team.id,name:team.name}));
  renderFavoriteTeams();
 } catch(error) {
  // If stats can't load, still show the team name and a working Save button, plus an error note.
  $(target).innerHTML='<div class="cardhead"><div><h2>'+safe(team.name)+'</h2><div class="tiny">'+safe(team.abbreviation)+' · NBA team</div></div><button class="btn secondary" id="favoriteToggle" type="button">☆ Save team</button></div><div class="error">Team roster statistics are temporarily unavailable. You can still save this team.</div>';
  $("favoriteToggle").addEventListener("click",()=>toggleFavoriteTeam({id:team.id,name:team.name}));
 }
}

// ===== PLAYER COMPARISON =====

// pickPlayer remembers which player was chosen for slot 0 (player one) or 1 (player two), shows the
// choice on screen, and draws the comparison as soon as both players are picked.
function pickPlayer(slot,row) {
 state.picked[slot]=row;
 $("comparePick"+(slot+1)).textContent="Selected: "+row.playerName;
 if(state.picked.every(Boolean))renderComparison();
}
// renderComparison draws a table with both players' per-game stats side by side.
function renderComparison() {
 // Pull the two chosen players out of "state" into a and b.
 const [a,b]=state.picked;
 // The stats to compare: a label to show, and the data key to read.
 const fields=[["Points per game","points"],["Rebounds per game","totalRb"],["Assists per game","assists"],["Steals per game","steals"],["Blocks per game","blocks"]];
 $("comparison").innerHTML='<div class="tablewrap"><table><thead><tr><th>Statistic</th><th class="num">'+safe(a.playerName)+'</th><th class="num">'+safe(b.playerName)+'</th></tr></thead><tbody>'+fields.map(([label,key])=>'<tr><td>'+label+'</td><td class="num">'+fmt(playerAverage(a,key))+'</td><td class="num">'+fmt(playerAverage(b,key))+'</td></tr>').join("")+'</tbody></table></div><p class="tiny">Regular-season averages for the '+safe(a.season||state.season)+' season.</p>';
}
// wireSearch connects a search box and its button so a search runs when the button is clicked
// or when the Enter key is pressed inside the box.
function wireSearch(inputId,buttonId,target) {
 $(buttonId).addEventListener("click",()=>searchPlayers($(inputId).value,target));
 $(inputId).addEventListener("keydown",event=>{if(event.key==="Enter")searchPlayers($(inputId).value,target);});
}

// ===== STARTUP: everything below runs once, when the page first loads, to connect the buttons and fill in the data =====

// TAB SWITCHING: when a tab is clicked, highlight it and show only the matching page section.
// "classList.toggle(name, condition)" adds the class if the condition is true, otherwise removes it.
document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>{
 document.querySelectorAll(".tab").forEach(item=>item.classList.toggle("active",item===button));
 document.querySelectorAll(".page").forEach(page=>page.classList.toggle("hidden",page.id!==button.dataset.tab));
}));
// The Refresh button reloads the scoreboard.
$("refreshScores").addEventListener("click",loadScores);
// Connect the two player search areas (Dashboard and Players page).
wireSearch("dashPlayerSearch","dashPlayerGo","dashPlayerResults");
wireSearch("playerSearch","playerGo","playerResults");
// "View team" loads the team chosen in the Teams page menu; choosing in the Dashboard menu loads it immediately.
$("teamGo").addEventListener("click",()=>loadTeam($("teamSelect").value,"teamProfile"));
$("teamQuick").addEventListener("change",()=>loadTeam($("teamQuick").value,"teamQuickInfo"));
// Connect both search areas on the Compare page (for player 1 and player 2).
[1,2].forEach(number=>wireSearch("compareSearch"+number,"compareGo"+number,"compareResults"+number));
// Fill the team menus, show saved favorites, and load the scoreboard for the first time.
populateTeams();
renderFavoriteTeams();
loadScores();
// setInterval repeats a task on a timer: reload the scoreboard every 60,000 milliseconds (60 seconds = 1 minute).
setInterval(loadScores,60000);
