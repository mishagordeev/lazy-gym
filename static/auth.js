// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDsJTM3S2AAs7WWoWOcBbdAtbXHUcchWG8",
  authDomain: "lazy-workouts.firebaseapp.com",
  projectId: "lazy-workouts",
  storageBucket: "lazy-workouts.firebasestorage.app",
  messagingSenderId: "1040286454673",
  appId: "1:1040286454673:web:bff26b5a9a084e98ef8030"
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
    const userName = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');
    const appContent = document.getElementById('app-content');

    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (currentUser) {
                auth.signOut();
            } else {
                // Вызов официального всплывающего окна авторизации Google
                auth.signInWithPopup(googleProvider).catch(err => {
                    alert('Ошибка входа через Google: ' + err.message);
                });
            }
        });
    }

    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            // Заполняем данные профиля из аккаунта Google
            if (userName) userName.textContent = user.displayName || user.email;
            if (userAvatar) {
                userAvatar.src = user.photoURL || '';
                userAvatar.style.display = user.photoURL ? 'block' : 'none';
            }
            if (authBtn) {
                authBtn.textContent = 'Выйти';
                authBtn.classList.add('logout');
            }
            if (appContent) appContent.style.display = 'block';
            
            if (typeof onLoginCallback === 'function') {
                await onLoginCallback(user);
            }
        } else {
            // Гостевой режим
            if (userName) userName.textContent = 'Войдите для синхронизации';
            if (userAvatar) userAvatar.style.display = 'none';
            if (authBtn) {
                authBtn.textContent = 'Войти через Google';
                authBtn.classList.remove('logout');
            }
            if (appContent) appContent.style.display = 'none';
            
            if (typeof onLogoutCallback === 'function') {
                onLogoutCallback();
            }
        }
    });
}