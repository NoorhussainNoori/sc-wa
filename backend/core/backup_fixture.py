"""
Repair Shamsi date strings in dumpdata JSON backups.

django_jalali's serialization for jDateField can write years as (true Shamsi year - 621),
e.g. 1404-08-25 becomes 783-08-25. That fails loaddata because the value is not a valid
jDate / is rejected. We normalize on export and import so backups round-trip.
"""

from __future__ import annotations

import json
import re
from io import StringIO
from typing import Any

import jdatetime
from django.core.management import call_command

_MODELS_DATE_SHAMSI = frozenset({"core.payment", "core.expense"})
_MIN_Y = 1300
_MAX_Y = 1650
_DUMPDATA_YEAR_BUG_OFFSET = 621

_DATE_RE = re.compile(r"^(\d{1,4})-(\d{2})-(\d{2})$")
_MONTH_SHAMSI_RE = re.compile(r"^(\d{4})-(\d{2})$")


def _valid_jalali(y: int, m: int, d: int) -> bool:
    try:
        jdatetime.date(y, m, d)
    except ValueError:
        return False
    return True


def _repair_date_shamsi_string(raw: str, fields: dict[str, Any], model: str) -> str | None:
    m = _DATE_RE.match(raw.strip())
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if _MIN_Y <= y <= _MAX_Y and _valid_jalali(y, mo, d):
        return None

    # Payments store reliable `month_shamsi`; dumpdata can corrupt both year and month in
    # `date_shamsi`. Prefer year+month from `month_shamsi` and day from the raw string.
    if model == "core.payment" and y < _MIN_Y:
        ms = fields.get("month_shamsi")
        mm = _MONTH_SHAMSI_RE.match(str(ms).strip()) if ms else None
        if mm:
            yy, mmonth = int(mm.group(1)), int(mm.group(2))
            if _MIN_Y <= yy <= _MAX_Y:
                cand = f"{yy:04d}-{mmonth:02d}-{d:02d}"
                if _valid_jalali(yy, mmonth, d):
                    return cand

    if y < _MIN_Y:
        y2 = y + _DUMPDATA_YEAR_BUG_OFFSET
        if _MIN_Y <= y2 <= _MAX_Y:
            cand = f"{y2:04d}-{mo:02d}-{d:02d}"
            if _valid_jalali(y2, mo, d):
                return cand

    if model == "core.payment":
        ms = fields.get("month_shamsi")
        mm = _MONTH_SHAMSI_RE.match(str(ms).strip()) if ms else None
        if mm:
            yy, mmonth = int(mm.group(1)), int(mm.group(2))
            if _MIN_Y <= yy <= _MAX_Y:
                cand = f"{yy:04d}-{mmonth:02d}-{d:02d}"
                if _valid_jalali(yy, mmonth, d):
                    return cand

    return None


def repair_backup_fixture_shamsi_dates(rows: list[Any]) -> None:
    for row in rows:
        if not isinstance(row, dict):
            continue
        model = row.get("model")
        if model not in _MODELS_DATE_SHAMSI:
            continue
        fields = row.get("fields")
        if not isinstance(fields, dict):
            continue
        raw = fields.get("date_shamsi")
        if not isinstance(raw, str):
            continue
        fixed = _repair_date_shamsi_string(raw, fields, model)
        if fixed is not None:
            fields["date_shamsi"] = fixed


def build_dumpdata_backup_json() -> str:
    buf = StringIO()
    call_command(
        "dumpdata",
        "auth.user",
        "authtoken.token",
        "core",
        indent=2,
        stdout=buf,
        natural_foreign=True,
    )
    rows = json.loads(buf.getvalue())
    if not isinstance(rows, list):
        raise ValueError("dumpdata did not produce a JSON array")
    repair_backup_fixture_shamsi_dates(rows)
    return json.dumps(rows, indent=2, ensure_ascii=False) + "\n"
