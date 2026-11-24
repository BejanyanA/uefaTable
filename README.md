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

## Guides

- [Create a custom football league](https://uefaresults.com/custom-leagues/)
- [Create your own Champions League tournament](https://uefaresults.com/champions-league-tournament/)
- [Create a World Cup bracket](https://uefaresults.com/world-cup-bracket/)
- [Football tournament bracket maker](https://uefaresults.com/tournament-bracket-maker/)

UEFA Results is an independent project. It is not affiliated with or endorsed by UEFA or FIFA.
