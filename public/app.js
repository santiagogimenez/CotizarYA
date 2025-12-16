// Estado de la aplicación
let currentRate = null;
let autoRefreshInterval = null;
let platformsAutoRefreshInterval = null;
let alerts = [];
let priceHistory = [];
let currentPeriod = '1h';
let currentMode = 'seller'; // 'seller' o 'user'

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
  resultLabel: document.getElementById('resultLabel'),
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
  btnClearAlerts: document.getElementById('btnClearAlerts'),
  alertsList: document.getElementById('alertsList'),
  priceChart: document.getElementById('priceChart'),
  chartEmpty: document.getElementById('chartEmpty'),
  statMax: document.getElementById('statMax'),
  statMin: document.getElementById('statMin'),
  statAvg: document.getElementById('statAvg'),
  statChange: document.getElementById('statChange'),
  blueCompra: document.getElementById('blueCompra'),
  blueVenta: document.getElementById('blueVenta'),
  usdtCompra: document.getElementById('usdtCompra'),
  usdtVenta: document.getElementById('usdtVenta'),
  comparisonAmount: document.getElementById('comparisonAmount'),
  bestOption: document.getElementById('bestOption'),
  bestPrice: document.getElementById('bestPrice'),
  bestDetail: document.getElementById('bestDetail'),
  alternativeOption: document.getElementById('alternativeOption'),
  alternativePrice: document.getElementById('alternativePrice'),
  alternativeDetail: document.getElementById('alternativeDetail'),
  comparisonDifference: document.getElementById('comparisonDifference'),
  btnModeSeller: document.getElementById('btnModeSeller'),
  btnModeUser: document.getElementById('btnModeUser'),
  markupGroup: document.getElementById('markupGroup')
};

// Variables globales para cotizaciones
let blueRates = { compra: 0, venta: 0 };
let usdtRates = { compra: 0, venta: 0 };

