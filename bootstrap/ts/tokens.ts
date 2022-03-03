export enum TokenType {
	/** [0-9]+ */
	Integer,

	/** [a-zA-Z]+ */
	Name,

	/** true, false */
	Boolean,

	/** "^["]+" */
	String,

	/** "^["]+" */
	StringPointer,

	/** [ ...Tokens ] */
	Array,

	/** { ...Tokens } */
	CodeBlock,

	/** A system code */
	Syscode,

	/** for, if, else, ... */
	Keyword,

	/** >>, << */
	ShiftOperator,

	/** +, -, *, /, % */
	MathOperator,

	/** &, |, ~ */
	BitwiseOperator,

	/** &&, ||, ! */
	LogicOperator,

	/** >=, <=, >, <, =, != */
	ComparisonOperator,

	/** call */
	Call,

	/** pop,swap,... */
	BuiltInFunction,

	Char,
}

/** A list of tokens */
type TokenList = Token[]

/** The value expected for each TokenType */
export type TokenValues = {
	// TODO! Figure out the types for the new types
	[TokenType.Syscode]: any
	[TokenType.MathOperator]: '+' | '-' | '*' | '/' | '%'
	[TokenType.ShiftOperator]: '>>' | '<<'
	[TokenType.BitwiseOperator]: '&' | '|' | '~' | '^'
	[TokenType.LogicOperator]: '&&' | '||' | '!',
	[TokenType.ComparisonOperator]: '>=' | '<=' | '>' | '<' | '=' | '!='
	[TokenType.BuiltInFunction]: string
	[TokenType.Call]: undefined,

	[TokenType.Char]: string,


	[TokenType.Keyword]: string

	[TokenType.Boolean]: boolean
	[TokenType.Name]: string
	[TokenType.Integer]: number
	[TokenType.CodeBlock]: { tokens: TokenList, end: SourceLocation, name?: string, index: number }
	[TokenType.Array]: { tokens: TokenList, end: SourceLocation, name?: string, index: number }
	[TokenType.String]: string
	[TokenType.StringPointer]: string
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
	/** The number of lines to skip from the beginning of the file */
	line: number
	/** The number of characters to skip from the beginning of the line */
	column: number
	/** The name of the current source */
	sourceName: string,
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

		case TokenType.Call:
			return `<Call>`;
		case TokenType.Name:
			return `Name[${token.value}]`;

		default:
			return token.value as string
	}
}


export const TokenTypeNames: Record<TokenType, string> = {
	[TokenType.Syscode]: "Syscode",
	[TokenType.MathOperator]: "MathOperator",
	[TokenType.ShiftOperator]: "ShiftOperator",
	[TokenType.BitwiseOperator]: "BitwiseOperator",
	[TokenType.LogicOperator]: "LogicOperator",
	[TokenType.ComparisonOperator]: "ComparisonOperator",
	[TokenType.BuiltInFunction]: "BuiltInFunction",
	[TokenType.Call]: "Call",
	[TokenType.Char]: "Char",
	[TokenType.Keyword]: "Keyword",
	[TokenType.Boolean]: "Boolean",
	[TokenType.Name]: "Name",
	[TokenType.Integer]: "Integer",
	[TokenType.CodeBlock]: "CodeBlock",
	[TokenType.Array]: "Array",
	[TokenType.String]: "String",
	[TokenType.StringPointer]: "StringPointer",
}