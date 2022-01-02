import assert from "assert"
import { openSync, readFileSync } from "fs"
import path from "path"
import { StandardLibraryDirectory } from "./arguments"
import { makeToken, SourceLocation, Token, TokenType } from "./tokens"
import { digitCode, escapeChar, isDigitCode, isWhitespace, toToastPath } from "./utils"

const NegativeSign = '-'
const IncludeSign = '%'

const BlockStart = '{'
const BlockEnd = '}'

const ArrayStart = '['
const ArrayEnd = ']'

const DelimeterEnds = {
	[BlockStart]: {
		end: BlockEnd,
		type: TokenType.CodeBlock
	},
	[ArrayStart]: {
		end: ArrayEnd,
		type: TokenType.List
	},
} as const

const ToastDelimiters = new Set([BlockStart, BlockEnd, ArrayStart, ArrayEnd])

interface Scope {
	/** The stack of consumed tokens */
	prevTokens: Token[]

	/** The queue of tokens parsed for lookahead, but not yet consumed */
	nextTokens: Token[]
}

// TODO: This was previously abstract; was there a reason why?
export class LexerSource {
	/** The raw text of this source */
	protected text: string = ''
	/** The raw index of this source */
	protected index: number = 0

	/** An identifier for this lexer source, used when logging errors */
	name: string = 'toastSource'

	location: SourceLocation = {
		/** The line the lexer is currently lexing */
		line: 0,
		/** The position from the front of the line the lexer is in */
		column: 0
	}
	variableUses: Record<string, Set<SourceLocation>> = {}
	variableDefinitions: Record<string, Set<SourceLocation>> = {}
	functionDefinitions: Record<string, Set<SourceLocation>> = {}

	includes: LexerSource = null;
	includedIn: LexerSource = null;

	scopeStack: Scope[] = [{ prevTokens: [], nextTokens: [] }]


	get deepestSource(): LexerSource {
		return this.includes ? this.includes.deepestSource : this
	}
	get deepestScope(): Scope {
		return this.scopeStack[this.scopeStack.length - 1]
	}

	get globalScope(): Scope {
		return this.scopeStack[0]
	}

	[Symbol.iterator]() {
		return this.globalScope.prevTokens[Symbol.iterator]()
	}

	getAllTokens() {
		while (!(this.done() && this.deepestScope.nextTokens.length == 0)) {
			this.readToken()
			// const token = this.readToken()
			// if (token)
			// 	yield token
		}
		for (let i = 0; i < this.globalScope.prevTokens.length; i++) {
			const token = this.globalScope.prevTokens[i]
			const nextToken = this.globalScope.prevTokens[i + 1]

			if (token.type === TokenType.Name) {
				if (nextToken && nextToken.type == TokenType.Name && nextToken.value == "def") {
					const prevToken = this.globalScope.prevTokens[i - 1]
					const map = (prevToken && prevToken.type == TokenType.CodeBlock) ? this.functionDefinitions : this.variableDefinitions

					map[token.value] = map[token.value] || new Set()
					map[token.value].add(nextToken.location)
					i++
				}
				else {
					this.variableUses[token.value] = this.variableUses[token.value] || new Set()
					this.variableUses[token.value].add(token.location)
				}
			}
		}
	}
	lookBehind(index = 1): Token {
		return this.deepestScope.prevTokens[this.deepestScope.prevTokens.length - index]
	}

	lookAhead(index = 1): Token {
		while (this.deepestScope.nextTokens.length < index && !this.done()) {
			const token = this.parseToken()
			if (token)
				this.deepestScope.nextTokens.push(token)
		}
		return this.deepestScope.nextTokens[index - 1]
	}

