# Flask Material Tracker

A Flask-based refactor of your HTML QR Printing Material Tracker. Uses SQLite via SQLAlchemy, Chart.js for charts, and Bootstrap for styling.

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run
export FLASK_APP=app:app  # Windows PowerShell: $env:FLASK_APP="app:app"
flask run --reload
```

Open http://127.0.0.1:5000

## Environment Variables

- `SECRET_KEY` (default: dev-secret-key)
- `DATABASE_URL` (default: sqlite:///tracker.db)
- `RIPPON_CAPACITY` (default: 50)
- `LABELS_CAPACITY` (default: 30)

## Deploy

Use the included `Procfile` with Gunicorn:

```bash
pip install -r requirements.txt
gunicorn app:app --bind 0.0.0.0:8000
```

Or deploy to any PaaS that supports Procfile.
