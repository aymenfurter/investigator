from flask import Flask
from flask_cors import CORS
from api.routes import api
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    app.register_blueprint(api, url_prefix='/api')

    @app.route('/')
    def home():
        return "Welcome to the AI Voice Analysis Tool API"

    return app

if __name__ == '__main__':
    app = create_app()
    app.run()