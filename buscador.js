/* Lógica de búsqueda (sin dependencias del DOM, para poder probarla con Node).
 *
 * buscar(consulta, personas) devuelve uno de:
 *   { tipo: "vacio" }
 *   { tipo: "exacto", persona }
 *   { tipo: "sugerencias", personas: [...] }   (máx. 3)
 *   { tipo: "nada" }
 */
(function (raiz) {
  "use strict";

  // minúsculas, sin tildes ni signos, espacios simples. No toca los datos originales.
  function normalizar(texto) {
    return String(texto == null ? "" : texto)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1), cur = new Array(b.length + 1), i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }

  function ordenarPalabras(norm) {
    return norm.split(" ").sort().join(" ");
  }

  // Errores tolerados según el largo del texto completo.
  function limiteCompleto(largo) {
    if (largo < 6) return 0;
    return Math.min(3, Math.max(1, Math.floor(largo * 0.16)));
  }

  // Errores tolerados en una sola palabra.
  function limitePalabra(largo) {
    if (largo <= 3) return 0;
    if (largo <= 6) return 1;
    return 2;
  }

  // ¿Las palabras escritas coinciden, en orden, con palabras del nombre? (permite omitir
  // un segundo nombre: "Maria Humeres" -> "María Eugenia Humeres"). Exige primera y última.
  function coincidePorPalabras(palabrasQ, palabrasN) {
    if (palabrasQ.length < 2 || palabrasQ.length > palabrasN.length) return false;
    var pos = 0, i, j, ok;
    for (i = 0; i < palabrasQ.length; i++) {
      ok = false;
      for (j = pos; j < palabrasN.length; j++) {
        var q = palabrasQ[i], n = palabrasN[j];
        if (levenshtein(q, n) <= Math.min(limitePalabra(q.length), limitePalabra(n.length))) {
          ok = true; pos = j + 1; break;
        }
      }
      if (!ok) return false;
      if (i === 0 && pos !== 1) return false;                              // primera con primera
      if (i === palabrasQ.length - 1 && pos !== palabrasN.length) return false; // última con última
    }
    return true;
  }

  function buscar(consulta, personas) {
    var q = normalizar(consulta);
    if (!q) return { tipo: "vacio" };
    var qOrd = ordenarPalabras(q), qPalabras = q.split(" ");
    var i, p, exactas = [], candidatas = [];

    var indice = personas.map(function (persona) {
      var n = normalizar(persona.nombre);
      return { persona: persona, n: n, nOrd: ordenarPalabras(n), nPalabras: n.split(" ") };
    });

    for (i = 0; i < indice.length; i++) {
      p = indice[i];
      if (p.n === q || p.nOrd === qOrd) exactas.push(p.persona);
    }
    if (exactas.length) return { tipo: "exacto", persona: exactas[0] };

    for (i = 0; i < indice.length; i++) {
      p = indice[i];
      var d = Math.min(levenshtein(q, p.n), levenshtein(qOrd, p.nOrd));
      var largo = Math.max(q.length, p.n.length);
      var puntaje = null;
      if (d <= limiteCompleto(largo)) puntaje = d;
      else if (coincidePorPalabras(qPalabras, p.nPalabras)) puntaje = 1.5;
      if (puntaje !== null) candidatas.push({ persona: p.persona, puntaje: puntaje });
    }
    if (!candidatas.length) return { tipo: "nada" };
    candidatas.sort(function (a, b) { return a.puntaje - b.puntaje; });
    return { tipo: "sugerencias", personas: candidatas.slice(0, 3).map(function (c) { return c.persona; }) };
  }

  var api = { normalizar: normalizar, levenshtein: levenshtein, buscar: buscar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Buscador = api;
})(typeof window !== "undefined" ? window : this);
