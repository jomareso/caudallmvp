PROYECTO: CAUDALL
PROMPT MAESTRO DE CONTINUIDAD
VERSIÓN DE REFERENCIA: CAUDALL v2.0

Estoy desarrollando Caudall, una plataforma de salud financiera B2B2C con cuestionario adaptativo, un índice de salud financiera (CFHI), motores de inferencia y decisión, economía conductual, aprendizaje y un panel administrativo altamente parametrizable.

IMPORTANTE:
Todo lo descrito a continuación YA FUE DISCUTIDO, DISEÑADO Y APROBADO durante la sesión de trabajo.

NO quiero que vuelvas a empezar la metodología.
NO quiero que vuelvas a diseñar el banco de preguntas desde cero.
NO quiero un mockup conceptual desconectado del producto real.
NO simplifiques la arquitectura.
NO elimines funcionalidades existentes.
NO sustituyas silenciosamente decisiones ya aprobadas.
NO declares algo terminado si solo existe en UI y todavía no modifica realmente el motor.

Tu tarea es tomar el proyecto actual de Caudall, inspeccionarlo cuidadosamente y CONTINUAR desde el estado real del proyecto, incorporando esta arquitectura completa especialmente en el Panel Administrativo y conectándola con el cuestionario/motor real.

==================================================
1. PRINCIPIO CENTRAL DE CAUDALL
==================================================

Caudall NO debe funcionar como:

cuestionario → suma de respuestas → score → recomendación genérica

Debe funcionar como:

EVIDENCIA → VARIABLES → CONSTRUCTOS → FINANCIAL STATE → CONFIDENCE / CONSISTENCY → CFHI → SAFETY → ROOT CAUSE → PRIORITY → ELIGIBILITY → FINANCIAL READINESS → BEHAVIORAL READINESS → NEXT BEST ACTION → BEHAVIORAL DESIGN → COMMITMENT → OUTCOME → LEARNING → NUEVO ESTADO

La unidad fundamental del sistema NO es la pregunta.
La unidad fundamental es la VARIABLE.
Las preguntas son instrumentos para obtener evidencia sobre variables.

==================================================
2. CUATRO CAPAS MAESTRAS
==================================================

A. DIAGNÓSTICO
- Evidence
- Variables
- Constructs
- Financial State
- CFHI
- Confidence
- Consistency

B. DECISIÓN
- Safety
- Root Cause
- Priority
- Eligibility

C. INTERVENCIÓN
- Financial Readiness
- Behavioral Readiness
- Next Best Action
- Behavioral Technique
- Commitment

D. APRENDIZAJE
- Outcome
- Feedback
- Learning

==================================================
3. LAS CINCO DIMENSIONES DEL CFHI
==================================================

1. CONTROL
Pregunta central: ¿Manejo sosteniblemente mis finanzas cotidianas?

2. RESILIENCIA
Pregunta central: ¿Puedo absorber un shock financiero?

3. DEUDA
Pregunta central: ¿Mis obligaciones son sostenibles?

4. AHORRO
Pregunta central: ¿Acumulo recursos de forma sostenible?

5. PLANIFICACIÓN
Pregunta central: ¿Convierto mis objetivos en acciones?

Contexto, Behavioral y Readiness NO constituyen una sexta dimensión del CFHI.

Pesos globales iniciales:
Control 20%
Resiliencia 20%
Deuda 20%
Ahorro 20%
Planificación 20%

IMPORTANTE: estos pesos son PROVISIONALES y PARAMETRIZABLES. No deben presentarse como científicamente validados todavía.

==================================================
4. DEFINICIONES METODOLÓGICAS
==================================================

CONTROL FINANCIERO
Capacidad de la persona para mantener sus gastos y compromisos dentro de los recursos disponibles, comprender su flujo financiero y conservar margen suficiente para tomar decisiones sin depender recurrentemente de deuda o reservas.

Constructos: margen financiero, cumplimiento, estabilidad del flujo, visibilidad, capacidad de ajuste, uso del margen, causa del desequilibrio.

RESILIENCIA FINANCIERA
Capacidad de absorber imprevistos o interrupciones temporales de ingresos sin comprometer necesidades esenciales, deteriorar significativamente objetivos financieros o recurrir a deuda problemática.

Constructos: cobertura de reserva, capacidad ante imprevistos, liquidez/accesibilidad, estabilidad de reserva, vulnerabilidad del ingreso, protecciones complementarias, dependencia externa.

DEUDA
Capacidad de mantener las obligaciones financieras en un nivel sostenible, cumplirlas oportunamente y utilizarlas sin comprometer necesidades presentes, capacidad de ahorro, resiliencia u objetivos.

Constructos: aplicabilidad, capacidad de pago, presión, atrasos, rollover, dependencia de nueva deuda, costo, estructura, trayectoria y driver.

AHORRO
Capacidad y comportamiento de acumular recursos de manera recurrente y sostenible para fortalecer la posición financiera y financiar necesidades u objetivos futuros.

Constructos: frecuencia, capacidad, consistencia, intensidad, sistematicidad, intencionalidad, persistencia y barreras.

PLANIFICACIÓN
Capacidad de transformar aspiraciones financieras en objetivos suficientemente definidos, acciones viables y mecanismos de seguimiento que permitan avanzar y ajustar el rumbo.

Constructos: existencia de objetivos, prioridad, especificidad, cuantificación, horizonte, plan de acción, ejecución, seguimiento, progreso y ajuste.

==================================================
5. CONSTRUCT AGGREGATION LAYER
==================================================

El scoring NO suma preguntas directamente.
Debe seguir:
Respuesta → Evidence → Variable → Constructo → Dimensión → CFHI

Constructos iniciales:

CONTROL
CTRL_MARGIN 45%
CTRL_COMPLIANCE 35%
CTRL_STABILITY 20%

RESILIENCIA
RES_COVERAGE_CONSTRUCT 45%
RES_SHOCK_CONSTRUCT 35%
RES_EFFECTIVENESS 20%

