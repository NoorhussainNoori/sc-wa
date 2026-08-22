# Payment snapshots

Used to compare database state before/after `fix_payment_months`.

## Commands

```powershell
# Capture current state
python manage.py snapshot_payment_state capture --label after_fix

# Compare (use actual filenames)
python manage.py snapshot_payment_state compare `
  --before snapshots/payment_snapshot_before_fix_20260822_110455.json `
  --after snapshots/payment_snapshot_after_fix_YYYYMMDD_HHMMSS.json
```

## Files in this folder

- `payment_snapshot_before_fix_RECOVERED_kpis.json` — KPI summary recovered from chat after accidental delete (not full row data).
- `payment_snapshot_after_fix_*.json` — full snapshot after fix (re-capture if deleted).

## Restore full “before” snapshot

Only possible by re-importing the client backup on a **copy** of the database, then running:

```powershell
python manage.py snapshot_payment_state capture --label before_fix
```

Do not re-import backup on the live fixed database unless you intend to run the fix again.
