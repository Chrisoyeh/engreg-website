import os
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from routes.auth import login_required
from firebase_config import db, bucket, firebase_initialized
from werkzeug.utils import secure_filename
from config import Config

gallery_bp = Blueprint("gallery", __name__)

# In-memory mock database for offline preview
MOCK_GALLERY = [
    {"id": "mock-1", "imageUrl": "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=400", "category": "graduation", "caption": "Graduation Class of 2026", "uploadDate": "2026-07-10 12:00:00", "uploadedBy": "admin@engreg.com"},
    {"id": "mock-2", "imageUrl": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=400", "category": "cultural", "caption": "Yoruba Dance Performers", "uploadDate": "2026-07-11 14:30:00", "uploadedBy": "admin@engreg.com"},
    {"id": "mock-3", "imageUrl": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=400", "category": "sports", "caption": "100m Athletics sprint finish", "uploadDate": "2026-07-12 09:15:00", "uploadedBy": "admin@engreg.com"}
]

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@gallery_bp.route("/api/gallery", methods=["GET"])
@login_required
def get_images():
    if not firebase_initialized:
        return jsonify({"success": True, "images": MOCK_GALLERY})
        
    try:
        images_ref = db.collection("gallery").order_by("uploadDate", direction="DESCENDING").stream()
        images = []
        for img in images_ref:
            data = img.to_dict()
            ts = data.get("uploadDate")
            ts_str = ts.strftime("%Y-%m-%d %H:%M:%S") if ts else ""
            images.append({
                "id": img.id,
                "imageUrl": data.get("imageUrl", ""),
                "category": data.get("category", ""),
                "caption": data.get("caption", ""),
                "uploadDate": ts_str,
                "uploadedBy": data.get("uploadedBy", "")
            })
        return jsonify({"success": True, "images": images})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@gallery_bp.route("/api/gallery/upload", methods=["POST"])
@login_required
def upload_image():
    category = request.form.get("category", "random")
    caption = request.form.get("caption", "")
    
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file part"}), 400
        
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No selected file"}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": f"Invalid file extension. Allowed: {Config.ALLOWED_EXTENSIONS}"}), 400

    if not firebase_initialized:
        # Simulate local mock upload
        if len(MOCK_GALLERY) >= 100:
            return jsonify({"success": False, "error": "Gallery limit reached. Maximum allowed is 100 photos."}), 400
            
        mock_id = f"mock-{int(datetime.now().timestamp())}"
        new_img = {
            "id": mock_id,
            "imageUrl": "https://placehold.co/800x600/0b2545/d4af37?text=Mock+Upload",
            "category": category,
            "caption": caption or file.filename,
            "uploadDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "uploadedBy": session.get("email", "admin@engreg.com")
        }
        MOCK_GALLERY.insert(0, new_img)
        return jsonify({"success": True, "image": new_img})

    try:
        # Check current count in Firestore
        gallery_count = len(list(db.collection("gallery").stream()))
        
        # Get settings configuration for max count limit
        max_gallery = 100
        settings_ref = db.collection("settings").document("school_settings").get()
        if settings_ref.exists:
            max_gallery = int(settings_ref.to_dict().get("maxGalleryImages", 100))
            
        if gallery_count >= max_gallery:
            return jsonify({"success": False, "error": f"Gallery limit reached. Maximum allowed is {max_gallery} photos."}), 400

        # Upload file to Firebase Storage
        filename = secure_filename(file.filename)
        blob_path = f"gallery/{int(datetime.now().timestamp())}_{filename}"
        blob = bucket.blob(blob_path)
        
        blob.upload_from_file(file, content_type=file.content_type)
        blob.make_public()
        image_url = blob.public_url

        # Store metadata in Firestore
        doc_data = {
            "imageUrl": image_url,
            "category": category,
            "caption": caption or filename,
            "uploadDate": datetime.utcnow(),
            "uploadedBy": session.get("email", "admin@engreg.com")
        }
        
        # Create Firestore doc
        doc_ref = db.collection("gallery").document()
        doc_ref.set(doc_data)
        
        # Log event in Firestore
        db.collection("logs").add({
            "action": "Photo Uploaded",
            "details": f"Uploaded photo: {caption or filename} in category {category}.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })
        
        doc_data["id"] = doc_ref.id
        doc_data["uploadDate"] = doc_data["uploadDate"].strftime("%Y-%m-%d %H:%M:%S")
        return jsonify({"success": True, "image": doc_data})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@gallery_bp.route("/api/gallery/<id>", methods=["DELETE"])
@login_required
def delete_image(id):
    if not firebase_initialized:
        # Simulate local mock deletion
        global MOCK_GALLERY
        MOCK_GALLERY = [img for img in MOCK_GALLERY if img["id"] != id]
        return jsonify({"success": True})

    try:
        # Retrieve image metadata
        doc_ref = db.collection("gallery").document(id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({"success": False, "error": "Image not found"}), 404
            
        data = doc.to_dict()
        image_url = data.get("imageUrl", "")
        caption = data.get("caption", "")
        
        # Delete from Firestore
        doc_ref.delete()
        
        # Try to delete from Storage (extract path from URL)
        # e.g., https://storage.googleapis.com/<bucket>/gallery/filename
        try:
            if "storage.googleapis.com" in image_url:
                parts = image_url.split("/gallery/")
                if len(parts) > 1:
                    storage_path = f"gallery/{parts[1]}"
                    blob = bucket.blob(storage_path)
                    if blob.exists():
                        blob.delete()
        except Exception as se:
            # Non-blocking warning if storage deletion fails
            print(f"Warning: Storage file deletion failed: {se}")

        # Log event
        db.collection("logs").add({
            "action": "Gallery Image Deleted",
            "details": f"Deleted photo: {caption}.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
