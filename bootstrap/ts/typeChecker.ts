import { type } from "os"
import { BuiltInFunctionSignature } from "./builtIns"
import { Token, TokenType } from "./tokens"
import { ConstantType, ExpressionType, Signature, TypeExpression } from "./typeInference"
import { Type } from "./types"

class TypeCheckerNotYetImplementedError extends Error {
	constructor(featureName: string) {
		super(`Type checker has not yet implemented feature '${featureName}'`)
	}
}

const integer = new ConstantType(Type.Integer)
export class TypeChecker {
	expect(actual: TypeExpression[], expected: TypeExpression[]) {
		//TODO: Type checking
	}
	infer(tokens: Token[]): Signature {
		const types: TypeExpression[] = []
		for (const token of tokens) {
			if (token.type == TokenType.BuiltInFunction) {
				const signature = BuiltInFunctionSignature[token.value]
				const inputs = types.splice(types.length - signature.inputs.length, signature.inputs.length)
				this.expect(inputs, signature.inputs)
				types.push(...signature.outputs)
			} else if (token.type == TokenType.MathOperator) {
				const inputs = types.splice(types.length - 2, 2)
				this.expect(inputs, [integer, integer])
				types.push(integer)
			}
			else if (token.type == TokenType.Integer) {
				types.push(integer)
			} else {
				throw new TypeCheckerNotYetImplementedError(`Checking ${token.type}`)
			}
			console.log(types)
		}
		throw new TypeCheckerNotYetImplementedError('Type inference')
	}
}