from flask import Blueprint, request, jsonify, session
from routes.auth import login_required
from firebase_config import db, bucket, firebase_initialized
from datetime import datetime

admissions_bp = Blueprint("admissions", __name__)

# Mock databases for admissions offline preview
MOCK_REGISTRATIONS = {
    "nursery": [
        {"id": "nurs-reg-1", "name": "Amina Bello", "gender": "Female", "class": "Nursery 1", "parentName": "Garba Bello", "parentPhone": "+2348031234567", "passportUrl": "#", "birthCertUrl": "#", "resultUrl": "#", "testimonialUrl": "#", "passed": False, "createdAt": "2026-07-10 10:00:00"},
        {"id": "nurs-reg-2", "name": "Chidi Okafor", "gender": "Male", "class": "Primary 2", "parentName": "Obinna Okafor", "parentPhone": "+2348059876543", "passportUrl": "#", "birthCertUrl": "#", "resultUrl": "#", "testimonialUrl": "#", "passed": True, "createdAt": "2026-07-11 11:30:00"}
    ],
    "high": [
        {"id": "high-reg-1", "name": "Tobi Adebayo", "gender": "Male", "class": "JSS 1", "parentName": "Kunle Adebayo", "parentPhone": "+2348122334455", "passportUrl": "#", "birthCertUrl": "#", "resultUrl": "#", "testimonialUrl": "#", "passed": False, "createdAt": "2026-07-09 08:15:00"},
        {"id": "high-reg-2", "name": "Fatima Musa", "gender": "Female", "class": "SSS 2", "parentName": "Musa Ibrahim", "parentPhone": "+2347065544332", "passportUrl": "#", "birthCertUrl": "#", "resultUrl": "#", "testimonialUrl": "#", "passed": True, "createdAt": "2026-07-12 15:40:00"}
    ]
}

MOCK_SUCCESSFUL = {
    "nursery": [
        {"id": "nurs-succ-1", "name": "Emeka Nwachukwu", "parentPhone": "+2348130099887", "createdAt": "2026-07-10 12:00:00"},
        {"id": "nurs-succ-2", "name": "Zainab Yusuf", "parentPhone": "+2347035566778", "createdAt": "2026-07-11 14:00:00"}
    ],
    "high": [
        {"id": "high-succ-1", "name": "Aisha Bello", "parentPhone": "+2348021122334", "createdAt": "2026-07-09 11:00:00"},
        {"id": "high-succ-2", "name": "Somtochukwu Eze", "parentPhone": "+2349087766554", "createdAt": "2026-07-10 16:30:00"}
    ]
}

@admissions_bp.route("/api/admissions/<school>/candidates", methods=["GET"])
@login_required
def get_candidates(school):
    # school: "nursery" or "high"
    coll_name = "nursery_primary_registration" if school == "nursery" else "high_school_registration"
    
    gender_filter = request.args.get("gender")
    class_filter = request.args.get("class")
    
    if not firebase_initialized:
        # Simulate filter locally
        list_cand = MOCK_REGISTRATIONS.get(school, [])
        if gender_filter:
            list_cand = [c for c in list_cand if c["gender"].lower() == gender_filter.lower()]
        if class_filter:
            list_cand = [c for c in list_cand if c["class"].lower() == class_filter.lower()]
        return jsonify({"success": True, "candidates": list_cand})
        
    try:
        query = db.collection(coll_name)
        if gender_filter:
            query = query.where("gender", "==", gender_filter)
        if class_filter:
            query = query.where("class", "==", class_filter)
            
        candidates_ref = query.stream()
        candidates = []
        for cand in candidates_ref:
            data = cand.to_dict()
            ts = data.get("createdAt")
            
            # Convert datetime to string safely depending on type
            if ts and not isinstance(ts, str):
                ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
            else:
                ts_str = ts or ""
                
            name = data.get("name")
            gender = data.get("gender")
            parent_name = data.get("parentName")
            parent_phone = data.get("parentPhone")
            
            if school == "nursery":
                if not name:
                    name = data.get("nurseryChildName") or "Unnamed Pupil"
                if not gender:
                    gender = data.get("nurseryGender") or ""
                if not parent_name:
                    parent_name = data.get("nurseryFatherName") or data.get("nurseryMotherName") or data.get("nurseryParentName") or ""
                if not parent_phone:
                    parent_phone = data.get("nurseryFatherHomeTel") or data.get("nurseryMotherHomeTel") or data.get("nurseryPhone") or ""
            else:
                if not name:
                    name = (f'{data.get("highSchoolSurname", "")} {data.get("highSchoolOtherNames", "")}'.strip()) or data.get("highSchoolName") or data.get("highSchoolDeclName") or "Unnamed Student"
                if not gender:
                    gender = data.get("highSchoolGender") or ""
                if not parent_name:
                    parent_name = data.get("highSchoolParentName") or ""
                if not parent_phone:
                    parent_phone = data.get("highSchoolParentHomeTel") or data.get("highSchoolPhone") or ""
                    
            result_url = data.get("resultUrl") or data.get("resultFileUrl") or "#"
            
            candidates.append({
                "id": cand.id,
                "name": name,
                "gender": gender,
                "class": data.get("class", ""),
                "parentName": parent_name,
                "parentPhone": parent_phone,
                "passportUrl": data.get("passportUrl", "#"),
                "birthCertUrl": data.get("birthCertUrl", "#"),
                "resultUrl": result_url,
                "testimonialUrl": data.get("testimonialUrl", "#"),
                "passed": data.get("passed", False),
                "createdAt": ts_str
            })
        return jsonify({"success": True, "candidates": candidates})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admissions_bp.route("/api/admissions/<school>/candidates/<id>/exam", methods=["POST"])
