// Конфигурация
const CONFIG = {
    botToken: '8503229886:AAH6VBB7a-3yy1MuIsL5g6_ti0e7YvUDu80',
    botUrl: 'https://t.me/DreamEmpireBot',
    apiUrl: 'https://api.nexus-realm.com', // Твой будущий API
    wallets: {
        TRC20: 'TMtUdrfmC95EXPFtvGS4wPhN9eUfpXn35c',
        ERC20: '0x22E1c1d467518821C59a709A4347F9E97Ba1BED0'
    }
};

// Глобальное состояние
let state = {
    user: null,
    balance: 0,
    price: 0.001,
    connected: false,
    chatSocket: null
};

// Инициализация
document.addEventListener('DOMContentLoaded', init);

async function init() {
    loadState();
    setupEventListeners();
    updateUI();
    loadStats();
    
    // Запускаем обновление данных каждые 10 секунд
    setInterval(updateData, 10000);
}

// Загрузка сохранённого состояния
function loadState() {
    const saved = localStorage.getItem('nexusState');
    if (saved) {
        state = JSON.parse(saved);
    }
}

// Сохранение состояния
function saveState() {
    localStorage.setItem('nexusState', JSON.stringify(state));
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Подключение к Telegram
    document.getElementById('connectTG').addEventListener('click', connectTelegram);
    
    // Покупка DRC
    document.getElementById('buyDRC').addEventListener('click', showBuyModal);
    document.getElementById('proceedBuy').addEventListener('click', processBuy);
    
    // Продажа DRC
    document.getElementById('proceedSell').addEventListener('click', processSell);
    
    // Игры
    document.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const game = e.target.dataset.game;
            startGame(game);
        });
    });
    
    // Чат
    document.getElementById('sendMessage').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Кошелёк
    document.getElementById('sendDRC').addEventListener('click', sendDRC);
    document.getElementById('receiveDRC').addEventListener('click', showReceiveQR);
    document.getElementById('historyDRC').addEventListener('click', showHistory);
    
    // Обновление данных
    document.getElementById('refreshUsers').addEventListener('click', loadTopUsers);
    
    // Изменение суммы покупки/продажи
    document.getElementById('buyAmount').addEventListener('input', updateBuyCalculation);
    document.getElementById('sellAmount').addEventListener('input', updateSellCalculation);
    
    // Выбор сети
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', selectPaymentMethod);
    });
}

// Обновление UI
function updateUI() {
    // Обновляем баланс
    if (state.user) {
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('connectTG').classList.add('hidden');
        document.getElementById('username').textContent = state.user.username;
        document.getElementById('balance').textContent = state.balance.toLocaleString() + ' DRC';
        
        // В кошельке
        document.getElementById('walletBalance').textContent = state.balance.toLocaleString();
        document.getElementById('balanceUSD').textContent = (state.balance * state.price).toFixed(2);
        document.getElementById('walletAddress').textContent = state.user.wallet || 'Не подключен';
        
        // Генерируем QR код
        if (state.user.wallet) {
            generateQRCode(state.user.wallet);
        }
    } else {
        document.getElementById('userInfo').classList.add('hidden');
        document.getElementById('connectTG').classList.remove('hidden');
    }
    
    // Обновляем цены
    document.getElementById('rateBuy').textContent = Math.floor(1 / state.price);
    document.getElementById('rateSell').textContent = state.price;
    
    updateBuyCalculation();
    updateSellCalculation();
}

// Подключение к Telegram
async function connectTelegram() {
    // Открываем бота в новом окне
    window.open(CONFIG.botUrl, '_blank');
    
    // Просим ввести данные из бота
    const telegramId = prompt('Введите ваш Telegram ID (можно получить в боте /profile):');
    if (!telegramId) return;
    
    // Получаем данные пользователя
    try {
        const response = await fetch(`${CONFIG.apiUrl}/user/${telegramId}`);
        const userData = await response.json();
        
        state.user = userData;
        state.balance = userData.balance || 0;
        state.connected = true;
        
        saveState();
        updateUI();
        showNotification('✅ Успешно подключено!', 'success');
    } catch (error) {
        showNotification('❌ Не удалось подключиться', 'error');
        console.error(error);
    }
}

