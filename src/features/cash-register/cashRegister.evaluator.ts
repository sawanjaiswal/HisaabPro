/**
 * Cash Register — Client-side expression evaluator.
 * Recursive-descent parser. NO eval(), NO Function().
 * MUST stay in sync with server/src/features/cash-register/expression.ts.
 * Same grammar, same precedence, same rejection rules.
 */

import { MAX_EXPRESSION_LEN, RESULT_OVERFLOW_PAISE } from './cashRegister.constants'
import type { SafeEvalResult, ExpressionError } from './cashRegister.types'

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'LPAREN' | 'RPAREN' | 'EOF'

interface Token {
  type: TokenType
  value: string
}

function tokenize(expr: string): Token[] | ExpressionError {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const ch = expr[i]

    // Skip whitespace
    if (ch === ' ') { i++; continue }

    if (ch >= '0' && ch <= '9') {
      let num = ''
      let dotCount = 0
      while (i < expr.length && (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.')) {
        if (expr[i] === '.') {
          dotCount++
          if (dotCount > 1) return 'SYNTAX_ERROR'
        }
        num += expr[i]
        i++
      }
      tokens.push({ type: 'NUMBER', value: num })
      continue
    }

    switch (ch) {
      case '+': tokens.push({ type: 'PLUS',   value: ch }); break
      case '-': tokens.push({ type: 'MINUS',  value: ch }); break
      case '*': tokens.push({ type: 'STAR',   value: ch }); break
      case '/': tokens.push({ type: 'SLASH',  value: ch }); break
      case '(': tokens.push({ type: 'LPAREN', value: ch }); break
      case ')': tokens.push({ type: 'RPAREN', value: ch }); break
      default: return 'INVALID_CHAR'
    }
    i++
  }

  tokens.push({ type: 'EOF', value: '' })
  return tokens
}

// ─── Parser (recursive descent) ───────────────────────────────────────────────

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private consume(): Token {
    return this.tokens[this.pos++]
  }

  // expression := term (('+' | '-') term)*
  parseExpression(): number {
    let left = this.parseTerm()
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.consume()
      const right = this.parseTerm()
      left = op.type === 'PLUS' ? left + right : left - right
    }
    return left
  }

  // term := factor (('*' | '/') factor)*
  parseTerm(): number {
    let left = this.parseFactor()
    while (this.peek().type === 'STAR' || this.peek().type === 'SLASH') {
      const op = this.consume()
      const right = this.parseFactor()
      if (op.type === 'SLASH') {
        if (right === 0) throw new Error('DIVIDE_BY_ZERO')
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  // factor := number | '(' expression ')' | '-' factor
  parseFactor(): number {
    const tok = this.peek()

    if (tok.type === 'MINUS') {
      this.consume()
      return -this.parseFactor()
    }

    if (tok.type === 'LPAREN') {
      this.consume()
      const val = this.parseExpression()
      if (this.peek().type !== 'RPAREN') throw new Error('SYNTAX_ERROR')
      this.consume()
      return val
    }

    if (tok.type === 'NUMBER') {
      this.consume()
      return parseFloat(tok.value)
    }

    throw new Error('SYNTAX_ERROR')
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function safeEvaluate(expr: string): SafeEvalResult {
  const trimmed = expr.trim()

  if (trimmed.length === 0) {
    return { paise: null, error: 'EMPTY' }
  }

  if (trimmed.length > MAX_EXPRESSION_LEN) {
    return { paise: null, error: 'TOO_LONG' }
  }

  const tokens = tokenize(trimmed)
  if (typeof tokens === 'string') {
    return { paise: null, error: tokens }
  }

  let result: number
  try {
    const parser = new Parser(tokens)
    result = parser.parseExpression()
    // Ensure all tokens consumed (no trailing junk)
    if (parser['peek']().type !== 'EOF') {
      return { paise: null, error: 'SYNTAX_ERROR' }
    }
  } catch (err) {
    const code = err instanceof Error ? err.message : 'SYNTAX_ERROR'
    if (code === 'DIVIDE_BY_ZERO') return { paise: null, error: 'DIVIDE_BY_ZERO' }
    return { paise: null, error: 'SYNTAX_ERROR' }
  }

  if (!Number.isFinite(result)) {
    return { paise: null, error: 'SYNTAX_ERROR' }
  }

  const paise = Math.round(result * 100)

  if (paise <= 0) {
    return { paise: null, error: 'INVALID_RESULT' }
  }

  if (paise > RESULT_OVERFLOW_PAISE) {
    return { paise: null, error: 'RESULT_OVERFLOW' }
  }

  return { paise, error: null }
}