DEUDA
DEBT_PAYMENT_CONSTRUCT 45%
DEBT_PRESSURE_CONSTRUCT 35%
DEBT_STRESS_CONSTRUCT 20%

AHORRO
SAV_FREQUENCY_CONSTRUCT 40%
SAV_CONSISTENCY_CONSTRUCT 35%
SAV_SUSTAINABILITY 25%

PLANIFICACIÓN
PLAN_DIRECTION 20%
PLAN_DEFINITION 20%
PLAN_ACTION_CONSTRUCT 25%
PLAN_EXECUTION_CONSTRUCT 25%
PLAN_MONITORING 10%

Todos los pesos internos deben quedar parametrizables.

==================================================
6. PRIMARY OWNER
==================================================

Toda evidencia que afecte scoring debe tener un PRIMARY OWNER.
Una misma evidencia puede informar otras dimensiones, pero NO puede penalizar varias veces el CFHI.

Ejemplo:
DEBT_ARREARS → PRIMARY OWNER = DEBT_STRESS
Puede informar CTRL_PAYMENT_STRESS y FINANCIAL_STRESS, pero esos efectos secundarios NO vuelven a penalizar independientemente el CFHI.

==================================================
7. EVIDENCE LAYER
==================================================

Cada respuesta o dato debe crear un Evidence Object con, como mínimo:
EVIDENCE_ID
SOURCE
QUESTION_ID si aplica
ANSWER_ID si aplica
VALUE
TIMESTAMP
PERIOD
RELIABILITY / PROVENANCE

Ejemplo:
SOURCE = QUESTION
QUESTION_ID = CTRL-01
VALUE = EXPENSES_GT_INCOME
RELIABILITY = DIRECT

Luego: Evidence → CTRL_CASHFLOW = NEGATIVE

Necesitamos trazabilidad completa. El Admin debe poder explicar POR QUÉ Caudall cree algo.

==================================================
8. PROVENANCE DE INFERENCIAS
==================================================

Formalizar:
DIRECT
STRONG_INFERENCE
WEAK_INFERENCE

Cada valor almacena VALUE + SOURCE + CONFIDENCE.

Regla inicial: una STRONG_INFERENCE puede sustituir una pregunta cuando confidence >= threshold.
Threshold inicial global: 80%, parametrizable.

Una WEAK_INFERENCE puede afectar routing o valor informativo, pero NO sustituye una pregunta.

==================================================
9. INFERENCIAS PROHIBIDAS
==================================================

Debe existir FORBIDDEN_INFERENCE.

Ejemplos:
RES_COVERAGE = STRONG NO permite inferir SAV_FREQUENCY = REGULAR.
RES_DEPENDENCY = CREDIT NO permite inferir DEBT_APPLICABILITY = YES.

El Admin debe permitir visualizar estas relaciones prohibidas.

==================================================
10. VARIABLES MAESTRAS — CONTROL
==================================================

CTRL_CASHFLOW
CTRL_PAYMENT
CTRL_STABILITY
CTRL_VISIBILITY
CTRL_ADJUSTMENT
CTRL_MARGIN_USE
CTRL_DRIVER
CTRL_DEPENDENCY
CTRL_STATE
CTRL_CONFIDENCE

Estados relevantes:
CTRL_CASHFLOW = HIGH / POSITIVE / EVEN / NEGATIVE / CRITICAL
CTRL_PAYMENT = ALWAYS / OFTEN / SOMETIMES / RARELY / NEVER
CTRL_STABILITY = STABLE / MOSTLY_STABLE / VARIABLE / HIGHLY_VARIABLE
CTRL_VISIBILITY = CLEAR / PARTIAL / LOW / UNKNOWN
CTRL_ADJUSTMENT = HIGH / MODERATE / LOW / NONE
CTRL_MARGIN_USE = PLANNED / MIXED / SPENT / UNCLEAR
CTRL_DRIVER = INCOME_GAP / SPENDING / DEBT_LOAD / VARIABLE_INCOME / ONE_OFF_EVENT / DEPENDENT_SUPPORT / UNKNOWN
CTRL_DEPENDENCY = CREDIT / SAVINGS_DRAWDOWN / FAMILY_SUPPORT / PAYMENT_DEFERRAL / NONE
CTRL_STATE = MET / PARTIAL / UNMET / CRITICAL

Score de Control ≠ Confidence de Control.

==================================================
11. VARIABLES MAESTRAS — RESILIENCIA
==================================================

RES_COVERAGE
RES_SHOCK_CAPACITY
RES_LIQUIDITY
RES_STABILITY
RES_INCOME_VULNERABILITY
RES_PROTECTION
RES_DEPENDENCY
RES_DRIVER
RES_STATE
RES_CONFIDENCE

Estados:
RES_COVERAGE = VERY_LOW / LOW / PARTIAL / GOOD / STRONG
RES_SHOCK_CAPACITY = FULL / MOSTLY / PARTIAL / DEBT_REQUIRED / UNABLE
RES_LIQUIDITY = FULLY_LIQUID / MOSTLY_LIQUID / PARTIALLY_LIQUID / RESTRICTED / UNKNOWN
RES_STABILITY = STABLE / OCCASIONAL_USE / RECURRENT_USE / DEPLETING
RES_INCOME_VULNERABILITY = LOW / MODERATE / HIGH / VERY_HIGH
RES_DEPENDENCY = NONE / CREDIT / NEW_DEBT / FAMILY_SUPPORT / DEFER_PAYMENTS / SELL_ASSETS / UNKNOWN
RES_DRIVER = LOW_SAVING_CAPACITY / RECENT_SHOCK / CASHFLOW_DEFICIT / RESERVE_DRAWDOWN / DEBT_BURDEN / INCOME_VOLATILITY / LOW_SAVING_HABIT / EARLY_BUILDING_STAGE / UNKNOWN
RES_STATE = MET / PARTIAL / UNMET / CRITICAL

