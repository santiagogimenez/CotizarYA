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
  statusMessage: document.getElementById('statusMessage')
};

// Inicializar la aplicación
async function init() {
  await fetchRate();
  setupEventListeners();
  startAutoRefresh();
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
    return;
  }

  // Calcular precio base
  let priceARS = usdtAmount * currentRate;

  // Aplicar markup
  if (markupPercent > 0) {
    priceARS = priceARS * (1 + markupPercent / 100);
  }

  // Aplicar redondeo
  if (roundingValue > 0) {
    priceARS = Math.round(priceARS / roundingValue) * roundingValue;
  }

  // Mostrar resultado
  elements.resultValue.textContent = `$ ${formatNumber(priceARS, 0)}`;
}

// Copiar precio al portapapeles
async function copyToClipboard() {
  const priceText = elements.resultValue.textContent.replace('$ ', '').replace(/\./g, '');
  
  try {
    await navigator.clipboard.writeText(priceText);
    
    // Feedback visual
    const originalText = elements.btnCopy.innerHTML;
    elements.btnCopy.classList.add('success');
    elements.btnCopy.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      ¡Copiado!
    `;

    setTimeout(() => {
      elements.btnCopy.classList.remove('success');
      elements.btnCopy.innerHTML = originalText;
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
