import json
import os
import tempfile

from django.core.management import call_command
from django.core.management.base import BaseCommand

from core.backup_fixture import repair_backup_fixture_shamsi_dates


class Command(BaseCommand):
    help = (
        "Restore database from a JSON backup produced by export_backup or the UI download. "
        "By default this clears ALL data first (flush), then loads the file."
    )

    def add_arguments(self, parser):
        parser.add_argument("path", help="Path to the backup .json file")
        parser.add_argument(
            "--no-flush",
            action="store_true",
            help="Load without clearing the database first (may fail on duplicate keys).",
        )

    def handle(self, *args, **options):
        path = options["path"]
        with open(path, encoding="utf-8") as fh:
            rows = json.load(fh)
        if not isinstance(rows, list):
            self.stderr.write(self.style.ERROR("Backup must be a JSON array."))
            return
        repair_backup_fixture_shamsi_dates(rows)

        fd, tmp_path = tempfile.mkstemp(suffix=".json")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tmp:
                json.dump(rows, tmp, indent=2, ensure_ascii=False)
            if not options["no_flush"]:
                call_command("flush", interactive=False)
                self.stdout.write(self.style.WARNING("Database flushed."))
            call_command("loaddata", tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        self.stdout.write(self.style.SUCCESS(f"Loaded backup from {path}"))