Regla central: RESILIENCIA ≠ AHORRO.
Stock/cobertura acumulada pertenece a Resiliencia. Flujo/hábito de ahorro pertenece a Ahorro.

==================================================
12. VARIABLES MAESTRAS — DEUDA
==================================================

DEBT_APPLICABILITY
DEBT_PAYMENT_CAPACITY
DEBT_PRESSURE
DEBT_ARREARS
DEBT_ROLLOVER
DEBT_ESSENTIAL_DEPENDENCY
DEBT_COST_AWARENESS
DEBT_STRUCTURE
DEBT_TRAJECTORY
DEBT_DRIVER
DEBT_STATE
DEBT_CONFIDENCE

DEBT_APPLICABILITY = NONE / APPLICABLE / UNKNOWN

Si DEBT_APPLICABILITY = NONE:
DEBT_STATE = N/A
DEBT_CONFIDENCE ≈ 100%
STOP de toda la rama.

NO preguntar capacidad de pago, presión, atrasos, rollover, tasas, estructura, trayectoria, dificultad o preocupación de deuda.
NO ofrecer salir de deudas, refinanciar, consolidar o priorizar deuda.

Debt N/A NO equivale a Debt score = 100.
Debe excluirse del denominador del CFHI y redistribuir proporcionalmente pesos entre dimensiones aplicables.

DEBT_PAYMENT_CAPACITY = COMFORTABLE / MANAGEABLE / TIGHT / DIFFICULT / UNMANAGEABLE
DEBT_PRESSURE = NONE / LOW / MODERATE / HIGH / SEVERE
DEBT_ARREARS = NONE / ONE_TIME / RECURRENT / CURRENT
DEBT_ROLLOVER = NONE / ONE_TIME / OCCASIONAL / RECURRENT
DEBT_ESSENTIAL_DEPENDENCY = NONE / OCCASIONAL / RECURRENT
DEBT_TRAJECTORY = DECREASING / STABLE / INCREASING_PLANNED / INCREASING_UNPLANNED / UNKNOWN
DEBT_DRIVER = PAYMENT_BURDEN / HIGH_COST / INCOME_GAP / INCOME_SHOCK / OVERSPENDING / EMERGENCY / ROLLOVER_CYCLE / MULTIPLE_OBLIGATIONS / ONE_OFF_EVENT / UNKNOWN
DEBT_STATE = N/A / MET / PARTIAL / UNMET / CRITICAL

DEBT_STRESS consolida DEBT_ARREARS + DEBT_ROLLOVER + DEBT_TRAJECTORY. No sumarlos mecánicamente como castigos independientes.

==================================================
13. VARIABLES MAESTRAS — AHORRO
==================================================

SAV_FREQUENCY
SAV_CONSISTENCY
SAV_CAPACITY
SAV_INTENSITY
SAV_SYSTEM
SAV_PURPOSE
SAV_PERSISTENCE
SAV_BARRIER
SAV_STAGE
SAV_STATE
SAV_CONFIDENCE

SAV_FREQUENCY = NEVER / RARELY / SOMETIMES / MOST_MONTHS / EVERY_MONTH
SAV_CAPACITY = NONE / CONSTRAINED / LIMITED / AVAILABLE / STRONG / UNKNOWN
SAV_CONSISTENCY = STABLE / MOSTLY_STABLE / INTERRUPTED / IRREGULAR / NONE
SAV_SYSTEM = AUTOMATED / PLANNED_MANUAL / AD_HOC / NONE
SAV_PURPOSE = EMERGENCY / SPECIFIC_GOAL / GENERAL_FUTURE / MULTIPLE / NO_DEFINED_PURPOSE
SAV_PERSISTENCE = MAINTAINED / REDUCED / PAUSED / REVERSED
SAV_BARRIER = INCOME_INSUFFICIENT / INCOME_VARIABLE / UNEXPECTED_EXPENSES / SPENDING / NO_SYSTEM / NO_PRIORITY / NO_GOAL / DEBT_PRESSURE / BEHAVIORAL_FRICTION / OTHER / UNKNOWN
SAV_STAGE = CONSTRAINED / NOT_STARTED / INTENDING / STARTED / REPEATING / SYSTEMATIC / MAINTAINING
SAV_STATE = MET / PARTIAL / UNMET / CONSTRAINED

AUTOMATED ≠ automáticamente mejor score.
NO PUEDE AHORRAR ≠ PUEDE AHORRAR PERO NO LO HACE.
Constraint vs Behavior debe ser una distinción formal.

==================================================
14. VARIABLES MAESTRAS — PLANIFICACIÓN
==================================================

PLAN_GOAL_EXISTENCE
PLAN_GOAL_PRIORITY
PLAN_SPECIFICITY
PLAN_AMOUNT
PLAN_HORIZON
PLAN_ACTION
PLAN_EXECUTION
PLAN_PROGRESS
PLAN_TRACKING
PLAN_ADJUSTMENT
PLAN_STAGE
PLAN_STATE
PLAN_CONFIDENCE

PLAN_STAGE = NO_DIRECTION / ASPIRATION / GOAL_DEFINED / PLAN_DEFINED / READY_TO_ACT / STARTED / REPEATING / TRACKING / MAINTAINING

REGLA OBLIGATORIA:
Si PLAN_EXECUTION indica que la persona YA comenzó, NO mostrar preguntas como “¿Qué te impide comenzar?”.
Si no existe objetivo, NO preguntar monto, fecha, aportes, seguimiento o progreso hasta que corresponda.

Mantener separados:
USER_GOAL
SYSTEM_PRIORITY
ACTION_ELIGIBILITY

Ejemplo:
USER_GOAL = HOME
SYSTEM_PRIORITY = DEBT
HOME_ELIGIBILITY_NOW = LOW

No borrar el objetivo; conservar aspiración y ajustar secuencia.

