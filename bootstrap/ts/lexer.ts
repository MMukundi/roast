import assert from "assert"
import { openSync, readFileSync } from "fs"
import path from "path"
import { StandardLibraryDirectory } from "./arguments"
import { makeToken, SourceLocation, Token, TokenType } from "./tokens"
import { digitCode, escapeChar, isDigitCode, isWhitespace, toToastPath } from "./utils"

const NegativeSign = '-'
const IncludeSign = '%'
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
	includes: LexerSource = null;
	includedIn: LexerSource = null;

	/** The stack of consumed tokens */
	prevTokens: Token[] = []

	/** The queue of tokens parsed for lookahead, but not yet consumed */
	nextTokens: Token[] = []

	get deepestSource(): LexerSource {
		return this.includes ? this.includes.deepestSource : this
	}

	*[Symbol.iterator]() {
		while (!(this.done() && this.nextTokens.length == 0)) {
			const token = this.readToken()
			if (token)
				yield token
		}
	}

	lookBehind(index = 1): Token {
		return this.prevTokens[this.prevTokens.length - index]
	}

	lookAhead(index = 1): Token {
		while (this.nextTokens.length < index && !this.done()) {
			const token = this.parseToken()
			if (token)
				this.nextTokens.push(token)
		}
		return this.nextTokens[index - 1]
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
		const token = this.nextTokens.length ? this.nextTokens.shift() : this.parseToken()
		if (token)
			this.prevTokens.push(token)
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

		let currentChar;
		// Skip comments
		this.skipWhitespace()
		while ((currentChar = this.current()) === "#") {
			this.advanceUntilChar("\n")
			this.skipWhitespace()
		}
		if (this.includeDone()) {
			return
		}
		const tokenLocation = { ...this.deepestSource.location }

		/// Block expressions and comments
		switch (currentChar) {
			// Testing for unary negation
			case "{":
				this.advanceOne()
				return makeToken(TokenType.OpenBlock, tokenLocation)
			case "}":
				this.advanceOne()
				return makeToken(TokenType.CloseBlock, tokenLocation)
			case "[":
				this.advanceOne()
				return makeToken(TokenType.OpenList, tokenLocation)
			case "]":
				this.advanceOne()
				return makeToken(TokenType.CloseList, tokenLocation)
			// Support for character constants
			case "\'": {
				this.advanceOne()

				if (this.current() == '\\') {
					this.advanceOne()
				} else if (this.current() == '\'') {
					throw ("Zero-length character literal")
				}
				const char = this.current()
				this.advanceOne()
				if (this.current() != '\'') {
					throw ("Character literal with more than one character")
				}
				this.advanceOne()
				return makeToken(TokenType.Value, tokenLocation, escapeChar(char).charCodeAt(0))
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
			const name: string[] = []

			if (firstChar == "-")
				name.push(NegativeSign)
			this.advanceWhile(() => {
				const current = this.current()
				if (!isWhitespace(current)) {
					name.push(current)
					return true;
				}
				return false
			})
			this.advanceOne()
			return makeToken(TokenType.Name, tokenLocation, name.join(""))
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
