from contextlib import contextmanager

from django.db.models.signals import post_migrate
from django.dispatch import receiver

from .models import FeeType

# flush() emits post_migrate, which would re-seed FeeTypes and break loaddata
# when backup PKs/order differ from the defaults. Restore disables seeding.
_suppress_default_fee_types = False


@contextmanager
def suppress_default_fee_types():
    global _suppress_default_fee_types
    previous = _suppress_default_fee_types
    _suppress_default_fee_types = True
    try:
        yield
    finally:
        _suppress_default_fee_types = previous


@receiver(post_migrate)
def ensure_default_fee_types(sender, **kwargs):
    if _suppress_default_fee_types:
        return
    if sender.name != "core":
        return

    defaults = [
        ("Monthly", False),
        ("Transport", False),
        ("Uniform", False),
        ("Book", False),
        ("Previous Balance", False),
        ("Other", True),
    ]

    for name, requires_reason in defaults:
        FeeType.objects.get_or_create(
            name=name,
            defaults={"requires_reason": requires_reason},
        )
