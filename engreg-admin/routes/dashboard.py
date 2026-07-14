from flask import Blueprint, render_template, jsonify, session
from routes.auth import login_required
from firebase_config import db, firebase_initialized

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/", methods=["GET"])
@dashboard_bp.route("/dashboard", methods=["GET"])
@login_required
def dashboard_view():
    return render_template("admin-dashboard.html", email=session.get("email"))

@dashboard_bp.route("/api/dashboard/stats", methods=["GET"])
@login_required
def get_stats():
    if not firebase_initialized:
        # Graceful mock response for offline review
        return jsonify({
            "success": True,
            "mock": True,
            "nursery_reg": 15,
            "high_reg": 27,
            "total_reg": 42,
            "gallery_uploaded": 42,
            "gallery_max": 100,
            "nursery_success": 8,
            "high_success": 12,
            "total_success": 20
        })
        
    try:
        # Query collections lengths
        nursery_reg = len(list(db.collection("nursery_primary_registration").stream()))
        high_reg = len(list(db.collection("high_school_registration").stream()))
        gallery_count = len(list(db.collection("gallery").stream()))
        nursery_success = len(list(db.collection("nursery_primary_successful").stream()))
        high_success = len(list(db.collection("high_school_successful").stream()))
        
        # Get max settings
        max_gallery = 100
        settings_ref = db.collection("settings").document("school_settings").get()
        if settings_ref.exists:
            max_gallery = int(settings_ref.to_dict().get("maxGalleryImages", 100))
            
        return jsonify({
            "success": True,
            "nursery_reg": nursery_reg,
            "high_reg": high_reg,
            "total_reg": nursery_reg + high_reg,
            "gallery_uploaded": gallery_count,
            "gallery_max": max_gallery,
            "nursery_success": nursery_success,
            "high_success": high_success,
            "total_success": nursery_success + high_success
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@dashboard_bp.route("/api/dashboard/logs", methods=["GET"])
@login_required
def get_logs():
    if not firebase_initialized:
        # Mock recent logs
        return jsonify({
            "success": True,
            "logs": [
                {"action": "Administrator Login", "details": f"{session.get('email')} logged in.", "operator": "System", "timestamp": "Just now"},
                {"action": "Photo Uploaded", "details": "Sports Day Sprint image uploaded.", "operator": "admin@engreg.com", "timestamp": "10 minutes ago"},
                {"action": "Candidate Registered", "details": "John Doe applied for Nursery 1", "operator": "System", "timestamp": "1 hour ago"},
                {"action": "Candidate Passed", "details": "Jane Smith moved to successful candidate list.", "operator": "admin@engreg.com", "timestamp": "2 hours ago"}
            ]
        })
        
    try:
        logs_ref = db.collection("logs").order_by("timestamp", direction="DESCENDING").limit(20).stream()
        logs = []
        for log in logs_ref:
            data = log.to_dict()
            # Format timestamp to string safely
            ts = data.get("timestamp")
            if ts:
                ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
            else:
                ts_str = ""
            logs.append({
                "action": data.get("action", ""),
                "details": data.get("details", ""),
                "operator": data.get("operator", ""),
                "timestamp": ts_str
            })
        return jsonify({"success": True, "logs": logs})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