// Покупка DRC
async function processBuy() {
    const amount = parseFloat(document.getElementById('buyAmount').value);
    if (!amount || amount < 1) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }
    
    const network = document.querySelector('.method-btn.active').dataset.network;
    const drcAmount = amount / state.price;
    
    // Показываем модальное окно с деталями
    const modal = document.getElementById('modalBuy');
    const content = document.getElementById('modalBuyContent');
    
    content.innerHTML = `
        <div class="payment-details">
            <h3>Детали оплаты</h3>
            <p>Сумма: <strong>${amount} USDT</strong></p>
            <p>Получите: <strong>${drcAmount.toLocaleString()} DRC</strong></p>
            <p>Сеть: <strong>${network}</strong></p>
            
            <div class="wallet-address">
                <p>Отправьте USDT на адрес:</p>
                <code class="address">${CONFIG.wallets[network]}</code>
                <button onclick="copyAddress('${CONFIG.wallets[network]}')" class="btn-small">
                    <i class="fas fa-copy"></i> Копировать
                </button>
            </div>
            
            <div id="paymentQR" class="qr-container"></div>
            
            <p class="small">После отправки средств DRC будут зачислены автоматически в течение 5-15 минут.</p>
            
            <div class="payment-actions">
                <button onclick="checkPayment('${network}', ${amount})" class="btn-success">
                    <i class="fas fa-check"></i> Я оплатил
                </button>
                <button onclick="closeModal()" class="btn-secondary">Отмена</button>
            </div>
        </div>
    `;
    
    // Генерируем QR код
    new QRCode(document.getElementById('paymentQR'), {
        text: CONFIG.wallets[network],
        width: 200,
        height: 200
    });
    
    modal.classList.remove('hidden');
}

