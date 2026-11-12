"use strict";

// NBA Stats API: independent community API, no key required.
const STATS_API = "https://api.server.nbaapi.com/api";
// ESPN is used only for the live scoreboard, not player or team lookup.
const SCORE_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const $ = id => document.getElementById(id);
const state = { teams: [], picked: [null, null], season: 2027 };
const FAVORITES_KEY = "nbaStatChecker.favoriteTeams";

const TEAMS = [
 ["ATL","Atlanta Hawks"],["BOS","Boston Celtics"],["BKN","Brooklyn Nets"],["CHA","Charlotte Hornets"],["CHI","Chicago Bulls"],
 ["CLE","Cleveland Cavaliers"],["DAL","Dallas Mavericks"],["DEN","Denver Nuggets"],["DET","Detroit Pistons"],["GSW","Golden State Warriors"],
 ["HOU","Houston Rockets"],["IND","Indiana Pacers"],["LAC","LA Clippers"],["LAL","Los Angeles Lakers"],["MEM","Memphis Grizzlies"],
 ["MIA","Miami Heat"],["MIL","Milwaukee Bucks"],["MIN","Minnesota Timberwolves"],["NOP","New Orleans Pelicans"],["NYK","New York Knicks"],
 ["OKC","Oklahoma City Thunder"],["ORL","Orlando Magic"],["PHI","Philadelphia 76ers"],["PHX","Phoenix Suns"],["POR","Portland Trail Blazers"],
 ["SAC","Sacramento Kings"],["SAS","San Antonio Spurs"],["TOR","Toronto Raptors"],["UTA","Utah Jazz"],["WAS","Washington Wizards"]
].map(([abbreviation,name])=>({id:abbreviation,abbreviation,name}));
state.teams = TEAMS;

const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function getJSON(url) {
 const response = await fetch(url, {headers:{Accept:"application/json"}});
 if (!response.ok) throw new Error("Data provider returned HTTP " + response.status);
 return response.json();
}
function setConnection(ok,message) {
 const label=$("connection"); if(label) label.textContent=message;
 if(label && label.previousElementSibling) label.previousElementSibling.style.background=ok?"var(--green)":"var(--red)";
}
function showError(id,message) { $(id).innerHTML='<div class="error">'+safe(message)+'</div>'; }
function teamName(team) { return team?.displayName || team?.name || "Team"; }
function eventStatus(event) { return event?.status?.type?.shortDetail || event?.status?.type?.description || "Scheduled"; }

async function loadScores() {
 $("scores").innerHTML='<div class="loading">Refreshing scoreboard…</div>';
 $("scoreError").innerHTML="";
 try {
  const data=await getJSON(SCORE_API+"/scoreboard");
  const events=data.events||[];
  $("scores").innerHTML=events.length?events.map(event=>{
   const competition=event.competitions?.[0], competitors=competition?.competitors||[];
   const home=competitors.find(x=>x.homeAway==="home")||competitors[0];
   const away=competitors.find(x=>x.homeAway==="away")||competitors[1];
   const live=event.status?.type?.state==="in";
   return '<div class="game"><div class="game-top"><span>'+safe(eventStatus(event))+'</span><span class="'+(live?'tag live':'tag')+'">'+(live?'LIVE':'NBA')+'</span></div><div class="teamrow"><span>'+safe(teamName(away?.team))+'</span><strong>'+safe(away?.score??"—")+'</strong></div><div class="teamrow"><span>'+safe(teamName(home?.team))+'</span><strong>'+safe(home?.score??"—")+'</strong></div><div class="game-foot">'+safe(competition?.date?new Date(competition.date).toLocaleString():"Game date unavailable")+'</div></div>';
  }).join(""):'<div class="placeholder" style="grid-column:1/-1">No games listed for today. Check back on a game day.</div>';
  setConnection(true,"Connected");
  $("updated").textContent="Last checked: "+new Date().toLocaleTimeString();
 } catch(error) {
  $("scores").innerHTML='<div class="placeholder" style="grid-column:1/-1">Could not load the scoreboard.</div>';
  showError("scoreError",error.message+" — Player and team lookup can still work independently.");
  setConnection(false,"Scoreboard unavailable");
 }
}

