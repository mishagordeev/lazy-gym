let currentDate = new Date();
let trainedDays = new Set();
let selectedExercise = null;

// Элементы интерфейса
const dateLabel = document.getElementById('current-date');
const prevBtn = document.getElementById('prev-day');
const nextBtn = document.getElementById('next-day');
const tableBody = document.querySelector('#entries-table tbody');
const calendarGrid = document.getElementById('calendar-grid');

const selectedExName = document.getElementById('selected-exercise-name');
const maxWeightBadge = document.getElementById('max-weight-badge');
const setsContainer = document.getElementById('sets-container');
const addSetBtn = document.getElementById('add-set-row-btn');
const saveEntryBtn = document.getElementById('save-entry-btn');

async function onUserLoggedIn(user) {
    console.log("Пользователь авторизован:", user.email);
    await updatePage();
    if (typeof fetchExercises === 'function') {
        fetchExercises();
    }
}

function onUserLoggedOut() {
    if (tableBody) tableBody.innerHTML = '';
}

initAuthUI(onUserLoggedIn, onUserLoggedOut);

function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function loadTrainedDays() {
    const res = await fetchWithAuth('/api/workouts/trained-days');
    if (res && res.ok) {
        const days = await res.json();
        trainedDays = new Set(days);
    }
}

function renderCalendar() {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
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

async function loadEntries() {
    const date = formatDate(currentDate);
    if (dateLabel) dateLabel.textContent = date;
    
    const res = await fetchWithAuth(`/api/entries?date=${date}`);
    if (!res || !res.ok) return;
    const entries = await res.json();
    
    if (!tableBody) return;
    tableBody.innerHTML = entries.length ? '' : '<tr><td colspan="3" class="empty-state">Нет записей за этот день</td></tr>';
    
    entries.forEach(e => {
        const tr = document.createElement('tr');
        let setsHTML = '<div class="sets-badge-container">';
        (e.sets || []).forEach((s, idx) => {
            setsHTML += `<span class="set-badge"><b>${idx+1}</b>: ${s.weight}кг × ${s.reps}</span>`;
        });
        setsHTML += '</div>';
        
        tr.innerHTML = `
            <td><span class="exercise-title">${e.exercise_name}</span></td>
            <td>${setsHTML}</td>
            <td style="text-align: right; white-space: nowrap;">
                <button class="icon-btn del-btn" data-id="${e.id}" title="Удалить">🗑️</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

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
        Array.from(setsContainer.children).forEach((r, idx) => {
            r.querySelector('.set-num').textContent = idx + 1;
        });
    });
    setsContainer.appendChild(row);
}

window.selectExercise = async function(id, name) {
    selectedExercise = { id, name };
    if (selectedExName) selectedExName.textContent = name;
    
    const res = await fetchWithAuth(`/api/exercises/max-weight/${id}`);
    if (res && res.ok) {
        const data = await res.json();
        if (maxWeightBadge) {
            maxWeightBadge.textContent = data.max_weight > 0 ? `ПМ: ${data.max_weight} кг` : 'ПМ: нет данных';
        }
    }
    
    if (setsContainer) {
        setsContainer.innerHTML = '';
        addSetRow();
    }
};

if (addSetBtn) addSetBtn.addEventListener('click', () => addSetRow());

if (saveEntryBtn) {
    saveEntryBtn.addEventListener('click', async () => {
        if (!selectedExercise) return alert('Пожалуйста, выберите упражнение через поиск');
        
        const rows = setsContainer.querySelectorAll('.set-input-row');
        const sets = [];
        
        rows.forEach(r => {
            const weightInput = r.querySelector('.input-weight');
            const repsInput = r.querySelector('.input-reps');
            if (weightInput && repsInput && weightInput.value !== '' && repsInput.value !== '') {
                sets.push({ weight: parseFloat(weightInput.value), reps: parseInt(repsInput.value) });
            }
        });
        
        if (!sets.length) return alert('Добавьте хотя бы один подход');
        
        const payload = { date: formatDate(currentDate), exercise_id: selectedExercise.id, sets };
        
        const res = await fetchWithAuth('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res && res.ok) {
            setsContainer.innerHTML = '';
            selectedExercise = null;
            if (selectedExName) selectedExName.textContent = 'Упражнение не выбрано';
            if (maxWeightBadge) maxWeightBadge.textContent = '';
            await updatePage();
        } else {
            alert('Ошибка при сохранении данных');
        }
    });
}

if (tableBody) {
    tableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;
        
        if (target.matches('.del-btn')) {
            if (confirm('Удалить эту запись?')) {
                await fetchWithAuth(`/api/entries/${formatDate(currentDate)}/${id}`, { method: 'DELETE' });
                await updatePage();
            }
        }
    });
}

if (prevBtn) prevBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updatePage(); });
if (nextBtn) nextBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updatePage(); });

async function updatePage() {
    await loadTrainedDays();
    renderCalendar();
    await loadEntries();
}