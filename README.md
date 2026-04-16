# School Rasool (Finance System)

This is a full-stack app:
- Backend: Django + DRF (token auth)
- Frontend: React + Vite

## Backend (Django)

1. Create a virtual environment and install dependencies:
   - `python -m venv .venv`
   - `pip install -r backend/requirements.txt`
2. Set environment variables (required by `backend/config/settings.py`):
   - Copy `backend/.env.example` -> `backend/.env` if you use a dotenv loader, or export the variables in your shell.
3. Run migrations:
   - `python backend/manage.py migrate`
4. Start the server:
   - `python backend/manage.py runserver`

## Frontend (React/Vite)

1. Create env file:
   - `frontend/.env.example` -> `frontend/.env`
2. Install and run:
   - `cd frontend`
   - `npm ci`
   - `npm run dev`

## Running tests

- Backend: `python backend/manage.py test`

## Demo seed data (backup testing)

From `backend/`: `python manage.py seed_demo` creates demo classes, students, teachers, fee types, payments, and expenses (tags: `DEMO-*` registrations, `Demo …` names). Run again safely; use `python manage.py seed_demo --replace` to delete that demo data and re-insert. Then export a backup, flush the DB, and `import_backup` (or the Backup UI) to confirm restore.

## Backup and restore

- **UI:** Log in → **Backup** in the sidebar → download `.json` or upload a previously saved file to restore.
- **CLI:** From `backend/`: `python manage.py export_backup path/to/backup.json` and `python manage.py import_backup path/to/backup.json` (default: flush DB then load; use `--no-flush` only if you know you need it).
- Restore **replaces all data** in the database. If restore fails after the flush, load a valid backup again. Backups may not load after migrations until you export a fresh file from the new schema.
- **Shamsi dates in JSON:** older exports could list payment/expense `date_shamsi` with a wrong year (e.g. `783-…` instead of `1404-…`). Export/import and the Backup UI now fix that automatically so those files load correctly.

## Docker Deployment (Mac mini / Production-style)

This Docker setup uses **PostgreSQL** and can run with **zero manual config**.

### Quick start (no setup needed)

From project root:

- `docker compose up -d --build`

Frontend will be available at:
- [http://localhost:8080](http://localhost:8080)

This automatically:
- starts PostgreSQL
- creates/uses DB and user (default values)
- runs Django migrations
- collects static files
- starts backend + frontend

### Optional: set your own secrets/hosts

If you want custom values, create root `.env` (optional):

```bash
cp backend/.env.docker.example .env
```

Then update values (especially `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `DJANGO_ALLOWED_HOSTS`) and restart:

- `docker compose up -d --build`

### Useful commands

- See logs: `docker compose logs -f`
- Restart: `docker compose restart`
- Stop: `docker compose down`
- Stop and remove volumes (danger: deletes postgres data): `docker compose down -v`

### Notes

- PostgreSQL data persists in Docker volume `school_rasool_pgdata`.
- Static files are collected automatically on backend container start.
- Frontend calls backend through nginx reverse proxy at `/api`.
