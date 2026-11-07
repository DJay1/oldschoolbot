# Live playtest setup

Use a separate folder and database from the Los Perros test bot. Leave `NODE_ENV` unset. `NODE_ENV=production` points logs and channels at the official Old School Bot servers.

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
BOT_ENV=production
USE_REAL_PG=1
TESTING_SERVER=
TESTING_LOG_CHANNEL=
ADMIN_USER_IDS=
PATREON_URL=https://patreon.com/bscbot
```

`BOT_ENV=production` is the live-play lock. It turns off instant trips, tame trips that finish immediately, instant nursery hatches, `/testpotato` (including spawn), `/qualitycheck`, and `/testershop`. `/admin` and `/rp` work only for the Discord user ids in `ADMIN_USER_IDS` (the application owner is added on login as well).

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

With `BOT_ENV=production` and `NODE_ENV` unset, the bot registers global slash commands on startup. Global commands include Discord DM permission (`dm_permission` and contexts for guilds, bot DMs, and group DMs). Players who share a server with the bot can use those commands in a DM with the bot.

`/admin` and `/rp` stay guild commands on `TESTING_SERVER` and are not available in DMs.

The test bot (no `BOT_ENV=production`) still installs every command on `TESTING_SERVER` only. That guild install is unchanged and does not publish global commands.

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

## 7. Patron tiers

Create three tiers on https://patreon.com/bscbot:

| Tier | Price | In-game |
| --- | --- | --- |
| Pup | $3 | 🐾 on the name, +10% of the 30 minute base trip length |
| Good Boy | $7 | Pup benefits, +20% trip length, the Good Boy bank background, daily cooldown at 75%, monthly cosmetic box |
| Top Dog | $15 | Good Boy benefits, custom bank background color, 🐶 cosmetic pet, early-access role |

No tier gives coins, tradeable items, XP lamps, or drop-rate boosts. The early supporter corgi (bit 199) is separate.

In Patreon, enable the Discord integration and connect the three tiers to three roles in the support server. Enable the Server Members intent for the bot in the Discord developer portal. Then set:

```
SUPPORT_SERVER_ID=
PATRON_ROLE_PUP=
PATRON_ROLE_GOODBOY=
PATRON_ROLE_TOPDOG=
```

The bot reads those roles on member updates and once an hour, and sets `PatronTier1`, `PatronTier2`, or `PatronTier3`. Losing the role clears the tier. An owner override is kept:

```
/admin patron user:@Player tier:2
```

`tier` is 0, 1, 2, or 3. Add `manual:false` to let the next role sync replace it.

Optional API sync, if you would rather not rely only on roles:

```
PATREON_CREATOR_TOKEN=
PATREON_CAMPAIGN_ID=
PATREON_TIER_PUP_ID=
PATREON_TIER_GOODBOY_ID=
PATREON_TIER_TOPDOG_ID=
```

The old oldschoolgg Patreon and GitHub sponsor sync does not run.
