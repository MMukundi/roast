export enum TokenType {
	// [
	OpenList,
	// ]
	CloseList,

	// {
	OpenBlock,

	// }
	CloseBlock,

	// "
	Quote,

	// [0-9]+
	Value,

	// [a-zA-Z]+
	Name,

	// "^["]+"
	String,

	// [ ...Tokens ]
	List,

	// { ...Tokens }
	CodeBlock,
}

// A list of tokens
type TokenList = TokenList[]

// The value expected for each TokenType
type TokenValueMap = {
	[TokenType.OpenList]: '[',
	[TokenType.CloseList]: ']'
	[TokenType.OpenBlock]: '{',
	[TokenType.CloseBlock]: '}'
	[TokenType.Quote]: '"'
	[TokenType.Name]: string
	[TokenType.Value]: number
	[TokenType.CodeBlock]: TokenList
	[TokenType.List]: TokenList
	[TokenType.String]: string
}

// The Token expected for each TokenType
type TokenMap = {
	[tokenType in TokenType]: { type: tokenType, value: TokenValueMap[tokenType] }
}
// A Token
export type Token = TokenMap[TokenType]
