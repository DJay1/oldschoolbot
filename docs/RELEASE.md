# Self-hosting Bark School Corgo

This is the runbook for one Windows PC that runs two copies of the bot: a live bot and a test bot. Later, the live bot can move to a server using the same files.

The live checkout stays on the release branch. Today that branch is `los-perros`. When this repo becomes the private `bsc-bot` repo, that branch is `main`. The test checkout is the one that switches branches.

## What DJ sets up by hand

The scripts cannot create Discord applications or Postgres databases.

1. Create two Discord applications at <https://discord.com/developers/applications>. One is production. One is test. Each has its own bot token and application id. Do not reuse a token.
2. In each application, open Bot and turn on the Server Members privileged intent. Leave Message Content and Presence off. Patron role sync reads member updates, and the client requests Guild Members. The full list is below.
3. Create four Postgres databases on the local server: `bsc_prod`, `bsc_test`, `robochimp_prod`, and `robochimp_test`.
4. Install Redis, or Memurai on Windows, and leave it on `127.0.0.1:6379`. One Redis serves both bots. They use different database numbers and key prefixes.
5. Make two folders, for example `C:\bsc\prod` and `C:\bsc\test`, and clone the repo into each.
6. In each folder, copy the example env file, fill in that bot's token, application id, guild id, channel id, and database URLs. Real env files are gitignored.

```bat
psql -U postgres -c "CREATE DATABASE bsc_prod;"
```

```bat
psql -U postgres -c "CREATE DATABASE bsc_test;"
```

```bat
psql -U postgres -c "CREATE DATABASE robochimp_prod;"
```

```bat
psql -U postgres -c "CREATE DATABASE robochimp_test;"
```

If the Postgres user or password is not `postgres` / `postgres`, change the URLs in the env files. The shape is `postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME?schema=public`.

## Two checkouts

Prod is pinned to the release branch. Test is allowed to check out a pull-request branch. Building in the test folder does not rewrite the prod folder's `dist`, emoji id file, logs, or icon cache.

```bat
mkdir C:\bsc
```

```bat
cd /d C:\bsc
```

```bat
git clone https://github.com/DJay1/oldschoolbot.git prod
```

```bat
git clone https://github.com/DJay1/oldschoolbot.git test
```

```bat
cd /d C:\bsc\prod
```

```bat
git checkout los-perros
```

```bat
cd /d C:\bsc\test
```

```bat
git checkout los-perros
```

When the private repo exists, clone `bsc-bot` instead and pin prod to `main`.

In `C:\bsc\prod`:

```bat
copy .env.production.example .env.production
```

In `C:\bsc\test`:

```bat
copy .env.test.example .env.test
```

Edit each file. Production must have `PRODUCTION=true`. Test must have `PRODUCTION=false`. Do not set `TEST=true` in `.env.test`. That variable belongs to the automated suite (`.env.integration`).

Then, in each folder:

```bat
corepack enable
```

```bat
pnpm install
```

Prod database:

```bat
cd /d C:\bsc\prod
```

```bat
pnpm db:push:prod
```

Test database:

```bat
cd /d C:\bsc\test
```

```bat
pnpm db:push:test
```

`db:push:prod` and `db:push:test` load the matching env file, push `prisma/schema.prisma` and `prisma/robochimp.prisma`, then run `scripts/execute-sql.ts`. Prisma uses `DATABASE_URL` and `ROBOCHIMP_DATABASE_URL` from that file. The bot process does the same: `BSC_ENV=prod` or `BSC_ENV=test` selects real Postgres even if `USE_REAL_PG` is forgotten. Leave `USE_REAL_PG=1` in the files anyway.

Build each folder once before the first start, and again after every pull:

```bat
pnpm build:quick
```

Upload emojis once per application. The id file is per bot and gitignored, so the two processes do not share snowflakes.

```bat
cd /d C:\bsc\prod
```

