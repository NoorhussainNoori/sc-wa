from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_student_deactivated_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="expense",
            name="bill_number",
            field=models.CharField(blank=True, default="", max_length=60),
        ),
        migrations.AddField(
            model_name="expense",
            name="notes",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="expense",
            name="quantity",
            field=models.CharField(blank=True, default="", max_length=60),
        ),
    ]
