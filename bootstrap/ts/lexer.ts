import { readFileSync } from "fs"
import { makeToken, tokenString, TokenType } from "./tokens"
import { digitCode, escapeChar, isDigitCode, isWhitespace } from "./utils"

abstract class LexerSource {
	/** The raw text of this source */
	protected text: string = ''
	/** The raw index of this source */
	protected index: number = 0

	/** An identifier for this lexer source, used when logging errors */
	name: string = 'toastSource'
	/** The line the lexer is currently lexing */
	line: number = 0
	/** The position from the front of the line the lexer is in */
	column: number = 0

	/** The current character. */
	current() {
		return this.text[this.index]
	}
	/** Moves forward in the text one character. */
	advanceOne() {
		let current = this.current()
		if (current === "\n") {
			this.line++
			this.column = 0
		} else {
			this.column++
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
	location(offset: number = 0) {
		return `${this.name}:${this.line}:${this.column}`
	}

	/** Returns whether or not the lexer source is completely consumed. */
	done() {
		return this.index >= this.text.length
	}

	/** Returns the next token in the lexer source. */
	readToken() {
		let currentChar;
		// Skip comments
		while ((currentChar = this.current()) === "#") {
			this.advanceUntilChar("\n")
			this.advanceOne()
		}

		/// Block expressions and comments
		switch (currentChar) {
			case "{":
				this.advanceOne()
				return makeToken(TokenType.OpenBlock)
			case "}":
				this.advanceOne()
				return makeToken(TokenType.CloseBlock)
			case "[":
				this.advanceOne()
				return makeToken(TokenType.OpenList)
			case "]":
				this.advanceOne()
				return makeToken(TokenType.CloseList)
			case "\"": {
				const stringLiteral: string[] = []
				let escapeNext = false
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
				return makeToken(TokenType.String, stringLiteral.join(""))
			}
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
			return makeToken(TokenType.Value, value)
		} else {
			const name: string[] = []
			this.advanceWhile(() => {
				const current = this.current()
				if (!isWhitespace(current)) {
					name.push(current)
					return true;
				}
				return false
			})
			return makeToken(TokenType.Name, name.join(""))
		}
	}
}

class LexerSourceFile extends LexerSource {
	constructor(path: string) {
		super()
		this.text = readFileSync(path).toString()
		this.name = path
	}
}