```bat
pnpm exec dotenv -e .env.production -- pnpm emojis:sync
```

```bat
cd /d C:\bsc\test
```

```bat
pnpm exec dotenv -e .env.test -- pnpm emojis:sync
```

## Env files and scripts

| File | Committed | Used by |
| --- | --- | --- |
| `.env.production.example` | yes | copy to `.env.production` |
| `.env.test.example` | yes | copy to `.env.test` |
| `.env.production` | no | live bot |
| `.env.test` | no | test bot |
| `.env.integration` | yes | `pnpm test:integration` and CI only |
| `.env` | no | local contributor setup from `.env.example` |

`PRODUCTION` is the mode flag. `src/lib/hosting/productionMode.ts` is the only parser. `globalConfig.isProduction` calls it. `true` / `1` / `yes` / `on` are production. `false` / `0` / `no` / `off` are not. When `PRODUCTION` is unset, `NODE_ENV=production` still means production, which is the old behavior.

`testingShortcutsEnabled()` is the opposite of `isProductionMode()`. Production turns off instant trips, tame trips that finish immediately, instant nursery hatches, `/testpotato` (including spawn), `/qualitycheck`, and `/testershop`. `/admin` and `/rp` work only for the Discord user ids in `ADMIN_USER_IDS`. The application owner is added to that list on login. Do not add a second production parser.

Scripts, from the repo root:

| Script | What it loads |
| --- | --- |
| `pnpm start:prod` | `.env.production`, then `node dist` |
| `pnpm start:test` | `.env.test`, then `node dist` |
| `pnpm db:push:prod` | `.env.production` |
| `pnpm db:push:test` | `.env.test` |
| `pnpm wipe:prod` | `.env.production` |
| `pnpm backup:prod` | `.env.production` |
| `pnpm backup:test` | `.env.test` |

`start:prod` and `start:test` do not rebuild. A crash restart must not rewrite `dist` while the other bot is running.

## Running both at once

The game process does not listen on an HTTP port. Discord is an outbound gateway connection. Sharding uses in-process worker threads (`WorkerShardingStrategy` in `@discordjs/ws`), not a shared lock or a local port. Trip workers (Piscina) are also in-process. Two different bot tokens can be online together. Two processes with the same token will kick each other off Discord. Do not do that.

There is no shared pid file.

| Resource | Production | Test |
| --- | --- | --- |
| Postgres | `bsc_prod` | `bsc_test` |
| Robochimp Postgres | `robochimp_prod` | `robochimp_test` |
| Redis DB / prefix | `0` / `bsc:prod:` | `1` / `bsc:test:` |
| Icon cache | `icon_cache/prod` | `icon_cache/test` |
| JSON logs | `logs/prod` | `logs/test` |
| Launcher log | `bot-prod.log` | `bot-test.log` |
| Emoji id file | `application-emoji-ids.prod.json` | `application-emoji-ids.test.json` |
| PGLite folder, if it is ever used | `.db/*-prod` | `.db/*-test` |

Pool sizes in the examples are `PG_POOL_MAX=10` and `PG_POOL_MIN=2`. Each process opens a game pool and a Robochimp pool. Two processes at the old default (minimum 20, twice) can exhaust a desktop Postgres `max_connections` of 100.

If Redis is down, the test process falls back to an in-memory cache. The production process keeps using Redis and will not share that memory. Start Redis before the live bot.

The separate `packages/robochimp` service has an `HTTP_PORT`. This game bot does not start that service. If you run it later, give prod and test different ports.

## Slash commands, invite, intents

On startup the production bot publishes every command that is not tied to a guild as a global command, and publishes `/admin` and `/rp` only to `SUPPORT_GUILD_ID`. Global commands are what make the bot work in any server that invites it, and in DMs. Discord can take up to an hour to show a new global command everywhere. A failed refresh is logged and the process stays up, so a crash loop cannot take the bot down over a rate limit.