// Inicializar la aplicación
async function init() {
  loadTheme();
  loadAlerts();
  loadHistory();
  await fetchRate();
  await fetchPlatforms();
  await fetchBlueRate();
  setupEventListeners();
  setupPeriodSelector();
  startAutoRefresh();
  startPlatformsAutoRefresh();
  updateYieldDefaults(); // Actualizar valores automáticos de rendimientos
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

// Cambiar entre modo vendedor y usuario final
function switchMode(mode) {
  currentMode = mode;
  
  // Actualizar botones
  elements.btnModeSeller.classList.toggle('active', mode === 'seller');
  elements.btnModeUser.classList.toggle('active', mode === 'user');
  
  // Mostrar/ocultar campo de markup
  if (mode === 'user') {
    elements.markupGroup.classList.add('hidden');
    elements.markup.value = '0';
    elements.resultLabel.textContent = 'Precio sin markup';
  } else {
    elements.markupGroup.classList.remove('hidden');
    elements.resultLabel.textContent = 'Precio final';
  }
  
  // Recalcular precio
  calculatePrice();
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
  elements.btnClearAlerts.addEventListener('click', clearTriggeredAlerts);
  
  elements.usdtAmount.addEventListener('input', calculatePrice);
  elements.markup.addEventListener('input', calculatePrice);
  elements.rounding.addEventListener('change', calculatePrice);
  elements.comparisonAmount.addEventListener('input', calculateComparison);

  // Mode toggles
  elements.btnModeSeller.addEventListener('click', () => switchMode('seller'));
  elements.btnModeUser.addEventListener('click', () => switchMode('user'));

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

  // Toggle tips educativos
  const btnToggleTips = document.getElementById('btnToggleTips');
  if (btnToggleTips) {
    btnToggleTips.addEventListener('click', toggleEducationTips);
  }

  // Calculadora de rendimientos
  const btnCalculateYield = document.getElementById('btnCalculateYield');
  if (btnCalculateYield) {
    btnCalculateYield.addEventListener('click', calculateYield);
  }

  // Formatear números con separador de miles
  const yieldAmountInput = document.getElementById('yieldAmount');
  if (yieldAmountInput) {
    yieldAmountInput.addEventListener('input', function(e) {
      // Guardar posición del cursor
      let cursorPos = e.target.selectionStart;
      let oldLength = e.target.value.length;
      
      // Remover todo excepto números
      let value = e.target.value.replace(/\D/g, '');
      
      if (value) {
        // Formatear con separador de miles
        let formatted = parseInt(value).toLocaleString('es-AR');
        e.target.value = formatted;
        
        // Ajustar cursor
        let newLength = formatted.length;
        let diff = newLength - oldLength;
        e.target.setSelectionRange(cursorPos + diff, cursorPos + diff);
      } else {
        e.target.value = '';
      }
    });
  }
}

function toggleEducationTips() {
  const extraTips = document.querySelectorAll('.extra-tip');
  const btn = document.getElementById('btnToggleTips');
  const toggleText = btn.querySelector('.toggle-text');
  const isExpanded = btn.classList.contains('expanded');
  
  if (isExpanded) {
    // Colapsar
    extraTips.forEach(tip => {
      tip.style.display = 'none';
    });
    btn.classList.remove('expanded');
    toggleText.textContent = 'Ver más consejos';
  } else {
    // Expandir
    extraTips.forEach((tip, index) => {
      tip.style.display = 'block';
      tip.style.animationDelay = `${index * 0.1}s`;
    });
    btn.classList.add('expanded');
    toggleText.textContent = 'Ver menos consejos';
  }
}

// Calcular variación promedio mensual del USDT basada en historial
function calculateUsdtMonthlyVariation() {
  if (priceHistory.length < 2) return 7; // Default si no hay datos
  
  // Obtener el precio más antiguo y más reciente
  const oldestPrice = priceHistory[0].price;
  const newestPrice = priceHistory[priceHistory.length - 1].price;
  
  // Calcular el tiempo transcurrido en días
  const oldestTime = new Date(priceHistory[0].timestamp);
  const newestTime = new Date(priceHistory[priceHistory.length - 1].timestamp);
  const daysDiff = (newestTime - oldestTime) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 1) return 7; // Muy pocos datos
  
  // Calcular variación total y convertirla a mensual
  const totalVariation = ((newestPrice - oldestPrice) / oldestPrice);
  const monthlyVariation = (totalVariation / daysDiff) * 30 * 100; // En porcentaje
  
  return Math.max(0, Math.min(20, monthlyVariation)); // Entre 0% y 20%
}

// Actualizar valores automáticos de la calculadora de rendimientos
async function updateYieldDefaults() {
  try {
    // Calcular variación USDT del historial
    const usdtVariation = calculateUsdtMonthlyVariation();
    document.getElementById('usdtVariation').value = usdtVariation.toFixed(1);
    
    // Obtener datos económicos de la API
    const response = await fetch('/api/economic-data');
    if (response.ok) {
      const data = await response.json();
      
      // Actualizar inflación
      document.getElementById('inflationRate').value = data.inflation.monthly.toFixed(1);
      
      // Actualizar tasa plazo fijo
      document.getElementById('fixedRate').value = data.fixedDeposit.annualRate;
      
      console.log(`📊 Datos económicos actualizados:`);
      console.log(`   - Inflación mensual: ${data.inflation.monthly}%`);
      console.log(`   - Tasa plazo fijo: ${data.fixedDeposit.annualRate}%`);
      console.log(`   - Variación USDT: ${usdtVariation.toFixed(1)}%`);
    }
  } catch (error) {
    console.error('Error al actualizar datos económicos:', error);
    // Mantener valores por defecto si falla
  }
}