// Продажа DRC
async function processSell() {
    const amount = parseFloat(document.getElementById('sellAmount').value);
    if (!amount || amount < 100) {
        showNotification('Минимальная сумма: 100 DRC', 'error');
        return;
    }
    
    if (amount > state.balance) {
        showNotification('Недостаточно DRC', 'error');
        return;
    }
    
    const network = document.querySelector('.method-btn.active').dataset.network;
    const usdtAmount = amount * state.price * 0.99; // 1% комиссия
    
    const wallet = prompt(`Введите ваш ${network} адрес для получения USDT:`);
    if (!wallet) return;
    
    // Отправляем запрос на продажу
    try {
        const response = await fetch(`${CONFIG.apiUrl}/sell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.user.id,
                amount: amount,
                network: network,
                wallet: wallet
            })
        });
        
        if (response.ok) {
            showNotification(`✅ Заявка на продажу ${amount} DRC принята!`, 'success');
            state.balance -= amount;
            saveState();
            updateUI();
        } else {
            showNotification('❌ Ошибка при продаже', 'error');
        }
    } catch (error) {
        showNotification('❌ Ошибка сети', 'error');
    }
}

// Игры
function startGame(gameType) {
    if (!state.connected) {
        showNotification('Сначала подключите Telegram аккаунт', 'warning');
        return;
    }
    
    const games = {
        mining: {
            url: `${CONFIG.apiUrl}/game/mining`,
            minBet: 0,
            description: 'Майнинг DRC'
        },
        roulette: {
            url: `${CONFIG.apiUrl}/game/roulette`,
            minBet: 10,
            description: 'DRC Рулетка'
        },
        chess: {
            url: `${CONFIG.apiUrl}/game/chess`,
            minBet: 100,
            description: 'DRC Шахматы'
        },
        trader: {
            url: `${CONFIG.apiUrl}/game/trader`,
            minBet: 1000,
            description: 'Космический трейдер'
        }
    };
    
    const game = games[gameType];
    
    // Показываем окно игры
    const modal = document.getElementById('modalBuy');
    const content = document.getElementById('modalBuyContent');
    
    content.innerHTML = `
        <div class="game-window">
            <h3>${game.description}</h3>
            <div id="gameContainer"></div>
            
            ${game.minBet > 0 ? `
            <div class="game-bet">
                <label>Ставка (DRC):</label>
                <input type="number" id="gameBet" min="${game.minBet}" max="${state.balance}" value="${game.minBet}">
                <button onclick="placeBet('${gameType}')" class="btn-primary">Играть</button>
            </div>
            ` : `
            <button onclick="startMining()" class="btn-primary">
                <i class="fas fa-play"></i> Начать майнинг
            </button>
            `}
            
            <div class="game-stats">
                <p>Ваш баланс: ${state.balance} DRC</p>
                <p>Мин. ставка: ${game.minBet} DRC</p>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function startMining() {
    let mined = 0;
    let time = 0;
    
    const gameContainer = document.getElementById('gameContainer');
    
    const gameLoop = setInterval(() => {
        time += 1;
        const drcPerSecond = 0.1 + Math.random() * 0.2;
        mined += drcPerSecond;
        
        gameContainer.innerHTML = `
            <div class="mining-game">
                <div class="mining-display">
                    <i class="fas fa-gem spinning"></i>
                    <h4>${mined.toFixed(2)} DRC</h4>
                    <p>Время: ${time} сек</p>
                </div>
                <button onclick="collectMining(${mined})" class="btn-success">
                    <i class="fas fa-sack-dollar"></i> Забрать ${mined.toFixed(2)} DRC
                </button>
            </div>
        `;
    }, 1000);
    
    // Сохраняем интервал для очистки
    window.currentMining = gameLoop;
}

async function collectMining(amount) {
    clearInterval(window.currentMining);
    
    try {
        const response = await fetch(`${CONFIG.apiUrl}/game/reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.user.id,
                game: 'mining',
                amount: amount
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            state.balance += data.reward;
            saveState();
            updateUI();
            
            document.getElementById('gameContainer').innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <h4>Получено: ${data.reward.toFixed(2)} DRC!</h4>
                </div>
            `;
        }
    } catch (error) {
        console.error(error);
    }
}

// Чат
function connectChat() {
    if (state.chatSocket) {
        state.chatSocket.close();
    }
    
    // WebSocket подключение к чату
    const ws = new WebSocket(`wss://${CONFIG.apiUrl.replace('https://', '')}/chat`);
    
    ws.onopen = () => {
        console.log('Chat connected');
        if (state.user) {
            ws.send(JSON.stringify({
                type: 'register',
                user_id: state.user.id,
                username: state.user.username
            }));
        }
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addChatMessage(data);
    };
    
    state.chatSocket = ws;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !state.chatSocket || !state.user) return;
    
    state.chatSocket.send(JSON.stringify({
        type: 'message',
        user_id: state.user.id,
        username: state.user.username,
        message: message,
        timestamp: Date.now()
    }));
    
    input.value = '';
}

function addChatMessage(data) {
    const chat = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    messageDiv.innerHTML = `
        <strong>${data.username}:</strong>
        <span>${data.message}</span>
        <small>${new Date(data.timestamp).toLocaleTimeString()}</small>
    `;
    
    chat.appendChild(messageDiv);
    chat.scrollTop = chat.scrollHeight;
}

// Утилиты
function updateBuyCalculation() {
    const amount = parseFloat(document.getElementById('buyAmount').value) || 0;
    const drc = amount / state.price * 0.995; // 0.5% комиссия
    document.getElementById('drcReceive').textContent = drc.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function updateSellCalculation() {
    const amount = parseFloat(document.getElementById('sellAmount').value) || 0;
    const usdt = amount * state.price * 0.99; // 1% комиссия
    document.getElementById('usdtReceive').textContent = usdt.toFixed(2);
}

function selectPaymentMethod(e) {
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
}

function generateQRCode(address) {
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: address,
        width: 200,
        height: 200
    });
}

function copyAddress(address) {
    navigator.clipboard.writeText(address);
    showNotification('Адрес скопирован!', 'success');
}

function showNotification(message, type = 'info') {
    // Создаём уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function closeModal() {
    document.getElementById('modalBuy').classList.add('hidden');
}

// Загрузка статистики
async function loadStats() {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/stats`);
        const stats = await response.json();
        
        document.getElementById('totalUsers').textContent = stats.total_users.toLocaleString();
        document.getElementById('totalDRC').textContent = stats.total_drc.toLocaleString();
        document.getElementById('drcPrice').textContent = stats.drc_price.toFixed(4);
        
        // Обновляем график
        updatePriceChart(stats.price_history);
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadTopUsers() {
    try {
        const response = await fetch(`${CONFIG.apiUrl}/top-users`);
        const users = await response.json();
        
        const container = document.getElementById('topUsers');
        container.innerHTML = '';
        
        users.forEach((user, index) => {
            const userDiv = document.createElement('div');
            userDiv.className = 'top-user';
            userDiv.innerHTML = `
                <span class="rank">${index + 1}</span>
                <span class="username">${user.username}</span>
                <span class="balance">${user.balance.toLocaleString()} DRC</span>
            `;
            container.appendChild(userDiv);
        });
    } catch (error) {
        console.error(error);
    }
}

function updatePriceChart(history) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    if (window.priceChart) {
        window.priceChart.destroy();
    }
    
    window.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.timestamp).toLocaleDateString()),
            datasets: [{
                label: 'Цена DRC (USDT)',
                data: history.map(h => h.price),
                borderColor: '#6a11cb',
                backgroundColor: 'rgba(106, 17, 203, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

// Обновление данных
async function updateData() {
    if (!state.user) return;
    
    try {
        const response = await fetch(`${CONFIG.apiUrl}/user/${state.user.id}`);
        const userData = await response.json();
        
        if (userData.balance !== state.balance) {
            state.balance = userData.balance;
            saveState();
            updateUI();
        }
    } catch (error) {
        console.error('Failed to update data:', error);
    }
}

// CSS для уведомлений и модалок
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    }
    
    .notification-success {
        background: var(--success);
        color: white;
    }
    
    .notification-error {
        background: var(--danger);
        color: white;
    }
    
    .notification-warning {
        background: var(--warning);
        color: white;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-content {
        background: var(--dark);
        padding: 2rem;
        border-radius: 15px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .close {
        float: right;
        font-size: 1.5rem;
        cursor: pointer;
    }
    
    .spinning {
        animation: spin 2s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .top-user {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .top-user:last-child {
        border-bottom: none;
    }
    
    .address {
        background: rgba(0, 0, 0, 0.3);
        padding: 0.5rem;
        border-radius: 5px;
        display: block;
        margin: 0.5rem 0;
        word-break: break-all;
        font-family: monospace;
    }
    
    .qr-container {
        display: flex;
        justify-content: center;
        margin: 1rem 0;
    }
`;
document.head.appendChild(style);
