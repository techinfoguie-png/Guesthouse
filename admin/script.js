// Конфигурация
const API_URL = 'https://script.google.com/macros/s/AKfycbynKHpCuTZXIiVd-NQzfc_GSa8N899fSdelP__2mH8RXJOk-xOKY5aUEpPvtjevM_qR/exec'; // ЗАМЕНИТЕ НА ВАШ URL!
let currentPassword = '';

// DOM элементы
const loginScreen = document.getElementById('loginScreen');
const adminPanel = document.getElementById('adminPanel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtnMobile');
const menuToggle = document.getElementById('menuToggle');
const sideMenu = document.getElementById('sideMenu');

// ========== АВТОРИЗАЦИЯ ==========
async function login() {
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    // Проверка через Google Sheets (ваш существующий API)
    try {
        const response = await fetch(`${API_URL}?action=settings`);
        const settings = await response.json();
        const valid = (password === settings.admin_password);
        
        if (valid) {
            currentPassword = password;
            localStorage.setItem('adminAuth', btoa(password));
            loginScreen.classList.add('hidden');
            adminPanel.classList.add('active');
            loadCurrentTab();
        } else {
            errorDiv.textContent = 'Неверный пароль';
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения';
    }
}

function logout() {
    localStorage.removeItem('adminAuth');
    currentPassword = '';
    loginScreen.classList.remove('hidden');
    adminPanel.classList.remove('active');
    document.getElementById('adminPassword').value = '';
}

function checkAutoLogin() {
    const saved = localStorage.getItem('adminAuth');
    if (saved) {
        document.getElementById('adminPassword').value = atob(saved);
        login();
    }
}

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function fetchData(endpoint) {
    const response = await fetch(`${API_URL}?action=${endpoint}`);
    return response.json();
}

async function updateData(action, data) {
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...data })
    });
    return response.json();
}