// The player totals API uses the season-ending year (2026 = 2025–26).
async function fetchSeasonRows(options={}) {
 const params=new URLSearchParams({season:String(options.season||state.season),pageSize:"1000",page:"1"});
 if(options.playerName) params.set("playerName",options.playerName);
 if(options.team) params.set("team",options.team);
 const result=await getJSON(STATS_API+"/playertotals?"+params.toString());
 return Array.isArray(result.data)?result.data:[];
}
async function fetchRows(options={}) {
 try {
  const rows=await fetchSeasonRows({...options,season:2027});
  if(rows.length){state.season=2027;return rows;}
 } catch(error) { /* Try the latest completed season below. */ }
 const rows=await fetchSeasonRows({...options,season:2026});
 state.season=2026;
 return rows;
}
function perGame(value,games) { return games?Number(value||0)/games:0; }
function fmt(value,digits=1) { return Number(value||0).toFixed(digits); }
function playerAverage(row,key) { return perGame(row[key],row.games); }
function statCards(row) {
 const games=Number(row.games)||0;
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
 return '<div class="stats">'+items.map(([label,value])=>'<div class="stat"><b>'+safe(value)+'</b><span>'+safe(label)+'</span></div>').join("")+'</div><p class="tiny">'+games+' games · '+safe(row.season||state.season)+' season · regular-season totals converted to per-game averages</p>';
}
function aggregateRows(rows) {
 const groups=new Map();
 rows.forEach(row=>{
  const key=row.playerId||row.playerName;
  if(!groups.has(key)) groups.set(key,{...row});
  else {
   const old=groups.get(key);
   ["games","gamesStarted","fieldGoals","fieldAttempts","threeFg","threeAttempts","twoFg","twoAttempts","ft","ftAttempts","offensiveRb","defensiveRb","totalRb","assists","steals","blocks","turnovers","personalFouls","points"].forEach(k=>old[k]=(Number(old[k])||0)+(Number(row[k])||0));
   if(row.team) old.team=row.team;
  }
 });
 return [...groups.values()];
}
function showPlayer(row,target) {
 const box=$(target);
 const position=row.position?" · "+row.position:"";
 box.innerHTML='<div class="cardhead"><div><h2>'+safe(row.playerName)+'</h2><div class="tiny">'+safe(row.team||"NBA")+safe(position)+' · '+safe(row.season||state.season)+' season</div></div><span class="tag">PLAYER PROFILE</span></div>'+statCards(row);
}
async function searchPlayers(query,target) {
 const box=$(target), q=query.trim();
 if(!q){box.innerHTML='<p class="tiny">Enter a player name first.</p>';return;}
 box.innerHTML='<div class="loading">Searching player statistics…</div>';
 try {
  const rows=aggregateRows(await fetchRows({playerName:q}));
  const matches=rows.filter(row=>(row.playerName||"").toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(b.games||0)-(a.games||0)).slice(0,12);
  if(!matches.length){box.innerHTML='<div class="placeholder">No matching player statistics found for this season. Try a different spelling.</div>';return;}
  box.innerHTML=matches.map((row,index)=>'<div class="result"><button type="button" data-row="'+index+'">'+safe(row.playerName)+'</button><span class="tiny">'+safe(row.team||"NBA")+' · '+safe(row.position||"Player")+'</span></div>').join("");
  box.querySelectorAll("[data-row]").forEach(button=>button.addEventListener("click",()=>{
   const selected=matches[Number(button.dataset.row)];
   if(target.startsWith("compareResults")){const slot=Number(target.slice(-1))-1;pickPlayer(slot,selected);}
   else showPlayer(selected,target==="dashPlayerResults"?"dashPlayerResults":"playerProfile");
  }));
 } catch(error) {
  box.innerHTML='<div class="error">Could not search player statistics. The independent data service may be temporarily unavailable. Try again later.</div>';
 }
}

