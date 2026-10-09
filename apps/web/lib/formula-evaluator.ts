// Evaluates Monday-style column formulas: {ColumnName} * 1.17, IF, SUM, ROUND, etc.

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type Token =
  | { type: 'NUM'; val: number }
  | { type: 'REF'; name: string }
  | { type: 'FUNC'; name: string }
  | { type: 'OP'; op: '+' | '-' | '*' | '/' }
  | { type: 'CMP'; op: '>' | '<' | '>=' | '<=' | '=' | '<>' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'COMMA' }
  | { type: 'EOF' };

const SUPPORTED_FUNCTIONS = new Set([
  'IF', 'SUM', 'ROUND', 'ABS', 'MIN', 'MAX', 'AVERAGE', 'SQRT', 'FLOOR', 'CEILING',
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }

    // Column reference: {Column Name}
    if (input[i] === '{') {
      const end = input.indexOf('}', i);
      if (end === -1) throw new Error('Unclosed { in formula');
      tokens.push({ type: 'REF', name: input.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    // Number (integer or decimal)
    if (/[\d.]/.test(input[i])) {
      let num = '';
      while (i < input.length && /[\d.]/.test(input[i])) num += input[i++];
      const val = parseFloat(num);
      if (isNaN(val)) throw new Error(`Invalid number: ${num}`);
      tokens.push({ type: 'NUM', val });
      continue;
    }

    // Function name / identifier
    if (/[A-Za-z_]/.test(input[i])) {
      let name = '';
      while (i < input.length && /[A-Za-z_\d]/.test(input[i])) name += input[i++];
      const upper = name.toUpperCase();
      if (!SUPPORTED_FUNCTIONS.has(upper)) throw new Error(`Unknown function: ${name}`);
      tokens.push({ type: 'FUNC', name: upper });
      continue;
    }

    // Two-char operators first
    const two = input.slice(i, i + 2);
    if (two === '>=') { tokens.push({ type: 'CMP', op: '>=' }); i += 2; continue; }
    if (two === '<=') { tokens.push({ type: 'CMP', op: '<=' }); i += 2; continue; }
    if (two === '<>') { tokens.push({ type: 'CMP', op: '<>' }); i += 2; continue; }

    // Single-char
    const ch = input[i];
    if (ch === '+') { tokens.push({ type: 'OP', op: '+' }); i++; continue; }
    if (ch === '-') { tokens.push({ type: 'OP', op: '-' }); i++; continue; }
    if (ch === '*') { tokens.push({ type: 'OP', op: '*' }); i++; continue; }
    if (ch === '/') { tokens.push({ type: 'OP', op: '/' }); i++; continue; }
    if (ch === '>') { tokens.push({ type: 'CMP', op: '>' }); i++; continue; }
    if (ch === '<') { tokens.push({ type: 'CMP', op: '<' }); i++; continue; }
    if (ch === '=') { tokens.push({ type: 'CMP', op: '=' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'COMMA' }); i++; continue; }

    throw new Error(`Unexpected character: ${ch}`);
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

// ── AST ───────────────────────────────────────────────────────────────────────

type Expr =
  | { kind: 'num'; val: number }
  | { kind: 'ref'; name: string }
  | { kind: 'neg'; expr: Expr }
  | { kind: 'binop'; op: '+' | '-' | '*' | '/'; left: Expr; right: Expr }
  | { kind: 'cmp'; op: '>' | '<' | '>=' | '<=' | '=' | '<>'; left: Expr; right: Expr }
  | { kind: 'call'; name: string; args: Expr[] };

// ── Parser (recursive descent) ────────────────────────────────────────────────

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]; }

  private consume(): Token {
    const t = this.tokens[this.pos++];
    return t;
  }

  private expect(type: 'LPAREN' | 'RPAREN' | 'COMMA'): void {
    const t = this.consume();
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
  }

  parse(): Expr {
    const expr = this.parseComparison();
    if (this.peek().type !== 'EOF') throw new Error('Unexpected tokens after expression');
    return expr;
  }

  private parseComparison(): Expr {
    const left = this.parseAddition();
    const t = this.peek();
    if (t.type === 'CMP') {
      this.consume();
      const right = this.parseAddition();
      return { kind: 'cmp', op: t.op, left, right };
    }
    return left;
  }

  private parseAddition(): Expr {
    let left = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (t.type !== 'OP' || (t.op !== '+' && t.op !== '-')) break;
      this.consume();
      const right = this.parseTerm();
      left = { kind: 'binop', op: t.op, left, right };
    }
    return left;
  }

  private parseTerm(): Expr {
    let left = this.parseFactor();
    for (;;) {
      const t = this.peek();
      if (t.type !== 'OP' || (t.op !== '*' && t.op !== '/')) break;
      this.consume();
      const right = this.parseFactor();
      left = { kind: 'binop', op: t.op, left, right };
    }
    return left;
  }

  private parseFactor(): Expr {
    const t = this.peek();
    if (t.type === 'OP' && t.op === '-') {
      this.consume();
      return { kind: 'neg', expr: this.parseFactor() };
    }
    return this.parseAtom();
  }

  private parseAtom(): Expr {
    const t = this.consume();

    if (t.type === 'NUM') return { kind: 'num', val: t.val };

    if (t.type === 'REF') return { kind: 'ref', name: t.name };

    if (t.type === 'LPAREN') {
      const expr = this.parseComparison();
      this.expect('RPAREN');
      return expr;
    }

    if (t.type === 'FUNC') {
      this.expect('LPAREN');
      const args: Expr[] = [];
      if (this.peek().type !== 'RPAREN') {
        args.push(this.parseComparison());
        while (this.peek().type === 'COMMA') {
          this.consume();
          args.push(this.parseComparison());
        }
      }
      this.expect('RPAREN');
      return { kind: 'call', name: t.name, args };
    }

    throw new Error(`Unexpected token type: ${t.type}`);
  }
}