==================================================
15. FINANCIAL STATE MODEL
==================================================

Cada usuario debe terminar representado por un estado vivo:

CONTROL: score / state / confidence / driver
RESILIENCE: score / state / confidence / driver
DEBT: applicability / score si aplica / state / confidence / driver
SAVING: score / state / confidence / stage / barrier
PLANNING: score / state / confidence / stage
USER_GOAL
SYSTEM_PRIORITY
ROOT_CAUSE
SAFETY_FLAGS
ELIGIBILITY
FIN_READINESS
BEH_READINESS

Objetivo, prioridad y causa raíz son cosas diferentes.

==================================================
16. CONTEXTO
==================================================

Contexto NO entra directamente al CFHI.

CTX_INCOME_PATTERN
CTX_PAY_FREQUENCY
CTX_DEPENDENTS
CTX_EMPLOYMENT_STABILITY
CTX_UPCOMING_EVENT
CTX_DATA_SOURCE
CTX_LIFE_STAGE

Ingresos variables + ahorro irregular NO significa automáticamente mala conducta de ahorro. Puede significar SAV_BARRIER = INCOME_VARIABLE.

==================================================
17. VARIABLES CONDUCTUALES
==================================================

BEH_FINANCIAL_STRESS
BEH_SELF_EFFICACY
BEH_INTENTION
BEH_FRICTION
CAPACITY_PERCEIVED
BEH_TRIGGER
BEH_COMMITMENT
BEH_FEEDBACK

BEH_FRICTION puede contener:
COMPLEXITY
TOO_MANY_CHOICES
FORGETTING
PROCRASTINATION
UNCERTAINTY
LOW_PRIORITY
EMOTIONAL_AVOIDANCE
LACK_OF_SYSTEM
NO_CLEAR_TRIGGER
NONE
UNKNOWN

==================================================
18. FINANCIAL READINESS VS BEHAVIORAL READINESS
==================================================

NO mezclarlas.

FINANCIAL READINESS considera FIN_CAPACITY, SAFETY_CLEARANCE, ACTION_ELIGIBILITY y RESOURCE_AVAILABILITY.
Estados: NOT_ELIGIBLE / CONSTRAINED / ELIGIBLE / STRONG

BEHAVIORAL READINESS considera SELF_EFFICACY, INTENTION, FRICTION, BEHAVIOR_STAGE y PERCEIVED_CAPACITY.
Estados: LOW / MODERATE / HIGH

FIN_READINESS + BEH_READINESS → ACTION DESIGN

ELIGIBILITY = ¿Conviene hacer esta acción?
READINESS = ¿Está preparado para hacerla ahora?

==================================================
19. SAFETY ENGINE
==================================================

Safety es independiente del score.

DEBT_ARREARS = CURRENT → DEBT_PAYMENT_STRESS
DEBT_ROLLOVER = RECURRENT → DEBT_CYCLE_RISK
DEBT_ESSENTIAL_DEPENDENCY = RECURRENT → CASHFLOW_CREDIT_DEPENDENCY
DEBT_STATE = CRITICAL → CRITICAL_DEBT

Safety puede bloquear temporalmente INVEST, ACCELERATE_SECONDARY_GOAL, AGGRESSIVE_SAVING, NEW_FINANCIAL_COMMITMENT.
Puede hacer override temporal sobre Priority.
Safety NO modifica necesariamente el score.

==================================================
20. CONSISTENCY RESOLUTION ENGINE
==================================================

A. USER CONTRADICTION
“No tengo deuda” + “Tengo pagos de deuda vencidos” → CLARIFY

B. APPARENT ANOMALY
Reserva 6+ meses + no puede cubrir imprevisto → investigar liquidez/accesibilidad.

C. ENGINE QA ERROR
DEBT_APPLICABILITY = NONE + el sistema pregunta tasa de deuda → NO preguntar al usuario; registrar QA FAILURE.

==================================================
21. CONFIDENCE ENGINE
==================================================

Score ≠ Confidence.
Cada variable, constructo y dimensión puede tener confidence.
Initial skip threshold = 80%, parametrizable.

==================================================
22. NEXT BEST QUESTION ENGINE
==================================================

El banco adaptativo de preguntas YA EXISTE y YA FUE TRABAJADO/AUDITADO.
NO LO REHAGAS DESDE CERO.

Principio central:
Caudall pregunta únicamente aquello que puede mejorar materialmente la siguiente decisión.

Cada pregunta debe tener:
QUESTION_ID
DIMENSION
VARIABLE_TARGET
CONSTRUCT_TARGET
ASK_IF
SKIP_IF / DO_NOT_ASK_IF
BASE_PRIORITY
INFORMATION_VALUE
SAFETY_VALUE
SCORING_VALUE
ROUTING_VALUE
UNCERTAINTY_REDUCTION
BURDEN
INFERENCE_SUBSTITUTION_ALLOWED
MIN_CONFIDENCE_TO_SKIP
VERSION
STATUS

Conceptualmente:
NBQ = Information Value + Decision Impact + Uncertainty Reduction - Redundancy - User Burden

==================================================
23. BANCO ADAPTATIVO
==================================================

Debe ser amplio y personalizado. No construir árboles rígidos; construir un grafo.
Referencia de Ahorro:

¿Ahorra regularmente?
→ NO: ¿hay capacidad? → no hay margen / sí hay margen → control / hábito
→ A VECES: ¿qué rompe la constancia? → ingreso variable / gastos / imprevistos
→ SÍ: ¿cómo está estructurado? → objetivo definido / sistemático / madurez

Una pregunta puede informar más de una dimensión.

==================================================
24. STOP ENGINE
==================================================

STOP cuando:
- dimension confidence suficiente;
- no unresolved safety condition;
- no high-value unanswered question;
- no inconsistencia crítica pendiente.

Target 8–12 preguntas
Soft max 15
Hard max 18
Parametrizable globalmente y por cliente.

