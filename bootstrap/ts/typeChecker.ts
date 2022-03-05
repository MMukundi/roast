import { type } from "os"
import { BuiltInFunctionSignature } from "./builtIns"
import { Token, tokenString, TokenType } from "./tokens"
import { compose, ConstantType, ExpressionType, Scheme, SequenceType, Signature, Substitution, TypeEnvironment, TypeExpression, TypeFunction, TypeVariable } from "./typeInference"
import { Type } from "./types"

class TypeCheckerNotYetImplementedError extends Error {
	constructor(featureName: string) {
		super(`Type checker has not yet implemented feature '${featureName}'`)
	}
}

const integer = new ConstantType(Type.Integer)
const stringType = new ConstantType(Type.StringPointer)
const boolType = new ConstantType(Type.Boolean)

const IntOperatorSignature = new TypeFunction(new SequenceType([integer, integer]), new SequenceType([integer])).generalize()
const BoolOperatorSignature = new TypeFunction(new SequenceType([boolType, boolType]), new SequenceType([boolType])).generalize()
const BoolUnaryOperatorSignature = new TypeFunction(new SequenceType([boolType]), new SequenceType([boolType])).generalize()
const CompOperatorSignature = new TypeFunction(new SequenceType([integer, integer]), new SequenceType([boolType])).generalize()



// const AnyFunc = new TypeFunction(new SequenceType([TypeVariable.fromInt(0)]), new SequenceType([TypeVariable.fromInt(1)])).generalize()
const AnyFunc = new TypeFunction(TypeVariable.fromInt(0), TypeVariable.fromInt(1)).generalize()

const IntSignature = new TypeFunction(new SequenceType([]), new SequenceType([integer])).generalize()
const StringPointerSignature = new TypeFunction(new SequenceType([]), new SequenceType([stringType])).generalize()
const NewVarSignature = new TypeFunction(new SequenceType([]), new SequenceType([TypeVariable.fromInt(0)])).generalize()
const DefSignature = new TypeFunction(new SequenceType([TypeVariable.fromInt(0), TypeVariable.fromInt(0)]), new SequenceType([])).generalize()
const StringSignature = new TypeFunction(new SequenceType([]), new SequenceType([stringType, integer])).generalize()

const IfElseSignature = new TypeFunction(
	new SequenceType([
		TypeVariable.fromInt(0),
		boolType,
		new TypeFunction(TypeVariable.fromInt(0), TypeVariable.fromInt(1)),
		new TypeFunction(TypeVariable.fromInt(0), TypeVariable.fromInt(1))
	]),
	new SequenceType([TypeVariable.fromInt(1)])).generalize()
const IfSignature = new TypeFunction(new SequenceType([boolType, new TypeFunction(TypeVariable.fromInt(0), TypeVariable.fromInt(1))]), new SequenceType([TypeVariable.fromInt(1)])).generalize()

export class TypeChecker {
	inputStack: TypeExpression[] = []

	typeStack: SequenceType = new SequenceType([])

	substitution: Substitution = new Map()
	environment: TypeEnvironment = new TypeEnvironment()

	popN(n: number) {
		const numMissing = n - this.typeStack.length()
		if (numMissing > 0) {
			const missingVars = []
			for (let i = 0; i < numMissing; i++) {
				const freshVar = TypeVariable.fresh()
				missingVars.unshift(freshVar)
			}
			this.inputStack.unshift(...missingVars)
			this.typeStack = new SequenceType(missingVars).concatenateSequence(this.typeStack)
		}
		let [rest, popped] = this.typeStack.splitAt(this.typeStack.length() - n)
		this.typeStack = rest
		return popped
	}

