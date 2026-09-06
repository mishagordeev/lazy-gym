let currentDate = new Date();
let trainedDays = new Set();
let selectedExercise = null;

async function onUserLoggedIn(user) {
    console.log("Пользователь авторизован:", user.email);
    await updatePage();
    if (typeof fetchExercises === 'function') {
        fetchExercises();
    }
}

function onUserLoggedOut() {
    console.log("Пользователь вышел из системы");
    tableBody.innerHTML = '';
}

// Запускаем модуль авторизации
initAuthUI(onUserLoggedIn, onUserLoggedOut);

// Все вызовы сетевых запросов используют чистый fetchWithAuth
async function loadEntries() {
    const date = formatDate(currentDate);
    const res = await fetchWithAuth(`/api/entries?date=${date}`);
    if (!res || !res.ok) return;
    const entries = await res.json();
    renderEntries(entries);
}

// Инициализация UI элементов
const dateLabel = document.getElementById('current-date');
const prevBtn = document.getElementById('prev-day');
const nextBtn = document.getElementById('next-day');
const tableBody = document.querySelector('#entries-table tbody');
const calendarGrid = document.getElementById('calendar-grid');

// Элементы формы добавления
const selectedExName = document.getElementById('selected-exercise-name');
const maxWeightBadge = document.getElementById('max-weight-badge');
const setsContainer = document.getElementById('sets-container');
const addSetBtn = document.getElementById('add-set-row-btn');
const saveEntryBtn = document.getElementById('save-entry-btn');

function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// 1. Календарь с подсветкой тренировочных дней
async function loadTrainedDays() {
    const res = await fetch('/api/workouts/trained-days');
    if (res.ok) {
        const days = await res.json();
        trainedDays = new Set(days);
    }
}

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Первый день месяца и количество дней
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Корректировка под русский стиль недель (Пн-Вс)
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
    // Пустые ячейки смещения
    for (let i = 0; i < startOffset; i++) {
        calendarGrid.appendChild(document.createElement('div'));
    }
    
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.textContent = day;
        
        const cellDateStr = formatDate(new Date(year, month, day));
        
        if (trainedDays.has(cellDateStr)) cell.classList.add('trained');
        if (cellDateStr === formatDate(currentDate)) cell.classList.add('active');
        
        cell.addEventListener('click', () => {
            currentDate = new Date(year, month, day);
            updatePage();
        });
        calendarGrid.appendChild(cell);
    }
}

// 2. Отображение записей за день
async function loadEntries() {
    const date = formatDate(currentDate);
    dateLabel.textContent = date;
    
    const res = await fetch(`/api/entries?date=${date}`);
    if (!res.ok) return;
    const entries = await res.json();
    
    tableBody.innerHTML = entries.length ? '' : '<tr><td colspan="3" class="empty-state">Нет записей за этот день</td></tr>';
    
    entries.forEach(e => {
        const tr = document.createElement('tr');
        
        // Рендеринг подходов внутри ячейки
        let setsHTML = '<div class="sets-badge-container">';
        e.sets.forEach((s, idx) => {
            setsHTML += `<span class="set-badge"><b>${idx+1}</b>: ${s.weight}кг × ${s.reps}</span>`;
        });
        setsHTML += '</div>';
        
        tr.innerHTML = `
            <td><span class="exercise-title">${e.exercise_name}</span></td>
            <td>${setsHTML}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button class="icon-btn edit-btn" data-id="${e.id}" title="Редактировать">✏️</button>
                <button class="icon-btn del-btn" data-id="${e.id}" title="Удалить">🗑️</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// 3. Динамическое управление полями ввода подходов (Разный вес в подходах)
function addSetRow(weight = '', reps = '') {
    const row = document.createElement('div');
    row.className = 'set-input-row';
    row.innerHTML = `
        <span class="set-num">${setsContainer.children.length + 1}</span>
        <input type="number" step="0.1" class="input-weight" value="${weight}" placeholder="Вес (кг)" required>
        <input type="number" class="input-reps" value="${reps}" placeholder="Повторы" required>
        <button type="button" class="remove-set-row">×</button>
    `;
    
    row.querySelector('.remove-set-row').addEventListener('click', () => {
        row.remove();
        // Пересчет номеров подходов
        Array.from(setsContainer.children).forEach((r, idx) => {
            r.querySelector('.set-num').textContent = idx + 1;
        });
    });
    setsContainer.appendChild(row);
}

// 4. Показ максимального веса (Вызывается из окна выбора упражнения)
window.selectExercise = async function(id, name) {
    selectedExercise = { id, name };
    selectedExName.textContent = name;
    
    // Запрос рекорда
    const res = await fetch(`/api/exercises/max-weight/${id}`);
    const data = await res.json();
    maxWeightBadge.textContent = data.max_weight > 0 ? `ПМ: ${data.max_weight} кг` : 'ПМ: нет данных';
    
    // Создаем дефолтный первый подход для удобства
    setsContainer.innerHTML = '';
    addSetRow();
};

addSetBtn.addEventListener('click', () => addSetRow());

// Сохранение записи
saveEntryBtn.addEventListener('click', async () => {
    if (!selectedExercise) return alert('Пожалуйста, выберите упражнение через поиск');
    
    const rows = setsContainer.querySelectorAll('.set-input-row');
    const sets = [];
    
    rows.forEach(r => {
        const weightInput = r.querySelector('.input-weight');
        const repsInput = r.querySelector('.input-reps');
        
        if (weightInput && repsInput) {
            const weight = weightInput.value;
            const reps = repsInput.value;
            
            if (weight !== '' && reps !== '') {
                // В JavaScript для добавления в массив используется .push(), а не .append()!
                sets.push({ 
                    weight: parseFloat(weight), 
                    reps: parseInt(reps) 
                });
            }
        }
    });
    
    if (!sets.length) return alert('Добавьте хотя бы один заполненный подход (вес и повторы)');
    
    const payload = { 
        date: formatDate(currentDate), 
        exercise_id: selectedExercise.id, 
        sets 
    };
    
    try {
        const res = await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            // Очищаем форму после успешного сохранения
            setsContainer.innerHTML = '';
            selectedExercise = null;
            selectedExName.textContent = 'Упражнение не выбрано';
            maxWeightBadge.textContent = '';
            
            // Обновляем данные на странице и в календаре
            await updatePage();
        } else {
            const err = await res.json();
            alert('Ошибка сервера: ' + (err.error || 'Не удалось сохранить'));
        }
    } catch (e) {
        console.error('Ошибка сети:', e);
        alert('Ошибка при отправке данных на сервер');
    }
});

// Слушатели кнопок удаления и изменения
tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const id = target.dataset.id;
    if (!id) return;
    
    if (target.matches('.del-btn')) {
        if (confirm('Удалить эту запись?')) {
            await fetch(`/api/entries/${formatDate(currentDate)}/${id}`, { method: 'DELETE' });
            updatePage();
        }
    }
});

prevBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updatePage(); });
nextBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updatePage(); });

async function updatePage() {
    await loadTrainedDays();
    renderCalendar();
    await loadEntries();
}

// Запуск
updatePage();