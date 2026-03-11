import os
import json
import firebase_admin
import uuid
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify, render_template

# cred = credentials.Certificate("firebase-key.json")
# firebase_admin.initialize_app(cred)

service_account = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

if service_account:
    cred = credentials.Certificate(json.loads(service_account))
    firebase_admin.initialize_app(cred)
else:
    raise ValueError("MY_CREDENTIALS environment variable is not set")

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.debug = True

db = firestore.client()

@app.route('/')
def index():
    return render_template('index.html')

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
    items = sorted(items, key=lambda x: x.get('index', ''))
    return jsonify(items)

# API: add entry
@app.route('/api/entries', methods=['POST'])
def add_entry():

    j = request.get_json() or {}

    date = j.get('date')
    exercise_id = j.get('exercise_id')
    weight = j.get('weight')
    reps = j.get('reps')
    sets = j.get('sets')

    if not (date and exercise_id):
        return jsonify({'error': 'invalid data'}), 400

    workout_ref = db.collection('workouts').document(date)
    entries_ref = workout_ref.collection('entries')

    docs = entries_ref.stream()

    max_index = -1
    for d in docs:
        data = d.to_dict()
        idx = data.get('index', -1)
        if idx > max_index:
            max_index = idx

    new_index = max_index + 1

    entry_id = str(uuid.uuid4())

    entry_data = {
        'exercise_id': exercise_id,
        'weight': weight,
        'reps': reps,
        'sets': sets,
        'index': new_index
    }

    history_data = {
        'date': date,
        'weight': weight,
        'reps': reps,
        'sets': sets
    }

    entry_ref = entries_ref.document(entry_id)

    history_ref = db.collection('exercise_history') \
        .document(exercise_id) \
        .collection('entries') \
        .document(entry_id)

    batch = db.batch()

    batch.set(entry_ref, entry_data)
    batch.set(history_ref, history_data)

    batch.commit()

    entry_data['id'] = entry_id

    return jsonify(entry_data), 201

# API: update entry
@app.route('/api/entries/<date>/<entry_id>', methods=['PUT'])
def update_entry(date, entry_id):

    j = request.get_json() or {}

    name = j.get('name')
    weight = j.get('weight')
    reps = j.get('reps')
    sets = j.get('sets')

    if not (name and weight is not None and reps is not None and sets is not None):
        return jsonify({'error': 'invalid data'}), 400

    entry_ref = db.collection('workouts') \
        .document(date) \
        .collection('entries') \
        .document(entry_id)

    doc = entry_ref.get()

    if not doc.exists:
        return jsonify({'error': 'Entry not found'}), 404

    current = doc.to_dict()

    exercise_id = current['exercise_id']
    index = current.get('index', 0)

    updated_entry = {
        'exercise_id': exercise_id,
        'name': name,
        'weight': weight,
        'reps': reps,
        'sets': sets,
        'index': index
    }

    history_ref = db.collection('exercise_history') \
        .document(exercise_id) \
        .collection('entries') \
        .document(entry_id)

    batch = db.batch()

    batch.update(entry_ref, updated_entry)

    batch.update(history_ref, {
        'weight': weight,
        'reps': reps,
        'sets': sets
    })

    batch.commit()

    updated_entry['id'] = entry_id

    return jsonify(updated_entry)

# API: delete entry
@app.route('/api/entries/<date>/<entry_id>', methods=['DELETE'])
def delete_entry(date, entry_id):

    entry_ref = db.collection('workouts') \
        .document(date) \
        .collection('entries') \
        .document(entry_id)

    doc = entry_ref.get()

    if not doc.exists:
        return jsonify({'error': 'Entry not found'}), 404

    data = doc.to_dict()
    exercise_id = data['exercise_id']

    history_ref = db.collection('exercise_history') \
        .document(exercise_id) \
        .collection('entries') \
        .document(entry_id)

    batch = db.batch()

    batch.delete(entry_ref)
    batch.delete(history_ref)

    batch.commit()

    return jsonify({'success': True})

@app.route('/api/exercise/<exercise_id>/history')
def exercise_history(exercise_id):

    docs = db.collection('exercise_history') \
        .document(exercise_id) \
        .collection('entries') \
        .order_by('date', direction=firestore.Query.DESCENDING) \
        .stream()

    result = []

    for d in docs:
        data = d.to_dict()
        result.append(data)

    return jsonify(result)

@app.route('/api/exercise/<exercise_id>')
def get_exercise(exercise_id):

    doc = db.collection('exercises').document(exercise_id).get()

    if not doc.exists:
        return jsonify({'error': 'not found'}), 404

    data = doc.to_dict()
    data['id'] = doc.id

    return jsonify(data)

@app.route('/exercise/<exercise_id>')
def exercise_page(exercise_id):
    return render_template('exercise.html', exercise_id=exercise_id)

@app.route('/api/workouts/<date>')
def get_workout(date):

    entries_ref = db.collection("workouts").document(date).collection("entries")

    docs = list(entries_ref.order_by("index").stream())

    exercise_ids = set()

    for d in docs:
        exercise_ids.add(d.to_dict().get("exercise_id"))

    exercises = {}

    for ex_id in exercise_ids:
        doc = db.collection("exercises").document(ex_id).get()
        if doc.exists:
            exercises[ex_id] = doc.to_dict().get("name")

    result = []

    for doc in docs:

        data = doc.to_dict()

        ex_id = data.get("exercise_id")

        result.append({
            "id": doc.id,
            "exercise_id": ex_id,
            "name": exercises.get(ex_id),
            "weight": data.get("weight"),
            "reps": data.get("reps"),
            "sets": data.get("sets"),
            "index": data.get("index")
        })

    return jsonify(result)

@app.route('/api/exercises')
def get_exercises():

    docs = db.collection("exercises").stream()

    result = []

    for doc in docs:

        data = doc.to_dict()

        result.append({
            "id": doc.id,
            "name": data.get("name")
        })

    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5000)