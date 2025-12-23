const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
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
};