// Calculadora de Rendimientos
function calculateYield() {
  const amountStr = document.getElementById('yieldAmount').value.replace(/\./g, '');
  const amount = parseFloat(amountStr);
  const months = parseInt(document.getElementById('yieldPeriod').value);
  const inflationRate = parseFloat(document.getElementById('inflationRate').value) / 100;
  const fixedRate = parseFloat(document.getElementById('fixedRate').value) / 100;
  const usdtVariation = parseFloat(document.getElementById('usdtVariation').value) / 100;
  
  if (!amount || amount < 1000) {
    showStatusMessage('Ingresá un monto válido (mínimo $1.000)', 'error');
    return;
  }
  
  // Calcular cada opción
  
  // 1. Mantener en pesos (pierde por inflación)
  const inflationMultiplier = Math.pow(1 + inflationRate, months);
  const realValuePesos = amount / inflationMultiplier;
  const lossPesos = amount - realValuePesos;
  const percentPesos = ((realValuePesos - amount) / amount) * 100;
  
  // 2. Plazo fijo (gana interés pero pierde contra inflación)
  const finalAmountFixed = amount * Math.pow(1 + fixedRate, months / 12);
  const realValueFixed = finalAmountFixed / inflationMultiplier;
  const profitFixed = realValueFixed - amount;
  const percentFixed = ((realValueFixed - amount) / amount) * 100;
  
  // 3. USDT (sube con el dólar)
  const usdAmount = amount / currentRate;
  const finalUsdtRate = currentRate * Math.pow(1 + usdtVariation, months);
  const finalAmountUsdt = usdAmount * finalUsdtRate;
  const realValueUsdt = finalAmountUsdt / inflationMultiplier;
  const profitUsdt = realValueUsdt - amount;
  const percentUsdt = ((realValueUsdt - amount) / amount) * 100;
  
  // Ordenar por rendimiento
  const options = [
    { name: 'USDT', amount: realValueUsdt, profit: profitUsdt, percent: percentUsdt, nominal: finalAmountUsdt },
    { name: 'Plazo Fijo', amount: realValueFixed, profit: profitFixed, percent: percentFixed, nominal: finalAmountFixed },
    { name: 'Pesos (sin invertir)', amount: realValuePesos, profit: -lossPesos, percent: percentPesos, nominal: amount }
  ];
  
  options.sort((a, b) => b.amount - a.amount);
  
  // Mostrar resultados
  const resultsDiv = document.getElementById('yieldResults');
  resultsDiv.style.display = 'block';
  
  // Mejor opción
  document.getElementById('bestYieldTitle').textContent = options[0].name;
  document.getElementById('bestYieldAmount').textContent = `$${formatNumber(options[0].nominal, 0)}`;
  
  const bestProfitEl = document.getElementById('bestYieldProfit');
  const bestPercentEl = document.getElementById('bestYieldPercent');
  
  if (options[0].profit >= 0) {
    bestProfitEl.textContent = `Ganancia real: $${formatNumber(options[0].profit, 0)}`;
    bestProfitEl.classList.remove('loss');
    bestPercentEl.classList.remove('loss');
  } else {
    bestProfitEl.textContent = `Pérdida real: $${formatNumber(Math.abs(options[0].profit), 0)}`;
    bestProfitEl.classList.add('loss');
    bestPercentEl.classList.add('loss');
  }
  bestPercentEl.textContent = `${options[0].percent >= 0 ? '+' : ''}${options[0].percent.toFixed(1)}%`;
  
  // Segunda opción
  document.getElementById('secondYieldTitle').textContent = options[1].name;
  document.getElementById('secondYieldAmount').textContent = `$${formatNumber(options[1].nominal, 0)}`;
  
  const secondProfitEl = document.getElementById('secondYieldProfit');
  const secondPercentEl = document.getElementById('secondYieldPercent');
  
  if (options[1].profit >= 0) {
    secondProfitEl.textContent = `Ganancia real: $${formatNumber(options[1].profit, 0)}`;
    secondProfitEl.classList.remove('loss');
    secondPercentEl.classList.remove('loss');
  } else {
    secondProfitEl.textContent = `Pérdida real: $${formatNumber(Math.abs(options[1].profit), 0)}`;
    secondProfitEl.classList.add('loss');
    secondPercentEl.classList.add('loss');
  }
  secondPercentEl.textContent = `${options[1].percent >= 0 ? '+' : ''}${options[1].percent.toFixed(1)}%`;
  
  // Peor opción
  document.getElementById('worstYieldTitle').textContent = options[2].name;
  document.getElementById('worstYieldAmount').textContent = `$${formatNumber(options[2].nominal, 0)}`;
  
  const worstProfitEl = document.getElementById('worstYieldProfit');
  const worstPercentEl = document.getElementById('worstYieldPercent');
  
  if (options[2].profit >= 0) {
    worstProfitEl.textContent = `Ganancia real: $${formatNumber(options[2].profit, 0)}`;
    worstProfitEl.classList.remove('loss');
    worstPercentEl.classList.remove('loss');
  } else {
    worstProfitEl.textContent = `Pérdida real: $${formatNumber(Math.abs(options[2].profit), 0)}`;
    worstProfitEl.classList.add('loss');
    worstPercentEl.classList.add('loss');
  }
  worstPercentEl.textContent = `${options[2].percent >= 0 ? '+' : ''}${options[2].percent.toFixed(1)}%`;
  
  // Conclusión mejorada
  const difference = options[0].profit - options[2].profit;
  const monthText = months === 1 ? 'mes' : months === 12 ? 'año' : `${months} meses`;
  
  let conclusionText = `En ${monthText}, eligiendo ${options[0].name} en lugar de dejar tu dinero en ${options[2].name}:`;
  
  if (options[0].profit >= 0) {
    // Mejor opción gana
    if (options[2].profit >= 0) {
      // Ambos ganan, pero uno gana más
      conclusionText += ` ganarías $${formatNumber(difference, 0)} más de poder adquisitivo.`;
    } else {
      // Mejor gana, peor pierde
      conclusionText += ` ganarías $${formatNumber(options[0].profit, 0)} mientras que con ${options[2].name} perderías $${formatNumber(Math.abs(options[2].profit), 0)}. Diferencia total: $${formatNumber(difference, 0)}.`;
    }
  } else {
    // Mejor opción pierde (pero menos que la peor)
    conclusionText += ` perderías $${formatNumber(Math.abs(options[0].profit), 0)} en lugar de $${formatNumber(Math.abs(options[2].profit), 0)}. Ahorro de pérdida: $${formatNumber(difference, 0)}.`;
  }
  
  document.getElementById('yieldConclusion').textContent = conclusionText;
  
  // Scroll suave a resultados
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Auto-refresh cada 30 segundos
function startAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    fetchRate(false);
    fetchBlueRate();
  }, 30000);
}

