import { type } from "os"
import { BuiltInFunctionSignature } from "./builtIns"
import { Token, TokenType } from "./tokens"
import { ConstantType, ExpressionType, Scheme, SequenceType, Signature, TypeExpression, TypeFunction } from "./typeInference"
import { Type } from "./types"

class TypeCheckerNotYetImplementedError extends Error {
	constructor(featureName: string) {
		super(`Type checker has not yet implemented feature '${featureName}'`)
	}
}

const integer = new ConstantType(Type.Integer)
const stringType = new ConstantType(Type.StringPointer)
const OperatorSignature = new TypeFunction(new SequenceType([integer, integer]), new SequenceType([integer])).generalize()
const IntSignature = new TypeFunction(new SequenceType([]), new SequenceType([integer])).generalize()
const BoolSignature = new TypeFunction(new SequenceType([]), new SequenceType([stringType])).generalize()
export class TypeChecker {
	typeStack: SequenceType = new SequenceType([])
	expect(signature: Scheme) {
		//TODO: Type checking
		// It is known to be
		const instantiatedSignature = signature.instantiate() as TypeFunction
		const expectedSequence = instantiatedSignature.input as SequenceType

		// console.log('Function Signature:', instantiatedSignature.toString())

		const [rest, actualSequence] = this.typeStack.splitAt(this.typeStack.length() - expectedSequence.length())
		// console.log(`Unifying: ${actualSequence.toString()}(actual) and ${expectedSequence.toString()}(expected)`)
		const substitution = actualSequence.unify(expectedSequence)

		this.typeStack = rest.concatenateSequence(instantiatedSignature.output as SequenceType).substitute(substitution)
		// console.log("Stack:", this.typeStack.toString())
	}
	infer(tokens: Token[]): Signature {

		for (const token of tokens) {
			if (token.type == TokenType.BuiltInFunction) {
				const signature = BuiltInFunctionSignature[token.value]
				this.expect(signature)
			} else if (token.type == TokenType.MathOperator) {
				this.expect(OperatorSignature)
			}
			else if (token.type == TokenType.Integer) {
				this.expect(IntSignature)
			}
			else if (token.type == TokenType.StringPointer) {
				this.expect(BoolSignature)
			} else {
				throw new TypeCheckerNotYetImplementedError(`Checking ${token.type}`)
			}
		}
		throw new TypeCheckerNotYetImplementedError('Type inference')
	}
}