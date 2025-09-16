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

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/entries')
def get_entries():
    date = request.args.get('date')
    if not date:
        return jsonify({'error': 'date parameter required (YYYY-MM-DD)'}), 400


    doc_ref = db.collection('workouts').document(date)
    entries_col = doc_ref.collection('entries')
    docs = entries_col.stream()
    items = []
    for d in docs:
        data = d.to_dict()
        data['id'] = d.id
        items.append(data)


# sort by name or timestamp if present
    items = sorted(items, key=lambda x: x.get('name', ''))
    return jsonify(items)

# @app.route('/')
# def character_sheet():
#     doc_ref = db.collection("workouts").document("2025-09-16")
#     doc = doc_ref.get()

#     if doc.exists:
#         workout_data = doc.to_dict()
#         return jsonify(workout_data)

#     else:
#         return jsonify({"error": "No workout data found."}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)