from flask import Blueprint, request, jsonify, session
from routes.auth import login_required
from firebase_config import db, firebase_initialized
from datetime import datetime

settings_bp = Blueprint("settings", __name__)

MOCK_SETTINGS = {
    "schoolName": "Engreg Schools",
    "phone1": "+2347061359270",
    "phone2": "+2348031234567",
    "email": "info@engregschool.com",
    "address": "24 Bankole St, Somolu, Lagos 102216, Lagos, Nigeria",
    "admissionFee": "15000",
    "academicSession": "2026/2027",
    "maxGalleryImages": 100,
    "facebook": "https://facebook.com",
    "instagram": "https://instagram.com",
    "twitter": "https://twitter.com",
    "linkedin": "https://linkedin.com",
    "youtube": "https://youtube.com"
}

@settings_bp.route("/api/settings", methods=["GET"])
@login_required
def get_settings():
    if not firebase_initialized:
        return jsonify({"success": True, "settings": MOCK_SETTINGS})
        
    try:
        doc_ref = db.collection("settings").document("school_settings")
        doc = doc_ref.get()
        if doc.exists:
            return jsonify({"success": True, "settings": doc.to_dict()})
        else:
            # Seed default settings in Firestore if document doesn't exist
            doc_ref.set(MOCK_SETTINGS)
            return jsonify({"success": True, "settings": MOCK_SETTINGS})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@settings_bp.route("/api/settings", methods=["POST"])
@login_required
def save_settings():
    data = request.get_json() or {}
    
    # Parse max images to int
    try:
        data["maxGalleryImages"] = int(data.get("maxGalleryImages", 100))
    except:
        data["maxGalleryImages"] = 100
        
    if not firebase_initialized:
        global MOCK_SETTINGS
        MOCK_SETTINGS.update(data)
        return jsonify({"success": True, "settings": MOCK_SETTINGS})
        
    try:
        doc_ref = db.collection("settings").document("school_settings")
        doc_ref.set(data, merge=True)
        
        # Log event
        db.collection("logs").add({
            "action": "Settings Updated",
            "details": "Administrator updated the global school settings.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({"success": True, "settings": data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
