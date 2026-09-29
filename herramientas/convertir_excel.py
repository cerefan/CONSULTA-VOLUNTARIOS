#!/usr/bin/env python3
"""Convierte turnos.xlsx -> datos/voluntarios.json (+ datos/inconsistencias.txt).

Uso (desde la raíz del proyecto):
    pip install openpyxl
    python3 herramientas/convertir_excel.py

No modifica turnos.xlsx. Lee las columnas por el nombre de su encabezado.
Hojas de turno: el horario se toma del nombre de la hoja, p. ej. "TURNO1 (10-13)".
Hojas con columna "Fecha/Momento" (Montaje, Desmontaje): se usa ese texto tal cual.
"""
import json, re, sys, unicodedata
from pathlib import Path
import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
XLSX = RAIZ / "turnos.xlsx"
SALIDA = RAIZ / "datos" / "voluntarios.json"
INFORME = RAIZ / "datos" / "inconsistencias.txt"


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def texto(v):
    return None if v is None or str(v).strip() == "" else re.sub(r"\s+", " ", str(v)).strip()


def horario_de_hoja(nombre):
    m = re.search(r"\((\d{1,2})\s*-\s*(\d{1,2})\)", nombre)
    return f"{int(m.group(1)):02d}:00–{int(m.group(2)):02d}:00" if m else None


def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    personas, avisos = {}, []
    filas = 0
    for ws in wb:
        filas_hoja = list(ws.iter_rows(values_only=True))
        if not filas_hoja:
            continue
        enc = [texto(c) for c in filas_hoja[0]]
        idx = {n: i for i, n in enumerate(enc) if n}
        for req in ("Nombre", "Apellido", "Tipo"):
            if req not in idx:
                avisos.append(f"Hoja '{ws.title}': falta la columna '{req}'. Hoja omitida.")
                break
        else:
            for n, fila in enumerate(filas_hoja[1:], start=2):
                g = lambda col: texto(fila[idx[col]]) if col in idx and idx[col] < len(fila) else None
                nombre, apellido, tipo = g("Nombre"), g("Apellido"), g("Tipo")
                if not (nombre or apellido):
                    if any(c is not None for c in fila):
                        avisos.append(f"Hoja '{ws.title}' fila {n}: fila sin nombre ni apellido.")
                    continue
                filas += 1
                completo = " ".join(x for x in (nombre, apellido) if x)
                p = personas.setdefault(norm(completo), {"nombre": completo, "turnos": [], "especiales": []})
                if p["nombre"] != completo:
                    avisos.append(f"Nombre escrito distinto para la misma persona normalizada: '{p['nombre']}' vs '{completo}' (hoja '{ws.title}', fila {n}).")
                area, sub = g("Área"), g("Subárea")
                if sub in ("—", "-", "–"):
                    sub = None
                if "Turno" in idx and g("Turno") is not None:
                    try:
                        t = int(float(g("Turno")))
                    except ValueError:
                        avisos.append(f"Hoja '{ws.title}' fila {n}: valor de Turno no numérico: {g('Turno')!r}.")
                        continue
                    m = re.search(r"TURNO\s*(\d+)", ws.title, re.I)
                    if m and int(m.group(1)) != t:
                        avisos.append(f"Hoja '{ws.title}' fila {n}: Turno={t} no coincide con el nombre de la hoja.")
                    horario = horario_de_hoja(ws.title)
                    if not horario:
                        avisos.append(f"Hoja '{ws.title}': no se pudo leer el horario del nombre de la hoja.")
                    reg = {"turno": t, "horario": horario, "area": area, "subarea": sub}
                    if area and area.lower() == "reserva":
                        p["especiales"].append({"tipo": "Reserva", "turno": t, "horario": horario})
                    else:
                        if not area:
                            avisos.append(f"Hoja '{ws.title}' fila {n}: {completo} sin Área.")
                        p["turnos"].append(reg)
                else:
                    momento = g("Fecha/Momento")
                    if not tipo:
                        avisos.append(f"Hoja '{ws.title}' fila {n}: {completo} sin Tipo.")
                        continue
                    if not momento:
                        avisos.append(f"Hoja '{ws.title}' fila {n}: {completo} ({tipo}) sin Fecha/Momento.")
                    p["especiales"].append({"tipo": tipo, "momento": momento})

    for p in personas.values():
        p["turnos"].sort(key=lambda r: r["turno"])
        # duplicados exactos / dos áreas en el mismo turno (se conservan, solo se avisa)
        vistos = {}
        for r in p["turnos"]:
            vistos.setdefault(r["turno"], []).append(r)
        for t, rs in vistos.items():
            if len(rs) > 1:
                avisos.append(f"{p['nombre']}: aparece {len(rs)} veces en el Turno {t}: " + "; ".join(f"{r['area']}/{r['subarea']}" for r in rs))
        orden = {"Montaje": 0, "Reserva": 1, "Desmontaje": 2}
        p["especiales"].sort(key=lambda e: (orden.get(e["tipo"], 9), e.get("turno", 0)))
        p["turnos"] = [{k: v for k, v in r.items() if v is not None} for r in p["turnos"]]
        p["especiales"] = [{k: v for k, v in e.items() if v is not None} for e in p["especiales"]]
        if not p["turnos"] and not p["especiales"]:
            avisos.append(f"{p['nombre']}: sin ninguna asignación.")

    lista = sorted(personas.values(), key=lambda p: norm(p["nombre"]))
    # posibles duplicados por error de tipeo en la fuente
    nombres = [p["nombre"] for p in lista]
    for i in range(len(nombres)):
        for j in range(i + 1, len(nombres)):
            a, b = norm(nombres[i]), norm(nombres[j])
            if lev(a, b) <= 2:
                avisos.append(f"Nombres muy parecidos (¿misma persona escrita distinto?): '{nombres[i]}' y '{nombres[j]}'.")

    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(json.dumps(lista, ensure_ascii=False, indent=1), encoding="utf-8")
    cab = f"Voluntarios: {len(lista)} | Filas leídas: {filas} | Avisos: {len(avisos)}\n"
    INFORME.write_text(cab + "\n".join(f"- {a}" for a in avisos) + "\n", encoding="utf-8")
    print(cab + "\n".join(f"- {a}" for a in avisos))


if __name__ == "__main__":
    sys.exit(main())
