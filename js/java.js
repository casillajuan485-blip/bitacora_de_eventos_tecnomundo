/* =========================================================
   STREAM SALES BOLIVIA - Lógica del frontend (JavaScript puro)
   Diseño Web II: eventos, delegación, bubbling, change, submit,
   preventDefault, validaciones y bitácora centralizada.

   Todo vive dentro de una IIFE para no crear variables globales.
   IMPORTANTE: las validaciones de este archivo solo SIMULAN seguridad.
   En una tienda real, el servidor debe volver a validar todo.
   ========================================================= */
(() => {
  'use strict';

  /* =======================================================
     1. CONSTANTES Y DATOS
     ======================================================= */
  const MAX_PRODUCTOS = 30;          // límite de catálogo para mantener la página fluida
  const MAX_REGISTROS = 100;          // límite de la bitácora (evita crecimiento ilimitado del DOM)
  const MAX_CHAT = 200;               // longitud máxima de un comentario
  const MAX_MENSAJES_CHAT_DOM = 60;   // mensajes del chat que se conservan en pantalla
  const ESPERA_LIKE_MS = 150;         // anti-rebote: ignora clics de like casi simultáneos
  const ESPERA_LOG_LIKE_MS = 1500;    // un like se registra en bitácora como máximo cada 1.5 s
  const ESPERA_DBLCLICK_MS = 600;     // separa envíos de corazones accidentales
  const PAUSA_ESCRITURA_CHAT_MS = 650; // registra el texto tras una pausa, no solamente la primera tecla
  const BLOQUEO_COMPRA_MS = 1000;     // evita doble envío del formulario
  const REGEX_TIKTOK = /^@[A-Za-z0-9._]{3,24}$/;
  const REGEX_ID_PRODUCTO = /^prod-\d{3,}$/;

  // Productos iniciales. Cada variante tiene: id, nombre, precio y unidades que consume del stock.
  // El stock de una variante se calcula: floor(stock del producto / unidades de la variante).
  const productos = [
    {
      id: 'prod-001', nombre: 'Auriculares Gamer', icono: '🎧', precio: 120, stock: 12,
      descripcion: 'Sonido envolvente 7.1 con micrófono con cancelación de ruido.',
      variantes: [
        { id: 'prod-001-basico', nombre: 'Kit Básico', unidades: 1, precio: 120 },
        { id: 'prod-001-doble', nombre: 'Combo Doble', unidades: 2, precio: 200 }
      ]
    },
    {
      id: 'prod-002', nombre: 'Smartwatch', icono: '⌚', precio: 250, stock: 8,
      descripcion: 'Pantalla AMOLED, monitor de ritmo cardíaco y notificaciones.',
      variantes: [
        { id: 'prod-002-individual', nombre: 'Individual', unidades: 1, precio: 250 },
        { id: 'prod-002-doble', nombre: 'Pack Pareja', unidades: 2, precio: 450 }
      ]
    },
    {
      id: 'prod-003', nombre: 'Mouse Gamer', icono: '🖱️', precio: 85, stock: 15,
      descripcion: 'Sensor de 12 000 DPI, 6 botones programables e iluminación RGB.',
      variantes: [
        { id: 'prod-003-individual', nombre: 'Individual', unidades: 1, precio: 85 },
        { id: 'prod-003-doble', nombre: 'Combo Doble', unidades: 2, precio: 150 }
      ]
    }
  ];

  // Estado de la aplicación (un solo objeto en lugar de muchas variables sueltas).
  const estado = {
    likes: 0,
    corazones: 0,
    espectadores: 128,
    registros: [],            // bitácora visible (máx. 100)
    totalEventos: 0,          // eventos registrados en toda la sesión
    pedidos: [],              // pedidos confirmados (la bitácora NO los borra)
    siguientePedido: 1,
    siguienteProducto: 4,
    procesandoCompra: false,
    ultimoLike: 0,
    ultimoLogLike: 0,
    ultimoDblclick: 0,
    ultimoLogChat: 0,
    destacadoIndice: 0
  };

  const COMENTARIOS_SIMULADOS = [
    ['@maria.cbba', '¿Todavía quedan auriculares?'],
    ['@juan_lp', 'El smartwatch está buenísimo 🔥'],
    ['@lucy_scz', '¿Hacen envíos a Sucre?'],
    ['@diego.gamer', 'Quiero el combo doble'],
    ['@andrea_bo', 'Saludos desde Tarija 👋'],
    ['@carlos_oru', '¿El mouse trae luces RGB?']
  ];

  /* =======================================================
     2. REFERENCIAS AL DOM (se buscan una sola vez)
     ======================================================= */
  const $ = (id) => document.getElementById(id);

  const liveContainer = $('liveContainer');
  const catalogGrid = $('catalogGrid');
  const chatMessages = $('chatMessages');
  const chatForm = $('chatForm');
  const chatInput = $('chatInput');
  const chatCounter = $('chatCounter');
  const errChat = $('errChat');
  const heartLayer = $('heartLayer');

  const checkoutForm = $('checkoutForm');
  const formProducto = $('formProducto');
  const formVariante = $('formVariante');
  const formUsuario = $('formUsuario');
  const formCantidad = $('formCantidad');
  const precioUnitario = $('precioUnitario');
  const totalCompra = $('totalCompra');
  const resumenPedido = $('resumenPedido');
  const btnConfirmar = $('btnConfirmar');
  const confirmacion = $('confirmacion');
  const pedidoDialog = $('pedidoDialog');
  const pedidoDialogResumen = $('pedidoDialogResumen');
  const aceptarPedido = $('aceptarPedido');
  const cancelarPedido = $('cancelarPedido');
  let pedidoPendiente = null;

  const productForm = $('productForm');
  const logList = $('logList');
  const logCounter = $('logCounter');
  const bubblingToggle = $('bubblingToggle');

  /* =======================================================
     3. UTILIDADES
     ======================================================= */

  // Crea elementos de forma segura: el texto SIEMPRE entra por textContent (nunca innerHTML).
  function crearElemento(etiqueta, { clase, texto, atributos, dataset } = {}, hijos = []) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    if (atributos) Object.entries(atributos).forEach(([k, v]) => nodo.setAttribute(k, v));
    if (dataset) Object.entries(dataset).forEach(([k, v]) => { nodo.dataset[k] = v; });
    hijos.forEach((hijo) => nodo.append(hijo));
    return nodo;
  }

  const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const formatearBs = (n) => `Bs. ${redondear(n).toFixed(2)}`;
  const formatearHora = (fecha) => fecha.toLocaleTimeString('es-BO', { hour12: false });
  const recortar = (texto, max) => (texto.length > max ? `${texto.slice(0, max)}…` : texto);

  const buscarProducto = (id) => productos.find((p) => p.id === id) || null;
  const stockVariante = (producto, variante) => Math.floor(producto.stock / variante.unidades);
  const stockTotal = () => productos.reduce((suma, p) => suma + p.stock, 0);

  /* =======================================================
     4. BITÁCORA CENTRALIZADA  (logEvent)
     Todos los módulos registran sus eventos con esta función.
     ======================================================= */
  const NIVEL_POR_TIPO = {
    COMPRA_EXITOSA: 'ok',
    PRODUCTO_AGREGADO: 'ok',
    ERRORES_VALIDACION: 'error',
    STOCK_INSUFICIENTE: 'error'
  };

  function logEvent(tipo, mensaje, pedidoId = '') {
    const tipoLimpio = typeof tipo === 'string' ? tipo.trim() : '';
    const mensajeLimpio = typeof mensaje === 'string' ? mensaje.trim() : '';

    // Validación de la bitácora: no se aceptan registros sin tipo o sin descripción.
    if (!tipoLimpio || !mensajeLimpio) return false;

    const ahora = new Date();
    estado.registros.unshift({            // unshift: lo más reciente queda primero
      hora: formatearHora(ahora),
      iso: ahora.toISOString(),
      tipo: tipoLimpio,
      mensaje: mensajeLimpio,
      pedidoId,
      nivel: NIVEL_POR_TIPO[tipoLimpio] || 'info'
    });

    // Límite de 100 registros visibles.
    if (estado.registros.length > MAX_REGISTROS) estado.registros.length = MAX_REGISTROS;

    estado.totalEventos += 1;
    renderBitacora();
    return true;
  }

  function renderBitacora() {
    logList.replaceChildren();

    if (estado.registros.length === 0) {
      logList.append(crearElemento('li', { clase: 'log-empty', texto: 'Sin registros todavía. Interactúa con el live para ver eventos aquí.' }));
    } else {
      const fragmento = document.createDocumentFragment();
      estado.registros.forEach((r) => {
        const item = crearElemento('li', { clase: `log-item is-${r.nivel}` }, [
          crearElemento('time', { clase: 'log-time', texto: r.hora, atributos: { datetime: r.iso } }),
          crearElemento('span', { clase: 'log-type', texto: r.tipo }),
          crearElemento('span', { clase: 'log-msg', texto: r.mensaje })
        ]);
        if (r.pedidoId) item.append(crearElemento('span', { clase: 'log-order', texto: r.pedidoId }));
        fragmento.append(item);
      });
      logList.append(fragmento);
    }

    logCounter.textContent = `${estado.registros.length} en pantalla · ${estado.totalEventos} en la sesión`;
  }

  /* =======================================================
     5. NOTIFICACIONES VISUALES
     ======================================================= */
  function mostrarToast(nivel, mensaje) {
    const toast = crearElemento('div', { clase: `toast is-${nivel}`, texto: mensaje });
    $('toasts').append(toast);
    setTimeout(() => toast.remove(), 3800);
  }

  /* =======================================================
     6. CATÁLOGO: tarjetas de producto
     Las tarjetas NO tienen listeners propios: los maneja #liveContainer.
     ======================================================= */
  function textoStock(producto) {
    if (producto.stock <= 0) return 'Agotado';
    if (producto.stock <= 5) return `¡Últimas ${producto.stock}!`;
    return `Stock: ${producto.stock}`;
  }

  function textoOpcion(producto, variante) {
    const disponibles = stockVariante(producto, variante);
    const sufijo = disponibles === 0 ? ' (sin stock)' : '';
    return `${variante.nombre} (${variante.unidades} u.) - ${formatearBs(variante.precio)}${sufijo}`;
  }

  // Rellena un <select> con las variantes del producto (las opciones salen de los datos, no del usuario).
  function poblarVariantes(select, producto, valorPrevio) {
    select.replaceChildren();
    producto.variantes.forEach((v) => {
      select.append(crearElemento('option', { texto: textoOpcion(producto, v), atributos: { value: v.id } }));
    });
    const existe = producto.variantes.some((v) => v.id === valorPrevio);
    select.value = existe ? valorPrevio : producto.variantes[0].id;
  }

  function crearTarjetaProducto(producto) {
    const selectVariante = crearElemento('select', { atributos: { 'data-variant-select': '' } });
    poblarVariantes(selectVariante, producto);

    return crearElemento('article', { clase: 'product-card', dataset: { prod: producto.id } }, [
      crearElemento('div', { clase: 'product-visual', texto: producto.icono, atributos: { 'aria-hidden': 'true' } }),
      crearElemento('h3', { texto: producto.nombre }),
      crearElemento('p', { clase: 'product-desc', texto: producto.descripcion }),
      crearElemento('div', { clase: 'product-meta' }, [
        crearElemento('span', { clase: 'price', texto: formatearBs(producto.precio), atributos: { 'data-role': 'precio' } }),
        crearElemento('span', { clase: 'stock-badge', texto: textoStock(producto), atributos: { 'data-role': 'stock' } })
      ]),
      crearElemento('label', { clase: 'variant-label' }, [
        crearElemento('span', { texto: 'Variante' }),
        selectVariante
      ]),
      crearElemento('button', {
        clase: 'btn btn-buy', texto: 'Comprar', atributos: { type: 'button' }, dataset: { action: 'comprar' }
      })
    ]);
  }

  function obtenerTarjeta(idProducto) {
    return catalogGrid.querySelector(`[data-prod="${idProducto}"]`);
  }

  // Sincroniza la tarjeta con los datos (stock, precio de la variante elegida, estado agotado).
  function actualizarTarjeta(producto) {
    const tarjeta = obtenerTarjeta(producto.id);
    if (!tarjeta) return;

    const select = tarjeta.querySelector('[data-variant-select]');
    poblarVariantes(select, producto, select.value);
    const variante = producto.variantes.find((v) => v.id === select.value) || producto.variantes[0];

    tarjeta.querySelector('[data-role="precio"]').textContent = formatearBs(variante.precio);

    const insignia = tarjeta.querySelector('[data-role="stock"]');
    insignia.textContent = textoStock(producto);
    insignia.classList.toggle('is-low', producto.stock > 0 && producto.stock <= 5);
    insignia.classList.toggle('is-out', producto.stock <= 0);

    const agotado = producto.stock <= 0;
    tarjeta.classList.toggle('is-soldout', agotado);
    const boton = tarjeta.querySelector('[data-action="comprar"]');
    boton.textContent = agotado ? 'Agotado' : 'Comprar';
    boton.setAttribute('aria-disabled', String(agotado)); // no usamos disabled para poder registrar el intento
  }

  function renderCatalogo() {
    catalogGrid.replaceChildren(...productos.map(crearTarjetaProducto));
  }

  /* =======================================================
     7. EVENTOS DEL DÍA 1 - DELEGACIÓN EN #liveContainer
     ======================================================= */

  // Describe un nodo para mostrar la ruta del bubbling: etiqueta + id/clase.
  function describirNodo(nodo) {
    let texto = nodo.tagName.toLowerCase();
    if (nodo.id) texto += `#${nodo.id}`;
    else if (nodo.dataset && nodo.dataset.prod) texto += `[data-prod=${nodo.dataset.prod}]`;
    else if (nodo.classList && nodo.classList.length) texto += `.${nodo.classList[0]}`;
    return texto;
  }

  // D. EVENT BUBBLING: un clic en un hijo (por ejemplo un <span> dentro de un botón)
  // "sube" por sus ancestros hasta llegar a #liveContainer. composedPath() devuelve
  // esa ruta real, desde el elemento clicado hacia arriba.
  function registrarBubbling(e) {
    if (!bubblingToggle.checked) return;
    const ruta = e.composedPath();
    const limite = ruta.indexOf(liveContainer);
    const nodos = ruta.slice(0, limite + 1).filter((n) => n instanceof Element).map(describirNodo);
    logEvent('BUBBLING', `El clic subió: ${nodos.join(' → ')}`);
  }

  function seleccionarEnFormulario(producto, variante) {
    formProducto.value = producto.id;
    poblarVariantes(formVariante, producto, variante.id);
    actualizarCalculos();
  }

  // Lógica común de un cambio de variante (tarjeta o formulario).
  function procesarCambioVariante(producto, varianteId, origen) {
    const variante = producto.variantes.find((v) => v.id === varianteId);
    if (!variante) {
      logEvent('ERRORES_VALIDACION', `Variante inválida "${recortar(String(varianteId), 40)}" para ${producto.nombre}.`);
      mostrarToast('error', 'La variante no pertenece al producto.');
      return null;
    }
    logEvent('CAMBIO_VARIANTE', `${origen}: ${producto.nombre} → ${variante.nombre} (${variante.unidades} u.) a ${formatearBs(variante.precio)}.`);
    if (stockVariante(producto, variante) < 1) {
      logEvent('STOCK_INSUFICIENTE', `Sin stock para la variante ${variante.nombre} de ${producto.nombre}.`);
      mostrarToast('warn', `Sin stock para ${variante.nombre}.`);
    }
    return variante;
  }

  /* ---------- A. CLICK (delegado) ---------- */
  function procesarClick(e) {
    // closest() sube desde el elemento clicado hasta encontrar el botón con data-action,
    // así funciona aunque el clic caiga en un <span> hijo del botón.
    const accionEl = e.target.closest('[data-action]');
    // contains() confirma que el elemento pertenece al contenedor del live.
    if (!accionEl || !liveContainer.contains(accionEl)) return;

    switch (accionEl.dataset.action) {
      case 'comprar': {
        const tarjeta = accionEl.closest('[data-prod]');
        const producto = tarjeta ? buscarProducto(tarjeta.dataset.prod) : null;
        if (!producto) {
          logEvent('ERRORES_VALIDACION', 'Se pulsó Comprar sobre un producto que no existe.');
          mostrarToast('error', 'Producto no encontrado.');
          return;
        }
        const select = tarjeta.querySelector('[data-variant-select]');
        const variante = producto.variantes.find((v) => v.id === select.value) || producto.variantes[0];

        logEvent('OFERTA_CLICK', `Clic en Comprar: ${producto.nombre} (${producto.id}), variante ${variante.nombre}.`);

        if (stockVariante(producto, variante) <= 0) {
          logEvent('STOCK_INSUFICIENTE', `${variante.nombre} de ${producto.nombre} está agotado.`);
          mostrarToast('error', `${producto.nombre} está agotado.`);
          return;
        }
        seleccionarEnFormulario(producto, variante);
        checkoutForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        formUsuario.focus({ preventScroll: true });
        mostrarToast('ok', `${producto.nombre} añadido al formulario de compra.`);
        break;
      }

      case 'like': {
        const ahora = Date.now();
        if (ahora - estado.ultimoLike < ESPERA_LIKE_MS) return; // anti-rebote
        estado.ultimoLike = ahora;
        estado.likes += 1;
        $('likeCount').textContent = estado.likes;
        // El contador sube siempre, pero el registro se limita para no llenar la bitácora.
        if (ahora - estado.ultimoLogLike >= ESPERA_LOG_LIKE_MS) {
          estado.ultimoLogLike = ahora;
          logEvent('LIKE_STREAM', `Like enviado al stream (total: ${estado.likes}).`);
        }
        break;
      }

      case 'reaccion':
        // Un clic simple no hace nada: la reacción se envía con DOBLE clic (ver dblclick).
        break;

      default:
        break;
    }
  }

  liveContainer.addEventListener('click', (e) => {
    procesarClick(e);
    registrarBubbling(e);
  });

  /* ---------- B. DBLCLICK (delegado) ---------- */
  function lanzarCorazones(cantidad) {
    for (let i = 0; i < cantidad; i += 1) {
      const corazon = crearElemento('span', { clase: 'heart', texto: '❤️' });
      corazon.style.left = `${10 + Math.random() * 80}%`;
      corazon.style.animationDelay = `${i * 90}ms`;
      corazon.addEventListener('animationend', () => corazon.remove(), { once: true });
      heartLayer.append(corazon);
    }
  }

  liveContainer.addEventListener('dblclick', (e) => {
    const boton = e.target.closest('[data-action="reaccion"]');
    if (!boton || !liveContainer.contains(boton)) return;

    const ahora = Date.now();
    if (ahora - estado.ultimoDblclick < ESPERA_DBLCLICK_MS) return; // evita envíos accidentales repetidos
    estado.ultimoDblclick = ahora;

    const CORAZONES_POR_ENVIO = 5;
    estado.corazones += CORAZONES_POR_ENVIO;
    $('heartCount').textContent = estado.corazones;
    lanzarCorazones(CORAZONES_POR_ENVIO);
    logEvent('DBLCLICK', `Doble clic en Reaccionar: ${CORAZONES_POR_ENVIO} corazones enviados (total: ${estado.corazones}).`);
  });

  /* ---------- C. KEYUP (delegado) ---------- */
  function actualizarContadorChat() {
    chatCounter.textContent = `${chatInput.value.length} / ${MAX_CHAT}`;
  }

  // Evita registrar solo la primera letra de una frase escrita rápidamente.
  // Seguimos escuchando keyup, tal como exige la práctica del Día 1.
  let temporizadorChat = null;
  let ultimoTextoChatRegistrado = '';

  function registrarEscrituraChat() {
    temporizadorChat = null;
    const texto = chatInput.value.trim();
    if (!texto || texto === ultimoTextoChatRegistrado) return;
    ultimoTextoChatRegistrado = texto;
    logEvent('CHAT_INPUT', `El espectador escribió ${texto.length} caracteres en el chat.`);
  }

  liveContainer.addEventListener('keyup', (e) => {
    if (!e.target.closest('#chatInput')) return;
    actualizarContadorChat();
    if (e.key === 'Enter') return;
    clearTimeout(temporizadorChat);
    temporizadorChat = setTimeout(registrarEscrituraChat, PAUSA_ESCRITURA_CHAT_MS);
  });

  // 'input' cubre pegado de texto, mantiene el contador y el registro coherentes.
  liveContainer.addEventListener('input', (e) => {
    if (!e.target.closest('#chatInput')) return;
    actualizarContadorChat();
    clearTimeout(temporizadorChat);
    temporizadorChat = setTimeout(registrarEscrituraChat, PAUSA_ESCRITURA_CHAT_MS);
  });

  /* ---------- Cambio de variante en las tarjetas (change delegado) ---------- */
  liveContainer.addEventListener('change', (e) => {
    const select = e.target.closest('[data-variant-select]');
    if (!select || !liveContainer.contains(select)) return;

    const tarjeta = select.closest('[data-prod]');
    const producto = tarjeta ? buscarProducto(tarjeta.dataset.prod) : null;
    if (!producto) return;

    const variante = procesarCambioVariante(producto, select.value, 'Tarjeta');
    if (variante) {
      tarjeta.querySelector('[data-role="precio"]').textContent = formatearBs(variante.precio);
      if (formProducto.value === producto.id) {          // mantiene el formulario coherente
        poblarVariantes(formVariante, producto, variante.id);
        actualizarCalculos();
      }
    } else {
      poblarVariantes(select, producto);                  // restaura una opción válida
    }
  });

  /* =======================================================
     8. MÓDULO 4 - CHAT
     ======================================================= */
  function agregarMensajeChat(usuario, texto, esPropio = false) {
    // textContent: el comentario se muestra como TEXTO, jamás como HTML.
    const item = crearElemento('li', { clase: `chat-msg${esPropio ? ' is-own' : ''}` }, [
      crearElemento('span', { clase: 'chat-user', texto: usuario }),
      crearElemento('span', { clase: 'chat-text', texto })
    ]);
    chatMessages.append(item);
    while (chatMessages.children.length > MAX_MENSAJES_CHAT_DOM) chatMessages.firstElementChild.remove();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();                         // evita recargar la página
    errChat.textContent = '';
    chatInput.classList.remove('has-error');

    const texto = chatInput.value.trim();       // elimina espacios al inicio y al final
    // Si se envía antes de terminar la pausa, registra también la frase completa.
    clearTimeout(temporizadorChat);
    temporizadorChat = null;
    if (texto) registrarEscrituraChat();
    let error = '';
    if (!texto) error = 'Escribe un comentario antes de enviar.';
    else if (texto.length > MAX_CHAT) error = `El comentario no puede superar ${MAX_CHAT} caracteres.`;

    if (error) {
      errChat.textContent = error;
      chatInput.classList.add('has-error');
      chatInput.setAttribute('aria-invalid', 'true');
      logEvent('ERRORES_VALIDACION', `Comentario rechazado: ${error}`);
      return;
    }

    agregarMensajeChat('@tú', texto, true);
    logEvent('CHAT_COMENTARIO', `Comentario enviado: "${recortar(texto, 60)}".`);
    chatInput.value = '';
    ultimoTextoChatRegistrado = '';
    actualizarContadorChat();
  });

  chatInput.addEventListener('input', () => {
    errChat.textContent = '';
    chatInput.classList.remove('has-error');
    chatInput.removeAttribute('aria-invalid');
  });

  /* =======================================================
     9. MÓDULO DÍA 2 - FORMULARIO DE COMPRA
     ======================================================= */
  function poblarSelectorProductos() {
    const previo = formProducto.value;
    formProducto.replaceChildren();
    productos.forEach((p) => {
      const etiqueta = p.stock <= 0 ? `${p.nombre} (agotado)` : p.nombre;
      formProducto.append(crearElemento('option', { texto: etiqueta, atributos: { value: p.id } }));
    });
    formProducto.value = productos.some((p) => p.id === previo) ? previo : productos[0].id;

    const producto = buscarProducto(formProducto.value);
    poblarVariantes(formVariante, producto, formVariante.value);
  }

  function leerSeleccion() {
    const producto = buscarProducto(formProducto.value);
    const variante = producto ? producto.variantes.find((v) => v.id === formVariante.value) || null : null;
    return { producto, variante };
  }

  // Recalcula precio unitario, total y resumen. El total lo calcula JavaScript, no el usuario.
  function actualizarCalculos() {
    const { producto, variante } = leerSeleccion();
    if (!producto || !variante) {
      precioUnitario.textContent = formatearBs(0);
      totalCompra.textContent = formatearBs(0);
      resumenPedido.textContent = 'Elige un producto para ver el resumen del pedido.';
      return;
    }

    const maxDisponible = stockVariante(producto, variante);
    formCantidad.max = String(maxDisponible);
    precioUnitario.textContent = formatearBs(variante.precio);

    const textoCantidad = formCantidad.value.trim();
    const cantidadValida = /^\d+$/.test(textoCantidad) && Number(textoCantidad) > 0;
    if (!cantidadValida) {
      totalCompra.textContent = formatearBs(0);
      resumenPedido.textContent = `${producto.nombre} · ${variante.nombre}. Indica la cantidad para calcular el total.`;
      return;
    }

    const cantidad = Number(textoCantidad);
    if (!Number.isSafeInteger(cantidad) || cantidad > 999 || cantidad > maxDisponible) {
      totalCompra.textContent = formatearBs(0);
      resumenPedido.textContent = cantidad > maxDisponible
        ? `Stock insuficiente: máximo ${maxDisponible} paquete(s) de ${variante.nombre}.`
        : 'Introduce una cantidad válida de 1 a 999.';
      return;
    }
    const total = variante.precio * cantidad;
    totalCompra.textContent = formatearBs(total);
    resumenPedido.textContent =
      `Resumen: ${cantidad} × ${variante.nombre} de ${producto.nombre} (${cantidad * variante.unidades} unidades) = ${formatearBs(total)}.`;
  }

  const CAMPOS_ERROR = { producto: 'errProducto', variante: 'errVariante', usuario: 'errUsuario', cantidad: 'errCantidad' };
  const CAMPOS_INPUT = { producto: formProducto, variante: formVariante, usuario: formUsuario, cantidad: formCantidad };

  function limpiarErroresFormulario() {
    Object.keys(CAMPOS_ERROR).forEach((campo) => {
      $(CAMPOS_ERROR[campo]).textContent = '';
      CAMPOS_INPUT[campo].classList.remove('has-error');
      CAMPOS_INPUT[campo].removeAttribute('aria-invalid');
    });
  }

  function mostrarErrorCampo(campo, mensaje) {
    $(CAMPOS_ERROR[campo]).textContent = mensaje;
    CAMPOS_INPUT[campo].classList.add('has-error');
    CAMPOS_INPUT[campo].setAttribute('aria-invalid', 'true');
  }

  // Valida TODO el formulario. Devuelve los errores por campo y si el problema es de stock.
  function validarCompra() {
    const errores = {};
    let falloDeStock = false;

    const producto = buscarProducto(formProducto.value);
    if (!producto) errores.producto = 'El producto seleccionado no existe.';

    const variante = producto ? producto.variantes.find((v) => v.id === formVariante.value) : null;
    if (producto && !variante) errores.variante = 'La variante no pertenece al producto seleccionado.';

    // Usuario de TikTok (sin trim: así detectamos espacios que el usuario escribió).
    const usuario = formUsuario.value;
    if (!usuario) errores.usuario = 'El usuario de TikTok es obligatorio.';
    else if (!usuario.startsWith('@')) errores.usuario = 'El usuario debe comenzar con @ (ejemplo: @mi_usuario).';
    else if (/\s/.test(usuario)) errores.usuario = 'El usuario no puede contener espacios.';
    else if (!REGEX_TIKTOK.test(usuario)) {
      errores.usuario = 'Usa solo letras, números, puntos y guiones bajos (de 3 a 24 caracteres después de @).';
    }

    // Cantidad.
    const textoCantidad = formCantidad.value.trim();
    let cantidad = 0;
    if (textoCantidad === '') errores.cantidad = 'La cantidad es obligatoria y debe ser un número.';
    else if (textoCantidad.startsWith('-')) errores.cantidad = 'La cantidad no puede ser negativa.';
    else if (!/^\d+$/.test(textoCantidad)) errores.cantidad = 'La cantidad debe ser un número entero.';
    else {
      cantidad = Number(textoCantidad);
      if (cantidad === 0) errores.cantidad = 'La cantidad no puede ser cero.';
      else if (cantidad > 999) errores.cantidad = 'La cantidad máxima por pedido es 999.';
    }

    // Stock (solo si lo anterior es válido).
    if (producto && variante && !errores.cantidad) {
      const unidadesNecesarias = cantidad * variante.unidades;
      if (producto.stock <= 0) {
        errores.cantidad = `${producto.nombre} está agotado.`;
        falloDeStock = true;
      } else if (unidadesNecesarias > producto.stock) {
        const paquetes = stockVariante(producto, variante);
        errores.cantidad = `Stock insuficiente: solo puedes pedir ${paquetes} de ${variante.nombre} (quedan ${producto.stock} unidades).`;
        falloDeStock = true;
      }
    }

    return { errores, falloDeStock, producto, variante, usuario, cantidad };
  }

  function generarIdPedido() {
    const id = `PED-${String(estado.siguientePedido).padStart(4, '0')}`;
    estado.siguientePedido += 1;
    return id;
  }

  function mostrarConfirmacion(pedido) {
    confirmacion.replaceChildren(
      crearElemento('h3', { texto: '¡Pedido confirmado!' }),
      crearElemento('p', { texto: `${pedido.id} para ${pedido.usuario}` }),
      crearElemento('p', { texto: `${pedido.cantidad} × ${pedido.variante} de ${pedido.producto}` }),
      crearElemento('p', { texto: `Total: ${formatearBs(pedido.total)}` })
    );
    confirmacion.hidden = false;
    clearTimeout(mostrarConfirmacion.temporizador);
    mostrarConfirmacion.temporizador = setTimeout(() => { confirmacion.hidden = true; }, 10000);
  }

  // SUBMIT del formulario: valida y ABRE confirmación; todavía no modifica el inventario.
  checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (estado.procesandoCompra || pedidoPendiente) return;

    limpiarErroresFormulario();
    const validacion = validarCompra();
    const campos = Object.keys(validacion.errores);
    if (campos.length) {
      campos.forEach((campo) => mostrarErrorCampo(campo, validacion.errores[campo]));
      const detalle = campos.map((campo) => validacion.errores[campo]).join(' | ');
      logEvent(validacion.falloDeStock ? 'STOCK_INSUFICIENTE' : 'ERRORES_VALIDACION', `Compra rechazada: ${detalle}`);
      mostrarToast('error', 'Revisa los datos de tu compra.');
      CAMPOS_INPUT[campos[0]].focus();
      return;
    }

    const { producto, variante, usuario, cantidad } = validacion;
    pedidoPendiente = { productoId: producto.id, varianteId: variante.id, usuario, cantidad };
    const unidades = cantidad * variante.unidades;
    pedidoDialogResumen.replaceChildren(
      crearElemento('strong', { texto: `${producto.nombre} · ${variante.nombre}` }),
      crearElemento('span', { texto: `Cliente: ${usuario}` }),
      crearElemento('span', { texto: `${cantidad} paquete(s) · ${unidades} unidad(es) de inventario` }),
      crearElemento('span', { clase: 'dialog-total', texto: `Total: ${formatearBs(variante.precio * cantidad)}` })
    );
    pedidoDialog.showModal();
    aceptarPedido.focus();
  });

  // Se cancela sin generar identificadores ni descontar stock.
  cancelarPedido.addEventListener('click', () => pedidoDialog.close('cancelado'));
  pedidoDialog.addEventListener('close', () => { pedidoPendiente = null; });

  // Confirmación final: volver a validar para evitar compras con datos/stock desactualizados.
  aceptarPedido.addEventListener('click', () => {
    if (!pedidoPendiente || estado.procesandoCompra) return;
    const pendiente = pedidoPendiente;
    const producto = buscarProducto(pendiente.productoId);
    const variante = producto?.variantes.find((v) => v.id === pendiente.varianteId);
    if (!producto || !variante || !Number.isSafeInteger(pendiente.cantidad) ||
        pendiente.cantidad < 1 || pendiente.cantidad > 999 ||
        producto.stock < pendiente.cantidad * variante.unidades) {
      pedidoDialog.close('stock-invalido');
      logEvent('STOCK_INSUFICIENTE', 'El stock cambió o el pedido dejó de ser válido antes de confirmar.');
      mostrarToast('error', 'El pedido ya no es válido. Revisa el stock.');
      actualizarCalculos();
      return;
    }
    estado.procesandoCompra = true;
    btnConfirmar.disabled = true;
    aceptarPedido.disabled = true;
    const unidades = pendiente.cantidad * variante.unidades;
    const total = redondear(variante.precio * pendiente.cantidad);
    const idPedido = generarIdPedido();
    producto.stock -= unidades;
    const pedido = {
      id: idPedido, usuario: pendiente.usuario, producto: producto.nombre,
      variante: variante.nombre, cantidad: pendiente.cantidad, unidades, total,
      hora: formatearHora(new Date())
    };
    estado.pedidos.unshift(pedido);
    logEvent('COMPRA_EXITOSA', `${pedido.usuario} compró ${pedido.cantidad} × ${pedido.variante} de ${pedido.producto}. Total: ${formatearBs(total)}.`, idPedido);
    actualizarTarjeta(producto);
    poblarSelectorProductos();
    renderPedidos();
    renderEstadisticas();
    mostrarConfirmacion(pedido);
    mostrarToast('ok', `Pedido ${idPedido} confirmado.`);
    formUsuario.value = '';
    formCantidad.value = '';
    actualizarCalculos();
    pedidoDialog.close('confirmado');
    setTimeout(() => {
      estado.procesandoCompra = false;
      btnConfirmar.disabled = false;
      aceptarPedido.disabled = false;
    }, BLOQUEO_COMPRA_MS);
  });

  // CHANGE: cambio de producto y de variante en el formulario.
  formProducto.addEventListener('change', () => {
    const producto = buscarProducto(formProducto.value);
    if (!producto) return;

    // DÍA 2: el evento change también registra al seleccionar otro artefacto.
    logEvent('CAMBIO_PRODUCTO', `Producto seleccionado en Compra rápida: ${producto.nombre} (${producto.id}).`);
    poblarVariantes(formVariante, producto);
    limpiarErroresFormulario();
    actualizarCalculos();
  });

  formVariante.addEventListener('change', () => {
    const producto = buscarProducto(formProducto.value);
    if (!producto) return;
    const variante = procesarCambioVariante(producto, formVariante.value, 'Formulario');
    if (!variante) poblarVariantes(formVariante, producto);
    formVariante.classList.remove('has-error');
    formVariante.removeAttribute('aria-invalid');
    $(CAMPOS_ERROR.variante).textContent = '';
    actualizarCalculos();
  });

  formCantidad.addEventListener('input', () => {
    formCantidad.classList.remove('has-error');
    formCantidad.removeAttribute('aria-invalid');
    $(CAMPOS_ERROR.cantidad).textContent = '';
    actualizarCalculos();
    const { producto, variante } = leerSeleccion();
    const n = Number(formCantidad.value);
    if (formCantidad.value.trim() && producto && variante && n > stockVariante(producto, variante)) {
      mostrarErrorCampo('cantidad', `Stock insuficiente: máximo ${stockVariante(producto, variante)} paquete(s).`);
    }
  });

  formUsuario.addEventListener('input', () => {
    formUsuario.classList.remove('has-error');
    formUsuario.removeAttribute('aria-invalid');
    $(CAMPOS_ERROR.usuario).textContent = '';
  });

  /* =======================================================
     10. PEDIDOS Y ESTADÍSTICAS
     ======================================================= */
  function renderPedidos() {
    const lista = $('orderList');
    lista.replaceChildren();
    if (estado.pedidos.length === 0) {
      lista.append(crearElemento('li', { clase: 'order-empty', texto: 'Aún no hay pedidos. ¡Compra algo del live!' }));
      return;
    }
    estado.pedidos.slice(0, 15).forEach((p) => {
      lista.append(crearElemento('li', { clase: 'order-item' }, [
        crearElemento('strong', { texto: `${p.id} · ${formatearBs(p.total)}` }),
        crearElemento('span', { texto: `${p.usuario}: ${p.cantidad} × ${p.variante} de ${p.producto}` }),
        crearElemento('span', { clase: 'muted', texto: `Hora: ${p.hora}` })
      ]));
    });
  }

  function renderEstadisticas() {
    $('statPedidos').textContent = estado.pedidos.length;
    $('statIngresos').textContent = formatearBs(estado.pedidos.reduce((s, p) => s + p.total, 0));
    $('statUnidades').textContent = estado.pedidos.reduce((s, p) => s + p.unidades, 0);
    $('statStock').textContent = stockTotal();
  }

  /* =======================================================
     11. AGREGAR PRODUCTOS DINÁMICAMENTE
     La tarjeta nueva se inserta en #catalogGrid SIN listeners propios:
     ya funciona porque #liveContainer usa delegación de eventos.
     ======================================================= */
  const CAMPOS_PRODUCTO = {
    nombre: ['nuevoNombre', 'errNuevoNombre'],
    precio: ['nuevoPrecio', 'errNuevoPrecio'],
    stock: ['nuevoStock', 'errNuevoStock']
  };

  Object.values(CAMPOS_PRODUCTO).forEach(([idInput, idError]) => {
    $(idInput).addEventListener('input', () => {
      $(idError).textContent = '';
      $(idInput).classList.remove('has-error');
      $(idInput).removeAttribute('aria-invalid');
    });
  });

  // Al pulsar «Agregar producto al catálogo» se abre el formulario y
  // la pantalla se desplaza hasta el primer campo para comenzar a escribir.
  const panelAgregarProducto = productForm.closest('details');
  panelAgregarProducto.addEventListener('toggle', () => {
    if (!panelAgregarProducto.open) return;
    requestAnimationFrame(() => {
      productForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('nuevoNombre').focus({ preventScroll: true });
    });
  });

  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.values(CAMPOS_PRODUCTO).forEach(([idInput, idError]) => {
      $(idError).textContent = '';
      $(idInput).classList.remove('has-error');
      $(idInput).removeAttribute('aria-invalid');
    });

    if (productos.length >= MAX_PRODUCTOS) {
      mostrarToast('warn', `El catálogo permite como máximo ${MAX_PRODUCTOS} productos.`);
      logEvent('ERRORES_VALIDACION', 'No se agregó el producto: catálogo lleno.');
      return;
    }

    const nombre = $('nuevoNombre').value.trim();
    const descripcion = $('nuevaDescripcion').value.trim();
    const textoPrecio = $('nuevoPrecio').value.trim();
    const textoStock = $('nuevoStock').value.trim();
    const errores = {};

    if (!nombre) errores.nombre = 'El nombre es obligatorio.';
    else if (nombre.length > 40) errores.nombre = 'El nombre no puede superar 40 caracteres.';
    else if (productos.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) errores.nombre = 'Ya existe un producto con ese nombre.';

    if (!/^\d+(\.\d{1,2})?$/.test(textoPrecio) || Number(textoPrecio) <= 0) {
      errores.precio = 'El precio debe ser un número positivo (máximo 2 decimales).';
    }
    if (!/^\d+$/.test(textoStock) || Number(textoStock) > 9999) {
      errores.stock = 'El stock debe ser un entero entre 0 y 9999.';
    }

    const campos = Object.keys(errores);
    if (campos.length > 0) {
      campos.forEach((campo) => {
        $(CAMPOS_PRODUCTO[campo][1]).textContent = errores[campo];
        $(CAMPOS_PRODUCTO[campo][0]).classList.add('has-error');
        $(CAMPOS_PRODUCTO[campo][0]).setAttribute('aria-invalid', 'true');
      });
      logEvent('ERRORES_VALIDACION', `Producto nuevo rechazado: ${campos.map((c) => errores[c]).join(' | ')}`);
      mostrarToast('error', 'No se pudo agregar el producto.');
      return;
    }

    const precio = redondear(Number(textoPrecio));
    const id = `prod-${String(estado.siguienteProducto).padStart(3, '0')}`;
    estado.siguienteProducto += 1;
    if (!REGEX_ID_PRODUCTO.test(id) || buscarProducto(id)) {
      logEvent('ERRORES_VALIDACION', 'No se pudo generar un identificador de producto válido.');
      return;
    }

    const nuevo = {
      id, nombre, icono: '📦', precio, stock: Number(textoStock),
      descripcion: descripcion || 'Producto agregado durante el live.',
      variantes: [
        { id: `${id}-individual`, nombre: 'Individual', unidades: 1, precio },
        { id: `${id}-doble`, nombre: 'Combo Doble', unidades: 2, precio: redondear(precio * 2 * 0.9) }
      ]
    };
    productos.push(nuevo);
    catalogGrid.append(crearTarjetaProducto(nuevo));   // sin addEventListener: delegación
    actualizarTarjeta(nuevo);
    poblarSelectorProductos();
    renderEstadisticas();

    logEvent('PRODUCTO_AGREGADO', `Nuevo producto en el catálogo: ${nombre} (${id}), ${formatearBs(precio)}, stock ${nuevo.stock}.`);
    mostrarToast('ok', `${nombre} agregado al catálogo.`);
    productForm.reset();
    productForm.closest('details').open = false;
  });

  /* =======================================================
     12. BITÁCORA: botón de limpieza
     Solo borra los registros: NO toca pedidos ni stock.
     ======================================================= */
  $('btnLimpiarBitacora').addEventListener('click', () => {
    estado.registros = [];
    renderBitacora();
    mostrarToast('ok', 'Bitácora limpiada. Los pedidos y el stock no cambiaron.');
  });

  /* =======================================================
     13. SIMULACIONES DEL LIVE (espectadores, chat, oferta)
     ======================================================= */
  setInterval(() => {
    estado.espectadores = Math.max(40, estado.espectadores + Math.floor(Math.random() * 9) - 3);
    $('viewerCount').textContent = estado.espectadores;
  }, 3000);

  setInterval(() => {
    const [usuario, texto] = COMENTARIOS_SIMULADOS[Math.floor(Math.random() * COMENTARIOS_SIMULADOS.length)];
    agregarMensajeChat(usuario, texto);   // comentarios simulados: no se registran en la bitácora
  }, 7000);

  setInterval(() => {
    const disponibles = productos.filter((p) => p.stock > 0);
    if (disponibles.length === 0) {
      $('featuredName').textContent = 'Todo agotado, ¡vuelve pronto!';
      return;
    }
    estado.destacadoIndice = (estado.destacadoIndice + 1) % disponibles.length;
    $('featuredName').textContent = disponibles[estado.destacadoIndice].nombre;
  }, 6000);

  /* =======================================================
     14. INICIALIZACIÓN
     ======================================================= */
  function iniciar() {
    renderCatalogo();
    poblarSelectorProductos();
    actualizarCalculos();
    renderPedidos();
    renderEstadisticas();
    renderBitacora();
    actualizarContadorChat();
    agregarMensajeChat('@streamsales', '¡Bienvenidos al live de ofertas gamer!');
    logEvent('SISTEMA', 'Plataforma iniciada. Eventos delegados en #liveContainer.');
  }

  iniciar();
})();