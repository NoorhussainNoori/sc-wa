from django.db.models.signals import post_migrate
from django.dispatch import receiver

from .models import FeeType


@receiver(post_migrate)
def ensure_default_fee_types(sender, **kwargs):
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