==================================================
25. ROOT CAUSE ENGINE
==================================================

No seleccionar simplemente la dimensión con score más bajo.
Ejemplo: Income gap → Cashflow deficit → No saving → Low reserve.
Aunque Ahorro tenga score menor, Root Cause puede ser Control.

Formalizar SOURCE_VARIABLE / TARGET_VARIABLE / RELATION / STRENGTH / CONDITIONS / CONFIDENCE.
Cada estado puede declarar DRIVER_OF y CAUSED_BY.

==================================================
26. PRIORITY ENGINE
==================================================

Orden conceptual:
1. Safety
2. Root Cause
3. Severity
4. Dependency
5. User Goal
6. Actionability

Root Cause ≠ Priority necesariamente.
Safety puede hacer override temporal.
No congelar todavía coeficientes matemáticos definitivos.

==================================================
27. ELIGIBILITY ENGINE
==================================================

Separar USER_GOAL / SYSTEM_PRIORITY / ACTION_ELIGIBILITY.
Nunca borrar una aspiración solo porque no sea accionable ahora.

==================================================
28. ECONOMÍA CONDUCTUAL
==================================================

Principio: FRICTION → TECHNIQUE, nunca al revés.

PROCRASTINATION → Implementation intention
FORGETTING → Stable trigger / reminder
TOO_MANY_CHOICES → Choice reduction
COMPLEXITY → Microaction
LOW_SELF_EFFICACY → Small wins
REPEATING_BEHAVIOR → Habit formation
DISTANT_GOAL → Goal gradient
NO_CLEAR_MOMENT → Trigger
HIGH_INTENTION_NO_EXECUTION → Commitment
WEAK_TRACKING → Feedback
FRESH_START_OPPORTUNITY → Fresh start
NO_SYSTEM → Default / automation

Técnicas exploradas: implementation intentions, commitment devices, defaults, choice architecture, choice reduction, salience, reminders, stable triggers, habit formation, feedback, goal gradient, fresh start effect, mental accounting, present bias, loss aversion, friction costs, small wins, microactions, simplification, precommitment, automation.

==================================================
29. ACTION DIFFICULTY
==================================================

MICRO / STANDARD / ACCELERATED
Si una acción es demasiado difícil, NO cambiar arbitrariamente la prioridad.

==================================================
30. COMMITMENT
==================================================

ACTION
AMOUNT
FREQUENCY
TRIGGER
DATE si aplica
DURATION
TARGET_VARIABLE
TARGET_DIMENSION
BEHAVIORAL_TECHNIQUE
STATUS

Un solo trigger principal por compromiso.

==================================================
31. FEEDBACK Y LEARNING ENGINE
==================================================

COMPLETED / PARTIALLY_COMPLETED / NOT_COMPLETED / SKIPPED / UNKNOWN
Capturar WHY.
Ejemplo: NOT_COMPLETED + TOO_DIFFICULT puede reducir preferred_action_size y actualizar self_efficacy/friction probability.

Ciclo: Diagnóstico → Acción → Compromiso → Conducta observada → Aprendizaje → Nuevo estado → Next Best Action.

==================================================
32. PRINCIPIOS METODOLÓGICOS CORE APROBADOS
==================================================

1. No hacer preguntas cuya respuesta ya se conozca o pueda inferirse con suficiente confianza.
2. No mostrar opciones incompatibles con la realidad financiera del usuario.
3. No confundir objetivo del usuario con prioridad del sistema.
4. No confundir score con decisión.
5. No confundir ahorro con resiliencia.
6. No confundir tener deuda con tener mala salud de deuda.
7. No convertir Deuda N/A en score 100.
8. No penalizar dos veces una misma evidencia.
9. No interpretar un síntoma downstream como causa raíz automáticamente.
10. No preguntar por barreras para comenzar cuando el usuario ya comenzó.
11. No asumir que una reserva acumulada implica hábito actual de ahorro.
12. No asumir que ingresos variables significan mala conducta.
13. No exigir más precisión de la necesaria para tomar una decisión útil.
14. Safety puede modificar temporalmente prioridad/elegibilidad sin modificar necesariamente el score.
15. Una inferencia fuerte puede sustituir una pregunta; una débil solo orienta routing.
16. Las preguntas puntúan a través de constructos, nunca por simple suma.
17. Financial Readiness y Behavioral Readiness son diferentes.
18. La dificultad de la acción puede cambiar sin cambiar la prioridad.
19. La economía conductual debe resolver una fricción identificada.
20. El Learning Engine aprende de conducta observada.
21. Si no tiene deuda, cerrar inmediatamente toda rama de deuda.
22. Si ya tiene reserva suficiente, no ofrecer “crear una reserva”.
23. Si ya inició un plan, no preguntar “qué te impide comenzar”.
24. Si gastos > ingresos y existen señales críticas, opciones como invertir pueden quedar excluidas temporalmente.
25. Las opciones mostradas al usuario deben reducirse conforme a su realidad.

==================================================
33. REFERENCIAS METODOLÓGICAS EXPLORADAS
==================================================

FINANCIAL HEALTH / FINANCIAL WELL-BEING
- manejar el presente;
- absorber shocks;
- avanzar hacia objetivos;
- mantener opciones futuras;
- bienestar financiero percibido;
- seguridad/control financiero;
- separación entre indicadores objetivos y subjetivos.

FINANCIAL CAPABILITY
- administrar ingresos/gastos;
- ahorro;
- deuda;
- planificación;
- resiliencia;
- ejecución de decisiones.

BEHAVIORAL ECONOMICS / BEHAVIORAL SCIENCE
- implementation intentions;
- commitment;
- defaults;
- choice architecture;
- choice reduction;
- salience;
- reminders;
- stable triggers;
- habit formation;
- feedback;
- goal gradient;
- fresh start;
- mental accounting;
- present bias;
- loss aversion;
- friction costs;
- small wins;
- microactions;
- simplification;
- precommitment;
- automation.

