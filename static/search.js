const searchInput = document.getElementById('search-input');
const filterSelect = document.getElementById('filter-category');
const exerciseListContainer = document.getElementById('exercise-list');
const quickCreateInput = document.getElementById('quick-create-name');
const quickCreateBtn = document.getElementById('quick-create-btn');

let allExercises = [];

async function fetchExercises() {
    const res = await fetchWithAuth('/api/exercises');
    if (res && res.ok) {
        allExercises = await res.json();
        renderList();
    }
}

function renderList() {
    if (!exerciseListContainer) return;
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const category = filterSelect ? filterSelect.value : '';
    
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
            if (typeof window.selectExercise === 'function') {
                window.selectExercise(ex.id, ex.name);
            }
            const adder = document.getElementById('adder-section');
            if (adder) adder.scrollIntoView({ behavior: 'smooth' });
        });
        
        exerciseListContainer.appendChild(item);
    });
}

if (quickCreateBtn) {
    quickCreateBtn.addEventListener('click', async () => {
        const name = quickCreateInput ? quickCreateInput.value.trim() : '';
        const category = filterSelect ? filterSelect.value || 'Разное' : 'Разное';
        
        if(!name) return alert('Введите название для создания');
        
        const res = await fetchWithAuth('/api/exercises', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, category })
        });
        
        if(res && res.ok) {
            const newEx = await res.json();
            if (quickCreateInput) quickCreateInput.value = '';
            await fetchExercises();
            if (typeof window.selectExercise === 'function') {
                window.selectExercise(newEx.id, newEx.name);
            }
        }
    });
}

if (searchInput) searchInput.addEventListener('input', renderList);
if (filterSelect) filterSelect.addEventListener('change', renderList);