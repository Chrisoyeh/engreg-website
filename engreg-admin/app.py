import os
from flask import Flask, render_template, redirect, url_for, session
from config import Config
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.gallery import gallery_bp
from routes.admissions import admissions_bp
from routes.settings import settings_bp

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)
app.config.from_object(Config)

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(gallery_bp)
app.register_blueprint(admissions_bp)
app.register_blueprint(settings_bp)

# Global CORS Headers Handler
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
    return response

# Global error handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template("admin-login.html", error="Page not found. Redirected to login."), 404

@app.errorhandler(413)
def request_entity_too_large(e):
    from flask import jsonify
    return jsonify({"success": False, "error": "File size exceeds the 4MB maximum limit."}), 413

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=app.config["PORT"],
        debug=app.config["DEBUG"]
    )
