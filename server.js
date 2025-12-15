const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache en memoria
let cache = {
  data: null,
  timestamp: 0,
  TTL: 30000 // 30 segundos
};

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Endpoint principal para obtener la cotización
app.get('/api/rate', async (req, res) => {
  try {
    const now = Date.now();
    
    // Verificar si el cache es válido
    if (cache.data && (now - cache.timestamp) < cache.TTL) {
      return res.json({
        ...cache.data,
        cached: true
      });
    }

    // Consultar la API de CriptoYa - Binance P2P
    const response = await fetch('https://criptoya.com/api/binancep2p/USDT/ARS/1');
    
    if (!response.ok) {
      throw new Error('Error al consultar la API de CriptoYa');
    }

    const data = await response.json();

    // Validar que existan los datos necesarios
    if (!data.ask || !data.bid) {
      throw new Error('Datos incompletos desde la API');
    }

    // Preparar la respuesta
    const rateData = {
      ask: parseFloat(data.ask),
      bid: parseFloat(data.bid),
      source: 'Binance P2P',
      timestamp: new Date().toISOString()
    };

    // Actualizar cache
    cache.data = rateData;
    cache.timestamp = now;

    res.json({
      ...rateData,
      cached: false
    });

  } catch (error) {
    console.error('Error en /api/rate:', error);
    res.status(500).json({
      error: 'No se pudo obtener la cotización',
      message: error.message
    });
  }
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Servir el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
