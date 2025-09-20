const dateLabel = document.getElementById('current-date');
const prevBtn = document.getElementById('prev-day');
const nextBtn = document.getElementById('next-day');
const tableBody = document.querySelector('#entries-table tbody');
// const exerciseSelect = document.getElementById('exercise-select');
const exerciseInput = document.getElementById('name-input');
const weightInput = document.getElementById('weight-input');
const repsInput = document.getElementById('reps-input');
const setsInput = document.getElementById('sets-input');
const addBtn = document.getElementById('add-btn');


let currentDate = new Date();


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
        tableBody.innerHTML = '<tr><td colspan="4">Ошибка при загрузке</td></tr>';
        return;
    }
    const entries = await res.json();
    renderEntries(entries);
}


function renderEntries(entries) {
    if (!entries.length) {
        tableBody.innerHTML = '<tr><td colspan="4">Нет записей за этот день</td></tr>';
        return;
    }
    tableBody.innerHTML = '';
    entries.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
<td>${e.name}</td>
<td style="text-align: right;">${e.weight} x ${e.reps} x ${e.sets}</td>
<td><button class="del-btn" data-id="${e.id}">Удалить</button></td>`;
        tableBody.appendChild(tr);
    });
}


async function addEntry() {
    const date = formatDate(currentDate);
    const name = exerciseInput.value;
    const weight = weightInput.value;
    const reps = repsInput.value;
    const sets = setsInput.value;
    if (!weight || !reps || !sets) return alert('Введите вес и количество повторов');


    const payload = { date, name, weight, reps, sets };
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


// Делегирование для кнопок удаления
tableBody.addEventListener('click', (e) => {
    if (e.target.matches('.del-btn')) {
        const id = e.target.dataset.id;
        if (confirm('Удалить запись?')) deleteEntry(id);
    }
});


prevBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    displayDate();
    loadEntries();
});
nextBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    displayDate();
    loadEntries();
});


addBtn.addEventListener('click', addEntry);


// Инициализация
displayDate();
loadEntries();