	unify(a: TypeExpression, b: TypeExpression) {
		const substitution = a.unify(b)
		this.substitution = compose(this.substitution, substitution)
		this.typeStack = this.typeStack.substitute(this.substitution)
		this.environment = this.environment.substitute(this.substitution)
	}
	expect(signature: Scheme) {
		//TODO: Type checking
		// It is known to be
		const instantiatedSignature = signature.instantiate() as TypeFunction
		const substitutedSignature = instantiatedSignature.substitute(this.substitution) as TypeFunction
		// console.log(signature.toString(), instantiatedSignature.toString(), substitutedSignature.toString(), this.substitution, this.environment)
		const expectedSequence = substitutedSignature.input
		// console.log(substitutedSignature.toString(), new TypeFunction(new SequenceType(this.inputStack), this.typeStack).substitute(this.substitution).toString())

		const actualSequence = this.popN(expectedSequence.expressionType == ExpressionType.Sequence ? (expectedSequence as SequenceType).length() : 1)

		this.typeStack = this.typeStack.concatenateSequence(substitutedSignature.output.expressionType == ExpressionType.Sequence ? (substitutedSignature.output as SequenceType) : new SequenceType([substitutedSignature.output]))
		this.unify(actualSequence, expectedSequence)
	}
	infer(tokens: Token[]): [Substitution, TypeFunction] {
		// console.log("START", new TypeFunction(new SequenceType(this.inputStack), this.typeStack).substitute(this.substitution).toString())

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i]
			if (token.type == TokenType.BuiltInFunction) {
				const signature = BuiltInFunctionSignature[token.value]
				this.expect(signature)
			} else if (token.type == TokenType.MathOperator) {
				this.expect(IntOperatorSignature)
			} else if (token.type == TokenType.LogicOperator) {
				if (token.value == "!") {
					this.expect(BoolUnaryOperatorSignature)
				} else {
					this.expect(BoolOperatorSignature)

				}
			}
			else if (token.type == TokenType.ComparisonOperator) {
				this.expect(CompOperatorSignature)
			}
			else if (token.type == TokenType.ShiftOperator) {
				this.expect(IntOperatorSignature)
			}
			else if (token.type == TokenType.Integer) {
				this.typeStack = this.typeStack.append(integer)
			}
			else if (token.type == TokenType.StringPointer) {
				this.typeStack = this.typeStack.append(stringType)
			}
			else if (token.type == TokenType.CodeBlock) {
				/* 
				TODO: It looks knowing if a codeblock is a named function or something else is a common task
				Incentive for some sort of intermediate 'Statement' representation grouping such 
				structures like defs and if(else)s together, so we can evaluate on /those/, which
				is much easier
				*/
				const codeblockVar = AnyFunc.instantiate() as TypeFunction
				if (tokens[i + 2]?.type == TokenType.Keyword && tokens[i + 2]?.value == "def") {
					// console.log("defed")
					const nextTok = tokens[i + 1]
					if (nextTok?.type == TokenType.Name) {
						this.environment = this.environment.extend(nextTok.value, codeblockVar.scheme())
						i += 2
					} else {
						throw "Definition error: 'def' must be preceded by a name."
					}
				} else {
					this.typeStack = this.typeStack.append(codeblockVar)
				}

				const newChecker = new TypeChecker()
				newChecker.environment = this.environment.clone()
				newChecker.substitution = new Map(this.substitution)

				const [subs, inferredSignature] = newChecker.infer(token.value.tokens)

				const inp = TypeExpression.bind((codeblockVar.input as TypeVariable).variable, inferredSignature.input)
				const out = TypeExpression.bind((codeblockVar.output as TypeVariable).variable, inferredSignature.output)

				this.unify(codeblockVar, inferredSignature)

				// const otherSubs = TypeExpression.bind(codeblockVar.variable, inferredSignature)
				// this.substitution = compose(compose( this.substitution,subs),otherSubs)
				// this.environment = this.environment.substitute(this.substitution)
				// this.environment = this.environment.extend(codeblockVar.variable, inferredSignature.generalize())

				this.substitution = compose(compose(compose(this.substitution, subs), inp), out)
				this.environment = this.environment.substitute(this.substitution)
				// this.typeStack = this.typeStack.append(inferredSignature)
				// this.environment = this.environment.extend(codeblockVar.variable, inferredSignature.generalize())
			}
			else if (token.type == TokenType.Name) {
				// console.log(i, tokens[i], tokens[i + 1])
				if (this.environment.has(token.value)) {
					// TODO: This may not work with multi-value type variables
					const value = this.environment.get(token.value).instantiate()
					if (value.expressionType == ExpressionType.Variable) {
						// console.log("passing on ", token, value)
						this.typeStack = this.typeStack.append(new TypeVariable(token.value))
					}
					else {
						this.typeStack = this.typeStack.append(value)
					}

				} else if (tokens[i + 1]?.type == TokenType.Keyword && tokens[i + 1]?.value == "def") {
					this.typeStack = this.typeStack.append(new TypeVariable(token.value))

				}

				else {
					throw `Unbound variable '${token.value}'`
				}
			}
			else if (token.type == TokenType.Keyword) {
				switch (token.value) {
					case 'def':
						const lastTwo = this.popN(2)
						this.environment = this.environment.extend((lastTwo.get(1) as TypeVariable).variable, lastTwo.get(0).substitute(this.substitution).generalize())
						break;
					case 'ifelse':
						this.expect(IfElseSignature)
						break;
				}
			}
			else if (token.type == TokenType.String) {
				this.expect(StringSignature)
			}
			else if (token.type == TokenType.Call) {
				const func = this.popN(1).get(0)
				this.expect(func.scheme())
			} else {
				throw new TypeCheckerNotYetImplementedError(`Checking ${token.type}`)
			}
			// console.log(tokenString(token), new TypeFunction(new SequenceType(this.inputStack), this.typeStack).substitute(this.substitution).toString())

		}

		return [this.substitution, new TypeFunction(new SequenceType(this.inputStack), this.typeStack).substitute(this.substitution)]
	}
}

