import assert from "assert"
import { openSync, readFileSync } from "fs"
import path from "path"
import { StandardLibraryDirectory } from "./arguments"
import { errorLogger } from "./loggers"
import { makeToken, SourceLocation, Token, tokenString, ToastType, TokenValues } from "./tokens"
import { BuiltInFunctionSignature, Signature, SpecificTypeConstraint } from "./types"
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

/** The symbol which marks the beginning of an array */
const ArrayStart = '['
/** The symbol which marks the end of a array */
const ArrayEnd = ']'

const DelimiterEnds = {
	[BlockStart]: {
		end: BlockEnd,
		type: ToastType.CodeBlock
	},
	[ArrayStart]: {
		end: ArrayEnd,
		type: ToastType.Array
	},
} as const

/** Special characters which should not be included in the variable names */
const ToastDelimiters = new Set([BlockStart, BlockEnd, ArrayStart, ArrayEnd])

const MathOperators: Set<string> = new Set(['+', '-', '*', '/', '%'] as const)
const ShiftOperators: Set<string> = new Set(['>>', '<<'])
const BitwiseOperators: Set<string> = new Set(['&', '|', '~', '^'])
const LogicOperators: Set<string> = new Set(['&&', '||', '!'])
const Keywords: Set<string> = new Set(['def', 'if', 'ifelse', 'redef'])

/** A token scope containing all past and future tokens which have been parsed */
export interface Scope {
	/** The locations where each variable is used */
	variableUses: Record<string, Set<SourceLocation>>

	/** The locations where each variable is defined */
	variableDefinitions: Record<string, Set<SourceLocation>>

	/** The locations where each function is defined */
	functionDefinitions: Record<string, Set<SourceLocation>>

	parent?: Scope
}

// TODO: This was previously abstract; was there a reason why?
/** A location from which tokens can be read */
export class LexerSource {

	currentIndices = {
		[BlockStart]: 0,
		[ArrayStart]: 0,
	}

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
	/** The source at the top of the include stack. */
	get deepestSource(): LexerSource {
		return this.includes ? this.includes.deepestSource : this
	}

	// /** The scope at the top of the scope stack. */
	// get deepestScope(): Scope {
	// 	return this.scopeStack[this.scopeStack.length - 1]
	// }

	// /** The scope at the bottom of the scope stack. */
	// get globalScope(): Scope {
	// 	return this.scopeStack[0]
	// }

	// /** Iterates over all tokens in the global scope. */
	// [Symbol.iterator]() {
	// 	return this.globalScope.prevTokens[Symbol.iterator]()
	// }

