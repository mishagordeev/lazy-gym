// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Инициализация
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;

/**
 * Авторизованная обертка над native fetch().
 * Автоматически подставляет ID Token пользователя в заголовок Authorization.
 */
async function fetchWithAuth(url, options = {}) {
    if (!currentUser) {
        console.warn('Запрос заблокирован: Пользователь не авторизован');
        return null;
    }
    
    const token = await currentUser.getIdToken();
    
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    return fetch(url, options);
}

/**
 * Инициализация UI-состояния авторизации
 * @param {Function} onLoginCallback Вызывается при успешном входе
 * @param {Function} onLogoutCallback Вызывается при выходе
 */
function initAuthUI(onLoginCallback, onLogoutCallback) {
    const authBtn = document.getElementById('auth-btn');
    const userInfo = document.getElementById('user-info');
    const appContent = document.getElementById('app-content');

    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (currentUser) {
                auth.signOut();
            } else {
                auth.signInWithPopup(googleProvider).catch(err => {
                    alert('Ошибка авторизации: ' + err.message);
                });
            }
        });
    }

    // Слушатель изменения состояния входа
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            if (userInfo) userInfo.textContent = user.displayName || user.email;
            if (authBtn) authBtn.textContent = 'Выйти';
            if (appContent) appContent.style.display = 'block';
            
            if (typeof onLoginCallback === 'function') {
                await onLoginCallback(user);
            }
        } else {
            if (userInfo) userInfo.textContent = 'Войдите для доступа';
            if (authBtn) authBtn.textContent = 'Войти через Google';
            if (appContent) appContent.style.display = 'none';
            
            if (typeof onLogoutCallback === 'function') {
                onLogoutCallback();
            }
        }
    });
}