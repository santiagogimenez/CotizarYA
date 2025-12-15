// Estado de la aplicación
let currentRate = null;
let autoRefreshInterval = null;
let platformsAutoRefreshInterval = null;
let alerts = [];

// Elementos del DOM
const elements = {
  rateValue: document.getElementById('rateValue'),
  rateSource: document.getElementById('rateSource'),
  rateTimestamp: document.getElementById('rateTimestamp'),
  btnRefresh: document.getElementById('btnRefresh'),
  usdtAmount: document.getElementById('usdtAmount'),
  markup: document.getElementById('markup'),
  rounding: document.getElementById('rounding'),
  resultValue: document.getElementById('resultValue'),
  btnCopy: document.getElementById('btnCopy'),
  statusMessage: document.getElementById('statusMessage'),
  themeToggle: document.getElementById('themeToggle'),
  commissionCard: document.getElementById('commissionCard'),
  commBase: document.getElementById('commBase'),
  commMarkup: document.getElementById('commMarkup'),
  commMarkupPercent: document.getElementById('commMarkupPercent'),
  commSubtotal: document.getElementById('commSubtotal'),
  commRounding: document.getElementById('commRounding'),
  commTotal: document.getElementById('commTotal'),
  markupRow: document.getElementById('markupRow'),
  roundingRow: document.getElementById('roundingRow'),
  platformsList: document.getElementById('platformsList'),
  btnRefreshPlatforms: document.getElementById('btnRefreshPlatforms'),
  alertPrice: document.getElementById('alertPrice'),
  alertType: document.getElementById('alertType'),
  btnAddAlert: document.getElementById('btnAddAlert'),
  alertsList: document.getElementById('alertsList')
};

// Inicializar la aplicación
async function init() {
  loadTheme();
  loadAlerts();
  await fetchRate();
  await fetchPlatforms();
  setupEventListeners();
  startAutoRefresh();
  startPlatformsAutoRefresh();
}

// Gestión del tema oscuro
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Obtener la cotización desde el backend
async function fetchRate(showLoading = true) {
  if (showLoading) {
    elements.btnRefresh.classList.add('loading');
  }

  try {
    const response = await fetch('/api/rate');
    
    if (!response.ok) {
      throw new Error('Error al obtener la cotización');
    }

    const data = await response.json();
    currentRate = data.ask;

    // Actualizar UI
    elements.rateValue.textContent = `$ ${formatNumber(data.ask, 2)}`;
    elements.rateSource.textContent = data.source;
    elements.rateTimestamp.textContent = formatTimestamp(data.timestamp);

    // Recalcular si hay un monto ingresado
    if (elements.usdtAmount.value) {
      calculatePrice();
    }

    // Verificar alertas
    checkAlerts(data.ask);

    hideStatusMessage();

  } catch (error) {
    console.error('Error al obtener cotización:', error);
    showStatusMessage('No se pudo actualizar la cotización. Intentá nuevamente.', 'error');
  } finally {
    if (showLoading) {
      elements.btnRefresh.classList.remove('loading');
    }
  }
}

// Calcular el precio final
function calculatePrice() {
  const usdtAmount = parseFloat(elements.usdtAmount.value) || 0;
  const markupPercent = parseFloat(elements.markup.value) || 0;
  const roundingValue = parseInt(elements.rounding.value) || 0;

  if (usdtAmount <= 0 || !currentRate) {
    elements.resultValue.textContent = '$ 0';
    elements.commissionCard.style.display = 'none';
    return;
  }

  // Calcular precio base
  const basePrice = usdtAmount * currentRate;
  
  // Aplicar markup
  const markupAmount = basePrice * (markupPercent / 100);
  const priceWithMarkup = basePrice + markupAmount;

  // Aplicar redondeo
  let finalPrice = priceWithMarkup;
  let roundingAdjustment = 0;
  
  if (roundingValue > 0) {
    finalPrice = Math.round(priceWithMarkup / roundingValue) * roundingValue;
    roundingAdjustment = finalPrice - priceWithMarkup;
  }

  // Mostrar resultado principal
  elements.resultValue.textContent = `$ ${formatNumber(finalPrice, 0)}`;

  // Actualizar desglose de comisiones
  updateCommissionBreakdown({
    base: basePrice,
    markup: markupAmount,
    markupPercent: markupPercent,
    subtotal: priceWithMarkup,
    rounding: roundingAdjustment,
    total: finalPrice
  });

  // Mostrar el card de comisiones
  elements.commissionCard.style.display = 'block';
}

