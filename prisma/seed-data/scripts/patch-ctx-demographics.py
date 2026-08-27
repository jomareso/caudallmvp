#!/usr/bin/env python3
"""
Ajusta el bloque de contexto (CTX-*) a pedido de Reynoso, tras probar el
flujo real: solo sexo, edad, nivel académico, situación laboral (conforme
categorías tipo Banco Central), rango de ingreso y cantidad de
dependientes — se quita % de gastos del hogar (CTX-03) y patrón de
ingreso variable/fijo (CTX-05), que no estaban en esa lista.

Uso: python3 prisma/seed-data/scripts/patch-ctx-demographics.py
"""
import json

PATH = "prisma/seed-data/banco-maestro-v3.json"

with open(PATH, encoding="utf-8") as f:
    data = json.load(f)

questions = data["questions"]
variables = data["variables"]

by_id = {q["id"]: q for q in questions}

# ---- 1. Desactivar CTX-03 (% gastos del hogar) y CTX-05 (patrón de ingreso) ----
# RESERVA en vez de DRAFT (mismo estado que las 220 preguntas de sesgos
# conductuales pendientes — toQuestionStatus() trata cualquier valor que
# no sea literalmente 'ACTIVA' como inactivo). No se borran: quedan en el
# banco por si se necesitan más adelante, solo dejan de ofrecerse.
for qid in ("CTX-03", "CTX-05"):
    by_id[qid]["status"] = "RESERVA"

# ---- 2. Nueva pregunta: sexo ----
ctx_sex = {
    "id": "CTX-08",
    "dimension": "CONTEXTO",
    "construct": "CTX_SEGMENTATION",
    "variable": "CTX_SEX",
    "primaryOwnerConstruct": "CTX_SEGMENTATION",
    "textUX": "¿Cuál es tu sexo?",
    "whyAsk": "Aporta contexto de segmentación para análisis y comparación, sin afectar el CFHI.",
    "role": "CONTEXT",
    "anchor": False,
    "askIfRaw": "FINANCIAL_DIAGNOSTIC_COMPLETE AND RESULT_NOT_SHOWN AND user has not skipped optional context block",
    "skipIfRaw": "CTX_SEX known OR user declines context questions",
    "basePriority": 50,
    "informationValue": 0.4,
    "scoringValue": 0.0,
    "routingValue": 0.1,
    "safetyValue": 0.0,
    "rootCauseValue": 0.1,
    "uncertaintyReduction": 0.2,
    "burden": 1,
    "inferenceSubstitutionAllowed": True,
    "minConfidenceToSkip": 100,
    "frictionTarget": None,
    "aiRegenerationAllowed": False,
    "coreLogicEditable": True,
    "status": "ACTIVA",
    "version": "4.2",
    "benchmarkSource": "Caudall · segmentación contextual",
    "methodologicalFunction": "CONTEXT_SEGMENTATION",
    "behavioralConstruct": None,
    "options": [
        {"order": 1, "text": "Femenino", "state": "FEMALE", "score": None,
         "secondaryUpdates": "CTX_SEX=FEMALE", "friction": None, "nextCandidates": "CTX-02",
         "notes": "Uso secundario, no afecta el CFHI."},
        {"order": 2, "text": "Masculino", "state": "MALE", "score": None,
         "secondaryUpdates": "CTX_SEX=MALE", "friction": None, "nextCandidates": "CTX-02",
         "notes": "Uso secundario, no afecta el CFHI."},
        {"order": 3, "text": "Prefiero no responder", "state": "DECLINED", "score": None,
         "secondaryUpdates": None, "friction": None, "nextCandidates": "CTX-02",
         "notes": "Uso secundario, no afecta el CFHI."}
    ]
}

