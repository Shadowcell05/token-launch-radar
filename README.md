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

Implied value comes from a curve fitted on the protocols whose token
already trades: ln(market cap) = a + b × ln(TVL) — one shared slope
(about 0.52 on this snapshot: market cap grows with roughly the square
root of TVL, so a flat multiple systematically overprices large
protocols) plus a level per category, shrunk toward the global curve so
small categories stay honest. The fitted value carries one adjustment —
maturity (0.75x at listing rising to 1.20x after four tokenless years:
longer tokenless = a more credible launch candidate) — and the range
comes from the fit's residual quartiles.

The model is measured, not asserted: the program runs a deterministic
five-fold cross-validation (folds assigned by a hash of each protocol's
slug) that fits every candidate model on four fifths of the traded
protocols and scores it against the held-out fifth's actual market
caps, rotating until every traded peer has been priced blind exactly
once. The candidate table is an audit: it scores the board model
exactly as it ships (adjustment included), the unadjusted curve, the
flat multiples the curve replaced, and the previous version's full
adjustment set (momentum + maturity + breadth). That audit is why this
version is simpler than the last: scored openly, the full set priced
blind *worse* on every column (87.8% median error against 86.0% for
the bare curve), while maturity alone improved the curve to 84.9% —
the lowest median error of the six candidates. Momentum and breadth
were removed; nothing in this model is kept on intuition. The
dashboard publishes the full table and the board model's blind-pricing
spread next to the board, and draws the model itself — every traded
peer at its actual cap, every board row at its implied value, and the
fitted curve through them, log-log. The dashboard
also shows a per-category launch prior and a confidence grade from the
peer count; the prior and the confidence are farming guidance and never
move the value rank. No protocol name is special-cased anywhere: the
same arithmetic scores every row, and the dashboard recomputes each
value from the model's inputs in the page.

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
- `screenshots/` — the board, a protocol detail view, a filtered
  (watchlist, farm-priority) view, and the model-validation panel,
  captured from the dashboard itself.
