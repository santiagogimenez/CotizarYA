// Estado de la aplicación
let currentRate = null;
let autoRefreshInterval = null;

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
  roundingRow: document.getElementById('roundingRow')
};

// Inicializar la aplicación
async function init() {
  loadTheme();
  await fetchRate();
  setupEventListeners();
  startAutoRefresh();
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
  elements.btnCopy.addEventListener('click', copyToClipboard);
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  elements.usdtAmount.addEventListener('input', calculatePrice);
  elements.markup.addEventListener('input', calculatePrice);
  elements.rounding.addEventListener('change', calculatePrice);

  // Calcular al presionar Enter
  elements.usdtAmount.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      calculatePrice();
    }
  });
}

// Auto-refresh cada 30 segundos
function startAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    fetchRate(false);
  }, 30000);
}

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
});

// Iniciar la aplicación
init();