STAGES / READINESS / BEHAVIOR CHANGE
- entender;
- planificar;
- comenzar;
- repetir;
- ejecutar;
- dar seguimiento;
- mantener.
Caudall lo formaliza mediante PLAN_STAGE, SAV_STAGE, FIN_READINESS, BEH_READINESS. No aplicar mecánicamente un framework externo de etapas.

ADAPTIVE ASSESSMENT
- banco amplio de preguntas;
- preguntas ancla;
- branching dinámico;
- conditional routing;
- information value;
- uncertainty reduction;
- confidence;
- inference;
- stop conditions;
- reducción de redundancia;
- personalización del cuestionario.

PSYCHOMETRICS / SCORING
En fase posterior validar confiabilidad, consistencia interna, discriminación de ítems, estabilidad de constructos, pesos, bandas, correlación con outcomes, validez convergente/discriminante y desempeño adaptativo.
Por eso: pesos actuales = PROVISIONAL; thresholds = parametrizables; Admin compara Draft vs Published; Analytics mide information value; no afirmar todavía que CFHI está psicométricamente validado.

ROOT CAUSE / SYSTEMS THINKING
No tratar síntomas de forma aislada.

HUMAN-CENTERED / LOW-FRICTION UX
- lenguaje claro;
- evitar jerga;
- reducir carga cognitiva;
- pocas opciones relevantes;
- progressive disclosure;
- acciones pequeñas cuando confidence/capacity es baja;
- no mostrar metodología técnica al usuario;
- “¿Por qué este paso?” sencillo;
- trazabilidad técnica solo en Admin/Audit.

Estas referencias son sustento/benchmark, NO sustituyen la arquitectura Caudall v2.0.

==================================================
34. MULTI-TENANT B2B2C
==================================================

PLATFORM DEFAULT → CLIENT CONFIGURATION → SEGMENT CONFIGURATION → USER STATE

🔒 CORE: Primary Owner, anti-double-counting, provenance, safety crítica, consistency crítica, reglas N/A, protección del motor.
⚙️ PARAMETRIZABLE: pesos permitidos, thresholds, número objetivo de preguntas, catálogo de objetivos, intervenciones habilitadas, copy, segmentación.
🎨 BRAND: logo, colores, tipografía, claim, imágenes, tono.

==================================================
35. BRANDING
==================================================

El logo visible al usuario debe ser el logo cargado en Admin para ese cliente.
El background debe poder adaptarse al fondo/colores del logo, con override manual.
Admin: logo principal, logo alternativo/negativo, claim, colores, fondos, tipografía, imágenes, textos, co-branding.

==================================================
36. VERSIONADO
==================================================

Versiones separadas: Methodology, Question Bank, Scoring, Behavioral Rules, Client Config.
Cada evaluación guarda METHODOLOGY_VERSION_USED.
Nada se modifica directamente en producción.
Flujo: PUBLISHED → CREATE DRAFT → EDIT → SIMULATE → VALIDATE → COMPARE → PUBLISH.
Debe existir rollback.

==================================================
37. ARQUITECTURA DEL PANEL ADMINISTRATIVO
==================================================

1. INICIO
- Estado plataforma
- Clientes activos
- Evaluaciones
- Alertas
- Versión publicada
- Estado del motor
- QA

2. METODOLOGÍA
- Dimensiones
- Constructos
- Variables
- Scoring
- Dependencias / Grafo causal
- Versiones

3. MOTOR ADAPTATIVO
- Banco de preguntas existente
- Routing / árboles
- Inferencias
- Confidence
- Consistency
- Stop Rules

4. MOTOR DE DECISIÓN
- Safety Gates
- Root Cause
- Priority
- Eligibility
- Financial Readiness

5. ECONOMÍA CONDUCTUAL
- Behavioral Readiness
- Fricciones
- Técnicas
- Intervenciones
- Compromisos
- Learning

6. CLIENTES B2B2C
- Organizaciones
- Branding
- Segmentos
- Goals
- Productos / soluciones
- Overrides

7. SIMULADOR & QA
- Crear persona
- Ejecutar journey
- Ver preguntas mostradas
- Ver preguntas omitidas
- Ver por qué se omitieron
- Ver inferencias
- Ver variables
- Ver confidence
- Explicar score
- Explicar recomendación
- Ver safety
- Ver root cause
- Ver priority
- Ver eligibility
- Ver readiness
- Ver técnica conductual
- Ver commitment
- Contradicciones
- QA errors

8. ANALYTICS
- CFHI
- Dimensiones
- Funnel
- Preguntas
- Intervenciones
- Completion
- Outcomes
- Information value
- Drop-off
- Tiempo por pregunta
- Journey length

9. SISTEMA
- Usuarios
- Roles
- Audit log
- Versiones
- Draft / Published
- Configuración global

==================================================
38. BARRA GLOBAL DEL ADMIN
==================================================

Caudall Core v2.0 | Cliente [Global ▼] | Segmento [Todos ▼] | Estado [Draft / Published] | [Simular] | [Publicar]

==================================================
39. ADMIN → INICIO
==================================================

Portada ejecutiva con clientes activos, usuarios evaluados, CFHI promedio, acciones completadas, preguntas activas, intervenciones activas, reglas activas y estado del motor/QA.

==================================================
40. ADMIN → METODOLOGÍA
==================================================

Mostrar 5 dimensiones, ~15 constructos, 50+ variables, versión publicada, scoring válido, variables huérfanas, conflictos CORE, dependencias válidas.
Tabs: Dimensiones / Constructos / Variables / Scoring / Dependencias / Versiones.

==================================================
41. ADMIN → DIMENSIONES
==================================================

Tarjetas para CONTROL / RESILIENCIA / DEUDA / AHORRO / PLANIFICACIÓN.
Cada tarjeta: nombre, pregunta central, peso CFHI, constructos, variables, estado, Administrar.

