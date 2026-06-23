from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_student_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="deactivated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
