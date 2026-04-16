from django.core.management.base import BaseCommand

from core.backup_fixture import build_dumpdata_backup_json


class Command(BaseCommand):
    help = (
        "Write a JSON backup (users, API tokens, and all school data) to a file or stdout. "
        "Restore with: python manage.py import_backup <path>"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "path",
            nargs="?",
            help="Output file path. If omitted, prints to stdout.",
        )

    def handle(self, *args, **options):
        path = options.get("path")
        text = build_dumpdata_backup_json()
        if path:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(text)
            self.stdout.write(self.style.SUCCESS(f"Backup written to {path}"))
        else:
            self.stdout.write(text)