// ── Evaluator ─────────────────────────────────────────────────────────────────

function evalExpr(expr: Expr, values: Map<string, number>): number {
  switch (expr.kind) {
    case 'num':
      return expr.val;

    case 'ref':
      return values.get(expr.name) ?? 0;

    case 'neg':
      return -evalExpr(expr.expr, values);

    case 'binop': {
      const l = evalExpr(expr.left, values);
      const r = evalExpr(expr.right, values);
      if (expr.op === '+') return l + r;
      if (expr.op === '-') return l - r;
      if (expr.op === '*') return l * r;
      if (expr.op === '/') return r === 0 ? 0 : l / r;
      throw new Error('Unknown op');
    }

    case 'cmp': {
      const l = evalExpr(expr.left, values);
      const r = evalExpr(expr.right, values);
      if (expr.op === '>') return l > r ? 1 : 0;
      if (expr.op === '<') return l < r ? 1 : 0;
      if (expr.op === '>=') return l >= r ? 1 : 0;
      if (expr.op === '<=') return l <= r ? 1 : 0;
      if (expr.op === '=') return l === r ? 1 : 0;
      if (expr.op === '<>') return l !== r ? 1 : 0;
      throw new Error('Unknown cmp op');
    }

    case 'call': {
      const { name, args } = expr;

      if (name === 'IF') {
        if (args.length !== 3) throw new Error('IF() requires 3 arguments: IF(condition, ifTrue, ifFalse)');
        return evalExpr(args[0], values) ? evalExpr(args[1], values) : evalExpr(args[2], values);
      }

      if (name === 'SUM') {
        return args.reduce((acc, a) => acc + evalExpr(a, values), 0);
      }

      if (name === 'AVERAGE') {
        if (!args.length) return 0;
        return args.reduce((acc, a) => acc + evalExpr(a, values), 0) / args.length;
      }

      if (name === 'ROUND') {
        if (args.length !== 2) throw new Error('ROUND() requires 2 arguments: ROUND(value, decimals)');
        const v = evalExpr(args[0], values);
        const d = Math.max(0, Math.round(evalExpr(args[1], values)));
        const f = Math.pow(10, d);
        return Math.round(v * f) / f;
      }

      if (name === 'ABS') {
        if (args.length !== 1) throw new Error('ABS() requires 1 argument');
        return Math.abs(evalExpr(args[0], values));
      }

      if (name === 'SQRT') {
        if (args.length !== 1) throw new Error('SQRT() requires 1 argument');
        return Math.sqrt(evalExpr(args[0], values));
      }

      if (name === 'FLOOR') {
        if (args.length !== 1) throw new Error('FLOOR() requires 1 argument');
        return Math.floor(evalExpr(args[0], values));
      }

      if (name === 'CEILING') {
        if (args.length !== 1) throw new Error('CEILING() requires 1 argument');
        return Math.ceil(evalExpr(args[0], values));
      }

      if (name === 'MIN') {
        if (!args.length) return 0;
        return Math.min(...args.map((a) => evalExpr(a, values)));
      }

      if (name === 'MAX') {
        if (!args.length) return 0;
        return Math.max(...args.map((a) => evalExpr(a, values)));
      }

      throw new Error(`Unknown function: ${name}`);
    }
  }
}

// ── Cell value extraction ─────────────────────────────────────────────────────

function cellToNumber(cell: { value: unknown } | undefined | null): number {
  if (!cell) return 0;
  const v = cell.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    // NUMBER / PRICE: { text: "123" }
    if (obj.text !== undefined) return parseFloat(String(obj.text)) || 0;
    // CHECKBOX: { checked: true }
    if (typeof obj.checked === 'boolean') return obj.checked ? 1 : 0;
  }
  return 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FormulaCell {
  columnId?: number;
  value?: unknown;
  column?: { name: string; type: string };
}

export interface FormulaResult {
  result: number | null;
  error: string | null;
}

export function evaluateFormula(
  formula: string,
  cells: FormulaCell[],
): FormulaResult {
  const trimmed = formula.trim();
  if (!trimmed) return { result: null, error: null };

  try {
    const values = new Map<string, number>();
    for (const cell of cells) {
      const name = cell.column?.name;
      if (name) values.set(name, cellToNumber(cell as any));
    }

    const tokens = tokenize(trimmed);
    const ast = new Parser(tokens).parse();
    const result = evalExpr(ast, values);

    return { result: isFinite(result) ? result : null, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Formula error';
    return { result: null, error: msg };
  }
}

export function validateFormula(formula: string): string | null {
  try {
    const tokens = tokenize(formula.trim());
    new Parser(tokens).parse();
    return null;
  } catch (err: unknown) {
    return err instanceof Error ? err.message : 'Invalid formula';
  }
}
