# 💱 CotizarYA

Herramienta web para convertir precios de USDT a pesos argentinos (ARS) en tiempo real, diseñada para vendedores que fijan precios en dólares USDT.

## 📌 Características

- **Cotización en tiempo real** desde Binance P2P vía CriptoYa
- **Conversión automática** de USDT a ARS
- **Markup/Recargo configurable** para ajustar márgenes de ganancia
- **Redondeo inteligente** (sin redondeo, cada $10, $50, $100, $500)
- **Copiar al portapapeles** con un solo click
- **Actualización automática** cada 30 segundos
- **Diseño responsive** y fácil de usar

## ⚡ Fuente de cotización

**La cotización se obtiene exclusivamente de Binance P2P (USDT/ARS) a través de la API pública de CriptoYa.**

- API utilizada: `https://criptoya.com/api/binancep2p/USDT/ARS/1`
- Valor usado: `ask` (precio de compra de USDT en ARS)
- Cache: 30 segundos para optimizar performance

## 🚀 Instalación y uso local

### Requisitos previos

- Node.js 14 o superior
- npm o yarn

### Pasos de instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/tu-usuario/cotizarya.git
cd cotizarya
```

2. Instalar dependencias:
```bash
npm install
```

3. Iniciar el servidor:
```bash
npm start
```

4. Abrir en el navegador:
```
http://localhost:3000
```

## 📂 Estructura del proyecto

```
cotizarya/
├── public/
│   ├── index.html      # Interfaz de usuario
│   ├── styles.css      # Estilos
│   └── app.js          # Lógica del frontend
├── server.js           # Servidor Express + API
├── package.json        # Dependencias
└── README.md
```

## 🛠️ Tecnologías

- **Backend**: Node.js + Express
- **Frontend**: HTML5 + CSS3 + JavaScript (Vanilla)
- **API**: CriptoYa (Binance P2P)

## 🌐 Deploy

Esta aplicación puede desplegarse fácilmente en:

- **Render**: https://render.com
- **Railway**: https://railway.app
- **Vercel**: https://vercel.com
- **Heroku**: https://heroku.com

### Variables de entorno

No requiere variables de entorno. El puerto se detecta automáticamente:
- Producción: `process.env.PORT`
- Local: `3000`

## 📊 Uso

1. **Ingresá el monto en USDT** que querés convertir
2. **Aplicá un recargo** (opcional) para tu margen de ganancia
3. **Seleccioná el redondeo** deseado
4. **Copiá el precio final** con un click

## 🔄 API Endpoints

### `GET /api/rate`

Obtiene la cotización actual de USDT/ARS desde Binance P2P.

**Respuesta exitosa:**
```json
{
  "ask": 1250.50,
  "bid": 1245.00,
  "source": "Binance P2P",
  "timestamp": "2025-12-15T18:30:00.000Z",
  "cached": false
}
```

### `GET /api/health`

Verifica el estado del servidor.

**Respuesta:**
```json
{
  "status": "ok"
}
```

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Creá una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrí un Pull Request

## 📄 Licencia

MIT License - Podés usar este proyecto libremente para cualquier propósito.

## ⚠️ Disclaimer

Esta herramienta utiliza cotizaciones de Binance P2P a través de CriptoYa. Los precios son referenciales y pueden variar según el momento de la transacción real. Siempre verificá los precios antes de realizar operaciones comerciales.

## 💡 Casos de uso

- Fijar precios de productos en marketplaces
- Calcular presupuestos en ARS basados en USDT
- Conversión rápida para vendedores de servicios
- Pricing dinámico en e-commerce

---

Desarrollado con ❤️ para la comunidad argentina de vendedores cripto
