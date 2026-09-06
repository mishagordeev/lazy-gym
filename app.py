import os
import json
import firebase_admin
import uuid
from functools import wraps
from firebase_admin import credentials, firestore, auth
from flask import Flask, request, jsonify, render_template

# Инициализация Firebase Admin SDK
if not firebase_admin._apps:
    service_account = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if service_account:
        try:
            cred_dict = json.loads(service_account)
            cred = credentials.Certificate(cred_dict)
        except Exception:
            cred = credentials.Certificate(service_account)
        firebase_admin.initialize_app(cred)
    elif os.path.exists('firebase-key.json'):
        cred = credentials.Certificate('firebase-key.json')
        firebase_admin.initialize_app(cred)
    else:
        raise ValueError("No Firebase credentials found")

app = Flask(__name__, static_folder='static', static_url_path='/static')
db = firestore.client()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized, missing token'}), 401
        
        id_token = auth_header.split('Bearer ')[1]
        try:
            decoded_token = auth.verify_id_token(id_token)
            request.user_id = decoded_token['uid']
        except Exception as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
            
        return f(*args, **kwargs)
    return decorated_function

def user_db(uid):
    return db.collection('users').document(uid)

@app.route('/')
def index():
    return render_template('index.html')

# API: Получить дни с тренировками
@app.route('/api/workouts/trained-days', methods=['GET'])
@login_required
def get_trained_days():
    docs = user_db(request.user_id).collection('workouts').stream()
    trained_days = []
    for d in docs:
        entries = user_db(request.user_id).collection('workouts').document(d.id).collection('entries').limit(1).stream()
        if any(entries):
            trained_days.append(d.id)
    return jsonify(trained_days)

# API: Записи за конкретный день (GET и POST)
@app.route('/api/entries', methods=['GET', 'POST'])
@login_required
def handle_entries():
    if request.method == 'GET':
        date = request.args.get('date')
        if not date:
            return jsonify({'error': 'date parameter required'}), 400

        entries_col = user_db(request.user_id).collection('workouts').document(date).collection('entries')
        docs = entries_col.stream()
        items = []
        for d in docs:
            data = d.to_dict()
            data['id'] = d.id
            items.append(data)

        return jsonify(sorted(items, key=lambda x: x.get('index', 0)))

    elif request.method == 'POST':
        try:
            j = request.get_json() or {}
            date = j.get('date')
            exercise_id = j.get('exercise_id')
            raw_sets = j.get('sets', [])

            if not (date and exercise_id and raw_sets):
                return jsonify({'error': 'invalid data structure'}), 400

            clean_sets = [{'weight': float(s.get('weight', 0)), 'reps': int(s.get('reps', 0))} for s in raw_sets]

            exercise_name = 'Упражнение'
            ex_doc = db.collection('exercises').document(exercise_id).get()
            if ex_doc.exists:
                exercise_name = ex_doc.to_dict().get('name', 'Упражнение')

            entries_ref = user_db(request.user_id).collection('workouts').document(date).collection('entries')
            docs = list(entries_ref.stream())
            max_index = max([d.to_dict().get('index', -1) for d in docs] + [-1])
            entry_id = str(uuid.uuid4())

            entry_data = {
                'exercise_id': str(exercise_id),
                'exercise_name': str(exercise_name),
                'sets': clean_sets,
                'index': int(max_index + 1)
            }

            entry_ref = entries_ref.document(entry_id)
            history_ref = user_db(request.user_id).collection('exercise_history').document(exercise_id).collection('entries').document(entry_id)

            batch = db.batch()
            batch.set(entry_ref, entry_data)
            batch.set(history_ref, {'date': str(date), 'sets': clean_sets})
            batch.commit()

            entry_data['id'] = entry_id
            return jsonify(entry_data), 201
        except Exception as e:
            return jsonify({'error': f'Server error: {str(e)}'}), 500

# API: Удаление записи
@app.route('/api/entries/<date>/<entry_id>', methods=['DELETE'])
@login_required
def delete_entry(date, entry_id):
    entry_ref = user_db(request.user_id).collection('workouts').document(date).collection('entries').document(entry_id)
    doc = entry_ref.get()
    if not doc.exists:
        return jsonify({'error': 'Not found'}), 404
        
    exercise_id = doc.to_dict()['exercise_id']
    history_ref = user_db(request.user_id).collection('exercise_history').document(exercise_id).collection('entries').document(entry_id)
    
    batch = db.batch()
    batch.delete(entry_ref)
    batch.delete(history_ref)
    batch.commit()
    return jsonify({'success': True})

# API: Получить рекордный вес
@app.route('/api/exercises/max-weight/<exercise_id>', methods=['GET'])
@login_required
def get_max_weight(exercise_id):
    docs = user_db(request.user_id).collection('exercise_history').document(exercise_id).collection('entries').stream()
    max_weight = 0.0
    for d in docs:
        for s in d.to_dict().get('sets', []):
            try:
                w = float(s.get('weight', 0))
                if w > max_weight:
                    max_weight = w
            except ValueError:
                continue
    return jsonify({'max_weight': max_weight})

# API: Справочник упражнений
@app.route('/api/exercises', methods=['GET', 'POST'])
@login_required
def handle_exercises():
    if request.method == 'POST':
        j = request.get_json() or {}
        name = j.get('name')
        category = j.get('category', 'Разное')
        if not name:
            return jsonify({'error': 'Name empty'}), 400
        new_id = str(uuid.uuid4())
        db.collection('exercises').document(new_id).set({'name': name, 'category': category})
        return jsonify({'id': new_id, 'name': name, 'category': category}), 201

    docs = db.collection('exercises').stream()
    return jsonify([{'id': d.id, **d.to_dict()} for d in docs])