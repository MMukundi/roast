import assert from "assert"
import { openSync, readFileSync } from "fs"
import path from "path"
import { StandardLibraryDirectory } from "./arguments"
import { errorLogger } from "./loggers"
import { makeToken, SourceLocation, Token, tokenString, TokenType } from "./tokens"
import { digitCode, escapeChar, isDigitCode, isWhitespace, toToastPath } from "./utils"

/** The symbol representing both unary negation and subtraction */
const NegativeSign = '-'

/** The symbol which both indicates preprocessor
 * statements as well as modular arithmetic */
const IncludeSign = '%'

/** The symbol which marks the beginning of a code block */
const BlockStart = '{'
/** The symbol which marks the end of a code block */
const BlockEnd = '}'

/** The symbol which marks the beginning of a list */
const ListStart = '['
/** The symbol which marks the end of a list */
const ListEnd = ']'

const DelimiterEnds = {
	[BlockStart]: {
		end: BlockEnd,
		type: TokenType.CodeBlock
	},
	[ListStart]: {
		end: ListEnd,
		type: TokenType.List
	},
} as const

/** Special characters which should not be included in the variable names */
const ToastDelimiters = new Set([BlockStart, BlockEnd, ListStart, ListEnd])

/** A token scope containing all past and future tokens which have been parsed */
interface Scope {
	/** The stack of consumed tokens */
	prevTokens: Token[]

	/** The queue of tokens parsed for lookahead, but not yet consumed */
	nextTokens: Token[]
}

// TODO: This was previously abstract; was there a reason why?
/** A location from which tokens can be read */
export class LexerSource {
	/** The raw text of this source */
	protected text: string = ''
	/** The raw index of this source */
	protected index: number = 0

	/** An identifier for this lexer source, used when logging errors */
	name: string = 'toastSource'

	/** The lexer's location in some source file */
	location: SourceLocation = {
		line: 0,
		column: 0,
		sourceName: null
	}

	/** The files which should not be included */
	filesNotToInclude: Set<string> = new Set();

	/** The locations where each variable is used */
	variableUses: Record<string, Set<SourceLocation>> = {}

	/** The locations where each variable is defined */
	variableDefinitions: Record<string, Set<SourceLocation>> = {}

	/** The locations where each function is defined */
	functionDefinitions: Record<string, Set<SourceLocation>> = {}

	/** The file currently being parsed
	 * from an include directive in this source.
	 * 	Together with @see this.includedIn,
	 * this forms the include stack */
	includes: LexerSource = null;

	/** The source this source is included in.
	 * 	Together with @see this.includes,
	 * this forms the include stack
	 */
	includedIn: LexerSource = null;

	/** The stack of scopes created by nested code blocks,
	 * to isolate scopes from one another, contextually */
	scopeStack: Scope[] = [{ prevTokens: [], nextTokens: [] }]

	/** The source at the top of the include stack. */
	get deepestSource(): LexerSource {
		return this.includes ? this.includes.deepestSource : this
	}

	/** The scope at the top of the scope stack. */
	get deepestScope(): Scope {
		return this.scopeStack[this.scopeStack.length - 1]
	}

	/** The scope at the bottom of the scope stack. */
	get globalScope(): Scope {
		return this.scopeStack[0]
	}

	/** Iterates over all tokens in the global scope. */
	[Symbol.iterator]() {
		return this.globalScope.prevTokens[Symbol.iterator]()
	}

	/** Gets all of the tokens in the source. */
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

	/** Gets the current character.
	 * @returns The current character.
	 */
	current() {
		return this.deepestSource.text[this.deepestSource.index]
	}

	/** Moves forward in the source one character.
	 * @returns The character which was advanced past
	 */
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

	/** Moves forward in the text. 
	 * @param count The number of characters to advance
	 * @returns A string containing all of the characters
	 * which were advanced past
	*/
	advance(count: number) {
		let skipped = ""
		for (let i = 0; !this.includeDone() && i < count; i++) {
			skipped += this.advanceOne()
		}
		return skipped
	}
	/** Moves forward in the text as long as a condition is met. 
	 * @param predicate A function which takes in a character
	 * and returns true while the lexer should continue to advance,
	 * and false once the lexer should stop advancing
	 * @returns A string containing all of the characters
	 * which were advanced past
	*/
	advanceWhile(predicate: (char: string) => boolean) {
		let skipped = ""
		while (!this.includeDone() && predicate(this.current())) {
			skipped += this.advanceOne()
		}
		return skipped
	}

	/** Moves forward in the text until as a condition is met.
	 * @param predicate A function which takes in a character
	 * and returns false while the lexer should continue to advance,
	 * and true once the lexer should stop advancing
	 * @returns A string containing all of the characters
	 * which were advanced past
	*/
	advanceUntil(predicate: (char: string) => boolean) {
		return this.advanceWhile((c) => !predicate(c))
	}

	/** Moves forward in the text until as a character is found. 
	 * @param character The character to find
	 * @returns A string containing all of the characters
	 * which were advanced past before this character
	*/
	advanceUntilChar(character: string) {
		return this.advanceUntil(() => this.current() === character)
	}

	/** Moves forward to the next non-whitespace character.
	 * @returns A string containing all of the whitespace characters
	 * which were advanced past
	*/
	skipWhitespace() {
		this.advanceWhile(isWhitespace)
	}
	/** Moves forward to the next non-comment character. 
	 * @param startChar The current character
	 * @returns The first non-comment character
	*/
	skipComments(startChar?: string) {
		let currentChar = startChar
		while ((currentChar = this.current()) === "#") {
			this.advanceUntilChar("\n")
			this.skipWhitespace()
		}
		return currentChar
	}


