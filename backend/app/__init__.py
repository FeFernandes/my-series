from flask import Flask, jsonify
from app.database.connection import initialize_database
from app.routes.api import api_bp

def create_app():
    app = Flask(__name__)
    initialize_database()
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Recurso não encontrado."}), 404

    return app
