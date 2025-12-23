const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Cache en memoria (dentro del scope de la función serverless)
let cache = {
  data: null,
  timestamp: 0,
  TTL: 30000 // 30 segundos
};

let platformsCache = {
  data: null,
  timestamp: 0,
  TTL: 30000 // 30 segundos
};

module.exports = async (req, res) => {
  // Vercel serverless: req.method, req.url
  const { url, method } = req;

  // /api/server/rate
  if (url.startsWith('/api/server/rate')) {
    if (method !== 'GET') return res.status(405).end();
    try {
      const now = Date.now();
      if (cache.data && (now - cache.timestamp) < cache.TTL) {
        return res.json({ ...cache.data, cached: true });
      }
      const response = await fetch('https://criptoya.com/api/binancep2p/USDT/ARS/1');
      if (!response.ok) throw new Error('Error al consultar la API de CriptoYa');
      const data = await response.json();
      if (!data.ask || !data.bid) throw new Error('Datos incompletos desde la API');
      const rateData = {
        ask: parseFloat(data.ask),
        bid: parseFloat(data.bid),
        source: 'Binance P2P',
        timestamp: new Date().toISOString()
      };
      cache.data = rateData;
      cache.timestamp = now;
      res.json({ ...rateData, cached: false });
    } catch (error) {
      res.status(500).json({ error: 'No se pudo obtener la cotización', message: error.message });
    }
    return;
  }

  // /api/server/platforms
  if (url.startsWith('/api/server/platforms')) {
    if (method !== 'GET') return res.status(405).end();
    try {
      const now = Date.now();
      if (platformsCache.data && (now - platformsCache.timestamp) < platformsCache.TTL) {
        return res.json({ platforms: platformsCache.data, cached: true, timestamp: new Date().toISOString() });
      }
      const exchanges = [
        { id: 'binancep2p', name: 'Binance P2P', icon: '🟡' },
        { id: 'ripio', name: 'Ripio', icon: '🔵' },
        { id: 'buenbit', name: 'Buenbit', icon: '🟢' },
        { id: 'letsbit', name: "Let'sBit", icon: '🟠' },
        { id: 'lemoncash', name: 'Lemon', icon: '🟡' },
        { id: 'satoshitango', name: 'SatoshiTango', icon: '🟣' }
      ];
      const promises = exchanges.map(async (exchange) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(`https://criptoya.com/api/${exchange.id}/USDT/ARS/1`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error(`Error en ${exchange.name}`);
          const data = await response.json();
          return {
            id: exchange.id,
            name: exchange.name,
            icon: exchange.icon,
            ask: parseFloat(data.ask) || null,
            bid: parseFloat(data.bid) || null,
            available: !!(data.ask && data.bid)
          };
        } catch (error) {
          return {
            id: exchange.id,
            name: exchange.name,
            icon: exchange.icon,
            ask: null,
            bid: null,
            available: false,
            error: error.message
          };
        }
      });
      const results = await Promise.all(promises);
      const available = results.filter(p => p.available).sort((a, b) => a.ask - b.ask);
      const unavailable = results.filter(p => !p.available);
      const responseData = { available, unavailable, count: available.length };
      platformsCache.data = responseData;
      platformsCache.timestamp = now;
      res.json({ platforms: responseData, cached: false, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'No se pudo obtener las cotizaciones', message: error.message });
    }
    return;
  }

  // /api/server/economic-data
  if (url.startsWith('/api/server/economic-data')) {
    if (method !== 'GET') return res.status(405).end();
    try {
      const blueResponse = await fetch('https://dolarapi.com/v1/dolares/blue');
      if (!blueResponse.ok) throw new Error('Error al consultar DolarAPI');
      const blueData = await blueResponse.json();
      const bluePrice = blueData.venta;
      const estimatedInflation = 8.5;
      const fixedDepositRate = 110;
      res.json({
        inflation: {
          monthly: estimatedInflation,
          source: 'Estimación basada en datos históricos',
          lastUpdate: new Date().toISOString()
        },
        fixedDeposit: {
          annualRate: fixedDepositRate,
          source: 'Promedio bancos argentinos',
          lastUpdate: new Date().toISOString()
        },
        blueRate: bluePrice
      });
    } catch (error) {
      res.status(500).json({ error: 'No se pudo obtener datos económicos', message: error.message });
    }
    return;
  }

  // /api/server/health
  if (url.startsWith('/api/server/health')) {
    return res.json({ status: 'ok' });
  }

  // Servir el frontend (solo para desarrollo local, en Vercel lo maneja solo)
  if (url === '/' || url.startsWith('/public')) {
    const filePath = path.join(process.cwd(), 'public', url === '/' ? 'index.html' : url.replace('/public/', ''));
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      res.setHeader('Content-Type', 'text/html');
      return res.end(content);
    }
  }

  // 404 para cualquier otro endpoint
  res.status(404).json({ error: 'Not found' });
};