@login_required
def toggle_exam_passed(school, id):
    coll_name = "nursery_primary_registration" if school == "nursery" else "high_school_registration"
    data = request.get_json() or {}
    passed_val = data.get("passed", False)
    
    if not firebase_initialized:
        # Simulate toggle
        list_cand = MOCK_REGISTRATIONS.get(school, [])
        for c in list_cand:
            if c["id"] == id:
                c["passed"] = passed_val
                break
        return jsonify({"success": True})
        
    try:
        db.collection(coll_name).document(id).update({"passed": passed_val})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admissions_bp.route("/api/admissions/<school>/candidates/move-successful", methods=["POST"])
@login_required
def move_successful(school):
    reg_coll = "nursery_primary_registration" if school == "nursery" else "high_school_registration"
    succ_coll = "nursery_primary_successful" if school == "nursery" else "high_school_successful"
    
    data = request.get_json() or {}
    candidate_ids = data.get("ids", [])
    
    if not candidate_ids:
        return jsonify({"success": False, "error": "No candidates selected"}), 400

    if not firebase_initialized:
        # Simulate transaction move
        reg_list = MOCK_REGISTRATIONS.get(school, [])
        succ_list = MOCK_SUCCESSFUL.get(school, [])
        
        moved_count = 0
        for cid in candidate_ids:
            cand = next((c for c in reg_list if c["id"] == cid), None)
            if cand:
                # Remove from registration
                MOCK_REGISTRATIONS[school] = [c for c in reg_list if c["id"] != cid]
                reg_list = MOCK_REGISTRATIONS[school]
                
                # Add to successful
                new_succ = {
                    "id": f"succ-{cid}",
                    "name": cand["name"],
                    "parentPhone": cand["parentPhone"],
                    "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                succ_list.append(new_succ)
                moved_count += 1
                
        return jsonify({"success": True, "count": moved_count})

    try:
        # Run inside Firestore transactions
        transaction = db.transaction()
        
        @db.transactional
        def move_tx(tx, ids):
            count = 0
            for cid in ids:
                reg_ref = db.collection(reg_coll).document(cid)
                snapshot = reg_ref.get(transaction=tx)
                
                if snapshot.exists:
                    cand_data = snapshot.to_dict()
                    succ_ref = db.collection(succ_coll).document(cid)
                    
                    name = cand_data.get("name")
                    parent_phone = cand_data.get("parentPhone")
                    
                    if not name:
                        if school == "nursery":
                            name = cand_data.get("nurseryChildName") or "Unnamed Pupil"
                        else:
                            name = (f'{cand_data.get("highSchoolSurname", "")} {cand_data.get("highSchoolOtherNames", "")}'.strip()) or cand_data.get("highSchoolName") or cand_data.get("highSchoolDeclName") or "Unnamed Student"
                            
                    if not parent_phone:
                        if school == "nursery":
                            parent_phone = cand_data.get("nurseryFatherHomeTel") or cand_data.get("nurseryMotherHomeTel") or cand_data.get("nurseryPhone") or ""
                        else:
                            parent_phone = cand_data.get("highSchoolParentHomeTel") or cand_data.get("highSchoolPhone") or ""

                    # Copy to successful collection
                    tx.set(succ_ref, {
                        "name": name,
                        "parentPhone": parent_phone,
                        "createdAt": datetime.utcnow()
                    })
                    
                    # Delete original registration
                    tx.delete(reg_ref)
                    count += 1
            return count

        moved_count = move_tx(transaction, candidate_ids)
        
        # Log event
        db.collection("logs").add({
            "action": "Candidates Passed",
            "details": f"Moved {moved_count} candidates to successful list for {school.upper()}.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({"success": True, "count": moved_count})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admissions_bp.route("/api/admissions/<school>/successful", methods=["GET"])
@login_required
def get_successful(school):
    succ_coll = "nursery_primary_successful" if school == "nursery" else "high_school_successful"
    
    if not firebase_initialized:
        return jsonify({"success": True, "successful": MOCK_SUCCESSFUL.get(school, [])})
        
    try:
        successful_ref = db.collection(succ_coll).order_by("createdAt", direction="DESCENDING").stream()
        successful = []
        for succ in successful_ref:
            data = succ.to_dict()
            ts = data.get("createdAt")
            ts_str = ts.strftime("%Y-%m-%d %H:%M:%S") if ts else ""
            successful.append({
                "id": succ.id,
                "name": data.get("name", ""),
                "parentPhone": data.get("parentPhone", ""),
                "createdAt": ts_str
            })
        return jsonify({"success": True, "successful": successful})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admissions_bp.route("/api/admissions/<school>/successful/move-back", methods=["POST"])
@login_required
def move_back(school):
    reg_coll = "nursery_primary_registration" if school == "nursery" else "high_school_registration"
    succ_coll = "nursery_primary_successful" if school == "nursery" else "high_school_successful"
    
    data = request.get_json() or {}
    candidate_ids = data.get("ids", [])
    
    if not candidate_ids:
        return jsonify({"success": False, "error": "No candidates selected"}), 400

    if not firebase_initialized:
        # Simulate move back
        reg_list = MOCK_REGISTRATIONS.get(school, [])
        succ_list = MOCK_SUCCESSFUL.get(school, [])
        
        moved_count = 0
        for cid in candidate_ids:
            succ = next((s for s in succ_list if s["id"] == cid), None)
            if succ:
                # Remove from successful
                MOCK_SUCCESSFUL[school] = [s for s in succ_list if s["id"] != cid]
                succ_list = MOCK_SUCCESSFUL[school]
                
                # Add to registration
                new_reg = {
                    "id": cid.replace("succ-", ""),
                    "name": succ["name"],
                    "gender": "Male",
                    "class": "Nursery 1" if school == "nursery" else "JSS 1",
                    "parentName": "Parent Name",
                    "parentPhone": succ["parentPhone"],
                    "passportUrl": "#",
                    "birthCertUrl": "#",
                    "resultUrl": "#",
                    "testimonialUrl": "#",
                    "passed": False,
                    "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                reg_list.append(new_reg)
                moved_count += 1
        return jsonify({"success": True, "count": moved_count})

    try:
        transaction = db.transaction()
        
        @db.transactional
        def move_back_tx(tx, ids):
            count = 0
            for cid in ids:
                succ_ref = db.collection(succ_coll).document(cid)
                snapshot = succ_ref.get(transaction=tx)
                
                if snapshot.exists:
                    succ_data = snapshot.to_dict()
                    reg_ref = db.collection(reg_coll).document(cid)
                    
                    # Copy to registration collection
                    tx.set(reg_ref, {
                        "name": succ_data.get("name", ""),
                        "gender": "Unknown",
                        "class": "Nursery 1" if school == "nursery" else "JSS 1",
                        "parentName": "Restored Candidate",
                        "parentPhone": succ_data.get("parentPhone", ""),
                        "passed": False,
                        "createdAt": datetime.utcnow()
                    })
                    
                    # Delete original successful doc
                    tx.delete(succ_ref)
                    count += 1
            return count

        moved_count = move_back_tx(transaction, candidate_ids)
        
        # Log event
        db.collection("logs").add({
            "action": "Return to Registration",
            "details": f"Moved {moved_count} candidates back to registration list for {school.upper()}.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({"success": True, "count": moved_count})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admissions_bp.route("/api/admissions/<school>/candidates/<id>", methods=["DELETE"])
@login_required
def delete_candidate(school, id):
    coll_name = "nursery_primary_registration" if school == "nursery" else "high_school_registration"
    
    if not firebase_initialized:
        global MOCK_REGISTRATIONS
        MOCK_REGISTRATIONS[school] = [c for c in MOCK_REGISTRATIONS[school] if c["id"] != id]
        return jsonify({"success": True})
        
    try:
        doc_ref = db.collection(coll_name).document(id)
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return jsonify({"success": False, "error": "Candidate not found"}), 404
            
        cand_data = snapshot.to_dict()
        name = cand_data.get("name", "")
        
        # Delete documents from Firebase Storage if URLs exist
        for key in ["passportUrl", "birthCertUrl", "resultUrl", "testimonialUrl"]:
            url = cand_data.get(key)
            if url and "storage.googleapis.com" in url:
                try:
                    # extract blob path
                    blob_path = url.split(".com/")[1]
                    blob = bucket.blob(blob_path)
                    if blob.exists():
                        blob.delete()
                except Exception as se:
                    print(f"Warning: Storage deletion failed for url {url}: {se}")
                    
        # Delete Firestore document
        doc_ref.delete()
        
        # Log event
        db.collection("logs").add({
            "action": "Candidate Deleted",
            "details": f"Deleted candidate: {name} from {school.upper()} registrations.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
        
@admissions_bp.route("/api/admissions/<school>/successful/<id>", methods=["DELETE"])
@login_required
def delete_successful(school, id):
    coll_name = "nursery_primary_successful" if school == "nursery" else "high_school_successful"
    
    if not firebase_initialized:
        global MOCK_SUCCESSFUL
        MOCK_SUCCESSFUL[school] = [s for s in MOCK_SUCCESSFUL[school] if s["id"] != id]
        return jsonify({"success": True})
        
    try:
        doc_ref = db.collection(coll_name).document(id)
        snapshot = doc_ref.get()
        if not snapshot.exists:
            return jsonify({"success": False, "error": "Successful candidate not found"}), 404
            
        data = snapshot.to_dict()
        name = data.get("name", "")
        
        # Delete Firestore document
        doc_ref.delete()
        
        # Log event
        db.collection("logs").add({
            "action": "Successful Candidate Deleted",
            "details": f"Deleted successful candidate: {name} from {school.upper()} successful list.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admissions_bp.route("/api/public/successful/<school>", methods=["GET"])
def get_public_successful(school):
    succ_coll = "nursery_primary_successful" if school == "nursery" else "high_school_successful"
    
    if not firebase_initialized:
        return jsonify({"success": True, "successful": MOCK_SUCCESSFUL.get(school, [])})
        
    try:
        successful_ref = db.collection(succ_coll).order_by("createdAt", direction="DESCENDING").stream()
        successful = []
        for succ in successful_ref:
            data = succ.to_dict()
            successful.append({
                "name": data.get("name", ""),
                "class": "Successful"
            })
        return jsonify({"success": True, "successful": successful})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admissions_bp.route("/api/admissions/<school>/candidates", methods=["POST"])
@login_required
def register_candidate(school):
    global db, firebase_initialized
    import firebase_config

    if not firebase_config.firebase_initialized:
        firebase_config.try_initialize_firebase()

    if firebase_config.firebase_initialized:
        db = firebase_config.db
        firebase_initialized = firebase_config.firebase_initialized

    if not firebase_initialized:
        return jsonify({"success": False, "error": "Firebase is not initialized. Registration requires a working Firebase database connection."}), 500

    try:
        coll_name = "nursery_primary_registration" if school == "nursery" else "high_school_registration"
        data = request.get_json() or {}

        name = data.get("name", "").strip()
        gender = data.get("gender", "")
        target_class = data.get("class", "")
        parent_name = data.get("parentName", "").strip()
        parent_phone = data.get("parentPhone", "").strip()

        if not name or not target_class:
            return jsonify({"success": False, "error": "Name and class are required."}), 400

        payload = {
            "name": name,
            "gender": gender,
            "class": target_class,
            "parentName": parent_name,
            "parentPhone": parent_phone,
            "passportUrl": data.get("passportUrl", "#"),
            "birthCertUrl": data.get("birthCertUrl", "#"),
            "resultUrl": data.get("resultUrl", "#"),
            "testimonialUrl": data.get("testimonialUrl", "#"),
            "passed": False,
            "createdAt": datetime.utcnow()
        }

        doc_ref = db.collection(coll_name).document()
        doc_ref.set(payload)

        # Log event in Firestore
        db.collection("logs").add({
            "action": "Candidate Registered",
            "details": f"Manually registered candidate {name} in {target_class}.",
            "operator": session.get("email", "admin@engreg.com"),
            "timestamp": datetime.utcnow()
        })

        return jsonify({"success": True, "id": doc_ref.id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


