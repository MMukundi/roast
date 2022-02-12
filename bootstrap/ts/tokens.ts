export enum ToastType {
	// Deprecated delimiter tokens
	// /** [ */
	// OpenArray,
	// /** ] */
	// CloseArray,

	// /** { */
	// OpenBlock,
	// /** } */
	// CloseBlock,

	// /** " */
	// Quote,

	/** Unknown */
	Any,

	/** [0-9]+ */
	Integer,

	/** [a-zA-Z]+ */
	Name,

	/** true, false */
	Boolean,

	/** "^["]+" */
	String,

	/** "^["]+" */
	CString,

	/** [ ...Tokens ] */
	Array,

	/** { ...Tokens } */
	CodeBlock,

	/** Built-in function, user defined operation */
	FunctionPointer,

	/** Any pointer */
	Pointer,

	/** A block of addressable memory */
	MemoryRegion,

	/** A system code */
	Syscode,

	/** for, if, else, ... */
	Keyword,

	/** +, -, *, /, % */
	MathOperator,

	/** &, |, ! */
	BitwiseOperator,
}

/** A list of tokens */
type TokenList = Token[]

/** The value expected for each TokenType */
export type TokenValues = {
	// TODO! Figure out the types for the new types
	[ToastType.Pointer]: any
	[ToastType.FunctionPointer]: any
	[ToastType.MemoryRegion]: any
	[ToastType.Syscode]: any
	[ToastType.Keyword]: any
	[ToastType.MathOperator]: any
	[ToastType.BitwiseOperator]: any

	[ToastType.Any]: any
	[ToastType.Boolean]: boolean
	[ToastType.Name]: string
	[ToastType.Integer]: number
	[ToastType.CodeBlock]: { tokens: TokenList, end: SourceLocation, name?: string }
	[ToastType.Array]: { tokens: TokenList, end: SourceLocation, name?: string }
	[ToastType.String]: string
	[ToastType.CString]: string
}

/** The Token for a specific TokenType */
type SpecificToken<T extends ToastType> = { type: T, value: TokenValues[T], location: SourceLocation }
/** The Token expected for each TokenType */
export type TokenMap = {
	[tokenType in ToastType]: SpecificToken<tokenType>
}

/** Any Token */
export type Token = TokenMap[ToastType]
export type SourceLocation = {
	/** The number of lines to skip from the beginning of the file */
	line: number
	/** The number of characters to skip from the beginning of the line */
	column: number
	/** The name of the current source */
	sourceName: string,
}
/** Creates a token of the given type */
export function makeToken<T extends ToastType>(type: T, location: SourceLocation, value?: TokenValues[T]): SpecificToken<T> {
	return { type, value, location }
}
export function tokenString(token: Token): string {
	switch (token.type) {
		case ToastType.CodeBlock:
			const values = token.value.tokens
			const firsts: TokenList = values.slice(0, 3)
			let summary: TokenList[] = (firsts.length + 2 >= values.length) ? [firsts] : [firsts, [values[values.length - 1]]]
			return (`CodeBlock<${values.length} instructions>{${summary.map(tokenList => tokenList.map(summaryToken => tokenString(summaryToken))).join("...")}}`)
		case ToastType.Name:
			return `Name[${token.value}]`;

		default:
			return token.value as string
	}
}