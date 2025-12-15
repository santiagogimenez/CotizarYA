// Estado de la aplicación
let currentRate = null;
let autoRefreshInterval = null;
let platformsAutoRefreshInterval = null;
let alerts = [];
let priceHistory = [];
let currentPeriod = '1h';

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
  alertsList: document.getElementById('alertsList'),
  priceChart: document.getElementById('priceChart'),
  chartEmpty: document.getElementById('chartEmpty'),
  statMax: document.getElementById('statMax'),
  statMin: document.getElementById('statMin'),
  statAvg: document.getElementById('statAvg'),
  statChange: document.getElementById('statChange')
};

// Inicializar la aplicación
async function init() {
  loadTheme();
  loadAlerts();
  loadHistory();
  await fetchRate();
  await fetchPlatforms();
  setupEventListeners();
  setupPeriodSelector();
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

    // Guardar en historial (solo si aún no hay suficientes datos de muestra)
    if (priceHistory.length > 0) {
      const lastTime = priceHistory[priceHistory.length - 1].timestamp;
      const hoursSinceLast = (Date.now() - lastTime) / (1000 * 60 * 60);
      
      // Solo agregar datos reales si han pasado más de 30 segundos desde el último
      if (hoursSinceLast >= 0.0083) { // 0.0083 horas = 30 segundos
        addToHistory(data.ask);
      }
    } else {
      addToHistory(data.ask);
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

// Sistema de Historial y Gráficos
function loadHistory() {
  const saved = localStorage.getItem('priceHistory');
  priceHistory = saved ? JSON.parse(saved) : [];
  
  // Verificar si los datos son válidos (tienen suficiente rango temporal)
  if (priceHistory.length > 0) {
    const firstTime = priceHistory[0].timestamp;
    const lastTime = priceHistory[priceHistory.length - 1].timestamp;
    const hoursDiff = (lastTime - firstTime) / (1000 * 60 * 60);
    
    console.log(`📦 Cargando ${priceHistory.length} puntos existentes (${hoursDiff.toFixed(1)}h de rango)`);
    
    // Si el rango es menor a 2 horas, regenerar datos
    if (hoursDiff < 2) {
      console.log('⚠️ Datos insuficientes, regenerando...');
      generateSampleData();
    }
  } else if (currentRate) {
    // Si no hay datos y ya tenemos el precio actual, generar
    console.log('📊 Generando datos iniciales...');
    generateSampleData();
  }
  
  renderChart();
}

function generateSampleData() {
  // Limpiar datos anteriores
  priceHistory = [];
  
  const now = Date.now();
  const basePrice = currentRate || 1520;
  let price = basePrice;
  
  // Generar 100 puntos distribuidos en las últimas 25 horas
  const totalPoints = 100;
  const hoursToGenerate = 25;
  const timeSpanMs = hoursToGenerate * 60 * 60 * 1000; // 25 horas en milisegundos
  const intervalMs = timeSpanMs / totalPoints; // Intervalo entre cada punto
  
  for (let i = 0; i < totalPoints; i++) {
    // Timestamp: empieza hace 25 horas y avanza hacia ahora
    const timestamp = now - timeSpanMs + (i * intervalMs);
    
    // Movimiento de precio aleatorio pero suave
    const randomChange = (Math.random() - 0.5) * 3;
    price += randomChange;
    
    // Mantener precio en rango razonable
    price = Math.max(basePrice - 15, Math.min(basePrice + 15, price));
    
    priceHistory.push({ 
      price: parseFloat(price.toFixed(2)), 
      timestamp: Math.floor(timestamp)
    });
  }
  
  localStorage.setItem('priceHistory', JSON.stringify(priceHistory));
  
  // Verificar distribución
  const firstDate = new Date(priceHistory[0].timestamp);
  const lastDate = new Date(priceHistory[priceHistory.length - 1].timestamp);
  const hoursDiff = (lastDate - firstDate) / (1000 * 60 * 60);
  
  console.log(`📊 ${priceHistory.length} puntos generados`);
  console.log(`📅 Primer punto: ${firstDate.toLocaleString()}`);
  console.log(`📅 Último punto: ${lastDate.toLocaleString()}`);
  console.log(`⏰ Rango temporal: ${hoursDiff.toFixed(1)} horas`);
}

function addToHistory(price) {
  const now = Date.now();
  priceHistory.push({ price, timestamp: now });
  
  // Limpiar datos antiguos (más de 30 días)
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  priceHistory = priceHistory.filter(item => item.timestamp > thirtyDaysAgo);
  
  localStorage.setItem('priceHistory', JSON.stringify(priceHistory));
  renderChart();
}

function setupPeriodSelector() {
  const buttons = document.querySelectorAll('.period-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      console.log(`🔄 Cambiando a período: ${currentPeriod}`);
      renderChart();
    });
  });
}

function getFilteredHistory() {
  if (priceHistory.length === 0) return [];
  
  const now = Date.now();
  const periods = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  const periodMs = periods[currentPeriod];
  const cutoffTime = now - periodMs;
  
  console.log(`⏰ Ahora: ${new Date(now).toLocaleString()}`);
  console.log(`⏰ Cutoff (${currentPeriod}): ${new Date(cutoffTime).toLocaleString()}`);
  console.log(`⏰ Primer dato: ${new Date(priceHistory[0].timestamp).toLocaleString()}`);
  console.log(`⏰ Último dato: ${new Date(priceHistory[priceHistory.length - 1].timestamp).toLocaleString()}`);
  
  const filtered = priceHistory.filter(item => {
    const isInRange = item.timestamp >= cutoffTime;
    return isInRange;
  });
  
  console.log(`📊 Total datos: ${priceHistory.length}, Período: ${currentPeriod}, Filtrados: ${filtered.length}`);
  
  // Si hay muchos datos, tomar una muestra para mejor rendimiento
  if (filtered.length > 100) {
    const step = Math.ceil(filtered.length / 100);
    const sampled = filtered.filter((_, index) => index % step === 0);
    console.log(`📉 Muestreados: ${sampled.length} de ${filtered.length}`);
    return sampled;
  }
  
  return filtered;
}

