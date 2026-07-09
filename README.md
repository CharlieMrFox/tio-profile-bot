# Test IO — Profile Verification Bot

Discord bot that checks whether a name has a matching Test IO tester profile.
Ported from a Tampermonkey userscript.

## Features

- `/checkprofiles` — paste a batch of names into a modal, get back who has a
  matching Test IO profile and who doesn't.
- Automatic join check — when someone joins the server, the bot checks their
  Discord display name against Test IO. If found, it grants a "Verified
  Tester" role automatically. If not found, it DMs them guidance (with a
  public fallback message if their DMs are closed).

## Local setup

```bash
npm install
cp .env.example .env   # then fill in the values, see below
node deploy-commands.js   # registers /checkprofiles — only needs to be run once, or again after changing commands
node index.js              # starts the bot
```

## Environment variables

See `.env.example` for the full list and descriptions. Required:
- `DISCORD_TOKEN`
- `CLIENT_ID`

Optional:
- `GUILD_ID` — instant command registration to one test server
- `FALLBACK_CHANNEL_ID` — public fallback if a DM fails
- `VERIFIED_ROLE_ID` — role auto-granted on a profile match

## Deploying so it runs 24/7 (Railway)

This repo is set up to deploy on [Railway](https://railway.app) directly from
GitHub, so the bot stays online without needing your own machine running.

1. Push this repo to GitHub (see below if you haven't already).
2. Go to [railway.app](https://railway.app) → sign in with GitHub.
3. **New Project → Deploy from GitHub repo** → select this repo.
4. Railway auto-detects Node.js and runs `npm install` then `npm start`
   (defined in `package.json`).
5. Go to the new service → **Variables** tab → add each variable from
   `.env.example` with your real values (Railway injects these as
   environment variables — you do NOT upload a `.env` file, and it's
   gitignored anyway).
6. Deploy. Check the **Deployments → Logs** tab for
   `Logged in as YourBotName#1234` to confirm it's live.
7. Slash commands only need to be (re-)registered when they change — run
   `node deploy-commands.js` locally once with production values in your
   local `.env`, or add it as a one-off Railway command from the service's
   shell.

From this point, Railway keeps the process alive, restarts it if it crashes,
and redeploys automatically every time you push to the connected branch.

## Pushing to GitHub for the first time

```bash
git init
git add .
git commit -m "Initial commit: Test IO profile verification bot"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

Create the empty repo on GitHub first (github.com → New repository) before
running the `remote add` / `push` commands above.
