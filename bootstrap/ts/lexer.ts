import assert from "assert"
import { readFileSync } from "fs"
import { makeToken, SourceLocation, TokenType } from "./tokens"
import { digitCode, escapeChar, isDigitCode, isWhitespace } from "./utils"

const NegativeSign = "-"
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

	/** The current character. */
	current() {
		return this.text[this.index]
	}
	/** Moves forward in the text one character. */
	advanceOne() {
		let current = this.current()
		if (current === "\n") {
			this.location.line++
			this.location.column = 0
		} else {
			this.location.column++
		}
		this.index++
		return current
	}
	/** Moves forward in the text. */
	advance(count: number) {
		let skipped = ""
		for (let i = 0; !this.done() && i < count; i++) {
			skipped += this.advanceOne()
		}
		return skipped
	}
	/** Moves forward in the text as long as a condition is met. */
	advanceWhile(predicate: (char: string) => boolean) {
		let skipped = ""
		while (!this.done() && predicate(this.current())) {
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
		return this.text[this.index + offset]
	}

	/** Returns a string representing the current location in the lexer source. */
	locationString(location: SourceLocation) {
		return `${this.name}:${location.line + 1}:${location.column + 1}`
	}

	/** Returns whether or not the lexer source is completely consumed. */
	done() {
		return this.index >= this.text.length
	}

	/** Returns the next token in the lexer source. */
	readToken() {
		assert(!this.done(), "Tried to read token after end of file")

		let currentChar;
		// Skip comments
		this.skipWhitespace()
		while ((currentChar = this.current()) === "#") {
			this.advanceUntilChar("\n")
			this.skipWhitespace()
		}
		if (this.done()) {
			return
		}
		const tokenLocation = { ...this.location }

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
					} else if (nextChar !== '"') {
						stringLiteral.push(nextChar)
						return true;
					}
					return false
				})
				if (this.current() !== '"') {
					throw ("Unterminated string literal")
				}
				this.advanceOne()
				return makeToken(TokenType.String, tokenLocation, stringLiteral.join(""))
			}
		}

		// Testing for unary negation
		let lastCharMinus = false
		if (currentChar == NegativeSign) {
			lastCharMinus = true
			this.advanceOne()
			currentChar = this.current()
		}

		let currentCharAsDigit = digitCode(currentChar)
		if (isDigitCode(currentCharAsDigit)) {
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
			if (lastCharMinus) {
				value *= -1
			}
			return makeToken(TokenType.Value, tokenLocation, value)
		} else {
			const name: string[] = []

			if (lastCharMinus)
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
		this.text = readFileSync(path).toString()
		this.name = path
	}
}