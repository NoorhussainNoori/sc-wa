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