function startPlatformsAutoRefresh() {
  platformsAutoRefreshInterval = setInterval(() => {
    fetchPlatforms(false);
  }, 30000);
}

// Obtener cotización del dólar blue
async function fetchBlueRate() {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares/blue');
    
    if (!response.ok) {
      throw new Error('Error al obtener cotización del dólar blue');
    }
    
    const data = await response.json();
    
    blueRates = {
      compra: data.compra,
      venta: data.venta
    };
    
    // Actualizar UI
    elements.blueCompra.textContent = `$ ${formatNumber(blueRates.compra, 2)}`;
    elements.blueVenta.textContent = `$ ${formatNumber(blueRates.venta, 2)}`;
    
    // Actualizar cotizaciones USDT para comparación
    if (currentRate > 0) {
      // Simular spread de P2P (aproximadamente 1-2%)
      usdtRates = {
        compra: currentRate * 0.99, // Compras USDT un poco más bajo
        venta: currentRate * 1.01   // Vendes USDT un poco más alto
      };
      
      elements.usdtCompra.textContent = `$ ${formatNumber(usdtRates.compra, 2)}`;
      elements.usdtVenta.textContent = `$ ${formatNumber(usdtRates.venta, 2)}`;
      
      // Si hay un monto ingresado, recalcular comparación
      if (elements.comparisonAmount.value) {
        calculateComparison();
      }
    }
  } catch (error) {
    console.error('Error al obtener dólar blue:', error);
    elements.blueCompra.textContent = 'Error';
    elements.blueVenta.textContent = 'Error';
  }
}

