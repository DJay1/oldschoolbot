# Live playtest setup

Use a separate folder and database from the Los Perros test bot. Production mode is `isProductionMode()` in `src/lib/hosting/productionMode.ts`, which `globalConfig.isProduction` calls. Set `PRODUCTION=true`. When `PRODUCTION` is unset, `NODE_ENV=production` still means production, and that also points logs and channels at the official Old School Bot servers.

## 1. Database

Create two empty Postgres databases, for example `bsc_live` and `bsc_robochimp`. Do not reuse `osb_test` or `robochimp_test`.

## 2. Environment

Copy `.env.example` to `.env` in this folder and set:

```
CLIENT_ID=
BOT_TOKEN=
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/bsc_live
ROBOCHIMP_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/bsc_robochimp
TZ=UTC
PRODUCTION=true
USE_REAL_PG=1
TESTING_SERVER=
TESTING_LOG_CHANNEL=
ADMIN_USER_IDS=
PATREON_URL=https://patreon.com/bscbot
```

`PRODUCTION=true` is the live-play lock. It turns off instant trips, tame trips that finish immediately, instant nursery hatches, `/testpotato` (including spawn), `/qualitycheck`, and `/testershop`. `/admin` and `/rp` work only for the Discord user ids in `ADMIN_USER_IDS` (the application owner is added on login as well). Do not add a second production parser.

`TESTING_SERVER` is the guild where `/admin` and `/rp` are registered. `TESTING_LOG_CHANNEL` is where trip notifications and server announcements go while `NODE_ENV` is not `production`.

`PATREON_URL` defaults to `https://patreon.com/bscbot` when it is omitted. Set it only to replace that page. Do not point it at an oldschoolgg or magnaboy Patreon.

Perk tier numbers are unchanged.

## 3. Schema

From this folder:

```
corepack enable
pnpm i
npx prisma db push
npx prisma db push --schema ./prisma/robochimp.prisma
```

## 4. Command sync and DMs

With `PRODUCTION=true` and `NODE_ENV` unset, the bot registers global slash commands on startup. Global commands include Discord DM permission (`dm_permission` and contexts for guilds, bot DMs, and group DMs). Players who share a server with the bot can use those commands in a DM with the bot.

`/admin` and `/rp` stay guild commands on `TESTING_SERVER` and are not available in DMs.

The test bot (`PRODUCTION=false`) still installs every command on `TESTING_SERVER` only. That guild install is unchanged and does not publish global commands.

The Direct Messages intent is already requested in code. Slash commands in DMs do not need the Message Content intent. In the Discord developer portal, the bot must be allowed to create slash commands, and server members must be able to DM the bot.

On a `NODE_ENV=production` process, startup does not sync commands. Run this from the support server after the bot is up:

```
/admin sync_commands
```

## 5. Start

```
pnpm build-and-run
```

Do not use `pnpm start` for the live folder. That command restarts the process whenever a file changes.

## 6. Launch event

The launch event is off until an admin turns it on. Dates are UTC.

```
/admin event action:list
/admin event action:enable name:launch
/admin event action:schedule name:launch start:2026-11-07T00:00:00Z end:2026-11-14T00:00:00Z
/admin event action:disable name:launch
/claim name:Founder
```

Founder titles already claimed still show when the event is off.
