import { errorLogger } from "./loggers"
import { Compiler } from "./parser"
import { Token, ToastType, SourceLocation } from "./tokens"
import { Type } from "./types"
import { TypeConstraint, SpecificTypeConstraint, TypeNames, Signature, NameMap, BuiltInFunctionSignature, TokenConstraint, NameConstraint } from "./types"

interface CheckerScope {
	typeStack: TypeConstraint[]
	inputsNeeded: TypeConstraint[]
}

export class TypeChecker {
	static CommandLineArguments = [
		new SpecificTypeConstraint({ sourceName: "Command arguments", line: 0, column: 0 }, Type.Pointer),
		new SpecificTypeConstraint({ sourceName: "Command argument count", line: 0, column: 0 }, Type.Integer),
	]
	getInputLocation(index: number): SourceLocation {
		return this.getCurrentScope().inputsNeeded[index].location
	}
	getOutputLocation(index: number): SourceLocation {
		return this.getCurrentScope().typeStack[index].location
	}
	constructor(private compiler: Compiler) { }
	scopeStack: CheckerScope[] = [{
		typeStack: [],
		inputsNeeded: []
	}]
	nameMap: NameMap = {}
	missingNames: NameMap = {}
	blockTypes: Record<number, Signature> = {}

	logError(message: string, location: SourceLocation) {
		this.compiler.errorHere(message, location)
	}

	getCurrentScope(): CheckerScope {
		return this.scopeStack[this.scopeStack.length - 1]
	}

	addScope() {
		const newScope: CheckerScope = {
			typeStack: [],
			inputsNeeded: [],
		}
		this.scopeStack.push(newScope)
		return newScope
	}
	removeScope() {
		return this.scopeStack.pop()
	}

	expect(typesToExpect: SpecificTypeConstraint[]) {
		const { typeStack, inputsNeeded } = this.getCurrentScope()
		for (const expectedType of typesToExpect) {
			// console.log(TypeNames[expectedType.type], typesToExpect.map(x => TypeNames[x.type]), typeStack.length, typeStack.map(x => TypeNames[x.getType()?.type]))
			if (typeStack.length) {
				if (!typeStack[typeStack.length - 1].canConvertTo(expectedType.type)) {
					const actualType = typeStack[typeStack.length - 1].getType()
					this.logError(`Cannot convert ${TypeNames[actualType?.type]} to ${TypeNames[expectedType.type]}\n\t - ${TypeNames[actualType?.type]} introduced ${this.compiler.source.locationString(actualType.location)}\n\t - ${TypeNames[expectedType.type]} introduced ${this.compiler.source.locationString(expectedType.location)}`, expectedType.location)
				}
				typeStack.pop()
			} else {
				inputsNeeded.push(expectedType)
			}
		}
	}

	apply(signature: Signature) {
		const { typeStack } = this.getCurrentScope()
		this.expect(signature.inputs)
		typeStack.push(...signature.outputs)
	}

	typeCheck(tokens: Token[]): Signature {
		const { typeStack, inputsNeeded } = this.getCurrentScope()

		let lastToken = null
		let lastLastToken = null
		for (let token of tokens) {
			if (lastToken?.type === ToastType.Name) {
				const nameToken: Token = lastToken;
				if (token && token.type == ToastType.Keyword && token.value == "def") {
					// Removing variable name from stack
					typeStack.pop()
					const valueType = typeStack.pop()

					if (valueType == undefined) {
						this.logError("Definition with no value", valueType.location)
					} else {
						const missingType = this.missingNames[nameToken.value]
						if (missingType) {
							if (valueType.canConvertTo(missingType.getType().type)) {
								this.nameMap[nameToken.value] = valueType
							} else {
								const actualType = valueType.getType()
								const expectedType = missingType.getType()
								this.logError(`Cannot convert ${TypeNames[actualType?.type]} to ${TypeNames[expectedType.type]}\n\t - ${TypeNames[actualType?.type]} introduced ${this.compiler.source.locationString(actualType.location)}\n\t - ${TypeNames[expectedType.type]} needed ${this.compiler.source.locationString(expectedType.location)}`, expectedType.location)
							}
						} else {
							this.nameMap[nameToken.value] = valueType
						}
					}
					continue
				}
			}
			lastLastToken = lastToken
			lastToken = token



			switch (token.type) {
				case ToastType.Call:
					const valueType = typeStack.pop();
					console.log(valueType)
					const functionToken = valueType.getToken()

					if (functionToken?.type == ToastType.CodeBlock) {
						const functionSignature = this.blockTypes[functionToken.value.index]
						this.apply(functionSignature)

					} else {
						console.log(functionToken, TypeNames[functionToken.type], functionToken.value)
						throw "Cannot type recursive functions."
						// console.log("FUNC", valueType, this.nameMap, functionToken)
						// // throw "AAA"
						// if (this.missingNames[functionToken.value]) {

						// 	// if (this.missingNames[functionToken.value])
						// }
						// // this.missingNames[]
					}

					break;
				case ToastType.BuiltInFunction:
					this.apply(BuiltInFunctionSignature[token.value](this, token.location))

					break;
				case ToastType.Name:
					typeStack.push(new NameConstraint(token, this.nameMap))
					break;
				case ToastType.CodeBlock:
					if (!this.blockTypes[token.value.index]) {
						this.addScope()
						this.blockTypes[token.value.index] = this.typeCheck(token.value.tokens);
						this.removeScope()
					}
					typeStack.push(new TokenConstraint(token, this.nameMap))
					break;
				case ToastType.MathOperator:
					this.apply({
						inputs: [new SpecificTypeConstraint(token.location, Type.Integer), new SpecificTypeConstraint(token.location, Type.Integer)],
						outputs: [new SpecificTypeConstraint(token.location, Type.Integer)]
					})
					break;
				case ToastType.String:
					typeStack.push(new TokenConstraint({ ...token, type: ToastType.StringPointer }, this.nameMap))
					typeStack.push(new SpecificTypeConstraint(token.location, Type.Integer))
					break;
				default:
					typeStack.push(new TokenConstraint(token, this.nameMap))
					break;
			}
		}

		return {
			inputs: inputsNeeded as SpecificTypeConstraint[],
			outputs: typeStack as SpecificTypeConstraint[]
		}

	}
}