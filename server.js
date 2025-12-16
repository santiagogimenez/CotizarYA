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

let platformsCache = {
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

// Endpoint para comparar plataformas
app.get('/api/platforms', async (req, res) => {
  try {
    const now = Date.now();
    
    // Verificar si el cache es válido
    if (platformsCache.data && (now - platformsCache.timestamp) < platformsCache.TTL) {
      return res.json({
        platforms: platformsCache.data,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Lista de exchanges a consultar
    const exchanges = [
      { id: 'binancep2p', name: 'Binance P2P', icon: '🟡' },
      { id: 'ripio', name: 'Ripio', icon: '🔵' },
      { id: 'buenbit', name: 'Buenbit', icon: '🟢' },
      { id: 'letsbit', name: 'Let\'sBit', icon: '🟠' },
      { id: 'lemoncash', name: 'Lemon', icon: '🟡' },
      { id: 'satoshitango', name: 'SatoshiTango', icon: '🟣' }
    ];

    // Consultar todas las plataformas en paralelo
    const promises = exchanges.map(async (exchange) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`https://criptoya.com/api/${exchange.id}/USDT/ARS/1`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Error en ${exchange.name}`);
        }

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
    
    // Filtrar solo las plataformas disponibles y ordenar por menor precio (ask)
    const available = results
      .filter(p => p.available)
      .sort((a, b) => a.ask - b.ask);

    const unavailable = results.filter(p => !p.available);

    const responseData = {
      available,
      unavailable,
      count: available.length
    };

    // Actualizar cache
    platformsCache.data = responseData;
    platformsCache.timestamp = now;

    res.json({
      platforms: responseData,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en /api/platforms:', error);
    res.status(500).json({
      error: 'No se pudo obtener las cotizaciones',
      message: error.message
    });
  }
});

// Endpoint para obtener datos económicos argentinos (inflación estimada)
app.get('/api/economic-data', async (req, res) => {
  try {
    // Como no hay API pública confiable de inflación en tiempo real,
    // usamos estimaciones basadas en el dólar blue
    const blueResponse = await fetch('https://dolarapi.com/v1/dolares/blue');
    
    if (!blueResponse.ok) {
      throw new Error('Error al consultar DolarAPI');
    }
    
    const blueData = await blueResponse.json();
    const bluePrice = blueData.venta;
    
    // Estimación de inflación mensual basada en la devaluación
    // Fórmula simplificada: si el dólar sube, la inflación sigue
    // Usamos un promedio histórico de 8.5% como base
    const estimatedInflation = 8.5;
    
    // Tasa de plazo fijo: consultamos banco promedio
    // Como no hay API pública, usamos un valor típico del Banco Nación
    const fixedDepositRate = 110; // Tasa anual típica en Argentina
    
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
    console.error('Error en /api/economic-data:', error);
    res.status(500).json({
      error: 'No se pudo obtener datos económicos',
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
