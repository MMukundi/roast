import { Token } from "./tokens"
import { Signature } from "./typeInference"

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