// Calcular comparación Dollar Blue vs USDT
function calculateComparison() {
  const amount = parseFloat(elements.comparisonAmount.value);
  
  if (!amount || amount <= 0) {
    elements.bestOption.textContent = '--';
    elements.bestPrice.textContent = '$ --';
    elements.bestDetail.textContent = '--';
    elements.alternativeOption.textContent = '--';
    elements.alternativePrice.textContent = '$ --';
    elements.alternativeDetail.textContent = '--';
    elements.comparisonDifference.querySelector('.difference-value').textContent = '--';
    return;
  }
  
  // Calcular cuántos ARS necesitas para comprar X USD
  const arsNeedBlue = amount * blueRates.compra;
  const arsNeedUsdt = amount * usdtRates.compra;
  
  // Determinar cuál es mejor (menor costo)
  const isBlueBetter = arsNeedBlue < arsNeedUsdt;
  const difference = Math.abs(arsNeedBlue - arsNeedUsdt);
  const percentDiff = ((difference / Math.max(arsNeedBlue, arsNeedUsdt)) * 100).toFixed(2);
  
  if (isBlueBetter) {
    // Dólar Blue es mejor
    elements.bestOption.textContent = '🏦 Dólar Blue';
    elements.bestPrice.textContent = `$ ${formatNumber(arsNeedBlue, 2)}`;
    elements.bestDetail.textContent = `Comprás ${amount} USD a $ ${formatNumber(blueRates.compra, 2)} c/u`;
    
    elements.alternativeOption.textContent = '₮ USDT P2P';
    elements.alternativePrice.textContent = `$ ${formatNumber(arsNeedUsdt, 2)}`;
    elements.alternativeDetail.textContent = `Comprás ${amount} USDT a $ ${formatNumber(usdtRates.compra, 2)} c/u`;
  } else {
    // USDT es mejor
    elements.bestOption.textContent = '₮ USDT P2P';
    elements.bestPrice.textContent = `$ ${formatNumber(arsNeedUsdt, 2)}`;
    elements.bestDetail.textContent = `Comprás ${amount} USDT a $ ${formatNumber(usdtRates.compra, 2)} c/u`;
    
    elements.alternativeOption.textContent = '🏦 Dólar Blue';
    elements.alternativePrice.textContent = `$ ${formatNumber(arsNeedBlue, 2)}`;
    elements.alternativeDetail.textContent = `Comprás ${amount} USD a $ ${formatNumber(blueRates.compra, 2)} c/u`;
  }
  
  elements.comparisonDifference.querySelector('.difference-value').textContent = 
    `$ ${formatNumber(difference, 2)} (${percentDiff}%)`;
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
  
  // Pedir permiso para notificaciones del navegador si aún no se pidió
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showStatusMessage('🔔 Notificaciones del navegador activadas', 'success');
      }
    });
  }
}

function deleteAlert(id) {
  alerts = alerts.filter(alert => alert.id !== id);
  saveAlerts();
  renderAlerts();
}

function reactivateAlert(id) {
  const alert = alerts.find(a => a.id === id);
  if (alert) {
    alert.triggered = false;
    saveAlerts();
    renderAlerts();
    showStatusMessage('🔄 Alerta reactivada', 'success');
  }
}