// Actualizar el desglose de comisiones
function updateCommissionBreakdown(data) {
  elements.commBase.textContent = `$ ${formatNumber(data.base, 2)}`;
  elements.commSubtotal.textContent = `$ ${formatNumber(data.subtotal, 2)}`;
  elements.commTotal.textContent = `$ ${formatNumber(data.total, 0)}`;

  // Mostrar/ocultar fila de markup
  if (data.markupPercent > 0) {
    elements.markupRow.style.display = 'flex';
    elements.commMarkupPercent.textContent = data.markupPercent;
    elements.commMarkup.textContent = `+ $ ${formatNumber(data.markup, 2)}`;
  } else {
    elements.markupRow.style.display = 'none';
  }

  // Mostrar/ocultar fila de redondeo
  if (Math.abs(data.rounding) > 0.01) {
    elements.roundingRow.style.display = 'flex';
    const sign = data.rounding >= 0 ? '+' : '';
    elements.commRounding.textContent = `${sign} $ ${formatNumber(data.rounding, 2)}`;
  } else {
    elements.roundingRow.style.display = 'none';
  }
}

// Copiar precio al portapapeles
async function copyToClipboard() {
  const priceText = elements.resultValue.textContent.replace('$ ', '').replace(/\./g, '');
  
  try {
    await navigator.clipboard.writeText(priceText);
    
    // Feedback visual
    const originalText = elements.btnCopy.textContent;
    elements.btnCopy.classList.add('success');
    elements.btnCopy.textContent = '¡Copiado!';

    setTimeout(() => {
      elements.btnCopy.classList.remove('success');
      elements.btnCopy.textContent = originalText;
    }, 2000);

  } catch (error) {
    console.error('Error al copiar:', error);
    showStatusMessage('No se pudo copiar al portapapeles', 'error');
  }
}

// Configurar event listeners
function setupEventListeners() {
  elements.btnRefresh.addEventListener('click', () => fetchRate(true));
  elements.btnRefreshPlatforms.addEventListener('click', () => fetchPlatforms(true));
  elements.btnCopy.addEventListener('click', copyToClipboard);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.btnAddAlert.addEventListener('click', addAlert);
  
  elements.usdtAmount.addEventListener('input', calculatePrice);
  elements.markup.addEventListener('input', calculatePrice);
  elements.rounding.addEventListener('change', calculatePrice);

  // Calcular al presionar Enter
  elements.usdtAmount.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      calculatePrice();
    }
  });

  // Agregar alerta al presionar Enter
  elements.alertPrice.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addAlert();
    }
  });
}

// Auto-refresh cada 30 segundos
function startAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    fetchRate(false);
  }, 30000);
}

function startPlatformsAutoRefresh() {
  platformsAutoRefreshInterval = setInterval(() => {
    fetchPlatforms(false);
  }, 30000);
}

// Obtener cotizaciones de plataformas
async function fetchPlatforms(showLoading = true) {
  if (showLoading) {
    elements.btnRefreshPlatforms.classList.add('loading');
    elements.platformsList.innerHTML = `
      <div class="platforms-loading">
        <div class="spinner"></div>
        <p>Consultando plataformas...</p>
      </div>
    `;
  }

  try {
    const response = await fetch('/api/platforms');
    
    if (!response.ok) {
      throw new Error('Error al obtener las cotizaciones');
    }

    const data = await response.json();
    renderPlatforms(data.platforms);

  } catch (error) {
    console.error('Error al obtener plataformas:', error);
    elements.platformsList.innerHTML = `
      <div class="platforms-loading">
        <p style="color: var(--text-muted);">❌ No se pudieron cargar las plataformas</p>
      </div>
    `;
  } finally {
    if (showLoading) {
      elements.btnRefreshPlatforms.classList.remove('loading');
    }
  }
}

// Renderizar plataformas
function renderPlatforms(data) {
  if (!data.available || data.available.length === 0) {
    elements.platformsList.innerHTML = `
      <div class="platforms-loading">
        <p style="color: var(--text-muted);">No hay plataformas disponibles en este momento</p>
      </div>
    `;
    return;
  }

  let html = '';
  
  data.available.forEach((platform, index) => {
    const isBest = index === 0;
    html += `
      <div class="platform-item ${isBest ? 'best' : ''}">
        <div class="platform-info">
          <div class="platform-icon">${platform.icon}</div>
          <div class="platform-details">
            <div class="platform-name">${platform.name}</div>
            <div class="platform-type">Venta USDT</div>
          </div>
        </div>
        <div class="platform-price">
          <div class="platform-price-value">$ ${formatNumber(platform.ask, 2)}</div>
          <div class="platform-price-label">por USDT</div>
        </div>
      </div>
    `;
  });

  if (data.unavailable && data.unavailable.length > 0) {
    data.unavailable.forEach(platform => {
      html += `
        <div class="platform-item unavailable">
          <div class="platform-info">
            <div class="platform-icon">${platform.icon}</div>
            <div class="platform-details">
              <div class="platform-name">${platform.name}</div>
              <div class="platform-type">No disponible</div>
            </div>
          </div>
          <div class="platform-price">
            <div class="platform-price-value">-</div>
          </div>
        </div>
      `;
    });
  }

  elements.platformsList.innerHTML = html;
}

