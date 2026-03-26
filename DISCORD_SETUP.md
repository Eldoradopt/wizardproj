# Putting Your Game on Discord

To see your game running inside Discord as an Activity, follow these steps:

## 1. Push Your Code to GitHub
Before you can host your game, ensure all your files are uploaded to GitHub.
In your terminal, run:
```bash
git add .
git commit -m "initial game files for discord activity"
git push origin main
```

## 2. Deploy to GitHub Pages
GitHub Pages will host your game for free and provide the `https` URL Discord requires.
1.  Go to your repository on GitHub (e.g., `https://github.com/Eldoradopt/wizardproj`).
2.  Click **"Settings"** -> **"Pages"** (in the sidebar).
3.  Under **"Build and deployment"**, set the Source to **"Deploy from branch"**.
4.  Choose the **`main`** branch and the `/(root)` folder.
5.  Click **"Save"**.
6.  Wait a minute, then refresh. You'll see a banner at the top: **"Your site is live at https://eldoradopt.github.io/wizardproj/"**.

## 3. Create a Discord Application
1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Click **"New Application"** and name it "Wizard Worms".
3.  On the left sidebar, click **"App Launcher"**.
4.  Configure the basic information (Icon, Description).

## 4. Configure the Activity URL
This step tells Discord where to find your game.
1.  In the Developer Portal, go to **"App Launcher"** -> **"URL Mapping"**.
2.  Set the **External URL** to your GitHub Pages URL (e.g., `https://eldoradopt.github.io/wizardproj/`).
3.  Click **"Save Changes"**.

## 5. Test in Discord
1.  Open Discord (App or Browser).
2.  Join a Voice Channel.
3.  Click the **"Choose an Activity"** (Rocket icon) or **App Launcher** button.
4.  Find "Wizard Worms" and click it!

## 6. (Optional) Enhance with Discord SDK
Once your app is registered, you should update your `clientId` in `src/main.js`:
```javascript
// src/main.js
import { DiscordSDK } from "@discord/embedded-app-sdk";

const discordSdk = new DiscordSDK({
    clientId: "YOUR_CLIENT_ID_HERE"
});

setupDiscord();

async function setupDiscord() {
    await discordSdk.ready();
    console.log("Discord SDK is ready!");
}
```
This is needed for user profiles, voices, and multiplayer features!
