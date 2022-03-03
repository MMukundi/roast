import { type } from "os"
import { BuiltInFunctionSignature } from "./builtIns"
import { Token, TokenType } from "./tokens"
import { ConstantType, ExpressionType, SequenceType, Signature, TypeExpression, TypeFunction } from "./typeInference"
import { Type } from "./types"

class TypeCheckerNotYetImplementedError extends Error {
	constructor(featureName: string) {
		super(`Type checker has not yet implemented feature '${featureName}'`)
	}
}

const integer = new ConstantType(Type.Integer)
const stringType = new ConstantType(Type.StringPointer)
export class TypeChecker {
	expect(actual: TypeExpression[], expected: TypeExpression[]) {
		//TODO: Type checking
	}
	infer(tokens: Token[]): Signature {
		const types: TypeExpression[] = []
		for (const token of tokens) {
			if (token.type == TokenType.BuiltInFunction) {
				const signature = BuiltInFunctionSignature[token.value].instantiate() as TypeFunction

				// It is known to be
				const expectedSequence = signature.input as SequenceType

				const actualSequence = new SequenceType(types.splice(types.length - expectedSequence.types.length, expectedSequence.types.length))
				console.log(`Trying to unify ${actualSequence.toString()}(actual) and ${expectedSequence.toString()}(expected)`)
				console.log(actualSequence.unify(expectedSequence))

				// this.expect(actualSequence, signature.inputs)
				types.push(...(signature.output as SequenceType).types)
			} else if (token.type == TokenType.MathOperator) {
				const inputs = types.splice(types.length - 2, 2)
				this.expect(inputs, [integer, integer])
				types.push(integer)
			}
			else if (token.type == TokenType.Integer) {
				types.push(integer)
			}
			else if (token.type == TokenType.StringPointer) {
				types.push(stringType)
			} else {
				throw new TypeCheckerNotYetImplementedError(`Checking ${token.type}`)
			}
			console.log(new SequenceType(types).toString())
		}
		throw new TypeCheckerNotYetImplementedError('Type inference')
	}
}