	/** The current character. */
	current() {
		return this.deepestSource.text[this.deepestSource.index]
	}
	/** Moves forward in the text one character. */
	advanceOne() {

		let current = this.current()
		if (current === "\n") {
			this.deepestSource.location.line++
			this.deepestSource.location.column = 0
		} else {
			this.deepestSource.location.column++
		}
		this.deepestSource.index++
		return current
	}
	/** Moves forward in the text. */
	advance(count: number) {
		let skipped = ""
		for (let i = 0; !this.includeDone() && i < count; i++) {
			skipped += this.advanceOne()
		}
		return skipped
	}
	/** Moves forward in the text as long as a condition is met. */
	advanceWhile(predicate: (char: string) => boolean) {
		let skipped = ""
		while (!this.includeDone() && predicate(this.current())) {
			skipped += this.advanceOne()
		}
		return skipped
	}
	/** Moves forward in the text until as a condition is met. */
	advanceUntil(predicate: (char: string) => boolean) {
		return this.advanceWhile((c) => !predicate(c))
	}
	/** Moves forward in the text until as a condition is met. */
	advanceUntilChar(character: string) {
		return this.advanceUntil(() => this.current() === character)
	}
	/** Moves forward to the next non-whitespace character. */
	skipWhitespace() {
		this.advanceWhile(isWhitespace)
	}
	/** Moves forward to the next non-comment character. */
	skipComments(startChar?: string) {
		let currentChar = startChar
		while ((currentChar = this.current()) === "#") {
			this.advanceUntilChar("\n")
			this.skipWhitespace()
		}
		return currentChar
	}


	/** Returns a character relatively indexed from the current one. */
	get(offset: number = 0) {
		return this.deepestSource.text[this.deepestSource.index + offset]
	}

	/** Returns a string representing the current location in the lexer source. */
	locationString(location: SourceLocation) {
		return `${this.deepestSource.name}:${location.line + 1}:${location.column + 1}`
	}

	/** Returns whether or not the lexer source is completely consumed. */
	done() {
		return this.index >= this.text.length && (this.includeDone())
	}
	includeDone() {
		return this.deepestSource.index >= this.deepestSource.text.length
	}

	readStringLiteral(endChar = "\"") {
		const stringLiteral: string[] = []
		let escapeNext = false
		this.advanceOne()
		this.advanceWhile(() => {
			const nextChar = this.current()
			// stringLiteral.push(nextChar)
			if (escapeNext) {
				stringLiteral.push(escapeChar(nextChar))
				escapeNext = false;
				return true;
			} else if (nextChar === '\\') {
				escapeNext = true
				return true;
			} else if (nextChar !== endChar) {
				stringLiteral.push(nextChar)
				return true;
			}
			return false
		})
		return stringLiteral.join("")
	}