==================================================
42. ADMIN → CONSTRUCTOS
==================================================

Cada constructo: definición, peso, variables/evidencias, Primary Owner, método de agregación, confidence, scoring rule.

==================================================
43. ADMIN → VARIABLES
==================================================

Filtros por dimensión, tipo, función y estado.
Funciones: Score / Diagnostic / Routing / Safety / Root Cause / Behavioral / Derived.
Cada variable: VARIABLE_ID, NAME, DIMENSION, CONSTRUCT, VARIABLE_TYPE, ALLOWED_VALUES, PRIMARY_OWNER, SCORING_ROLE, SOURCE_TYPES, INFERENCE_IN, INFERENCE_OUT, CONFIDENCE_RULE, ROUTING_RULE, SAFETY_ROLE, ROOT_CAUSE_ROLE, ELIGIBILITY_ROLE, BEHAVIORAL_ROLE, CONSISTENCY_RULES, VERSION, STATUS.

==================================================
44. VER IMPACTO
==================================================

Añadir donde sea razonable. Si hay datos, mostrar efecto de cambios en preguntas promedio, inferencias, confidence, clientes y segmentos. Si no hay datos, decir que no está disponible; no inventar.

==================================================
45. ADMIN → SCORING
==================================================

Mostrar pesos 20/20/20/20/20, total 100%, tratamiento N/A redistribuido, etiqueta “Pesos provisionales — pendientes de validación empírica”, simulador Draft vs Published.

==================================================
46. GRAFO CAUSAL
==================================================

Filtros: Causales / Inferencias / Prohibidas.
Relación: SOURCE / TARGET / RELATION / STRENGTH / INFERENCE TYPE / CONFIDENCE / CONDITIONS / CAN SUBSTITUTE QUESTION? / VERSION / STATUS.

==================================================
47. MOTOR ADAPTATIVO — ADMIN
==================================================

NO rediseñar el banco desde cero.
Permitir ver banco por dimensión, navegar árbol/grafo, editar pregunta/opciones/scoring owner/ASK_IF/SKIP_IF/inferencias/candidatas/stop condition/estado/versionar/simular.

==================================================
48. IMPACTO DE UNA RESPUESTA
==================================================

Ejemplo DEBT-01 → “No tengo deudas”:
DEBT_APPLICABILITY = NONE
DEBT_STATE = N/A
DEBT_CONFIDENCE = 100%
EXCLUDE preguntas de deuda
EXCLUDE intervenciones de deuda
CFHI aplica regla N/A

==================================================
49. SIMULADOR & EXPLAINABILITY
==================================================

Ver en tiempo real:
Pregunta → Respuesta → Evidence → Variable → Confidence → Inferencias → Constructo → Score → Financial State → Consistency → Safety → Root Cause → Priority → Eligibility → Financial Readiness → Behavioral Readiness → Intervention → Behavioral Technique → Commitment.
También preguntas omitidas y por qué.

==================================================
50. QA OBLIGATORIO
==================================================

PERSONA 1 — SIN DEUDA: Debt = N/A, no preguntas posteriores de deuda, no objetivo salir de deuda.
PERSONA 2 — DÉFICIT CRÍTICO: no inversión, no ahorro agresivo, prioridad upstream correcta.
PERSONA 3 — ALTA SALUD FINANCIERA: no preguntas innecesarias.
PERSONA 4 — RESPUESTAS CONTRADICTORIAS: Consistency / Clarification.
PERSONA 5 — INGRESOS VARIABLES: no tratar variabilidad automáticamente como mala conducta.
PERSONA 6 — YA INICIÓ PLAN: no preguntar qué le impide comenzar.
PERSONA 7 — RESERVA SUFICIENTE: no ofrecer crear reserva.
PERSONA 8 — AHORRO EXISTE PERO RESERVA BAJA: distinguir hábito de ahorro de resiliencia.

Si prueba crítica falla: BLOQUEAR PUBLICACIÓN.

==================================================
51. VALIDACIÓN ANTES DE PUBLICAR
==================================================

Verificar pesos = 100%, variables SCORE con constructo, evidencia scoring con Primary Owner, no double counting, no inferencias circulares, N/A consistente, Safety con consecuencias, no preguntas huérfanas, no ramas imposibles, Stop Rules alcanzables, no intervenciones inaccesibles, no violaciones CORE, dependencias válidas, versiones consistentes.

==================================================
52. VERSIONES Y GOBIERNO
==================================================

Ejemplo:
Methodology 2.0
Question Bank 2.0.4
Scoring 2.0.1
Behavioral Rules 2.1
Client Config BANCO_X_14

Flujo: PRODUCTION → CREATE DRAFT → EDIT → SIMULATE → VALIDATE → QA → APPROVE → PUBLISH. Debe existir rollback.

==================================================
53. USUARIOS Y ROLES
==================================================

PLATFORM OWNER: todo.
METHODOLOGIST: metodología, variables, constructos, scoring, preguntas, inferencias.
PRODUCT ADMIN: UX, contenido, clientes, intervenciones.
ANALYST: Analytics, simulador, QA.
CLIENT ADMIN: solo tenant autorizado.
VIEWER: solo lectura.

==================================================
54. ANALYTICS
==================================================

Diagnósticos iniciados/completados, completion rate, tiempo promedio, número promedio de preguntas, CFHI, scores por dimensión, drop-off por pregunta, tiempo de respuesta, information value, intervenciones, compromisos, acciones completadas, outcomes.
Por pregunta: veces mostrada, abandono después, tiempo medio, cambio de decisión, valor informativo, confidence gain.

==================================================
55. DATOS E INTEGRACIONES
==================================================

Preparar arquitectura futura para CRM, Payroll, core bancario, AFP, Open Banking, HRIS y APIs.
Si Caudall ya posee un dato confiable proveniente de integración, NO volver a preguntárselo al usuario.
Toda fuente guarda provenance/confidence.

