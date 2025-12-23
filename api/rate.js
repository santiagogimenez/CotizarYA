const fetch = require('node-fetch');

// Cache en memoria (dentro del scope de la función serverless)
let cache = {
  data: null,
  timestamp: 0,
  TTL: 30000 // 30 segundos
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
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
};