	/** Returns the next token in the lexer source. */
	readToken(): Token {
		const token = this.deepestScope.nextTokens.length ? this.deepestScope.nextTokens.shift() : this.parseToken()
		if (token)
			this.deepestScope.prevTokens.push(token)
		return token
	}
	parseToken(): Token {
		const token = this.getToken()
		if (this.includeDone() && this.includes) {
			this.deepestSource.includedIn.includes = null
		}
		return token
	}
	getToken(): Token {
		assert(!this.done(), "Tried to read token after end of file")

		// Skip comments
		this.skipWhitespace()
		let currentChar = this.skipComments()
		if (this.includeDone()) {
			return
		}
		const tokenLocation = { ...this.deepestSource.location }

		/// Block expressions and comments
		switch (currentChar) {
			// Testing for unary negation
			// this.advanceOne()
			// return makeToken(TokenType.OpenList, tokenLocation)
			case BlockStart:
			case ArrayStart:
				this.advanceOne()
				const tokens: Token[] = []
				const { end, type } = DelimeterEnds[currentChar]

				if (currentChar === BlockStart) {
					this.scopeStack.push({ prevTokens: [], nextTokens: [] })
				}

				while (this.current() != end) {
					const token = this.parseToken()
					this.skipWhitespace()
					this.skipComments()
					tokens.push(token)
				}
				if (currentChar === BlockStart) {
					this.scopeStack.pop()
				}

				this.advanceOne()

				return makeToken(type, tokenLocation, { tokens, end: { ...this.location }, name: null }) as Token
			case BlockEnd:
				throw ("Unbalanced block end")
			// this.advanceOne()
			// return makeToken(TokenType.CloseBlock, tokenLocation)
			case ArrayEnd:
				// this.advanceOne()
				// return makeToken(TokenType.CloseList, tokenLocation)
				throw ("Unbalanced array end")

			// Support for character constants
			case "\'": {
				this.advanceOne()
				let escape = false

				if (this.current() == '\\') {
					this.advanceOne()
					escape = true
				} else if (this.current() == '\'') {
					throw ("Zero-length character literal")
				}
				const char = this.current()
				this.advanceOne()
				if (this.current() != '\'') {
					throw ("Character literal with more than one character")
				}
				this.advanceOne()
				return makeToken(TokenType.Value, tokenLocation, (escape ? escapeChar(char) : char).charCodeAt(0))
			}
			case "\"": {
				const stringLiteral = this.readStringLiteral()
				if (this.current() !== '"') {
					throw ("Unterminated string literal")
				}
				this.advanceOne()
				if (this.current() === 'c') {
					this.advanceOne()
					return makeToken(TokenType.CString, tokenLocation, stringLiteral)
				}
				return makeToken(TokenType.String, tokenLocation, stringLiteral)
			}
		}

		// Testing for unary negation
		let firstChar = currentChar
		if (currentChar == NegativeSign || currentChar == IncludeSign) {
			firstChar = currentChar
			this.advanceOne()
			currentChar = this.current()
		}

		let currentCharAsDigit = currentChar ? digitCode(currentChar) : -1
		if (firstChar == "%") {
			if (currentChar == "\"") {
				const includePath = this.readStringLiteral()
				if (this.current() !== '"') {
					throw ("Unterminated include path")
				}
				this.advanceOne()

				const newSource = new LexerSourceFile(path.resolve(this.deepestSource.name, "../", includePath));
				newSource.includedIn = this.deepestSource;
				this.deepestSource.includes = newSource

				return
			}
			else if (currentChar == "<") {
				const includePath = this.readStringLiteral(">")
				if (this.current() !== '>') {
					throw ("Unterminated include path")
				}
				this.advanceOne()
				const newSource = new LexerSourceFile(path.resolve(StandardLibraryDirectory, includePath));
				newSource.includedIn = this.deepestSource;
				this.deepestSource.includes = newSource
				return
			}
			// throw ("Invalid preprocessor command")
			return makeToken(TokenType.Name, tokenLocation, '%')
		}
		else if (isDigitCode(currentCharAsDigit)) {
			let value = currentCharAsDigit;
			this.advanceOne()

			this.advanceWhile(() => {
				const current = this.current()
				let charAsDigit = digitCode(current)
				if (isDigitCode(charAsDigit)) {
					value *= 10
					value += charAsDigit;
					return true;
				}
				return false
			})
			if (this.current() === ".") {
				let decimalPart = 0
				let power = 0.1
				this.advanceWhile(() => {
					const current = this.current()
					let charAsDigit = digitCode(current)
					if (isDigitCode(charAsDigit)) {
						decimalPart += power * charAsDigit;
						power /= 10
						return true;
					}
					return false
				})
				value += decimalPart
			}
			if (firstChar == "-") {
				value *= -1
			}
			return makeToken(TokenType.Value, tokenLocation, value)
		} else {
			let name: string = firstChar == "-" ? "-" : ""

			name += this.advanceWhile(() => {
				const current = this.current()
				if (!(isWhitespace(current) || ToastDelimiters.has(current))) {
					return true;
				}
				return false
			})
			const charAfter = this.current()
			if (charAfter && isWhitespace(charAfter)) {
				this.advanceOne()
			}

			return makeToken(TokenType.Name, tokenLocation, name)
		}
	}
}

export class LexerSourceFile extends LexerSource {
	constructor(path: string) {
		super()
		path = toToastPath(path)
		this.text = readFileSync(path).toString()
		this.name = path
	}
}
