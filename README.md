# Stream Sales Bolivia — Live Shopping

Proyecto académico de Diseño Web II. Simulación frontend de un Live Shopping, sin procesamiento de pagos reales ni almacenamiento permanente.

## Cómo ejecutarlo

Abre `index.html` en un navegador moderno (Chrome, Edge o Firefox). Mantén intacta esta estructura:

```
stream-sales-bolivia/
  index.html
  css/estilo.css
  js/java.js
  assets/icons/favicon.svg
```

No requiere instalar dependencias, servidor ni base de datos. También puede publicarse como sitio estático en GitHub Pages.

## Funcionalidades

- Catálogo con tres productos iniciales y creación dinámica (máximo 30).
- Delegación en `#liveContainer` para `click`, `dblclick`, `keyup`, `input` y `change`.
- Likes y reacciones, chat simulado y registro de eventos.
- Selección de variantes con packs de una o dos unidades.
- Compra rápida con validación de usuario, cantidad y stock.
- Confirmación previa con Cancelar / Confirmar, sin cobros reales.
- Descuento del stock y estadísticas solo después de confirmar.
- Bitácora con los últimos 100 registros visibles.
- Diseño minimalista adaptable a móvil y escritorio.

**Nota:** el estado es temporal. Al actualizar la página se restablecen productos, pedidos, mensajes, likes y stock. La validación de frontend no reemplaza la seguridad de un servidor real.
