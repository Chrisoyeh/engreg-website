import os
import logging
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth

logger = logging.getLogger(__name__)

# Track if initialization succeeded
db = None
bucket = None
firebase_initialized = False

# Path to the service account credentials file
cred_path = os.path.join(os.path.dirname(__file__), "firebase-credentials.json")

def try_initialize_firebase():
    global db, bucket, firebase_initialized
    if firebase_initialized:
        return True
    try:
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            import json
            with open(cred_path, 'r') as f:
                cred_data = json.load(f)
                project_id = cred_data.get("project_id", "")
                bucket_name = f"{project_id}.appspot.com"
                
            firebase_admin.initialize_app(cred, {
                'storageBucket': bucket_name
            })
            
            db = firestore.client()
            bucket = storage.bucket()
            firebase_initialized = True
            logger.info("Firebase Admin SDK successfully initialized with service account.")
            return True
        else:
            logger.info("Firebase credentials file not found. Attempting Application Default Credentials initialization...")
            firebase_admin.initialize_app()
            db = firestore.client()
            firebase_initialized = True
            logger.info("Firebase Admin SDK successfully initialized with Application Default Credentials.")
            return True
    except Exception as e:
        logger.error("Error during Firebase Admin SDK initialization: %s", e)
        return False

try_initialize_firebase()
