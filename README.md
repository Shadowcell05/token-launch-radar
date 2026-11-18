# Launch Radar

![Competition](https://make.fun/badge/token-radar-01.svg)
![Rank](https://make.fun/badge/token-radar-01/Shadowcell05/token-launch-radar/rank.svg)
![Reward](https://make.fun/badge/token-radar-01/Shadowcell05/token-launch-radar/reward.svg)

A token launch radar for make.fun's [Best Token Launch Radar](https://make.fun/bounty/token-radar-01) bounty: it reads the
sealed DefiLlama snapshot, finds the protocols that still record no token
(and are not a wrapped, staked or bridged product of one that trades),
ranks them by what their launch would be worth, and hands in a static
dashboard with the board, a detail view for every protocol, filters, and
a concrete farm plan for each row.

## The model

Implied value = TVL × the category's peer median (market cap / TVL of the
protocols in the same category whose token already trades; categories
with fewer than three traded peers fall back to the global peer set),
adjusted for 7-day TVL momentum (clamped, weight 0.35), maturity (longer
tokenless = more credible launch) and chain breadth. The dashboard also
shows the peer-quartile range, a per-category launch prior and a
confidence grade from the peer count; the prior and the confidence are
farming guidance and never move the value rank. No protocol name is
special-cased anywhere: the same arithmetic scores every row, and the
dashboard recomputes each value from the model's inputs in the page.

## Run it

```sh
node main.ts --input <snapshot.json|dir>   # writes to /output, or
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|dir>
```

Node 22, standard library only, no network. The program writes
`board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json`
(the last one with the vendored `vendor/makefun-board.ts`, byte for byte
the scorer's own copy).

## Layout

- `main.ts` — entry point: read snapshot, build board, write output.
- `lib/model.ts` — the scoring model, the farm-plan generator, the gate
  self-check.
- `dashboard/` — the static page (board, filters, detail view, peer view).
- `screenshots/` — the board, a protocol detail view, and a filtered
  (watchlist, farm-priority) view, captured from the dashboard itself.
