### Summary:

<!-- What did you change? Describe it here. -->

### Changes:

<!-- Write a comprehensive list of changes here. -->

### Anti-dupe / anti-exploit checklist

Go through [`docs/anti-exploit-checklist.md`](../docs/anti-exploit-checklist.md) item by item. For each item, tick the box if it passes and add a short note (or n/a).

- [ ] Quantity validation — pass/fail + note:
- [ ] Take-before-give (`takeBankAfterConfirm` / `transactItems`) — pass/fail + note:
- [ ] Concurrent / race (including two bot processes; use atomic SQL deductions and caps) — pass/fail + note:
- [ ] Restart idempotency — pass/fail + note:
- [ ] `/buy` is at least 2x `/sell`, and no sacrifice loops — pass/fail + note:
- [ ] Trade / GE paths — pass/fail + note:
- [ ] Refunds — pass/fail + note:
- [ ] New DB tables are classified wipe or keep in `src/lib/hosting/wipePlan.ts` — pass/fail + note:
- [ ] No `prisma db push` needed — pass/fail + note:
- [ ] `double_loot_finish_time` was not touched — pass/fail + note:
- [ ] No secrets in the PR — pass/fail + note:

### Checks run

```
npx tsc --noEmit -p src
npx vitest run tests/unit/priceAbuses.test.ts tests/unit/hosting.test.ts --config vitest.unit.config.mts
npx vitest run buySellFloor --config vitest.unit.config.mts
```

- [ ] `npx tsc --noEmit -p src`
- [ ] `npx vitest run tests/unit/priceAbuses.test.ts tests/unit/hosting.test.ts --config vitest.unit.config.mts`
- [ ] `npx vitest run buySellFloor --config vitest.unit.config.mts`

### Other checks:

- [ ] I have tested all my changes thoroughly.
