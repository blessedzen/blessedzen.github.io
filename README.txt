NBA STAT CHECKER — UPDATED FILES

FILES
- index.html: website structure
- style.css: website styling
- script.js: player search, player statistics, team directory, team statistics, comparisons, favorites, and scoreboard

INSTALL ON GITHUB PAGES
1. Download and unzip nba-stat-checker-updated.zip.
2. Open your GitHub repository.
3. Upload index.html, style.css, and script.js to the same folder (usually the repository root).
4. Replace the old files when GitHub asks.
5. Commit the changes.
6. Open your GitHub Pages website and refresh. If an old version appears, do a hard refresh (Cmd+Shift+R on Mac).

DATA SOURCES
- Player and team season totals: api.server.nbaapi.com, an independent community-run NBA statistics API. No API key is used. The website tries the 2026-27 season first, then falls back to 2025-26 if current-season data is not available. Season totals are converted into per-game averages where displayed.
- Live scoreboard only: ESPN's scoreboard endpoint. ESPN is no longer used for player search, team dropdowns, or team statistics.
- Team names and abbreviations: built into script.js, so all 30 teams appear without a remote team-list request.

NOTES
- This is an unofficial fan-made project and is not affiliated with the NBA or ESPN.
- The independent statistics API is community-run; it may be temporarily unavailable or its data may be delayed.
- Favorites are stored in this browser using localStorage. Favorites do not automatically sync to another device or browser.
- JavaScript syntax was checked with Node.js. Live API requests could not be verified from this environment, so test player search and team statistics after uploading.
