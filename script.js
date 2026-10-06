/* Interfaz: carga datos/voluntarios.json, recibe la consulta y muestra solo a la persona buscada. */
(function () {
  "use strict";

  var GRACIAS = "Muchas gracias por ayudar a hacer posible el Aconcagua Fest";
  var MSG_VACIO = "Por favor, ingresa tu nombre y apellido.";
  var MSG_NADA = ["No encontramos ese nombre en la base de datos.", "Revisa que hayas escrito correctamente tu nombre y apellido."];
  var MSG_CARGA = ["No pudimos cargar los turnos.", "Revisa tu conexión e intenta de nuevo en unos minutos."];

  // Si se escribe "Turno 1", "Montaje", "Desmontaje" o "Reserva" se muestra el listado completo.
  // Ponlo en false para volver a mostrar únicamente consultas individuales.
  var CONSULTA_POR_TURNO = true;

  var $ = function (id) { return document.getElementById(id); };
  var form = $("formulario"), campo = $("nombre"), boton = $("consultar");
  var vistaBusqueda = $("vista-busqueda"), vistaResultado = $("vista-resultado");
  var mensaje = $("mensaje"), cajaSug = $("sugerencias");
  var personas = null;

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function limpiarAvisos() {
    mensaje.hidden = true; mensaje.textContent = "";
    cajaSug.hidden = true; cajaSug.textContent = "";
  }

  function mostrarMensaje(lineas) {
    mensaje.textContent = "";
    lineas.forEach(function (l) { mensaje.appendChild(el("p", null, l)); });
    mensaje.hidden = false;
  }

  function dato(etiqueta, valor) {
    var p = el("p", "dato");
    p.appendChild(el("span", null, etiqueta + ": "));
    p.appendChild(el("strong", null, valor));
    return p;
  }

  function tarjetaTurno(t) {
    var c = el("article", "tarjeta");
    c.appendChild(el("h3", null, "Turno " + t.turno));
    if (t.horario) c.appendChild(el("p", "horario", t.horario));
    if (t.area) c.appendChild(dato("Área", t.area));
    if (t.subarea) c.appendChild(dato("Función", t.subarea));
    return c;
  }

  function tarjetaEspecial(e) {
    var c = el("article", "tarjeta especial");
    c.appendChild(el("h3", null, e.tipo));
    var detalle = e.momento || (e.turno != null ? "Turno " + e.turno + (e.horario ? " — " + e.horario : "") : "");
    if (detalle) c.appendChild(el("p", "horario", detalle));
    return c;
  }

  function mostrarResultado(persona) {
    limpiarAvisos();
    vistaResultado.textContent = "";
    var titulo = el("h2", "nombre", persona.nombre);
    titulo.tabIndex = -1;
    vistaResultado.appendChild(titulo);

    if (persona.turnos.length) {
      vistaResultado.appendChild(el("h3", "seccion-titulo", "Tus turnos"));
      persona.turnos.forEach(function (t) { vistaResultado.appendChild(tarjetaTurno(t)); });
    }
    if (persona.especiales.length) {
      vistaResultado.appendChild(el("h3", "seccion-titulo", "Asignaciones especiales"));
      persona.especiales.forEach(function (e) { vistaResultado.appendChild(tarjetaEspecial(e)); });
    }
    if (!persona.turnos.length && !persona.especiales.length) {
      vistaResultado.appendChild(el("p", "sin-datos", "No hay asignaciones registradas para este nombre."));
    }

    vistaResultado.appendChild(el("p", "gracias", GRACIAS));
    vistaResultado.appendChild(botonOtro());
    presentarResultado(titulo);
  }

  function botonOtro() {
    var otro = el("button", "boton secundario", "Consultar otro nombre");
    otro.type = "button";
    otro.style.width = "100%";
    otro.addEventListener("click", nuevaConsulta);
    return otro;
  }

  function presentarResultado(titulo) {
    vistaBusqueda.hidden = true;
    vistaResultado.hidden = false;
    window.scrollTo(0, 0);
    titulo.focus({ preventScroll: true });
  }

  function mostrarEspecial(e) {
    limpiarAvisos();
    vistaResultado.textContent = "";
    var titulo = el("h2", "nombre", e.nombre);
    titulo.tabIndex = -1;
    vistaResultado.appendChild(titulo);

    e.grupos.forEach(function (g) {
      if (g.titulo) vistaResultado.appendChild(el("h3", "seccion-titulo", g.titulo));
      var c = el("article", "tarjeta especial");
      var ul = el("ul", "lista-nombres");
      g.personas.forEach(function (n) { ul.appendChild(el("li", null, n)); });
      c.appendChild(ul);
      vistaResultado.appendChild(c);
    });

    vistaResultado.appendChild(botonOtro());
    presentarResultado(titulo);
  }

  function mostrarTurno(t) {
    limpiarAvisos();
    vistaResultado.textContent = "";
    var titulo = el("h2", "nombre", "Turno " + t.numero);
    titulo.tabIndex = -1;
    vistaResultado.appendChild(titulo);
    if (t.horario) vistaResultado.appendChild(el("p", "horario-turno", t.horario));

    t.grupos.forEach(function (g) {
      vistaResultado.appendChild(el("h3", "seccion-titulo", g.area));
      g.subareas.forEach(function (s) {
        var c = el("article", g.area === "Reserva" ? "tarjeta especial" : "tarjeta");
        if (s.nombre) c.appendChild(el("h3", null, s.nombre));
        var ul = el("ul", "lista-nombres");
        s.personas.forEach(function (n) { ul.appendChild(el("li", null, n)); });
        c.appendChild(ul);
        vistaResultado.appendChild(c);
      });
    });

    vistaResultado.appendChild(botonOtro());
    presentarResultado(titulo);
  }

  function mostrarSugerencias(lista) {
    cajaSug.textContent = "";
    cajaSug.appendChild(el("h2", null, "¿Quizás buscas?"));
    lista.forEach(function (p) {
      var b = el("button", "sugerencia", p.nombre);
      b.type = "button";
      b.addEventListener("click", function () { mostrarResultado(p); });
      cajaSug.appendChild(b);
    });
    cajaSug.hidden = false;
  }

  function consultar(evento) {
    evento.preventDefault();
    limpiarAvisos();
    if (!personas) return;
    if (CONSULTA_POR_TURNO) {
      var t = Buscador.consultarTurno(campo.value, personas);
      if (t && t.tipo === "turno") return mostrarTurno(t);
      if (t) { mostrarMensaje(["No encontramos ese turno en la base de datos."]); campo.focus(); return; }
      var esp = Buscador.consultarEspecial(campo.value, personas);
      if (esp) return mostrarEspecial(esp);
    }
    var r = Buscador.buscar(campo.value, personas);
    if (r.tipo === "vacio") { mostrarMensaje([MSG_VACIO]); campo.focus(); }
    else if (r.tipo === "exacto") mostrarResultado(r.persona);
    else if (r.tipo === "sugerencias") mostrarSugerencias(r.personas);
    else { mostrarMensaje(MSG_NADA); campo.focus(); }
  }

  function nuevaConsulta() {
    vistaResultado.hidden = true;
    vistaResultado.textContent = "";
    limpiarAvisos();
    campo.value = "";
    vistaBusqueda.hidden = false;
    window.scrollTo(0, 0);
    campo.focus();
  }

  // Indicación bajo el buscador: usa los tipos que realmente existen en los datos.
  function armarAyuda(datos) {
    var ejemplos = ["Turno 1"], vistos = {};
    datos.forEach(function (p) {
      p.especiales.forEach(function (e) {
        if (!vistos[e.tipo]) { vistos[e.tipo] = true; ejemplos.push(e.tipo); }
      });
    });
    var citas = ejemplos.map(function (x) { return "«" + x + "»"; });
    var lista = citas.length > 1 ? citas.slice(0, -1).join(", ") + " o " + citas[citas.length - 1] : citas[0];
    $("ayuda-turno").textContent = "¿Quieres ver quién colabora en un turno o tarea? Escribe, por ejemplo, " + lista + ".";
  }

  $("ayuda-turno").hidden = !CONSULTA_POR_TURNO;
  form.addEventListener("submit", consultar);

  fetch("datos/voluntarios.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (datos) {
      personas = datos;
      armarAyuda(datos);
      campo.disabled = false; boton.disabled = false;
    })
    .catch(function () { mostrarMensaje(MSG_CARGA); });
})();