==================================================
56. UX DEL USUARIO FINAL
==================================================

Toda la experiencia en español.
Metodología técnica NO se muestra al usuario.
Economía conductual opera detrás.
Pantalla de acción: qué hacer, cuánto si aplica, por qué, siguiente clic.
Mantener “¿Por qué este paso?” con explicación simple y personalizada.
No mostrar códigos técnicos, nombres internos de etapas, triggers internos, técnicas conductuales ni logs metodológicos.

==================================================
57. SCORE AL USUARIO
==================================================

El CFHI puede mantenerse internamente.
Admin permite mostrar score global: Sí / No / Por cliente.
Puede ser más útil mostrar estados por dimensión en vez de depender solo de un número.

==================================================
58. RESPONSIVE / IPHONE
==================================================

El proyecto ya ha tenido problemas importantes de navegación en iPhone 17.
NO romper correcciones existentes.
Probar Desktop, Surface/tablet, iPhone/Safari.
Especial atención a Comenzar, Panel administrativo, opciones, Continuar, sliders, selectors, scroll, sticky CTA, overlays, z-index, pointer-events, touch targets, safe-area, viewport, barra de progreso, cards, textos largos, inputs y admin tabs.
No crear contenedores estrechos artificialmente. Las preguntas deben usar el ancho útil del dispositivo.
La barra de progreso debe avanzar realmente con el journey adaptativo.
No asumir que abrir un HTML desde Archivos iOS equivale a probar una web real. La versión web debe funcionar por HTTPS en Safari.

==================================================
59. PRINCIPIOS DE IMPLEMENTACIÓN
==================================================

1. NO rehacer lo que ya funciona.
2. NO eliminar datos/configuración existente.
3. Migrar backward-compatible cuando sea posible.
4. Separar UI de lógica.
5. La configuración Admin debe gobernar realmente el motor.
6. Evitar hardcoding de reglas parametrizables.
7. Las reglas CORE pueden estar protegidas estructuralmente.
8. Toda decisión importante debe ser explicable.
9. Mantener versionado.
10. No publicar configuración inválida.
11. No confundir UI terminada con funcionalidad terminada.
12. Todo cambio debe respetar tenant + segment + version.
13. Probar móvil y desktop después de cambios estructurales.

==================================================
60. DEFINICIÓN DE TERMINADO
==================================================

Una funcionalidad está terminada SOLO cuando:
1. existe en UI cuando corresponde;
2. persiste correctamente;
3. afecta realmente al motor;
4. respeta tenant/segment/version;
5. puede auditarse;
6. pasa validaciones;
7. no rompe el journey;
8. funciona en desktop y móvil.

==================================================
61. ESTADO ACTUAL DEL TRABAJO
==================================================

Ya se trabajó previamente:
- metodología;
- cinco dimensiones;
- variables computables;
- constructos;
- banco adaptativo;
- branching;
- scoring preliminar;
- inferencias;
- confidence;
- consistency;
- safety;
- root cause;
- priority;
- eligibility;
- behavioral/readiness;
- auditoría metodológica;
- auditoría del banco;
- arquitectura del panel administrativo;
- B2B2C;
- mobile/responsive;
- versiones anteriores del MVP HTML.

NO regreses a rehacer esas etapas salvo contradicción concreta con el código real.

==================================================
62. FUENTE DE VERDAD
==================================================

ESPECIFICACIÓN MAESTRA CAUDALL v2.0
↓
METODOLOGÍA
↓
VARIABLES + CONSTRUCTOS
↓
BANCO ADAPTATIVO EXISTENTE
↓
MOTORES
↓
PANEL ADMINISTRATIVO
↓
EXPERIENCIA DE USUARIO

Si encuentras contradicción entre implementación y especificación:
1. no la resuelvas silenciosamente;
2. identifícala;
3. explica impacto;
4. propone migración;
5. preserva datos/configuración existente cuando sea posible.

==================================================
63. LO QUE QUIERO QUE HAGAS AHORA
==================================================

PRIMERO:
Inspecciona cuidadosamente el proyecto actual antes de modificar nada.

Identifica:
- stack;
- arquitectura;
- modelos de datos;
- componentes del Admin;
- banco de preguntas actual;
- scoring actual;
- routing actual;
- persistencia;
- autenticación/roles;
- multi-tenant si existe;
- versionado;
- experiencia móvil;
- qué elementos de esta especificación ya están implementados;
- qué elementos están parcialmente implementados;
- qué está solo en UI;
- qué está realmente conectado al motor.

NO empieces de cero.

DESPUÉS:
Crea un PLAN DE IMPLEMENTACIÓN POR FASES basado en el código real.

FASE 1
Modelos de datos + compatibilidad + Evidence / Variables / Constructs / Primary Owner.

FASE 2
Admin → Metodología completo.

FASE 3
Motor adaptativo conectado al banco existente.

FASE 4
Decision Engine: Safety + Root Cause + Priority + Eligibility.

FASE 5
Financial Readiness + Behavioral Readiness + Interventions + Behavioral Engine.

FASE 6
Simulator + Explainability + QA.

FASE 7
Multi-tenant + governance + publishing/versioning.

FASE 8
Analytics + Learning.

Después del plan: COMIENZA LA IMPLEMENTACIÓN REAL.

Antes de cada cambio estructural importante:
- revisa dependencias;
- evita regresiones;
- conserva lo que funciona.

Después de cada fase:
- ejecuta build;
- ejecuta tests;
- corrige errores;
- prueba desktop;
- prueba viewport móvil/iPhone;
- informa qué quedó realmente implementado;
- qué quedó pendiente;
- qué decisiones provisionales permanecen.

NO declares algo terminado si solo existe la interfaz y todavía no afecta realmente al motor.
NO vuelvas a diseñar la metodología.
NO vuelvas a construir el banco desde cero.
CONTINÚA DESDE EL ESTADO ACTUAL DEL PROYECTO.
