# Esports Manager: Broadcast Graphics for vMix

A full broadcast graphics package for **EA SPORTS FC** and **Call of Duty** (plus a generic mode for any map-based game).
The graphics are web pages hosted on **GitHub Pages**, kept in sync live through **Firebase**, and driven from a control panel you can open on any device.

vMix needs only **3 Web Browser inputs**:

| # | Input | URL | What's inside |
|---|---|---|---|
| 1 | Scenes | `…/output/scene.html` | Starting soon, BRB, ending, countdown, tactical/technical pause, match intro, map veto, bracket, schedule, standings, winner |
| 2 | In-game overlay | `…/output/overlay.html` | Scorebug (goals + clock for FC, map/mode + series for CoD), series strip, pause banner, lower third, ticker |
| 3 | Caster frame | `…/output/cast.html` | 1, 2 or 3 camera frames with nameplates and an "Up next" bar |

Control panel: `…/control/` (keep it out of vMix; open it in Chrome on the producer's machine, a tablet or a phone).

**Live site:** <https://acenagata.github.io/esports-manager/> (repo `AceNagata/esports-manager`, Firebase project `esports-manager-baadb`).

---

## 1. Team colors and logos

The graphics carry no tournament branding. Each team's color and logo drive the scorebug, intro, veto, bracket and winner screens.

- **Match tab**: next to each team's score there is a color picker, an **Upload logo** button and **No logo**. These edit whichever team is playing on that side.
- **Teams tab**: edit every team's name, tag, color, logo and players. A logo can be uploaded (resized to 256 px and stored in the database, no code push needed), or given as a URL or a path like `assets/logos/team.png`.
- Teams without a logo get a badge with their tag in the team color.

The interface highlight colors (`accent`, `accent2`, backgrounds) can be changed in `assets/js/config.js`.

Map images (optional): save a JPG for each map as `assets/maps/<map-name>.jpg`, lowercase with dashes for spaces (e.g. `den.jpg`, `blackheart.jpg`). The veto cards use them automatically.

## 2. Firebase (live sync, free)

1. Go to <https://console.firebase.google.com>, then **Add project**. Google Analytics isn't needed.
2. **Build → Realtime Database → Create database**. Pick a region close to you and start in **locked mode**.
3. **Build → Authentication → Get started → Email/Password → Enable**.
   Then go to **Users → Add user** and create an operator login for each producer.
4. Copy each user's **User UID**. In **Realtime Database → Data**, add the following (the value can be anything, e.g. `true`):
   ```
   operators
     └─ <USER UID>: true
   ```
5. **Realtime Database → Rules**: paste the contents of `database.rules.json` and click **Publish**.
   This rule lets anyone read the graphics, but only listed operators can change them.
6. **Project settings → General → Your apps → Web (</>)**: register the app and copy the config values into `firebase` in `assets/js/config.js`. Make sure `databaseURL` is filled in. If it's missing from the snippet, copy the URL shown at the top of **Realtime Database → Data**.

The `apiKey` is not a secret. It's safe in a public repo, because the database rules decide who can write.

Without Firebase config, everything runs in **local mode**. The control panel and outputs then sync only between tabs of the same browser, which is useful for testing but **won't reach vMix**.

## 3. GitHub Pages (hosting, free)

1. Create a GitHub repository (e.g. `esports-overlay`) and upload the contents of this folder to it.
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root → Save**.
3. After about a minute your site is live at `https://<username>.github.io/esports-overlay/`.
   The landing page there lists every output URL with copy buttons.

Every change you push goes live within about a minute. Show data (scores, teams, veto) lives in Firebase, so it changes instantly and never needs a push.

## 4. vMix setup

For each of the 3 outputs: **Add Input → Web Browser**

- **URL**: the output URL (without `?preview=1`)
- **Width / Height**: `1920` × `1080`
- **Transparent background**: ON (vMix 24+ browser inputs are transparent by default)

Then:

- **Input 2 (overlay)**: put it on **Overlay channel 1** and leave it on during gameplay. The scorebug, banners and lower thirds animate in and out by themselves; you never cut it.
- **Input 1 (scenes)**: full-screen. Either put it on **Overlay channel 2** over your game feed or cut to it as a normal input. When no scene is active, it's fully transparent.
- **Input 3 (caster frame)**: create a vMix input for the desk (e.g. a Colour input or a Virtual Set) and add your camera inputs as **Layers**, positioned to match these windows. Add the caster frame input as the top layer.

  | Layout | Cam 1 (x, y, w, h) | Cam 2 | Cam 3 |
  |---|---|---|---|
  | 1 cam | 360, 170, 1200, 675 | | |
  | 2 cams | 90, 250, 840, 473 | 990, 250, 840, 473 | |
  | 3 cams | 48, 300, 576, 324 | 672, 300, 576, 324 | 1296, 300, 576, 324 |

Tips:
- Right-click a browser input → **Refresh** if you ever change the code mid-show. Data changes need no refresh.
- **Backup slates**: when a scene looks right, use vMix's **Snapshot Input** (right-click the input) to save a PNG. Load these as image inputs, so you still have holding screens if the internet drops.
- If the connection drops, the outputs keep showing their last state and reconnect automatically.

## 5. Running the show

| Tab | Use it for |
|---|---|
| **ON AIR bar** (always visible) | Toggle scorebug, series strip, lower third, ticker and pause banner; clear the scene |
| **Match** | Game, teams, scores, series, current map (CoD), clock + period + aggregate (FC), swap sides, load next match from the schedule |
| **Map veto** | Pick the format, then click maps for each highlighted step. Deciders fill automatically. You can undo or clear any step. |
| **Scenes** | Starting soon / BRB / ending, countdown, intro, veto, bracket, schedule, standings, winner. Click a live (red) button again to take it off. |
| **Breaks** | Tactical pause (per team) or technical pause with count-up or time limit; banner on the overlay and/or the full-screen pause scene |
| **Lower thirds & casters** | Lower third text with quick-fill buttons for casters and players, ticker text, caster cam layout and names |
| **Bracket** | Generate single/double elimination (4/8/16 teams); enter scores, click the winner, and teams advance |
| **Schedule & standings** | Match list with live/done status; group table, auto-sorted by points then difference |
| **Teams** | Names, tags, colors, logos, players |
| **Settings** | vMix URLs, map pools, JSON backup/restore, reset |

Hotkeys (when no text field is focused): `1`/`2` add a point to team A/B, `Shift+1`/`Shift+2` remove one, `S` toggles the scorebug, `Esc` clears the scene.

### Show-day checklist
- [ ] Teams, logos and players entered; schedule filled
- [ ] Map pools checked against the current CDL rotation (**Settings → Map pools**)
- [ ] All 3 vMix browser inputs load, with the control panel showing **Live · synced**
- [ ] Test each scene, the veto and a pause once before going live
- [ ] Export a JSON backup (**Settings**)
- [ ] Snapshot backup slates in vMix

## Game notes

- **Call of Duty**: the default pool is the CDL 2026 (Black Ops 7) launch pool. Hardpoint: Blackheart, Colossus, Den, Exposure, Scar. S&D: Colossus, Den, Exposure, Raid, Scar. Overload: Den, Exposure, Scar. The BO5 veto follows the CDL pattern: HP ban/ban/pick/pick, S&D ban/ban/pick/pick, Overload ban/ban/decider, played in the order HP, S&D, OVL, HP, S&D.
- **EA FC**: no veto. The scorebug shows goals plus a running match clock (start/pause/set) and period. Optional aggregate score for two-legged ties, and "plays as" club names on the match intro.
- **Other game**: set your maps under **Settings → Map pools → Other game**, then choose BO1/BO3/BO5.

## Local testing

Serve the folder with any static server. A PowerShell one is included, so nothing needs installing:

```bash
powershell -ExecutionPolicy Bypass -File .claude/serve.ps1
```

Open `http://localhost:8080/control/` and the outputs (add `?preview=1` for a checkerboard background) in the same browser.

## File map

```
config            assets/js/config.js       ← edit this
styles            assets/css/theme.css, output.css, control.css
logic             assets/js/state.js (defaults) · sync.js (Firebase/local) · games.js (games + veto) · bracket.js
outputs           output/scene.* · overlay.* · cast.*
control panel     control/index.html · control.js
security rules    database.rules.json
```
