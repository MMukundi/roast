export enum TokenType {
	/** [ */
	OpenList,
	/** ] */
	CloseList,

	/** { */
	OpenBlock,
	/** } */
	CloseBlock,

	/** " */
	Quote,

	/** [0-9]+ */
	Value,

	/** [a-zA-Z]+ */
	Name,

	/** "^["]+" */
	String,

	/** "^["]+" */
	CString,

	/** [ ...Tokens ] */
	List,

	/** { ...Tokens } */
	CodeBlock,
}

/** A list of tokens */
type TokenList = Token[]

/** The value expected for each TokenType */
export type TokenValues = {
	[TokenType.OpenList]: null
	[TokenType.CloseList]: null
	[TokenType.OpenBlock]: null
	[TokenType.CloseBlock]: null
	[TokenType.Quote]: null

	[TokenType.Name]: string
	[TokenType.Value]: number
	[TokenType.CodeBlock]: { tokens: TokenList, end: SourceLocation, name?: string }
	[TokenType.List]: { tokens: TokenList, end: SourceLocation, name?: string }
	[TokenType.String]: string
	[TokenType.CString]: string
}
/**  The strings for the tokens which have specific string constants */
const tokenStringConstants = {
	[TokenType.OpenList]: '[',
	[TokenType.CloseList]: ']',
	[TokenType.OpenBlock]: '{',
	[TokenType.CloseBlock]: '}',
	[TokenType.Quote]: '"'
}

/** The Token for a specific TokenType */
type SpecificToken<T extends TokenType> = { type: T, value: TokenValues[T], location: SourceLocation }
/** The Token expected for each TokenType */
export type TokenMap = {
	[tokenType in TokenType]: SpecificToken<tokenType>
}

/** Any Token */
export type Token = TokenMap[TokenType]
export type SourceLocation = {
	line: number
	column: number
}
/** Creates a token of the given type */
export function makeToken<T extends TokenType>(type: T, location: SourceLocation, value?: TokenValues[T]): SpecificToken<T> {
	return { type, value, location }
}
export function tokenString(token: Token): string {
	switch (token.type) {
		case TokenType.CodeBlock:
			const values = token.value.tokens
			const firsts: TokenList = values.slice(0, 3)
			let summary: TokenList[] = (firsts.length + 2 >= values.length) ? [firsts] : [firsts, [values[values.length - 1]]]
			return (`CodeBlock<${values.length} instructions>{${summary.map(tokenList => tokenList.map(summaryToken => tokenString(summaryToken))).join("...")}}`)
		case TokenType.Name:
			// 	if (false)
			// 		// if (this.BuiltIns[value[1]])
			// 		return `BuiltIn[${token.value}]`
			// 	if (false)
			// 		// if (this.definitions[value[1]])
			// 		return `Variable[${token.value}]`
			return `Name[${token.value}]`;
		case TokenType.OpenBlock:
		case TokenType.CloseBlock:
		case TokenType.OpenList:
		case TokenType.CloseList:
			return tokenStringConstants[token.type]
		default:
			return token.value as string
	}
}