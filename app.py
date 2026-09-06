import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify, render_template

# Импортируем наш модуль авторизации
from auth import login_required

service_account = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

if service_account:
    cred = credentials.Certificate(json.loads(service_account))
    firebase_admin.initialize_app(cred)
else:
    # Загрузка локального файла ключа для разработки
    cred = credentials.Certificate('firebase-key.json')
    firebase_admin.initialize_app(cred)

app = Flask(__name__, static_folder='static', static_url_path='/static')
db = firestore.client()

def user_db(uid):
    """Возвращает ссылку на изолированное хранилище пользователя."""
    return db.collection('users').document(uid)

@app.route('/')
def index():
    return render_template('index.html')

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

# API: Получить записи за день (с поддержкой структуры подходов)
@app.route('/api/entries', methods=['GET'])
def get_entries():
    date = request.args.get('date')
    if not date:
        return jsonify({'error': 'date parameter required'}), 400

    entries_col = db.collection('workouts').document(date).collection('entries')
    docs = entries_col.stream()
    items = []
    for d in docs:
        data = d.to_dict()
        data['id'] = d.id
        items.append(data)

    items = sorted(items, key=lambda x: x.get('index', 0))
    return jsonify(items)

# API: Добавить запись (поддерживает динамический массив подходов)
@app.route('/api/entries', methods=['POST'])
def add_entry():
    j = request.get_json() or {}
    date = j.get('date')
    exercise_id = j.get('exercise_id')
    sets = j.get('sets', [])  # Ожидаем массив [{"weight": 80, "reps": 10}, ...]

    if not (date and exercise_id and sets):
        return jsonify({'error': 'invalid data structure'}), 400

    # Берем актуальное название упражнения из справочника
    ex_doc = db.collection('exercises').document(exercise_id).get()
    exercise_name = ex_doc.to_dict().get('name', 'Упражнение') if ex_doc.exists else 'Упражнение'

    workout_ref = db.collection('workouts').document(date)
    entries_ref = workout_ref.collection('entries')

    docs = entries_ref.stream()
    max_index = max([d.to_dict().get('index', -1) for d in docs] + [-1])
    new_index = max_index + 1

    entry_id = str(uuid.uuid4())

    entry_data = {
        'exercise_id': exercise_id,
        'exercise_name': exercise_name,
        'sets': sets,
        'index': new_index
    }

    entry_ref = entries_ref.document(entry_id)
    history_ref = db.collection('exercise_history').document(exercise_id).collection('entries').document(entry_id)

    batch = db.batch()
    batch.set(entry_ref, entry_data)
    batch.set(history_ref, {'date': date, 'sets': sets})
    batch.commit()

    entry_data['id'] = entry_id
    return jsonify(entry_data), 201

# API: Обновить или Удалить запись
@app.route('/api/entries/<date>/<entry_id>', methods=['PUT', 'DELETE'])
def modify_entry(date, entry_id):
    entry_ref = db.collection('workouts').document(date).collection('entries').document(entry_id)
    doc = entry_ref.get()
    
    if not doc.exists:
        return jsonify({'error': 'Not found'}), 404
        
    exercise_id = doc.to_dict()['exercise_id']
    history_ref = db.collection('exercise_history').document(exercise_id).collection('entries').document(entry_id)
    
    if request.method == 'DELETE':
        batch = db.batch()
        batch.delete(entry_ref)
        batch.delete(history_ref)
        batch.commit()
        return jsonify({'success': True})
        
    elif request.method == 'PUT':
        j = request.get_json() or {}
        sets = j.get('sets', [])
        
        batch = db.batch()
        batch.update(entry_ref, {'sets': sets})
        batch.update(history_ref, {'sets': sets})
        batch.commit()
        return jsonify({'success': True})

# API: Получить максимальный исторический вес для упражнения
@app.route('/api/exercises/max-weight/<exercise_id>', methods=['GET'])
def get_max_weight(exercise_id):
    docs = db.collection('exercise_history').document(exercise_id).collection('entries').stream()
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

# API: Справочник упражнений (с поддержкой категорий/мышц и «темпового» добавления)
@app.route('/api/exercises', methods=['GET', 'POST'])
def handle_exercises():
    if request.method == 'POST':
        j = request.get_json() or {}
        name = j.get('name')
        category = j.get('category', 'Разное')
        if not name:
            return jsonify({'error': 'Name is required'}), 400
            
        new_id = str(uuid.uuid4())
        db.collection('exercises').document(new_id).set({
            'name': name,
            'category': category
        })
        return jsonify({'id': new_id, 'name': name, 'category': category}), 201

    docs = db.collection('exercises').stream()
    result = []
    for doc in docs:
        d = doc.to_dict()
        result.append({
            'id': doc.id,
            'name': d.get('name'),
            'category': d.get('category', 'Разное')
        })
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5000)