function renderChart() {
  const filteredData = getFilteredHistory();
  
  if (filteredData.length < 2) {
    elements.chartEmpty.style.display = 'flex';
    elements.priceChart.style.display = 'none';
    elements.statMax.textContent = '--';
    elements.statMin.textContent = '--';
    elements.statAvg.textContent = '--';
    elements.statChange.textContent = '--';
    
    // Mostrar cantidad de puntos disponibles
    const totalPoints = priceHistory.length;
    if (totalPoints > 0) {
      elements.chartEmpty.querySelector('p').textContent = `📈 ${totalPoints} punto${totalPoints > 1 ? 's' : ''} de datos`;
      elements.chartEmpty.querySelector('span').textContent = `Se necesitan al menos 2 puntos para este período (${currentPeriod}). Seguí usando la app para recopilar más datos.`;
    }
    return;
  }
  
  elements.chartEmpty.style.display = 'none';
  elements.priceChart.style.display = 'block';
  
  // Calcular estadísticas
  const prices = filteredData.map(d => d.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = ((last - first) / first) * 100;
  
  // Actualizar stats
  elements.statMax.textContent = `$ ${formatNumber(max, 2)}`;
  elements.statMin.textContent = `$ ${formatNumber(min, 2)}`;
  elements.statAvg.textContent = `$ ${formatNumber(avg, 2)}`;
  elements.statChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  elements.statChange.style.color = change >= 0 ? 'var(--success)' : '#dc2626';
  
  // Dibujar gráfico
  drawChart(filteredData, min, max);
  
  // Mostrar info de puntos
  console.log(`Renderizando ${filteredData.length} puntos para período ${currentPeriod}`);
}

function drawChart(data, min, max) {
  const svg = elements.priceChart;
  const width = 800;
  const height = 200;
  const padding = 30;
  
  // Limpiar SVG
  while (svg.childNodes.length > 1) {
    svg.removeChild(svg.lastChild);
  }
  
  if (data.length < 2) return;
  
  // Añadir margen a min y max para que el gráfico respire
  const range = max - min;
  const minWithPadding = range > 0 ? min - range * 0.15 : min - 1;
  const maxWithPadding = range > 0 ? max + range * 0.15 : max + 1;
  
  // Función para convertir valor a coordenada Y
  const getY = (price) => {
    const normalized = (price - minWithPadding) / (maxWithPadding - minWithPadding);
    return height - padding - (normalized * (height - padding * 2));
  };
  
  // Función para convertir índice a coordenada X
  const getX = (index) => {
    return padding + (index / (data.length - 1)) * (width - padding * 2);
  };
  
  // Crear línea de grilla horizontal (línea de referencia en el medio)
  const midPrice = (maxWithPadding + minWithPadding) / 2;
  const midY = getY(midPrice);
  const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  gridLine.setAttribute('x1', padding);
  gridLine.setAttribute('y1', midY);
  gridLine.setAttribute('x2', width - padding);
  gridLine.setAttribute('y2', midY);
  gridLine.setAttribute('stroke', 'var(--border)');
  gridLine.setAttribute('stroke-width', '1');
  gridLine.setAttribute('stroke-dasharray', '4,4');
  gridLine.setAttribute('opacity', '0.3');
  svg.appendChild(gridLine);
  
  // Calcular puntos con mejor suavizado
  const points = data.map((item, index) => ({
    x: getX(index),
    y: getY(item.price),
    price: item.price
  }));
  
  // Crear path suave con interpolación cúbica
  let pathData = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    // Control points para curva suave de Bézier
    const cp1x = current.x + (next.x - current.x) / 3;
    const cp1y = current.y;
    const cp2x = current.x + 2 * (next.x - current.x) / 3;
    const cp2y = next.y;
    
    pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  
  // Crear área bajo la curva
  const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const areaData = `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;
  areaPath.setAttribute('d', areaData);
  areaPath.setAttribute('fill', 'url(#chartGradient)');
  areaPath.setAttribute('opacity', '0.5');
  svg.appendChild(areaPath);
  
  // Crear línea principal con sombra
  const shadowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shadowLine.setAttribute('d', pathData);
  shadowLine.setAttribute('fill', 'none');
  shadowLine.setAttribute('stroke', 'rgba(0, 217, 255, 0.3)');
  shadowLine.setAttribute('stroke-width', '6');
  shadowLine.setAttribute('stroke-linecap', 'round');
  shadowLine.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(shadowLine);
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', pathData);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'var(--accent)');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);
  
  // Agregar círculos en primer y último punto
  [0, points.length - 1].forEach(i => {
    const point = points[i];
    
    // Círculo exterior (glow)
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('cx', point.x);
    outerCircle.setAttribute('cy', point.y);
    outerCircle.setAttribute('r', '8');
    outerCircle.setAttribute('fill', 'var(--accent)');
    outerCircle.setAttribute('opacity', '0.2');
    svg.appendChild(outerCircle);
    
    // Círculo principal
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x);
    circle.setAttribute('cy', point.y);
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', 'white');
    circle.setAttribute('stroke', 'var(--accent)');
    circle.setAttribute('stroke-width', '3');
    svg.appendChild(circle);
  });
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
  if (platformsAutoRefreshInterval) {
    clearInterval(platformsAutoRefreshInterval);
  }
});

// Iniciar la aplicación
init();
