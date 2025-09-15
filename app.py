import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, send_from_directory, jsonify, request

service_account = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

if service_account:
    cred = credentials.Certificate(json.loads(service_account))
    firebase_admin.initialize_app(cred)
else:
    raise ValueError("MY_CREDENTIALS environment variable is not set")

app = Flask(__name__)
app.debug = True

db = firestore.client()

app = Flask(__name__)

if __name__ == '__main__':
    app.run(debug=True, port=5000)