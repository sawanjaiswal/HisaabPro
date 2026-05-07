/**
 * Recursive-descent expression evaluator for cash register.
 * Grammar: expression := term (('+' | '-') term)*
 *          term       := factor (('*' | '/') factor)*
 *          factor     := number | '(' expression ')' | '-' factor
 *          number     := DIGIT+ ('.' DIGIT+)?
 *
 * NO eval, NO Function(), NO regex shortcut.
 */

const MAX_EXPRESSION_LEN = 128
const MAX_RESULT_PAISE = 9_999_999_999 // Rs 9,99,99,999.99

type Token =
  | { type: 'NUM'; value: number }
  | { type: 'OP'; value: '+' | '-' | '*' | '/' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }

type EvalResult = { amountPaise: number; error?: undefined } | { amountPaise?: undefined; error: string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ') { i++; continue }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP', value: ch })
      i++
      continue
    }
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue }
    if (ch >= '0' && ch <= '9') {
      let numStr = ''
      let intDigits = 0
      while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') {
        numStr += expr[i]
        intDigits++
        i++
        if (intDigits > 12) throw new Error('SYNTAX_ERROR: number too large')
      }
      if (i < expr.length && expr[i] === '.') {
        numStr += '.'
        i++
        let fracDigits = 0
        while (i < expr.length && expr[i] >= '0' && expr[i] <= '9') {
          numStr += expr[i]
          fracDigits++
          i++
          if (fracDigits > 4) throw new Error('SYNTAX_ERROR: too many decimal places')
        }
        if (fracDigits === 0) throw new Error('SYNTAX_ERROR: trailing decimal point')
      }
      tokens.push({ type: 'NUM', value: parseFloat(numStr) })
      continue
    }
    throw new Error(`INVALID_CHAR: unexpected character '${ch}' at position ${i}`)
  }
  return tokens
}

class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  peek(): Token | undefined { return this.tokens[this.pos] }
  consume(): Token { return this.tokens[this.pos++] }

  parseExpression(): number {
    let left = this.parseTerm()
    while (this.pos < this.tokens.length) {
      const tok = this.peek()
      if (tok?.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
        this.consume()
        const right = this.parseTerm()
        left = tok.value === '+' ? left + right : left - right
      } else {
        break
      }
    }
    return left
  }

  parseTerm(): number {
    let left = this.parseFactor()
    while (this.pos < this.tokens.length) {
      const tok = this.peek()
      if (tok?.type === 'OP' && (tok.value === '*' || tok.value === '/')) {
        this.consume()
        const right = this.parseFactor()
        if (tok.value === '/') {
          if (right === 0) throw new Error('DIVIDE_BY_ZERO: division by zero')
          left = left / right
        } else {
          left = left * right
        }
      } else {
        break
      }
    }
    return left
  }

  parseFactor(): number {
    const tok = this.peek()
    if (!tok) throw new Error('SYNTAX_ERROR: unexpected end of expression')

    if (tok.type === 'OP' && tok.value === '-') {
      this.consume()
      return -this.parseFactor()
    }
    if (tok.type === 'LPAREN') {
      this.consume()
      const val = this.parseExpression()
      const closing = this.peek()
      if (!closing || closing.type !== 'RPAREN') throw new Error('SYNTAX_ERROR: unmatched parenthesis')
      this.consume()
      return val
    }
    if (tok.type === 'NUM') {
      this.consume()
      return tok.value
    }
    throw new Error('SYNTAX_ERROR: unexpected token')
  }
}

export function evaluateExpression(expr: string): number {
  if (!expr || expr.trim() === '') throw new Error('EMPTY: expression is empty')
  if (expr.length > MAX_EXPRESSION_LEN) throw new Error('TOO_LONG: expression exceeds maximum length')

  const tokens = tokenize(expr)
  if (tokens.length === 0) throw new Error('EMPTY: expression is empty')

  // Reject leading operators (non-minus) or consecutive operators
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const prev = tokens[i - 1]
    if (t.type === 'OP' && (t.value === '+' || t.value === '*' || t.value === '/')) {
      if (i === 0) throw new Error('SYNTAX_ERROR: expression starts with operator')
      if (prev?.type === 'OP') throw new Error('SYNTAX_ERROR: consecutive operators')
    }
    if (t.type === 'OP' && t.value === '-') {
      if (prev?.type === 'OP' && prev.value !== '-') continue // unary minus after op is ok
    }
  }

  const parser = new Parser(tokens)
  const result = parser.parseExpression()

  if (parser['pos'] < tokens.length) throw new Error('SYNTAX_ERROR: unexpected trailing input')
  if (!Number.isFinite(result)) throw new Error('INVALID_RESULT: result is not finite')

  const paise = Math.round(result * 100)
  if (paise <= 0) throw new Error('INVALID_RESULT: amount must be greater than zero')
  if (paise > MAX_RESULT_PAISE) throw new Error('RESULT_OVERFLOW: amount exceeds maximum allowed value')

  return paise
}

export function evaluateExpressionSafe(expr: string): EvalResult {
  try {
    const amountPaise = evaluateExpression(expr)
    return { amountPaise }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'INVALID_EXPRESSION'
    return { error: message }
  }
}