	/** Returns a character relatively indexed from the current one.
	 * @param offset The index from the current character
	 * @returns The character at the given index from the current one.
	*/
	get(offset: number = 0) {
		return this.deepestSource.text[this.deepestSource.index + offset]
	}

	/** Returns a string representing the current location in the lexer source. 
	 * @param location The location to stringify
	 * @returns A string representing the current location in the lexer source
	*/
	locationString(location: SourceLocation) {
		return `${this.deepestSource.name}:${location.line + 1}:${location.column + 1}`
	}

	/** Returns whether or not the lexer source is completely consumed.
	 * @returns True if the lexer source is completely consumed, false otherwise
	 */
	done() {
		return this.index >= this.text.length && (this.includeDone())
	}

	/** Returns whether or not the included lexer source is completely consumed.
	 * @returns True if the included lexer source is completely consumed, false otherwise
	 */
	includeDone() {
		return this.deepestSource.index >= this.deepestSource.text.length
	}

	/** Parses a string literal. 
	 * @param endChar The character to signify the end of the string
	 * @returns The string which was parsed
	*/
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

	/** Returns the next token in the lexer source. 
	 * @returns The token which was read
	*/
	readToken(): Token {
		const token = this.deepestScope.nextTokens.length ? this.deepestScope.nextTokens.shift() : this.parseToken()
		if (token)
			this.deepestScope.prevTokens.push(token)
		return token
	}
	/** Parses the next token in the lexer source. 
	 * @returns The token which was read
	*/
	parseToken(): Token {
		const token = this.getToken()
		// console.log(token ? tokenString(token) : "UF", token?.type, this.includeDone(), this.done(), this.scopeStack.length)
		if (this.includeDone() && this.includes) {
			this.deepestSource.includedIn.includes = null
		}
		return token
	}
	/** Parses the next token in the lexer source. 
	 * @returns The token which was read
	*/
	getToken(): Token {
		assert(!this.done(), "Tried to read token after end of file")

		// Skip comments
		this.skipWhitespace()
		let currentChar = this.skipComments()
		if (this.includeDone()) {
			return
		}
		const tokenLocation = { ...this.deepestSource.location, sourceName: this.deepestSource.name }

		/// Block expressions and comments
		switch (currentChar) {
			// Testing for unary negation
			// this.advanceOne()
			// return makeToken(TokenType.OpenList, tokenLocation)
			case BlockStart:
			case ListStart:
				this.advanceOne()
				const tokens: Token[] = []
				const { end, type } = DelimiterEnds[currentChar]

				if (currentChar === BlockStart) {
					this.scopeStack.push({ prevTokens: [], nextTokens: [] })
					// console.log("{")
				}

				this.skipWhitespace()
				this.skipComments()
				while (this.current() != end) {
					// this.skipWhitespace()
					// this.skipComments()
					if (this.includeDone()) {
						const message = currentChar === '{' ? `Unbalanced code block brackets` : `Unbalanced array brackets`
						// errorLogger.log(message)
						errorLogger.styleLogPrefix()
						errorLogger.styleLogWithoutAffix(this.locationString(tokenLocation))
						errorLogger.styleLogWithoutAffix("\n\t")
						errorLogger.styleLogWithoutAffix(message)
						errorLogger.styleLogSuffix()
						errorLogger.flush()
						assert(!this.includeDone(), message)
					}


					const token = this.parseToken()
					this.skipWhitespace()
					this.skipComments()
					tokens.push(token)
				}
				if (currentChar === BlockStart) {
					this.scopeStack.pop()
					// console.log("}")
				}

				this.advanceOne()

				return makeToken(type, tokenLocation, { tokens, end: { ...this.location }, name: null }) as Token
			case BlockEnd:
				throw ("Unbalanced block end")
			// this.advanceOne()
			// return makeToken(TokenType.CloseBlock, tokenLocation)
			case ListEnd:
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
			let includeFilename = null
			if (currentChar == "\"") {
				const includePath = this.readStringLiteral()
				if (this.current() !== '"') {
					throw ("Unterminated include path")
				}
				includeFilename = path.resolve(this.deepestSource.name, "../", includePath)
				this.advanceOne()
			}
			else if (currentChar == "<") {
				const includePath = this.readStringLiteral(">")
				if (this.current() !== '>') {
					throw ("Unterminated include path")
				}
				includeFilename = path.resolve(StandardLibraryDirectory, includePath)
			}
			else if (currentChar == "o") {
				const fileName = this.deepestSource.name
				this.advanceOne()
				let nChar = this.current()
				this.advanceOne()
				let cChar = this.current()
				this.advanceOne()
				let eChar = this.current()
				if (nChar == "n" && cChar == "c" && eChar == "e") {
					this.advanceOne()
					this.filesNotToInclude.add(fileName)
					return
				}
				throw ("Invalid preprocessor command")
			}
			includeFilename = includeFilename ? toToastPath(includeFilename) : null
			if (includeFilename && !this.filesNotToInclude.has(includeFilename)) {
				// if (includeFilename) {
				this.advanceOne()
				const newSource = new LexerSourceFile(includeFilename);
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

/** A source file from which tokens can be read */
export class LexerSourceFile extends LexerSource {
	/** Creates a source file lexer
	 * @param path The file to lex
	*/
	constructor(path: string) {
		super()
		path = toToastPath(path)
		this.text = readFileSync(path).toString()
		this.name = path
	}
}
