# UEFA Results

Free web app for running football tournaments with friends, with live football scores.

**Live site:** https://uefaresults.com/

## What it does

- Custom leagues in four formats: Champions League, Europa League, EURO and World Cup
- A 32-team group stage with playoffs, or a 16-team knockout cup
- Teams drawn into groups at random, one club or country per friend
- Group tables and the knockout bracket update from the scores you enter
- Friends list, private chat and trophies for tournament winners
- Live scores, fixtures, results and standings
- English, French and Armenian

## How it is built

- **Frontend:** plain HTML, CSS and JavaScript modules in `public/`, hosted on Cloudflare Pages
- **API:** a Cloudflare Worker (`worker.js`) with a D1 database
- **Real time:** Durable Objects for chat, notifications and presence
- **Live data API (planned):** the contract for the website and future mobile apps is in `docs/live-api.md`

## Environments

There are two fully separate copies of the app. They share no data.

| | Production | Dev |
| --- | --- | --- |
| Site | https://uefaresults.com | https://dev.uefatable.pages.dev |
| Site deploys from | `main` branch | `dev` branch |
| API Worker | `uefa-app-production` (api.uefaresults.com) | `uefa-app-dev` (workers.dev address) |
| API config file | `wrangler.toml` | `wrangler.dev.toml` |
| Database (D1) | `core_data` | `core-db-dev` |

How it fits together:

- **Site:** Cloudflare Pages builds every branch. `main` goes to production, `dev` goes to the dev address. The site picks its API from the address it is opened on (`public/js/services/config.js`), so the same code works in both places. Analytics only load on production.
- **API:** the dev Worker has its own database, its own chat/notification storage and its own login secret. A login from one environment does not work in the other.
- **Database structure:** `db/schema.sql` holds the tables and indexes (no data). Each change also goes in `db/migrations/` as a numbered file that says where it has been applied; run it on dev first, then on production.

Day-to-day:

1. Work on the `dev` branch and push it. The site change is on the dev address in under a minute.
2. API changes are not deployed by a push. Run `npm run deploy:api:dev` to put them on the dev Worker.
3. When it works on dev, merge `dev` into `main` (site) and deploy the production Worker from `wrangler.toml` (API).

Commands:

| Command | What it does |
| --- | --- |
| `npm run check` | Check that nothing is broken: code checks plus the dev site and dev API. Add `-- https://uefaresults.com` to check production, `-- --local` for code only |
| `npm run deploy:api:dev` | Deploy the API to the dev Worker |
| `npm run logs:api:dev` | Follow the dev Worker's logs |
| `npm run dev:site` | Run the site on this machine (http://localhost:8788), talking to the dev API |
| `npm run dev:api` | Run the API on this machine (http://localhost:8787) with a local database |
| `npm run dev:db:init` | Create the tables in that local database (run once) |

`npm run dev:api` needs a file named `.dev.vars` in the project root with one line, `JWT_SECRET=` followed by any long random text. The file is ignored by git. To make the local site use the local API, see the note in `public/js/services/config.js`.

## Guides

- [Create a custom football league](https://uefaresults.com/custom-leagues/)
- [Create your own Champions League tournament](https://uefaresults.com/champions-league-tournament/)
- [Create a World Cup bracket](https://uefaresults.com/world-cup-bracket/)
- [Football tournament bracket maker](https://uefaresults.com/tournament-bracket-maker/)

UEFA Results is an independent project. It is not affiliated with or endorsed by UEFA or FIFA.
