from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_student_previous_balance"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
    ]
