import functools
from flask import request, jsonify
from firebase_admin import auth

def login_required(f):
    """
    Декоратор для защиты эндпоинтов. 
    Проверяет наличия Google ID Token в заголовке Authorization: Bearer <token>
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized: Header missing or invalid'}), 401
        
        id_token = auth_header.split('Bearer ')[1]
        try:
            # Декодируем и валидируем токен через Firebase Admin SDK
            decoded_token = auth.verify_id_token(id_token)
            request.user_id = decoded_token['uid']
            request.user_email = decoded_token.get('email', '')
        except Exception as e:
            return jsonify({'error': 'Unauthorized: Token is invalid or expired'}), 401
            
        return f(*args, **kwargs)
    return decorated_function