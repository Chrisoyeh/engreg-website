# Engreg Schools – Administrator Portal Backend

Secure, enterprise-level administrative portal for managing candidate registrations, dynamic student admissions results tables, digital gallery resources, and school settings parameters using **Python Flask** and **Firebase Backend (Firestore + Authentication + Storage)**.

---

## Technical Specifications

### Project Structure
```
engreg-admin/
│
├── app.py                     # Main Flask Application
├── config.py                  # Environment & Upload Settings
├── firebase_config.py         # Firebase Admin SDK Configuration
├── requirements.txt           # Python Dependency Specs
├── README.md                  # Documentation File
│
├── templates/
│   ├── admin-login.html       # Split-Screen Login View
│   └── admin-dashboard.html   # Collapsible Sidebar SPA Dashboard
│
└── static/
    ├── css/
    │   └── admin-style.css    # Premium CSS overrides and animations
    └── js/
        └── admin-dashboard.js # Tab handlers, Chart.js graphs, Upload rules
```

### Dependencies
- **Flask**: WSGI web framework.
- **firebase-admin**: Python admin interface to manage authentication states, Cloud Firestore documents transaction updates, and Google Cloud Storage bucket endpoints.
- **python-dotenv**: Environment configuration manager.

---

## Database Configuration (Firebase Console Setup)

### 1. Enable Services
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create or select your project.
3. Under Build:
   - **Authentication**: Enable **Email/Password** sign-in provider.
   - **Firestore Database**: Create database in production mode.
   - **Storage**: Enable file storage buckets.

### 2. Firestore Collections Schema
The portal uses the following Firestore Collections:
- `gallery`: Stores image metadata docs.
- `nursery_primary_registration` & `high_school_registration`: Stores candidates profiles.
- `nursery_primary_successful` & `high_school_successful`: Stores successful candidate credentials.
- `settings`: Holds general school settings config (`school_settings` document).
- `logs`: Audit log documents of portal operational events.

---

## Local Installation

1. **Prerequisites**: Ensure you have Python 3.8+ installed.
2. **Navigate into folder**:
   ```bash
   cd engreg-admin
   ```
3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Acquire Credentials**:
   - In Firebase Console: Project Settings -> Service Accounts -> Generate New Private Key.
   - Save the downloaded JSON file as `firebase-credentials.json` directly inside the `engreg-admin` folder.
5. **Run Server**:
   ```bash
   python app.py
   ```
6. **Open in browser**: Access the login page at `http://127.0.0.1:5000/login`.

---

## Deployment & Production
- In production, set environment variables for `SECRET_KEY` and set `DEBUG=False` in `config.py` or `.env`.
- Deploy using WSGI servers such as **Gunicorn**:
  ```bash
  gunicorn -w 4 -b 0.0.0.0:5000 app:app
  ```
