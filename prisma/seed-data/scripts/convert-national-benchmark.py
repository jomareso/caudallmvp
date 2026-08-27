#!/usr/bin/env python3
"""
Convierte el archivo de datos de los Estudios de Salud Financiera
(2021-2024, compartidos por Reynoso) a un JSON estructurado — mismo
patrón que banco-maestro-v3.json: el JSON es la fuente de verdad que usa
la app, no la hoja de cálculo original.

Alcance decidido con Reynoso: el estudio viejo no mide Resiliencia por
separado (esa pregunta quedó mezclada dentro de "Ahorro", justo lo que la
Regla CORE #5 prohíbe confundir) — así que este JSON NO incluye un score
de Resiliencia. La comparación con pares, cuando se construya, solo
podrá usar el score general y Control/Ahorro/Deuda/Planificación hasta
que exista un estudio que mida Resiliencia aparte.

Mapeo de categorías del estudio -> dimensiones de Caudall:
  Gastos          -> CONTROL      (misma pregunta central: ingresos vs gastos)
  Ahorro          -> SAVING
  Deudas          -> DEBT
  Planificación   -> PLANNING

Demografía: se mapea a los mismos códigos de estado que ya usa el banco
de preguntas (CTX-01/02/06/09, ver banco-maestro-v3.json) cuando la
categoría del estudio corresponde limpiamente. Donde no corresponde
limpiamente (ver notas abajo) se deja sin mapear (null) en vez de forzar
una categoría que no es realmente equivalente.

Uso: python3 prisma/seed-data/scripts/convert-national-benchmark.py <ruta-al-xlsx>
"""
import json
import sys
import openpyxl

if len(sys.argv) != 2:
    print("Uso: python3 convert-national-benchmark.py <ruta-al-xlsx>")
    sys.exit(1)

SOURCE_PATH = sys.argv[1]
OUTPUT_PATH = "prisma/seed-data/national-benchmark.json"

# ---- Mapeos demográficos -> mismos códigos que CTX-01/02/06/09 ----

SEX_MAP = {"Femenino": "FEMALE", "Masculino": "MALE"}

# El estudio usa bandas de 5 años; Caudall usa bandas de 10 (CTX-01). Se
# agrupan las finas dentro de las gruesas — no es una aproximación
# arriesgada, es la misma frontera, con más granularidad de origen.
AGE_MAP = {
    "Menos de 18 años": None,  # fuera del rango que pregunta Caudall (18+)
    "19-24": "AGE_18_24",
    "20-24": "AGE_18_24",
    "25-29": "AGE_25_34",
    "30-34": "AGE_25_34",
    "35-39": "AGE_35_44",
    "40-44": "AGE_35_44",
    "45-49": "AGE_45_54",
    "50-54": "AGE_45_54",
    "55-59": "AGE_55_64",
    "Más de 60 años": "AGE_65_PLUS"  # aproximado: incluye 60-64, que Caudall pondría en AGE_55_64 -- el estudio no distingue más fino que esto
}

EDUCATION_MAP = {
    "Ninguno": "EDU_PRIMARY_OR_LESS",
    "Primario": "EDU_PRIMARY_OR_LESS",
    "Bachiller": "EDU_SECONDARY",
    "Técnico": "EDU_TECHNICAL",
    "Técnico o tecnológico": "EDU_TECHNICAL",
    "Universitario": "EDU_UNIVERSITY",
    "Maestría": "EDU_POSTGRAD",
    "Posgrado/especialidad": "EDU_POSTGRAD",
    "PhD": "EDU_POSTGRAD"
}

# "Inversiones"/"Remesas"/"Otras"/"Subsidio del gobierno" son FUENTES de
# ingreso, no situación laboral -- no tienen equivalente real en
# CTX_EMPLOYMENT_STATUS (que no es sobre "estudiante" ni "hogar" en el
# estudio tampoco). Se dejan sin mapear (null) en vez de forzar una
# categoría que no es la misma pregunta.
EMPLOYMENT_MAP = {
    "Empleado empresa privada": "PRIVATE_EMPLOYEE",
    "Empleado institución pública": "PUBLIC_EMPLOYEE",
    "Trabajador independiente": "SELF_EMPLOYED",
    "Negocio propio": "EMPLOYER",
    "Estoy desempleado": "UNEMPLOYED",
    "Pensión por jubilación": "RETIRED"
}

DEPENDENTS_MAP = {
    "Ninguna": "DEP_0",
    "1 persona": "DEP_1",
    "2 personas": "DEP_2",
    "3 personas": "DEP_3",
    "4 personas": "DEP_4_PLUS",
    "5 personas": "DEP_4_PLUS",
    "Más de 5 personas": "DEP_4_PLUS"
}

wb = openpyxl.load_workbook(SOURCE_PATH, read_only=True, data_only=True)
ws = wb["Data"]

records = []
skipped_incomplete = 0

for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0] is None:
        continue

    sexo, edad, _estado_civil, dependientes = row[3], row[4], row[5], row[6]
    _provincias, _region, nivel_acad, fuente_ingresos, ingresos = row[7], row[8], row[9], row[10], row[11]
    spend_score, save_score, borrow_score, plan_score = row[32], row[33], row[34], row[35]
    fin_health_score, fin_health_condition = row[36], row[37]
    institucion, anio = row[38], row[39]

    # Un registro sin los 5 scores no sirve para comparar -- se descarta
    # en vez de rellenar con un valor inventado.
    if None in (spend_score, save_score, borrow_score, plan_score, fin_health_score):
        skipped_incomplete += 1
        continue

    records.append({
        "studyYear": int(anio) if anio else None,
        "sourceLabel": institucion or "Nacional",
        "sex": SEX_MAP.get(sexo),
        "ageBand": AGE_MAP.get(edad),
        "educationLevel": EDUCATION_MAP.get(nivel_acad),
        "employmentStatus": EMPLOYMENT_MAP.get(fuente_ingresos),
        "dependents": DEPENDENTS_MAP.get(dependientes),
        "incomeRangeRaw": ingresos,
        "controlScore": float(spend_score),
        "savingScore": float(save_score),
        "debtScore": float(borrow_score),
        "planningScore": float(plan_score),
        "overallScore": float(fin_health_score),
        "condition": fin_health_condition
    })

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump({"version": "2021-2024", "records": records}, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"OK — {len(records)} registros escritos a {OUTPUT_PATH} ({skipped_incomplete} descartados por datos incompletos).")
