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

	/** [ ...Tokens ] */
	List,

	/** { ...Tokens } */
	CodeBlock,
}

/** A list of tokens */
type TokenList = Token[]

/** The value expected for each TokenType */
type TokenValueMap = {
	[TokenType.OpenList]: null
	[TokenType.CloseList]: null
	[TokenType.OpenBlock]: null
	[TokenType.CloseBlock]: null
	[TokenType.Quote]: null

	[TokenType.Name]: string
	[TokenType.Value]: number
	[TokenType.CodeBlock]: TokenList
	[TokenType.List]: TokenList
	[TokenType.String]: string
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
type SpecificToken<T extends TokenType> = { type: T, value: TokenValueMap[T] }
/** The Token expected for each TokenType */
type TokenMap = {
	[tokenType in TokenType]: SpecificToken<tokenType>
}

/** Any Token */
export type Token = TokenMap[TokenType]

/** Creates a token of the given type */
export function makeToken<T extends TokenType>(type: T, value?: TokenValueMap[T]): SpecificToken<T> {
	return { type, value }
}
export function tokenString(token: Token): string {
	switch (token.type) {
		case TokenType.CodeBlock:
			const values = token.value
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