# ---- 3. Nueva pregunta: situación laboral (categorías tipo Banco Central) ----
employment_states = [
    ("Empleado(a) sector privado", "PRIVATE_EMPLOYEE"),
    ("Empleado(a) sector público", "PUBLIC_EMPLOYEE"),
    ("Trabajador(a) independiente / por cuenta propia", "SELF_EMPLOYED"),
    ("Empleador(a) / dueño de negocio", "EMPLOYER"),
    ("Desempleado(a)", "UNEMPLOYED"),
    ("Estudiante", "STUDENT"),
    ("Jubilado(a) / pensionado(a)", "RETIRED"),
    ("Labores del hogar (no remunerado)", "HOMEMAKER"),
    ("Prefiero no responder", "DECLINED"),
]
ctx_employment = {
    "id": "CTX-09",
    "dimension": "CONTEXTO",
    "construct": "CTX_SEGMENTATION",
    "variable": "CTX_EMPLOYMENT_STATUS",
    "primaryOwnerConstruct": "CTX_SEGMENTATION",
    "textUX": "¿Cuál es tu situación laboral actual?",
    "whyAsk": "Aporta contexto de segmentación para análisis y comparación, sin afectar el CFHI.",
    "role": "CONTEXT",
    "anchor": False,
    "askIfRaw": "FINANCIAL_DIAGNOSTIC_COMPLETE AND RESULT_NOT_SHOWN AND user has not skipped optional context block",
    "skipIfRaw": "CTX_EMPLOYMENT_STATUS known OR user declines context questions",
    "basePriority": 50,
    "informationValue": 0.5,
    "scoringValue": 0.0,
    "routingValue": 0.2,
    "safetyValue": 0.0,
    "rootCauseValue": 0.2,
    "uncertaintyReduction": 0.25,
    "burden": 1,
    "inferenceSubstitutionAllowed": True,
    "minConfidenceToSkip": 100,
    "frictionTarget": None,
    "aiRegenerationAllowed": False,
    "coreLogicEditable": True,
    "status": "ACTIVA",
    "version": "4.2",
    "benchmarkSource": "Caudall · segmentación contextual (categorías tipo Banco Central / ENCFT)",
    "methodologicalFunction": "CONTEXT_SEGMENTATION",
    "behavioralConstruct": None,
    "options": [
        {"order": i + 1, "text": text, "state": state, "score": None,
         "secondaryUpdates": f"CTX_EMPLOYMENT_STATUS={state}" if state != "DECLINED" else None,
         "friction": None, "nextCandidates": "CTX-06", "notes": "Uso secundario, no afecta el CFHI."}
        for i, (text, state) in enumerate(employment_states)
    ]
}

questions.append(ctx_sex)
questions.append(ctx_employment)

# ---- 4. Reencadenar nextCandidates para reflejar el orden real ----
# CTX-01 (edad) -> CTX-08 (sexo) -> CTX-02 (dependientes) -> CTX-04 (ingreso)
# -> CTX-09 (situación laboral) -> CTX-06 (educación) -> CTX-07 (opt-in)
chain = {
    "CTX-01": "CTX-08",
    "CTX-08": "CTX-02",
    "CTX-02": "CTX-04",
    "CTX-04": "CTX-09",
    "CTX-09": "CTX-06",
    "CTX-06": "CTX-07",
}
for qid, next_id in chain.items():
    q = by_id[qid] if qid in by_id else (ctx_sex if qid == "CTX-08" else ctx_employment)
    for o in q["options"]:
        o["nextCandidates"] = next_id

# ---- 5. Variables nuevas (CTX_SEX, CTX_EMPLOYMENT_STATUS) ----
variables.append({
    "code": "CTX_SEX",
    "dimension": "CONTEXTO",
    "construct": "CTX_SEGMENTATION",
    "rawType": "CONTEXT",
    "states": ["FEMALE", "MALE", "DECLINED"],
    "affectsCfhiNote": "NO_CFHI",
    "description": "Completada automáticamente desde las opciones de CTX-08."
})
variables.append({
    "code": "CTX_EMPLOYMENT_STATUS",
    "dimension": "CONTEXTO",
    "construct": "CTX_SEGMENTATION",
    "rawType": "CONTEXT",
    "states": [s for _, s in employment_states],
    "affectsCfhiNote": "NO_CFHI",
    "description": "Completada automáticamente desde las opciones de CTX-09."
})

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("OK — CTX-03 y CTX-05 pasaron a RESERVA; CTX-08 (sexo) y CTX-09 (situación laboral) agregadas y activas.")