function getFavoriteTeams() {
 try { const saved=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]"); return Array.isArray(saved)?saved:[]; }
 catch(error) { return []; }
}
function saveFavoriteTeams(favorites) {
 try { localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites)); return true; }
 catch(error) { return false; }
}
function renderFavoriteTeams() {
 const box=$("favoriteTeams"); if(!box)return;
 const favorites=getFavoriteTeams();
 if(!favorites.length){box.innerHTML='<p class="tiny">No favorite teams saved yet. Open a team and select “Save team.”</p>';return;}
 box.innerHTML=favorites.map(team=>'<div class="result"><button type="button" data-favorite-id="'+safe(team.id)+'">'+safe(team.name)+'</button><button type="button" data-remove-id="'+safe(team.id)+'" aria-label="Remove favorite">Remove</button></div>').join("");
 box.querySelectorAll("[data-favorite-id]").forEach(button=>button.addEventListener("click",()=>loadTeam(button.dataset.favoriteId,"teamProfile")));
 box.querySelectorAll("[data-remove-id]").forEach(button=>button.addEventListener("click",()=>{saveFavoriteTeams(getFavoriteTeams().filter(t=>t.id!==button.dataset.removeId));renderFavoriteTeams();}));
}
function toggleFavoriteTeam(team) {
 const favorites=getFavoriteTeams(), exists=favorites.some(item=>item.id===team.id);
 const next=exists?favorites.filter(item=>item.id!==team.id):[...favorites,team];
 if(!saveFavoriteTeams(next)){alert("Your browser could not save favorites. Check its storage settings.");return;}
 const button=$("favoriteToggle"); if(button)button.textContent=exists?"☆ Save team":"★ Saved";
 renderFavoriteTeams();
}
function populateTeams() {
 ["teamSelect","teamQuick"].forEach(id=>{
  const select=$(id); if(!select)return;
  TEAMS.forEach(team=>{const option=document.createElement("option");option.value=team.id;option.textContent=team.name;select.appendChild(option);});
 });
}
async function loadTeam(id,target) {
 const team=TEAMS.find(item=>item.id===id); if(!team)return;
 $(target).innerHTML='<div class="loading">Loading '+safe(team.name)+' season stats…</div>';
 try {
  const rows=aggregateRows(await fetchRows({team:team.abbreviation}));
  const players=rows.filter(row=>row.team===team.abbreviation).sort((a,b)=>(b.points||0)-(a.points||0));
  const favorite=getFavoriteTeams().some(item=>item.id===team.id);
  const heading='<div class="cardhead"><div><h2>'+safe(team.name)+'</h2><div class="tiny">'+safe(team.abbreviation)+' · '+safe(state.season)+' season</div></div><button class="btn secondary" id="favoriteToggle" type="button">'+(favorite?'★ Saved':'☆ Save team')+'</button></div>';
  const table=players.length?'<div class="tablewrap"><table><thead><tr><th>Player</th><th class="num">GP</th><th class="num">PTS/G</th><th class="num">REB/G</th><th class="num">AST/G</th></tr></thead><tbody>'+players.slice(0,20).map(p=>'<tr><td>'+safe(p.playerName)+'</td><td class="num">'+safe(p.games)+'</td><td class="num">'+fmt(playerAverage(p,"points"))+'</td><td class="num">'+fmt(playerAverage(p,"totalRb"))+'</td><td class="num">'+fmt(playerAverage(p,"assists"))+'</td></tr>').join("")+'</tbody></table></div>':'<div class="placeholder">No team player statistics were returned for this season. The team is still available in the directory.</div>';
  $(target).innerHTML=heading+table;
  $("favoriteToggle").addEventListener("click",()=>toggleFavoriteTeam({id:team.id,name:team.name}));
  renderFavoriteTeams();
 } catch(error) {
  $(target).innerHTML='<div class="cardhead"><div><h2>'+safe(team.name)+'</h2><div class="tiny">'+safe(team.abbreviation)+' · NBA team</div></div><button class="btn secondary" id="favoriteToggle" type="button">☆ Save team</button></div><div class="error">Team roster statistics are temporarily unavailable. You can still save this team.</div>';
  $("favoriteToggle").addEventListener("click",()=>toggleFavoriteTeam({id:team.id,name:team.name}));
 }
}
function pickPlayer(slot,row) {
 state.picked[slot]=row;
 $("comparePick"+(slot+1)).textContent="Selected: "+row.playerName;
 if(state.picked.every(Boolean))renderComparison();
}
function renderComparison() {
 const [a,b]=state.picked;
 const fields=[["Points per game","points"],["Rebounds per game","totalRb"],["Assists per game","assists"],["Steals per game","steals"],["Blocks per game","blocks"]];
 $("comparison").innerHTML='<div class="tablewrap"><table><thead><tr><th>Statistic</th><th class="num">'+safe(a.playerName)+'</th><th class="num">'+safe(b.playerName)+'</th></tr></thead><tbody>'+fields.map(([label,key])=>'<tr><td>'+label+'</td><td class="num">'+fmt(playerAverage(a,key))+'</td><td class="num">'+fmt(playerAverage(b,key))+'</td></tr>').join("")+'</tbody></table></div><p class="tiny">Regular-season averages for the '+safe(a.season||state.season)+' season.</p>';
}
function wireSearch(inputId,buttonId,target) {
 $(buttonId).addEventListener("click",()=>searchPlayers($(inputId).value,target));
 $(inputId).addEventListener("keydown",event=>{if(event.key==="Enter")searchPlayers($(inputId).value,target);});
}

document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>{
 document.querySelectorAll(".tab").forEach(item=>item.classList.toggle("active",item===button));
 document.querySelectorAll(".page").forEach(page=>page.classList.toggle("hidden",page.id!==button.dataset.tab));
}));
$("refreshScores").addEventListener("click",loadScores);
wireSearch("dashPlayerSearch","dashPlayerGo","dashPlayerResults");
wireSearch("playerSearch","playerGo","playerResults");
$("teamGo").addEventListener("click",()=>loadTeam($("teamSelect").value,"teamProfile"));
$("teamQuick").addEventListener("change",()=>loadTeam($("teamQuick").value,"teamQuickInfo"));
[1,2].forEach(number=>wireSearch("compareSearch"+number,"compareGo"+number,"compareResults"+number));
populateTeams();
renderFavoriteTeams();
loadScores();
setInterval(loadScores,60000);