The test bot publishes the whole command list to its own `SUPPORT_GUILD_ID` only. Those updates show up immediately. QC the test bot in that server.

Invite URL. Replace `YOUR_CLIENT_ID` with that application's id. Scopes are `bot` and `applications.commands`. The permission integer `277562641472` is View Channels, Send Messages, Send Messages in Threads, Embed Links, Attach Files, Read Message History, Add Reactions, Use External Emojis, Manage Webhooks, and Use Application Commands. Manage Webhooks is required because the bot creates a webhook to talk in a channel.

```text
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=277562641472&scope=bot%20applications.commands
```

Invite the production bot to the support guild and to any server that should play. Invite the test bot only to the test guild.

Gateway intents requested in `src/discord/client.ts`:

- Guilds
- GuildMembers (the Server Members privileged intent)
- GuildMessages
- GuildMessageReactions
- DirectMessages
- DirectMessageReactions
- GuildWebhooks

Turn Server Members on in the developer portal. Leave Message Content and Presence off. Slash commands in DMs use the Direct Messages intent, which is already requested. They do not need Message Content.

Production startup registers global commands with DM permission (`dm_permission`, and contexts for guilds, bot DMs, and group DMs). `/admin` and `/rp` stay on `SUPPORT_GUILD_ID` and are not in DMs. The test bot installs every command on its support guild only and does not publish global commands.

`LOG_CHANNEL_ID` is the channel that receives the startup message and the log channels. Put a channel from the support guild there. Without it, production still has the old Old School GG channel ids and those sends will fail.

`SUPPORT_GUILD_ID` is where production registers `/admin` and `/rp`, and where the test bot registers everything. `TESTING_SERVER` and `TESTING_SERVER_ID` still work if `SUPPORT_GUILD_ID` is unset. Patron role sync uses `SUPPORT_SERVER_ID` when that is set, and otherwise uses this same guild. The Discord application owner is added as an admin when the bot connects.

`ADMIN_USER_IDS` is a comma-separated list of Discord user ids. On a production bot, only those users can run `/admin` and `/rp`. Leave it unset to keep the historical default id.

`PATREON_URL` is the public Patreon page. It defaults to `https://patreon.com/bscbot`. Set it only to replace that page. Do not point it at an oldschoolgg or magnaboy Patreon.

## Windows start, crash restart, and boot

`start-prod.cmd` and `start-test.cmd` live in the repo root. Each changes to its own folder, appends stdout and stderr to `bot-prod.log` or `bot-test.log`, and starts the process again 10 seconds after it exits. Close the window with Ctrl+C to stop the loop.

Double-click the cmd in that checkout, or from a prompt:

```bat
cd /d C:\bsc\prod
```

```bat
start-prod.cmd
```

```bat
cd /d C:\bsc\test
```

```bat
start-test.cmd
```

Run both. Use two windows. The titles are `BSC production` and `BSC test`.

To start them when you sign in, Task Scheduler (an interactive desktop has Node on the user PATH; "whether the user is logged on or not" often does not):

```bat
schtasks /Create /TN "BSC production" /SC ONLOGON /TR "cmd.exe /c C:\bsc\prod\start-prod.cmd" /F
```

```bat
schtasks /Create /TN "BSC test" /SC ONLOGON /TR "cmd.exe /c C:\bsc\test\start-test.cmd" /F
```

The cmd loop is the crash restart. Task Scheduler only starts it at logon. If you kill the window, it stays stopped until the next logon or you start it again.

A missing `dist\index.js` is written to the log and the loop waits 30 seconds instead of spinning. Build first.

## Promotion

QC on the test bot from the pull-request branch. Merge that PR into `los-perros` (later `main` of `bsc-bot`). Only then update the prod checkout.

Test folder, for a branch named `the-pr-branch`:

```bat
cd /d C:\bsc\test
```

```bat
git fetch origin
```

```bat
git checkout the-pr-branch
```

```bat
git pull
```

