// Intérprete de las expresiones ASK_IF / SKIP_IF del Banco Maestro real
// (prisma/seed-data/banco-maestro-v3.json). Cubre la gramática que
// realmente aparece en las 94 preguntas cargadas: TRUE, comparaciones de
// igualdad, IN {..}, confidence >=/<, "not known" / "known", y AND/OR con
// paréntesis. NO es el motor NBQ completo de la spec (§22) — es lo mínimo
// para que el banco real navegue correctamente con lo que ya sabemos del
// empleado.
//
// Frases que no siguen esta gramática (dependen de motores que todavía no
// existen: Root Cause, Eligibility, Commitment, Learning — ej. "NEXT_ACTION
// requires debt structure", "ELIGIBLE_ACTIONS_COUNT > 2") se evalúan como
// falso de forma segura: la pregunta simplemente no se vuelve alcanzable
// hasta que ese motor exista, en vez de fallar o preguntarse de más.

export type Fact = { state: string; confidenceRatio: number };
export type Facts = Map<string, Fact>;

type Token = { type: string; value: string };

function tokenize(expr: string): Token[] {
  const re = /\{[^}]*\}|!=|>=|<=|[()=<>,]|[A-Za-z_][A-Za-z0-9_.]*|[0-9]+(?:\.[0-9]+)?/g;
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    const v = m[0];
    if (v.startsWith('{')) tokens.push({ type: 'SET', value: v.slice(1, -1) });
    else if (v === '(' || v === ')' || v === '=' || v === '!=' || v === '>=' || v === '<=' || v === '>' || v === '<' || v === ',') {
      tokens.push({ type: v, value: v });
    } else if (/^[0-9]/.test(v)) {
      tokens.push({ type: 'NUMBER', value: v });
    } else {
      const upper = v.toUpperCase();
      if (upper === 'AND' || upper === 'OR' || upper === 'TRUE' || upper === 'NOT' || upper === 'IN' || upper === 'KNOWN' || upper === 'CONFIDENCE') {
        tokens.push({ type: upper, value: v });
      } else {
        tokens.push({ type: 'IDENT', value: v });
      }
    }
  }
  return tokens;
}

class Parser {
  private pos = 0;
  private unsupported = false;

  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(facts: Facts): boolean {
    if (this.tokens.length === 0) return false;
    const result = this.orExpr(facts);
    return this.unsupported ? false : result;
  }

  private orExpr(facts: Facts): boolean {
    let left = this.andExpr(facts);
    while (this.peek()?.type === 'OR') {
      this.next();
      const right = this.andExpr(facts);
      left = left || right;
    }
    return left;
  }

  private andExpr(facts: Facts): boolean {
    let left = this.atom(facts);
    while (this.peek()?.type === 'AND') {
      this.next();
      const right = this.atom(facts);
      left = left && right;
    }
    return left;
  }

  private atom(facts: Facts): boolean {
    const tok = this.peek();
    if (!tok) {
      this.unsupported = true;
      return false;
    }

    if (tok.type === '(') {
      this.next();
      const value = this.orExpr(facts);
      if (this.peek()?.type === ')') this.next();
      return value;
    }

    if (tok.type === 'TRUE') {
      this.next();
      return true;
    }

    if (tok.type === 'IDENT') {
      return this.comparison(facts);
    }

    // Token inesperado (fragmento de una frase que no seguimos, ej.
    // "requires", "is", "exists"): se marca no soportado -> false.
    this.next();
    this.unsupported = true;
    return false;
  }

  private comparison(facts: Facts): boolean {
    const ident = this.next()!.value;
    const op = this.peek();

    if (op?.type === 'CONFIDENCE') {
      this.next();
      const cmp = this.next();
      const num = this.next();
      const threshold = num ? parseFloat(num.value) : NaN;
      const confidence = facts.get(ident)?.confidenceRatio ?? 0;
      if (!cmp || Number.isNaN(threshold)) {
        this.unsupported = true;
        return false;
      }
      switch (cmp.type) {
        case '>=':
          return confidence >= threshold;
        case '<=':
          return confidence <= threshold;
        case '>':
          return confidence > threshold;
        case '<':
          return confidence < threshold;
        default:
          this.unsupported = true;
          return false;
      }
    }

    if (op?.type === 'NOT') {
      this.next();
      const known = this.next(); // "known"
      if (known?.type !== 'KNOWN') this.unsupported = true;
      return !facts.has(ident);
    }

    if (op?.type === 'KNOWN') {
      this.next();
      return facts.has(ident);
    }

    if (op?.type === '=' || op?.type === '!=') {
      this.next();
      const valueTok = this.next();
      if (!valueTok) {
        this.unsupported = true;
        return false;
      }
      const known = facts.has(ident);
      if (!known) return false; // sin evidencia, no se puede afirmar ninguna comparación
      const state = facts.get(ident)!.state;
      return op.type === '=' ? state === valueTok.value : state !== valueTok.value;
    }

    if (op?.type === 'IN') {
      this.next();
      const set = this.next();
      if (!set || set.type !== 'SET') {
        this.unsupported = true;
        return false;
      }
      const known = facts.has(ident);
      if (!known) return false;
      const options = set.value.split(',').map((s) => s.trim());
      return options.includes(facts.get(ident)!.state);
    }

    // Comparaciones numéricas directas sobre "variables" que no son
    // Variable en nuestro catálogo (ej. ELIGIBLE_ACTIONS_COUNT > 2): no
    // tenemos ese hecho, así que no se puede evaluar -> false seguro.
    if (op?.type === '>' || op?.type === '<' || op?.type === '>=' || op?.type === '<=') {
      this.next();
      this.next();
      this.unsupported = true;
      return false;
    }

    this.unsupported = true;
    return false;
  }
}

export function evaluateRule(expression: string, facts: Facts): boolean {
  const trimmed = expression.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'TRUE') return true;
  const tokens = tokenize(trimmed);
  return new Parser(tokens).parse(facts);
}
