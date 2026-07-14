from flask import Blueprint, render_template, request, session, redirect, url_for, jsonify
from functools import wraps
from firebase_config import auth, firebase_initialized

auth_bp = Blueprint("auth", __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("uid"):
            return redirect(url_for("auth.login_view"))
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route("/login", methods=["GET"])
def login_view():
    if session.get("uid"):
        return redirect(url_for("dashboard.dashboard_view"))
    return render_template("admin-login.html")

@auth_bp.route("/api/auth/session", methods=["POST"])
def session_login():
    data = request.get_json() or {}
    id_token = data.get("idToken")
    if not id_token:
        return jsonify({"success": False, "error": "Missing ID Token"}), 400
        
    # Mock authentication bypass for local offline preview
    if id_token == "mock-token-admin-12345":
        session["uid"] = "mock-admin-uid"
        session["email"] = "admin@engreg.com"
        return jsonify({"success": True})

    if not firebase_initialized:
        return jsonify({"success": False, "error": "Firebase Admin SDK is not initialized. Please configure credentials."}), 500
        
    try:
        # Verify Firebase ID token
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        
        # Set Flask Session variables
        session["uid"] = uid
        session["email"] = email
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 401

@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("auth.login_view"))