// Бронирования
async function loadBookings() {
    const container = document.getElementById('bookingsList');
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-pulse"></i> Загрузка...</div>';
    
    const bookings = await fetchData('bookings');
    const filter = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchBookings').value.toLowerCase();
    
    let filtered = bookings;
    if (filter !== 'all') {
        filtered = filtered.filter(b => b.status === filter);
    }
    if (search) {
        filtered = filtered.filter(b => 
            b.name.toLowerCase().includes(search) || 
            b.phone.includes(search)
        );
    }
    
    const newCount = bookings.filter(b => b.status === 'new').length;
    document.getElementById('newBookingsBadge').textContent = newCount;
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="loading-spinner">Нет бронирований</div>';
        return;
    }
    
    container.innerHTML = filtered.map(booking => `
        <div class="booking-card">
            <div class="booking-header">
                <span class="booking-name">${escapeHtml(booking.name)}</span>
                <span class="booking-status status-${booking.status}">
                    ${booking.status === 'new' ? '🟡 Новое' : booking.status === 'confirmed' ? '✅ Подтверждено' : '❌ Отменено'}
                </span>
            </div>
            <div class="booking-details">
                <span><i class="fas fa-phone"></i> ${escapeHtml(booking.phone)}</span>
                <span><i class="fas fa-envelope"></i> ${escapeHtml(booking.email || '—')}</span>
                <span><i class="fas fa-door-open"></i> Номер: ${booking.roomId}</span>
                <span><i class="fas fa-calendar-alt"></i> ${booking.checkIn} → ${booking.checkOut}</span>
                <span><i class="fas fa-users"></i> ${booking.guests} гостей</span>
            </div>
            <div class="booking-actions">
                ${booking.status === 'new' ? `<button class="btn-sm btn-confirm" onclick="updateStatus('${booking.id}', 'confirmed')">✅ Подтвердить</button>` : ''}
                ${booking.status !== 'cancelled' ? `<button class="btn-sm btn-cancel" onclick="updateStatus('${booking.id}', 'cancelled')">❌ Отменить</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function updateStatus(bookingId, newStatus) {
    await updateData('update_booking_status', { id: bookingId, status: newStatus });
    loadBookings();
}

// Номера
async function loadRooms() {
    const container = document.getElementById('roomsList');
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-pulse"></i> Загрузка...</div>';
    
    const rooms = await fetchData('rooms');
    
    container.innerHTML = rooms.map(room => `
        <div class="room-card">
            <h3>${escapeHtml(room.name)}</h3>
            <div class="room-price">${room.price} ₽ / ночь</div>
            <div class="room-capacity"><i class="fas fa-user-friends"></i> До ${room.capacity} гостей</div>
            <div class="room-description">${escapeHtml(room.description || 'Без описания')}</div>
            <button class="btn-primary" onclick="editRoom('${room.id}', ${room.price}, \`${escapeHtml(room.description || '')}\`)">✏️ Редактировать</button>
        </div>
    `).join('');
}

function editRoom(id, price, description) {
    document.getElementById('roomId').value = id;
    document.getElementById('roomPrice').value = price;
    document.getElementById('roomDescription').value = description;
    document.getElementById('roomModal').style.display = 'flex';
}

async function saveRoom() {
    const id = document.getElementById('roomId').value;
    const price = document.getElementById('roomPrice').value;
    const description = document.getElementById('roomDescription').value;
    
    await updateData('update_room', { id, price, description });
    document.getElementById('roomModal').style.display = 'none';
    loadRooms();
}

// Слайдер
async function loadSlides() {
    const container = document.getElementById('slidesList');
    const slides = await fetchData('slides');
    
    container.innerHTML = slides.map((slide, idx) => `
        <div class="slide-item">
            <img src="${slide.image_url}" class="slide-preview" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
            <div class="slide-info">
                <strong>${escapeHtml(slide.title || 'Без заголовка')}</strong>
                <small>${escapeHtml(slide.subtitle || '')}</small>
            </div>
            <div class="slide-actions">
                <button class="btn-primary" onclick="editSlide(${idx + 1}, '${escapeHtml(slide.image_url)}', '${escapeHtml(slide.title)}', '${escapeHtml(slide.subtitle)}')">✏️</button>
            </div>
        </div>
    `).join('');
}

function editSlide(rowId, imageUrl, title, subtitle) {
    document.getElementById('slideRowId').value = rowId;
    document.getElementById('slideImageUrl').value = imageUrl;
    document.getElementById('slideTitle').value = title;
    document.getElementById('slideSubtitle').value = subtitle;
    document.getElementById('modalTitle').textContent = 'Редактировать слайд';
    document.getElementById('slideModal').style.display = 'flex';
}

async function saveSlide() {
    const rowId = document.getElementById('slideRowId').value;
    const imageUrl = document.getElementById('slideImageUrl').value;
    const title = document.getElementById('slideTitle').value;
    const subtitle = document.getElementById('slideSubtitle').value;
    
    await updateData('update_slide', { rowId, image_url: imageUrl, title, subtitle });
    document.getElementById('slideModal').style.display = 'none';
    loadSlides();
}

async function deleteSlide() {
    const rowId = document.getElementById('slideRowId').value;
    if (confirm('Удалить слайд?')) {
        await updateData('delete_slide', { rowId });
        document.getElementById('slideModal').style.display = 'none';
        loadSlides();
    }
}

// Настройки
async function loadSettings() {
    const container = document.getElementById('settingsForm');
    const settings = await fetchData('settings');
    
    container.innerHTML = `
        <div class="setting-row">
            <label>Название отеля</label>
            <input type="text" id="hotel_name" value="${escapeHtml(settings.hotel_name || '')}">
        </div>
        <div class="setting-row">
            <label>Телефон</label>
            <input type="text" id="phone" value="${escapeHtml(settings.phone || '')}">
        </div>
        <div class="setting-row">
            <label>Email для уведомлений</label>
            <input type="email" id="email" value="${escapeHtml(settings.email || '')}">
        </div>
        <div class="setting-row">
            <label>Админ-пароль</label>
            <input type="password" id="admin_password" value="${escapeHtml(settings.admin_password || '')}">
        </div>
        <button class="btn-primary" onclick="saveSettings()">Сохранить настройки</button>
    `;
}

async function saveSettings() {
    const hotel_name = document.getElementById('hotel_name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const admin_password = document.getElementById('admin_password').value;
    
    await updateData('update_settings', { hotel_name, phone, email, admin_password });
    alert('Настройки сохранены');
}

// ========== НАВИГАЦИЯ ==========
let currentTab = 'bookings';

function loadCurrentTab() {
    if (currentTab === 'bookings') loadBookings();
    if (currentTab === 'rooms') loadRooms();
    if (currentTab === 'slides') loadSlides();
    if (currentTab === 'settings') loadSettings();
}

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabId}Tab`).classList.add('active');
    document.querySelectorAll('.menu-items li').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    loadCurrentTab();
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== СОБЫТИЯ ==========
loginBtn.onclick = login;
logoutBtls.forEach(btn => btn.onclick = logout);
menuToggle.onclick = () => sideMenu.classList.toggle('open');
document.querySelectorAll('.menu-items li').forEach(item => {
    item.onclick = () => {
        sideMenu.classList.remove('open');
        switchTab(item.dataset.tab);
    };
});
document.getElementById('statusFilter').onchange = () => loadBookings();
document.getElementById('searchBookings').oninput = () => loadBookings();
document.getElementById('saveSlideBtn').onclick = saveSlide;
document.getElementById('deleteSlideBtn').onclick = deleteSlide;
document.getElementById('saveRoomBtn').onclick = saveRoom;
document.getElementById('addSlideBtn').onclick = () => {
    document.getElementById('slideRowId').value = '';
    document.getElementById('slideImageUrl').value = '';
    document.getElementById('slideTitle').value = '';
    document.getElementById('slideSubtitle').value = '';
    document.getElementById('modalTitle').textContent = 'Добавить слайд';
    document.getElementById('slideModal').style.display = 'flex';
};
document.querySelectorAll('.close').forEach(close => {
    close.onclick = () => close.closest('.modal').style.display = 'none';
});
window.onclick = (e) => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
};

checkAutoLogin();
