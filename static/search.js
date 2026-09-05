const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-category');
const exerciseListContainer = document.getElementById('exercise-list');
const quickCreateInput = document.getElementById('quick-create-name');
const quickCreateBtn = document.getElementById('quick-create-btn');

let allExercises = [];

async function fetchExercises() {
    const res = await fetch('/api/exercises');
    if (res.ok) {
        allExercises = await res.json();
        renderList();
    }
}

function renderList() {
    const query = searchInput.value.toLowerCase();
    const category = filterSelect.value;
    
    exerciseListContainer.innerHTML = '';
    
    const filtered = allExercises.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(query);
        const matchesCategory = category === '' || ex.category === category;
        return matchesSearch && matchesCategory;
    });
    
    if(!filtered.length) {
        exerciseListContainer.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
        return;
    }
    
    filtered.forEach(ex => {
        const item = document.createElement('div');
        item.className = 'exercise-search-item';
        item.innerHTML = `
            <div>
                <div class="ex-search-name">${ex.name}</div>
                <div class="ex-search-cat">${ex.category}</div>
            </div>
            <button class="select-ex-btn">Выбрать</button>
        `;
        
        item.querySelector('.select-ex-btn').addEventListener('click', () => {
            // Вызываем функцию главного экрана родительского окна
            window.selectExercise(ex.id, ex.name);
            // Закрываем модальное окно / прокручиваем к форме
            document.getElementById('adder-section').scrollIntoView({ behavior: 'smooth' });
        });
        
        exerciseListContainer.appendChild(item);
    });
}

// Темповое добавление упражнения прямо из поиска (Пункт 2)
quickCreateBtn.addEventListener('click', async () => {
    const name = quickCreateInput.value.trim();
    const category = filterSelect.value || 'Разное';
    
    if(!name) return alert('Введите название для быстрого создания');
    
    const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, category })
    });
    
    if(res.ok) {
        const newEx = await res.json();
        quickCreateInput.value = '';
        await fetchExercises();
        window.selectExercise(newEx.id, newEx.name);
    }
});

searchInput.addEventListener('input', renderList);
filterSelect.addEventListener('change', renderList);

// Старт
fetchExercises();