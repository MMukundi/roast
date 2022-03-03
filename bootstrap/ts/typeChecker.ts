import { errorLogger } from "./loggers"
import { Compiler } from "./parser"
import { Token, TokenType, SourceLocation } from "./tokens"
import { Type } from "./types"
import { TypeConstraint, SpecificTypeConstraint, TypeNames, Signature, NameMap, BuiltInFunctionSignature, TokenConstraint, NameConstraint } from "./types"

class TypeCheckerNotYetImplementedError extends Error {
	constructor(featureName: string) {
		super(`Type checker has not yet implemented feature '${featureName}'`)
	}
}


export class TypeChecker {
	infer(tokens: Token[]): Signature {
		throw new TypeCheckerNotYetImplementedError('Type inference')
	}
}