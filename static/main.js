const dateLabel = document.getElementById('current-date');
const prevBtn = document.getElementById('prev-day');
const nextBtn = document.getElementById('next-day');
const tableBody = document.querySelector('#entries-table tbody');
const exerciseInput = document.getElementById('exercise-select');
const weightInput = document.getElementById('weight-input');
const repsInput = document.getElementById('reps-input');
const setsInput = document.getElementById('sets-input');
const addBtn = document.getElementById('add-btn');

let currentDate = new Date();
let editingEntryId = null; // ID записи, которая сейчас редактируется
let exercises = {};

function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function displayDate() {
    dateLabel.textContent = formatDate(currentDate);
}

async function loadEntries() {
    const date = formatDate(currentDate);
    const res = await fetch(`/api/entries?date=${date}`);
    if (!res.ok) {
        tableBody.innerHTML = '<tr><td colspan="5">Ошибка при загрузке</td></tr>';
        return;
    }
    const entries = await res.json();
    renderEntries(entries);
}

function renderEntries(entries) {
    if (!entries.length) {
        tableBody.innerHTML = '<tr><td colspan="5">Нет записей за этот день</td></tr>';
        return;
    }
    tableBody.innerHTML = '';
    console.log(exercises);
    entries.forEach(e => {
        // Основная строка записи
        const tr = document.createElement('tr');
        tr.dataset.id = e.id;
        tr.innerHTML = `
            <td>
                <a href="/exercise/${e.exercise_id}" class="exercise-link">
                    ${exercises[e.exercise_id].name}
                </a>
            </td>
            <td style="text-align: right;">${e.weight} x ${e.reps} x ${e.sets}</td>
            <td>
                <button class="edit-btn" data-id="${e.id}">Редактировать</button>
                <button class="del-btn" data-id="${e.id}">Удалить</button>
            </td>
        `;
        tableBody.appendChild(tr);
        
        // Строка с формой редактирования (изначально скрыта)
        const editRow = document.createElement('tr');
        editRow.id = `edit-form-${e.id}`;
        editRow.classList.add('edit-form-row');
        editRow.style.display = 'none';
        editRow.innerHTML = `
            <td colspan="3">
                <div class="edit-form">
                    <div class="edit-inputs">
                        <input type="text" class="edit-name" value="${e.name}" placeholder="Название">
                        <input type="number" class="edit-weight" value="${e.weight}" placeholder="Вес">
                        <input type="number" class="edit-reps" value="${e.reps}" placeholder="Повторы">
                        <input type="number" class="edit-sets" value="${e.sets}" placeholder="Подходы">
                    </div>
                    <div class="edit-buttons">
                        <button class="save-edit-btn" data-id="${e.id}">Сохранить</button>
                        <button class="cancel-edit-btn" data-id="${e.id}">Отмена</button>
                    </div>
                </div>
            </td>
        `;
        tableBody.appendChild(editRow);
    });
}

async function addEntry() {
    const date = formatDate(currentDate);
    const exercise_id = exerciseInput.value;
    const weight = weightInput.value;
    const reps = repsInput.value;
    const sets = setsInput.value;
    
    if (!weight || !reps || !sets) return alert('Введите вес и количество повторов');

    const payload = { date, exercise_id, weight, reps, sets };
    const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (res.ok) {
        exerciseInput.value = '';
        weightInput.value = '';
        repsInput.value = '';
        setsInput.value = '';
        await loadEntries();
    } else {
        const err = await res.json();
        alert('Ошибка: ' + (err.error || 'unknown'));
    }
}

async function deleteEntry(id) {
    const date = formatDate(currentDate);
    const res = await fetch(`/api/entries/${date}/${id}`, { method: 'DELETE' });
    if (res.ok) await loadEntries();
    else alert('Ошибка при удалении');
}

async function updateEntry(id, updatedData) {
    const date = formatDate(currentDate);
    const res = await fetch(`/api/entries/${date}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
    });
    
    if (res.ok) {
        return true;
    } else {
        const err = await res.json();
        alert('Ошибка при обновлении: ' + (err.error || 'unknown'));
        return false;
    }
}

async function loadExercises() {

    const res = await fetch("/api/exercises")
    const data = await res.json()

    exercises = Object.fromEntries(
        data.map(({ id, ...rest }) => [id, rest])
    );

    populateDropdown(data)
}

function showEditForm(id) {
    // Скрыть все другие открытые формы редактирования
    document.querySelectorAll('.edit-form-row').forEach(row => {
        row.style.display = 'none';
    });
    
    // Показать форму редактирования для этой записи
    const editRow = document.getElementById(`edit-form-${id}`);
    if (editRow) {
        editRow.style.display = '';
        editingEntryId = id;
    }
}

function hideEditForm(id) {
    const editRow = document.getElementById(`edit-form-${id}`);
    if (editRow) {
        editRow.style.display = 'none';
        editingEntryId = null;
    }
}

// Делегирование для кнопок удаления, редактирования, сохранения и отмены
tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    
    if (target.matches('.del-btn')) {
        const id = target.dataset.id;
        if (confirm('Удалить запись?')) deleteEntry(id);
    }
    
    if (target.matches('.edit-btn')) {
        const id = target.dataset.id;
        showEditForm(id);
    }
    
    if (target.matches('.save-edit-btn')) {
        const id = target.dataset.id;
        const editRow = document.getElementById(`edit-form-${id}`);
        
        if (!editRow) return;
        
        const name = editRow.querySelector('.edit-name').value;
        const weight = editRow.querySelector('.edit-weight').value;
        const reps = editRow.querySelector('.edit-reps').value;
        const sets = editRow.querySelector('.edit-sets').value;
        
        if (!weight || !reps || !sets) {
            alert('Введите вес и количество повторов');
            return;
        }
        
        const updatedData = { name, weight, reps, sets };
        const success = await updateEntry(id, updatedData);
        
        if (success) {
            hideEditForm(id);
            await loadEntries();
        }
    }
    
    if (target.matches('.cancel-edit-btn')) {
        const id = target.dataset.id;
        hideEditForm(id);
    }
});

prevBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    displayDate();
    loadEntries();
    editingEntryId = null; // Сбросить редактирование при смене дня
});

nextBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    displayDate();
    loadEntries();
    editingEntryId = null; // Сбросить редактирование при смене дня
});

addBtn.addEventListener('click', addEntry);

function populateDropdown(exercisesList) {

    exerciseInput.innerHTML = ""

    exercisesList.forEach(e => {

        const option = document.createElement("option")

        option.value = e.id
        option.textContent = e.name

        exerciseInput.appendChild(option)

    })
}

// Инициализация
displayDate();
loadEntries();
loadExercises();