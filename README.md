# GuardianMap — Major Python Project

GuardianMap is a full-stack, safety-aware navigation and women's safety project built primarily around a Python FastAPI backend.

## Included modules
- Authentication: register, login, JWT session
- Responsive dashboard for desktop and mobile
- Real browser geolocation
- Destination search using OpenStreetMap/Nominatim
- Road routing through OSRM when available, with a clearly labelled fallback
- Walking, cycling, driving and transit UI modes
- Route safety score and risk explanation
- Step-by-step navigation modal that does not auto-loop or get stuck
- Live browser location watching during navigation
- Safe Haven routing
- “I think someone is following me” safety mode
- Follow Me virtual escort
- Safety check-ins
- Battery Saver
- Optional foreground voice demo using the phrase “Guardian Help”
- Trusted Circle
- Saved Home / Office / College / custom places
- Community safety reports
- Basic duplicate-report merging
- Workplace / late-shift safety mode
- Ride safety checklist, clearly labelled as a demo
- Guardian AI rule-based safety copilot
- Personal trip analytics
- Privacy and appearance settings
- SQLite database

## Project structure
app/
  core/       configuration, database, security
  models/     SQLAlchemy database models
  schemas/    request validation
  services/   routing and AI logic
  api/        dependencies
  static/     responsive frontend CSS and JavaScript
  templates/  HTML
data/         SQLite database created automatically

## Run in VS Code on Windows

Open the project folder and run:

```powershell
py -m venv .venv
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
py -m uvicorn app.main:app --reload
```

Open:

http://127.0.0.1:8000

## Important notes
This project is a serious prototype, not an emergency service and not a guarantee of safety.
- Browser location requires HTTPS or localhost plus user permission.
- OpenStreetMap search and public OSRM routing require an internet connection.
- Public OSRM can occasionally be unavailable; GuardianMap then shows a labelled fallback rather than freezing.
- SMS, phone calls, background mobile tracking, verified cab identity, and official emergency dispatch require additional provider/mobile integrations and should not be falsely claimed by a web prototype.
- The voice feature is a foreground browser demo and is consent-based.
- Safe-haven points are demo data in this version; production should use verified POI sources.

## Suggested next production upgrades
- PostgreSQL + PostGIS
- OSMnx + NetworkX graph routing
- Redis / Celery background jobs
- WebSockets for live sessions
- Real SMS provider integration
- Role-based moderator dashboard
- Verified public-place and emergency POI data
- Advanced ML duplicate detection and risk forecasting
- Native Android/iOS companion app