	/** Gets all of the tokens in the source. */
	getAllTokens() {
		const tokens = []
		const globalScope: Scope = {
			variableUses: {},
			variableDefinitions: {},

			functionDefinitions: {},

			parent: undefined
		}

		const currentScope: Scope = globalScope

		let lastToken = null
		let lastLastToken = null
		while (!this.done()) {
			const token = this.readToken()
			if (token) {
				tokens.push(token)

				if (lastToken?.type === ToastType.Name) {
					if (token && token.type == ToastType.Keyword && token.value == "def") {
						const map = (lastLastToken && lastLastToken.type == ToastType.CodeBlock) ? currentScope.functionDefinitions : currentScope.variableDefinitions

						map[lastToken.value] = map[lastToken.value] || new Set()
						map[lastToken.value].add(token.location)
					}
					else {
						currentScope.variableUses[lastToken.value] = currentScope.variableUses[lastToken.value] || new Set()
						currentScope.variableUses[lastToken.value].add(lastToken.location)
					}
				}
				lastLastToken = lastToken
				lastToken = token
			}
		}
		this.functionDefinitions = globalScope.functionDefinitions
		this.variableDefinitions = globalScope.variableDefinitions
		this.variableUses = globalScope.variableUses
		return tokens
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
		const token = this.parseToken()
		return token
	}
	/** Parses the next token in the lexer source. 
	 * @returns The token which was read
	*/
	parseToken(): Token {
		const token = this.getToken()
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
			// return makeToken(TokenType.OpenArray, tokenLocation)
			case BlockStart:
			case ArrayStart:
				this.advanceOne()
				const tokens: Token[] = []
				const { end, type } = DelimiterEnds[currentChar]



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

				this.advanceOne()

				return makeToken(type, tokenLocation, { tokens, end: { ...this.location }, name: null, index: (this.currentIndices[currentChar]++) }) as Token
			case BlockEnd:
				throw ("Unbalanced block end")
			// this.advanceOne()
			// return makeToken(TokenType.CloseBlock, tokenLocation)
			case ArrayEnd:
				// this.advanceOne()
				// return makeToken(TokenType.CloseArray, tokenLocation)
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
				return makeToken(ToastType.Integer, tokenLocation, (escape ? escapeChar(char) : char).charCodeAt(0))
			}
			case "\"": {
				const stringLiteral = this.readStringLiteral()
				if (this.current() !== '"') {
					throw ("Unterminated string literal")
				}
				this.advanceOne()
				if (this.current() === 'c') {
					this.advanceOne()
					return makeToken(ToastType.CString, tokenLocation, stringLiteral)
				}
				return makeToken(ToastType.String, tokenLocation, stringLiteral)
			}
		}

		// Testing for unary negation
		let firstChar = currentChar
		if (currentChar == NegativeSign || currentChar == IncludeSign) {
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
			return makeToken(ToastType.MathOperator, tokenLocation, '%')
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
			return makeToken(ToastType.Integer, tokenLocation, value)
		} else {
			/**
			case '>=':
				compiler.assemblySource += `\ttoastStackCompare ge\n`;
				return;
			case '<=':
				compiler.assemblySource += `\ttoastStackCompare le\n`;
				return;

			case '>':
				compiler.assemblySource += `\ttoastStackCompare g\n`;
				return;
			case '<':
				compiler.assemblySource += `\ttoastStackCompare l\n`;
				return;
			case '=':
				compiler.assemblySource += `\ttoastStackCompare e\n`;
				return;

			case '!=':
				compiler.assemblySource += `\ttoastStackCompare ne\n`;
				return; */
			switch (firstChar) {
				case '+': case '-': case '/': case '*': case '%':
					if (firstChar != NegativeSign && firstChar != IncludeSign) {
						this.advanceOne()
					}
					return makeToken(ToastType.MathOperator, tokenLocation, firstChar as TokenValues[ToastType.MathOperator])
				case '!':
					this.advanceOne()
					if (this.current() == "=") {
						this.advanceOne()
						return makeToken(ToastType.Name, tokenLocation, "!=")
					}
					return makeToken(ToastType.LogicOperator, tokenLocation, `!`)
				case '&': case '|':
					this.advanceOne()
					currentChar = this.current()
					if (currentChar == firstChar) {
						this.advanceOne()
						return makeToken(ToastType.LogicOperator, tokenLocation, `${currentChar}${currentChar}` as TokenValues[ToastType.LogicOperator])
					}
				case '~':
				case '^':
					this.advanceOne()
					return makeToken(ToastType.BitwiseOperator, tokenLocation, firstChar)

				case '>': case '<':
					this.advanceOne()
					currentChar = this.current()
					if (currentChar == firstChar) {
						this.advanceOne()
						return makeToken(ToastType.ShiftOperator, tokenLocation, `${firstChar}${firstChar}` as TokenValues[ToastType.ShiftOperator])
					}
					if (currentChar == "=") {
						this.advanceOne()
						return makeToken(ToastType.ComparisonOperator, tokenLocation, `${firstChar}=` as TokenValues[ToastType.ComparisonOperator])
					}
					return makeToken(ToastType.ComparisonOperator, tokenLocation, firstChar)
				case '=':
					this.advanceOne()
					return makeToken(ToastType.ComparisonOperator, tokenLocation, firstChar)

				default:
					{

						const name = this.advanceWhile(() => {
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

						if (name == "call") {
							return makeToken(ToastType.Call, tokenLocation)
						}
						if (Keywords.has(name)) {
							return makeToken(ToastType.Keyword, tokenLocation, name)
						}
						if (name in BuiltInFunctionSignature) {
							return makeToken(ToastType.BuiltInFunction, tokenLocation, name)
						}


						return makeToken(ToastType.Name, tokenLocation, name)
					}
			}
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