function clearTriggeredAlerts() {
  const triggeredCount = alerts.filter(a => a.triggered).length;
  
  if (triggeredCount === 0) {
    showStatusMessage('No hay alertas activadas para limpiar', 'error');
    return;
  }
  
  alerts = alerts.filter(alert => !alert.triggered);
  saveAlerts();
  renderAlerts();
  showStatusMessage(`🗑️ ${triggeredCount} alerta${triggeredCount > 1 ? 's' : ''} eliminada${triggeredCount > 1 ? 's' : ''}`, 'success');
}

window.reactivateAlert = reactivateAlert;
window.clearTriggeredAlerts = clearTriggeredAlerts;

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
          ${alert.triggered ? `
            <button class="btn-reactivate-alert" onclick="reactivateAlert(${alert.id})" title="Reactivar alerta">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6M23 20v-6h-6"></path>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
            </button>
          ` : ''}
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
  
  // Reproducir sonido de notificación
  playNotificationSound();
  
  // Notificación visual en la app
  const notification = document.createElement('div');
  notification.className = 'alert-notification';
  notification.innerHTML = `
    <div class="alert-notification-header">
      <div class="alert-notification-icon">🔔</div>
      <div class="alert-notification-title">¡Alerta de Precio!</div>
      <button class="alert-notification-close" onclick="this.closest('.alert-notification').remove()">×</button>
    </div>
    <div class="alert-notification-body">
      El USDT ${typeText} a <strong>$ ${formatNumber(currentPrice, 2)}</strong><br>
      Tu precio objetivo era $ ${formatNumber(alert.price, 2)}
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-cerrar después de 10 segundos
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, 10000);
  
  // Intentar notificación del navegador
  showBrowserNotification(alert, currentPrice, typeText);
}

function playNotificationSound() {
  try {
    // Crear un tono de notificación usando Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.log('No se pudo reproducir el sonido:', error);
  }
}

function showBrowserNotification(alert, currentPrice, typeText) {
  // Verificar si las notificaciones están soportadas
  if (!('Notification' in window)) {
    return;
  }
  
  // Si ya hay permiso, mostrar notificación
  if (Notification.permission === 'granted') {
    new Notification('🔔 CotizarYA - Alerta de Precio', {
      body: `El USDT ${typeText} a $ ${formatNumber(currentPrice, 2)}\nTu precio objetivo: $ ${formatNumber(alert.price, 2)}`,
      icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💱</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔔</text></svg>',
      tag: 'price-alert',
      requireInteraction: false
    });
  } 
  // Si nunca se pidió permiso, pedirlo para la próxima
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
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
  
  // Limpiar SVG (excepto defs)
  const gridLines = svg.querySelector('#gridLines');
  const priceLabels = svg.querySelector('#priceLabels');
  const chartArea = svg.querySelector('#chartArea');
  const dataPoints = svg.querySelector('#dataPoints');
  
  if (gridLines) gridLines.innerHTML = '';
  if (priceLabels) priceLabels.innerHTML = '';
  if (chartArea) chartArea.innerHTML = '';
  if (dataPoints) dataPoints.innerHTML = '';
  
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
  
  // Crear grid horizontal (3 líneas de referencia)
  const gridPrices = [minWithPadding, (minWithPadding + maxWithPadding) / 2, maxWithPadding];
  gridPrices.forEach((price, idx) => {
    if (idx === 0 || idx === 2) return; // Solo línea del medio
    const y = getY(price);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', padding);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width - padding);
    line.setAttribute('y2', y);
    gridLines.appendChild(line);
  });
  
  // Agregar etiquetas de precio en el eje Y
  [maxWithPadding, (minWithPadding + maxWithPadding) / 2, minWithPadding].forEach((price) => {
    const y = getY(price);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', padding - 8);
    label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end');
    label.textContent = `$${price.toFixed(0)}`;
    priceLabels.appendChild(label);
  });
  
  // Calcular puntos con mejor suavizado
  const points = data.map((item, index) => ({
    x: getX(index),
    y: getY(item.price),
    price: item.price,
    timestamp: item.timestamp,
    index: index
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
  chartArea.appendChild(areaPath);
  
  // Crear línea principal con sombra
  const shadowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shadowLine.setAttribute('d', pathData);
  shadowLine.setAttribute('fill', 'none');
  shadowLine.setAttribute('stroke', 'rgba(0, 217, 255, 0.3)');
  shadowLine.setAttribute('stroke-width', '6');
  shadowLine.setAttribute('stroke-linecap', 'round');
  shadowLine.setAttribute('stroke-linejoin', 'round');
  chartArea.appendChild(shadowLine);
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', pathData);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'var(--accent)');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  line.classList.add('chart-path');
  chartArea.appendChild(line);
  
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
    chartArea.appendChild(outerCircle);
    
    // Círculo principal
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', point.x);
    circle.setAttribute('cy', point.y);
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', 'white');
    circle.setAttribute('stroke', 'var(--accent)');
    circle.setAttribute('stroke-width', '3');
    chartArea.appendChild(circle);
  });
  
  // Agregar puntos interactivos invisibles sobre la línea (cada 5 puntos para mejor rendimiento)
  const step = Math.max(1, Math.floor(points.length / 30));
  points.forEach((point, index) => {
    if (index % step === 0 || index === 0 || index === points.length - 1) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', 'rgba(0, 212, 255, 0)');
      circle.setAttribute('stroke', 'transparent');
      circle.setAttribute('stroke-width', '0');
      circle.classList.add('data-point');
      circle.dataset.price = point.price.toFixed(2);
      circle.dataset.timestamp = point.timestamp;
      circle.dataset.x = point.x;
      dataPoints.appendChild(circle);
    }
  });
  
  // Configurar interactividad del gráfico
  setupChartInteractivity(points);
}

function setupChartInteractivity(points) {
  const container = document.getElementById('chartContainer');
  const svg = elements.priceChart;
  const tooltip = document.getElementById('chartTooltip');
  const crosshair = document.getElementById('crosshair');
  const tooltipDate = tooltip.querySelector('.tooltip-date');
  const tooltipPrice = tooltip.querySelector('.tooltip-price');
  
  if (!container || !tooltip || !crosshair) return;
  
  let currentPointIndex = -1;
  
  function showTooltip(point, x) {
    const date = new Date(point.timestamp);
    const dateStr = date.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    tooltipDate.textContent = dateStr;
    tooltipPrice.textContent = `$ ${formatNumber(point.price, 2)}`;
    tooltip.classList.add('visible');
    tooltip.style.left = `${x}px`;
    
    crosshair.setAttribute('x1', point.x);
    crosshair.setAttribute('x2', point.x);
    crosshair.setAttribute('opacity', '0.6');
  }
  
  function hideTooltip() {
    tooltip.classList.remove('visible');
    crosshair.setAttribute('opacity', '0');
    currentPointIndex = -1;
  }
  
  function findNearestPoint(mouseX) {
    // Convertir coordenadas del mouse a coordenadas SVG
    const rect = svg.getBoundingClientRect();
    const svgX = (mouseX / rect.width) * 800;
    
    let nearestPoint = null;
    let minDistance = Infinity;
    
    points.forEach(point => {
      const distance = Math.abs(point.x - svgX);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    });
    
    return nearestPoint;
  }
  
  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const nearestPoint = findNearestPoint(mouseX);
    
    if (nearestPoint && nearestPoint.index !== currentPointIndex) {
      currentPointIndex = nearestPoint.index;
      showTooltip(nearestPoint, mouseX);
    }
  });
  
  container.addEventListener('mouseleave', hideTooltip);
}

// Formatear números
function formatNumber(num, decimals = 2) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true
  }).format(Math.round(num));
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
