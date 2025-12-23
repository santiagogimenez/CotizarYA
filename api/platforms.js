const fetch = require('node-fetch');

let platformsCache = {
  data: null,
  timestamp: 0,
  TTL: 30000 // 30 segundos
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
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
};
