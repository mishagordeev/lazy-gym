import os
import json
import firebase_admin
import uuid
from functools import wraps
from firebase_admin import credentials, firestore, auth
from flask import Flask, request, jsonify, render_template

# Безопасная инициализация Firebase на Vercel
if not firebase_admin._apps:
    service_account = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if service_account:
        try:
            # Если в env передан чистый JSON
            cred_dict = json.loads(service_account)
            cred = credentials.Certificate(cred_dict)
        except Exception:
            # Если в env передан путь к файлу
            cred = credentials.Certificate(service_account)
        firebase_admin.initialize_app(cred)
    elif os.path.exists('firebase-key.json'):
        cred = credentials.Certificate('firebase-key.json')
        firebase_admin.initialize_app(cred)
    else:
        raise ValueError("No Firebase credentials found in environment or local file")

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

@app.route('/api/entries', methods=['POST'])
@login_required
def add_entry():
    try:
        j = request.get_json() or {}
        date = j.get('date')
        exercise_id = j.get('exercise_id')
        raw_sets = j.get('sets', [])

        if not (date and exercise_id and raw_sets):
            return jsonify({'error': 'invalid data structure'}), 400

        # Принудительно приводим типы данных подходов
        clean_sets = []
        for s in raw_sets:
            clean_sets.append({
                'weight': float(s.get('weight', 0)),
                'reps': int(s.get('reps', 0))
            })

        # Запрос названия упражнения
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
        # Теперь сервер вернет понятный JSON с описанием ошибки вместо падения 500
        return jsonify({'error': f'Server error: {str(e)}'}), 500