// Sistema de Alertas de Precio
function loadAlerts() {
  const saved = localStorage.getItem('priceAlerts');
  alerts = saved ? JSON.parse(saved) : [];
  renderAlerts();
}

function saveAlerts() {
  localStorage.setItem('priceAlerts', JSON.stringify(alerts));
}

function addAlert() {
  const price = parseFloat(elements.alertPrice.value);
  const type = elements.alertType.value;

  if (!price || price <= 0) {
    showStatusMessage('Ingresá un precio válido', 'error');
    return;
  }

  const alert = {
    id: Date.now(),
    price: price,
    type: type,
    triggered: false,
    createdAt: new Date().toISOString()
  };

  alerts.push(alert);
  saveAlerts();
  renderAlerts();

  elements.alertPrice.value = '';
  showStatusMessage('✅ Alerta creada correctamente', 'success');
}

function deleteAlert(id) {
  alerts = alerts.filter(alert => alert.id !== id);
  saveAlerts();
  renderAlerts();
}

function renderAlerts() {
  if (alerts.length === 0) {
    elements.alertsList.innerHTML = `
      <div class="alerts-empty">
        <p>📭 No tenés alertas configuradas</p>
        <span>Configurá una alerta para recibir notificaciones cuando el precio alcance tu objetivo</span>
      </div>
    `;
    return;
  }

  let html = '';
  alerts.forEach(alert => {
    const typeText = alert.type === 'above' ? '⬆️ Suba a' : '⬇️ Baje a';
    const triggeredClass = alert.triggered ? 'triggered' : '';
    
    html += `
      <div class="alert-item ${triggeredClass}">
        <div class="alert-info">
          <div class="alert-target">$ ${formatNumber(alert.price, 2)}</div>
          <div class="alert-condition">
            <span class="icon">${typeText}</span>
            ${alert.triggered ? '<strong style="color: var(--success);">✓ Activada</strong>' : 'Esperando...'}
          </div>
        </div>
        <div class="alert-actions">
          <button class="btn-delete-alert" onclick="deleteAlert(${alert.id})" title="Eliminar alerta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  });

  elements.alertsList.innerHTML = html;
}

function checkAlerts(currentPrice) {
  alerts.forEach(alert => {
    if (alert.triggered) return;

    let shouldTrigger = false;

    if (alert.type === 'above' && currentPrice >= alert.price) {
      shouldTrigger = true;
    } else if (alert.type === 'below' && currentPrice <= alert.price) {
      shouldTrigger = true;
    }

    if (shouldTrigger) {
      alert.triggered = true;
      saveAlerts();
      renderAlerts();
      showNotification(alert, currentPrice);
    }
  });
}

function showNotification(alert, currentPrice) {
  const typeText = alert.type === 'above' ? 'subió' : 'bajó';
  
  const notification = document.createElement('div');
  notification.className = 'alert-notification';
  notification.innerHTML = `
    <div class="alert-notification-header">
      <div class="alert-notification-icon">🔔</div>
      <div class="alert-notification-title">¡Alerta de Precio!</div>
    </div>
    <div class="alert-notification-body">
      El USDT ${typeText} a <strong>$ ${formatNumber(currentPrice, 2)}</strong><br>
      Tu precio objetivo era $ ${formatNumber(alert.price, 2)}
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

window.deleteAlert = deleteAlert;

// Formatear números
function formatNumber(num, decimals = 2) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

// Formatear timestamp
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}hs`;
}

// Mostrar mensaje de estado
function showStatusMessage(message, type = 'error') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message show ${type}`;
  
  setTimeout(() => {
    hideStatusMessage();
  }, 5000);
}

// Ocultar mensaje de estado
function hideStatusMessage() {
  elements.statusMessage.classList.remove('show');
}

// Limpiar al cerrar la página
window.addEventListener('beforeunload', () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  if (platformsAutoRefreshInterval) {
    clearInterval(platformsAutoRefreshInterval);
  }
});

// Iniciar la aplicación
init();