```bat
pnpm install
```

```bat
pnpm db:push:test
```

```bat
pnpm build:quick
```

Ctrl+C the test window, then start `start-test.cmd` again. Exercise the change on the test Discord application.

After the PR is merged:

```bat
cd /d C:\bsc\prod
```

```bat
git checkout los-perros
```

```bat
git pull origin los-perros
```

```bat
pnpm install
```

```bat
pnpm db:push:prod
```

```bat
pnpm build:quick
```

Ctrl+C the prod window, then start `start-prod.cmd` again. Do not check out feature branches in `C:\bsc\prod`.

## Backups and restore

`backup-prod.cmd` runs `pnpm backup:prod`, which `pg_dump`s `DATABASE_URL` and `ROBOCHIMP_DATABASE_URL` from `.env.production` into `backups\` as custom-format dumps. `backup-test.cmd` does the same for the test env. `pg_dump` must be on PATH (it ships with PostgreSQL). The password is passed through `PGPASSWORD`, not on the command line.

Nightly, from the prod checkout, at 04:00:

```bat
schtasks /Create /TN "BSC postgres backup" /SC DAILY /ST 04:00 /TR "cmd.exe /c C:\bsc\prod\backup-prod.cmd" /F
```

Stop the bot before a restore. Replace the dump file name. This overwrites the database with that dump.

```bat
set PGHOST=localhost
```

```bat
set PGPORT=5432
```

```bat
set PGUSER=postgres
```

```bat
set PGPASSWORD=postgres
```

```bat
set PGDATABASE=bsc_prod
```

```bat
pg_restore --clean --if-exists --no-owner --dbname=bsc_prod backups\bsc_prod-nightly-STAMP.dump
```

Repeat with `PGDATABASE=robochimp_prod` and that dump if you are restoring Robochimp too. Change `PGPASSWORD` to the real password. Do not commit it.

## Launch wipe

`pnpm wipe:prod` is an owner script on the machine. It is not a slash command. Anyone who can run it in the prod folder can wipe the live database. Stop `start-prod.cmd` first.

It refuses to run unless `--confirm-wipe` is exactly the database name in `DATABASE_URL`. A prod file pointed at `bsc_prod` only proceeds with `--confirm-wipe bsc_prod`. If the URL is `bsc_test` and you pass `bsc_prod`, it refuses and changes nothing.

It runs `pg_dump` of the game database and the Robochimp database before any delete. If `pg_dump` is missing or fails, it stops and leaves the data alone. Dumps land in `backups\` as `pre-wipe` files.

It then wipes player progress for every user, including the owner: users and minions, banks, GP, collection log, KC, XP, activities, minigame points, Grand Exchange and trades, giveaways, economy and stats, and cooldowns. Config stays. The script prints row counts, how many users were reinserted, and the backup paths.

`--keep-perks` is the default. It keeps these `users.bitfield` values and reinserts a user row that has only those bits:

| Bit | Name |
| --- | --- |
| 2 | Patron tier 1 |
| 3 | Patron tier 2 |
| 4 | Patron tier 3 |
| 5 | Patron tier 4 |
| 6 | Patron tier 5 |
| 21 | Patron tier 6 |
| 199 | BSC Early Supporter |
| 237 | Launch Founder |
| 239 | BSC supporter cosmetic |

Every other bit is cleared (moderator, scrolls, toggles, and the rest). Users with none of those bits are not reinserted. Their row is created again the next time they use the bot, empty.

On Robochimp, cached XP, collection-log percent, mastery, leagues, store bits, and testing points are cleared. `patreon_id` and `github_id` always stay. Perk tier and Robochimp bits stay unless you pass `--no-keep-perks`. Store codes stay, and their redeemed-by fields are cleared.

```bat
cd /d C:\bsc\prod
```

```bat
pnpm wipe:prod -- --confirm-wipe bsc_prod
```

To drop patron tiers and the Early Supporter bit as well:

```bat
pnpm wipe:prod -- --confirm-wipe bsc_prod --no-keep-perks
```

Emoji ids are not a database table. They live in the gitignored JSON file and in Discord. Seasonal event on/off state is the raw table `seasonal_event_config`, which is kept. Per-user Halloween candy is `halloween_event`, which is wiped.

`reset` in the table means the rows stay and the progress columns are set back to empty. `wipe` means the rows are deleted.

### Game database (`prisma/schema.prisma`)

| Model | Table | Action | Why |
| --- | --- | --- | --- |
| Activity | activity | wipe | Trips in progress and trip history |
| Analytic | analytics_table | wipe | Economy and population snapshots |
| BuyCommandTransaction | buy_command_transaction | wipe | Shop purchases |
| GearPreset | gear_presets | wipe | Saved gear presets |
| Giveaway | giveaway | wipe | Giveaways and entries |
| PlayerOwnedHouse | poh | wipe | Player-owned houses |
| SlayerTask | slayer_tasks | wipe | Slayer tasks |
| User | users | wipe | Accounts, minions, banks, GP, skills, CL, cooldowns, and bitfield. Perk bits are reinserted when --keep-perks is set |
| MortimerTricks | mortimer_trick | wipe | Mortimer trick progress |
| ReclaimableItem | reclaimable_item | wipe | Reclaimable item claims |
| XPGain | xp_gains | wipe | XP gain history |
| Metric | metrics | wipe | Process stats samples |
| Minigame | minigames | wipe | Minigame points and counts |
| BossEvent | boss_event | wipe | Live boss-event state, not seasonal config |
| TameActivity | tame_activity | wipe | Tame trips |
| Tame | tames | wipe | Tames |
| CommandUsage | command_usage | wipe | Command usage stats |
| FishingContestCatch | fishing_contest_catch | wipe | Fishing contest catches |
| LootTrack | loot_track | wipe | Loot tracking |
| EconomyItem | economy_item | wipe | Economy item totals |
| EconomyItemBanks | economy_item_banks | wipe | Economy item banks |
| LastManStandingGame | lms_games | wipe | LMS games |
| EconomyTransaction | economy_transaction | wipe | Trades, gifts, dues, and other transfers |
| StashUnit | stash_unit | wipe | STASH units |
| UserStats | user_stats | wipe | KC, collection log, and other stats |
| FarmedCrop | farmed_crop | wipe | Farming patches planted |
| BotItemSell | bot_item_sell | wipe | Item sales to the bot |
| PinnedTrip | pinned_trip | wipe | Pinned trips |
| HistoricalData | historical_data | wipe | Historical XP, GP, and CL snapshots |
| GEListing | ge_listing | wipe | Grand Exchange listings |
| GETransaction | ge_transaction | wipe | Grand Exchange trades |
| GEBank | ge_bank | wipe | Grand Exchange bank |
| Bingo | bingo | wipe | Bingos |
| BingoTeam | bingo_team | wipe | Bingo teams |
| BingoParticipant | bingo_participant | wipe | Bingo participants |
| GiftBox | gift_box | wipe | Gift boxes |
| Portent | portent | wipe | Portent charges |
| UserEvent | user_event | wipe | Max and collection-log events |
| UserCounter | user_counter | wipe | Per-user counters |
| TableBank | table_bank | wipe | Relational banks |
| TableBankItem | table_bank_item | wipe | Relational bank items |
| HalloweenEvent | halloween_event | wipe | Per-user Halloween candy. Seasonal on/off config is seasonal_event_config and is kept |
| JsonBank | json_bank | wipe | JSON banks, KC, and collection log |
| ShootingStars | shooting_stars | wipe | Shooting stars |
| SystemLogs | system_logs | wipe | Runtime error log, not configuration |
| UserLog | user_logs | wipe | User action log |
| ClientStorage | clientStorage | reset | Keep the row and its config columns. Zero economy banks, GP counters, prices, and lottery state |
| Guild | guilds | keep | Per-server settings: disabled commands, pet channel, staff channels, mega duck location |
| Webhook | webhook_table | keep | Discord webhooks the bot created for channels. Not player progress |
| Badges | badges | keep | Static badge text catalog |
| CLCategory | categories | keep | Static collection-log categories |
| CLCategoryItem | category_items | keep | Static collection-log category items |
| QualityCheckCampaign | quality_check_campaign | keep | Quality-check board campaign. Staff workflow, not a player save |
| QualityCheckBounty | quality_check_bounty | keep | Quality-check bounties. Staff workflow, not a player save |

Config columns kept on `clientStorage`: `id`, `disabled_commands`, `custom_prices`, `maxing_message`, `shutdown`, `grand_exchange_is_locked`. If the bot stays shut down after a wipe, `shutdown` was already true. That flag is config and is not cleared.

Not Prisma models, and kept if present: `seasonal_event_config`, `bsc_patron_override`, `_prisma_migrations`. `bsc_patron_override` holds manual patron locks, gift cooldowns, and custom-background entitlement. The bot creates it on startup. It is not a Prisma model, so it does not need `db push`. Do not drop `seasonal_event_config`.

`Guild.mega_duck_location` is kept with the guild row, including `usersParticipated`.

### Robochimp database (`prisma/robochimp.prisma`)

| Model | Table | Action | Why |
| --- | --- | --- | --- |
| User | user | reset | Clear cached XP, CL, mastery, leagues, store bits, and testing points. Keep the user id, Patreon link, and GitHub link. Perk tier and bits stay unless --no-keep-perks |
| StoreCode | store_code | reset | Keep the codes. Clear who redeemed them |
| TriviaQuestion | trivia_question | keep | Trivia question catalog |
| BlacklistedEntity | blacklisted_entity | keep | Blacklist of users and guilds |
| PingableRole | pingable_role | keep | Pingable role config |
| Tag | tag | keep | Support tags |
| UserGroup | user_group | keep | Account link groups |
| UserSecrets | user_secrets | keep | OAuth secrets, not game progress |
| DiscordUser | discord_user | keep | Discord profile cache |

The source of truth for this list is `src/lib/hosting/wipePlan.ts`. The unit test fails if a Prisma model is added and not classified.


## Live-play lock

`PRODUCTION=true` is the live bot. `PRODUCTION=false` is the test bot. `src/lib/hosting/productionMode.ts` is the only parser, and `globalConfig.isProduction` calls it.

When `PRODUCTION` is unset, `NODE_ENV=production` still means production. The prod example sets both `PRODUCTION=true` and `NODE_ENV=production`. Set `LOG_CHANNEL_ID` and `SUPPORT_GUILD_ID` so that does not send logs to the old Old School GG channels.

Do not use `pnpm start` for either hosted folder. That command restarts the process whenever a file changes. Use `start-prod.cmd` / `pnpm start:prod` and `start-test.cmd` / `pnpm start:test`.

## Launch event

The launch event is off until an admin turns it on. Dates are UTC.

```
/admin event action:list
/admin event action:enable name:launch
/admin event action:schedule name:launch start:2026-11-07T00:00:00Z end:2026-11-14T00:00:00Z
/admin event action:disable name:launch
/claim name:Founder
```

The Founder mark stays on the name after the event ends. A wipe with the default `--keep-perks` keeps that bit.

## Patron tiers

Create these six tiers on https://patreon.com/bscbot. Use these names and prices. Each tier includes every perk below it. There is no $100 tier.

| Patreon tier name | Price | Discord role env | Bot bit |
| --- | --- | --- | --- |
| Pup | $3 | `PATRON_ROLE_PUP` | PatronTier1 |
| Good Boy | $5 | `PATRON_ROLE_GOODBOY` | PatronTier2 |
| Top Dog | $10 | `PATRON_ROLE_TOPDOG` | PatronTier3 |
| Alpha | $15 | `PATRON_ROLE_ALPHA` | PatronTier4 |
| Pack Leader | $25 | `PATRON_ROLE_PACKLEADER` | PatronTier5 |
| Biggest of Dogs | $50 | `PATRON_ROLE_BIGGESTOFDOGS` | PatronTier6 |

Perks, as totals for that tier:

| Tier | Perks |
| --- | --- |
| Pup | +3 min max trip, supporter badge |
| Good Boy | +6 min, Discord role, higher sim caps, +2 Grand Exchange slots |
| Top Dog | +10 min, give a mystery box, full trip-repeat buttons, +4 Grand Exchange slots |
| Alpha | +15 min, bank backgrounds and background commands, spawn lamp, spawn box, unlimited giveaways, +8 Grand Exchange slots |
| Pack Leader | exclusive bank background (Barrows), `/patron double_loot` once a month (40 min, server-wide), gift 1 week of Good Boy once a month |
| Biggest of Dogs | custom bank background while they stay Pack Leader or higher, `/patron double_loot` once a month (90 min), gift 1 week of Alpha once a month |

### Checklist for DJ

1. On https://patreon.com/bscbot create six tiers named exactly Pup, Good Boy, Top Dog, Alpha, Pack Leader, and Biggest of Dogs, at $3, $5, $10, $15, $25, and $50.
2. In the support guild, create one Discord role per tier. Role names can match the tier names. Copy each role id.
3. In Patreon, turn on the Discord integration and connect each Patreon tier to its role. Patreon assigns and removes those roles. The bot does not need a creator token for that.
4. Put the role ids in the prod and test env files:

```
PATRON_ROLE_PUP=
PATRON_ROLE_GOODBOY=
PATRON_ROLE_TOPDOG=
PATRON_ROLE_ALPHA=
PATRON_ROLE_PACKLEADER=
PATRON_ROLE_BIGGESTOFDOGS=
```

5. Leave a role blank only if that tier is not ready. The bot logs one startup warning and skips that tier. It does not crash.
6. Restart the bot. `SUPPORT_SERVER_ID` is the guild those roles live in. If it is unset, the bot uses `SUPPORT_GUILD_ID`.
7. Subscribe a Discord-linked test account, then upgrade, downgrade, and cancel. The bot sets patron bits from the highest role, removes lower tier roles, and on cancel keeps perks for 3 days after the role disappears.
8. A manual override is the fallback. `manual:false` lets the next role sync replace it.

```
/admin patron set user:@Player tier:alpha
```

```
/admin patron clear user:@Player
```

```
/admin patron background user:@Player name:Barrows
```

`/admin patron background` only works for Biggest of Dogs, and the image stays while they are Pack Leader or higher. There is no upload pipeline. Pick an existing background name or id.

Optional Patreon API v2 sync. Leave these unset to use Discord roles only. If you set the token and campaign, the bot also reads entitled tiers and updates roles for linked Discord accounts. Role sync still runs and remains the source of truth for members in the support guild.

```
PATREON_CREATOR_TOKEN=
PATREON_CAMPAIGN_ID=
PATREON_TIER_PUP_ID=
PATREON_TIER_GOODBOY_ID=
PATREON_TIER_TOPDOG_ID=
PATREON_TIER_ALPHA_ID=
PATREON_TIER_PACKLEADER_ID=
PATREON_TIER_BIGGESTOFDOGS_ID=
```

Player commands:

```
/patron info
```

```
/patron gift user:@Friend
```

```
/patron double_loot
```

The old oldschoolgg Patreon and GitHub sponsor sync does not run. The BSC Early Supporter badge (bit 199) is separate. No `db push` is required for this ladder. Gift cooldowns and the custom-background flag live in `bsc_patron_override`, which the bot creates. Do not drop `seasonal_event_config`.
