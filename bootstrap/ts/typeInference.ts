import { SpecificTypeConstraint, Type, TypeNames } from "./types"

type TypeVariableType = string
export type Substitution = Map<TypeVariableType, TypeExpression>
type Environment = Map<TypeVariableType, Scheme>
export abstract class Substitutable<T> {
	constructor() { }
	abstract substitute(s: Substitution): T
	abstract freeTypeVariables(): Set<TypeVariableType>
}
export abstract class ExpressionBase<T> extends Substitutable<T> {
	constructor() {
		super()
	}
	abstract asSchemeSequence(): Scheme
}
export const enum ExpressionType {
	Variable,
	Function,
	Constant,

	Sequence
}

export class Scheme extends ExpressionBase<Scheme> {
	constructor(public vars: string[], public type: TypeExpression) {
		super()
	}
	substitute(s: Substitution) {
		const sPrime = new Map(s)
		this.vars.forEach(v => sPrime.delete(v))
		return new Scheme(this.vars, this.type.substitute(s))
	}
	freeTypeVariables() {
		return deleteAll(this.type.freeTypeVariables(), this.vars)
	}
	instantiate(): TypeExpression {
		return this.type.substitute(new Map(this.vars.map(v => [v, TypeVariable.fresh()])))
	}
	override toString() {
		return `Forall ${this.vars.join(",")}.${this.type.toString()}`
	}
	override asSchemeSequence(): Scheme {
		return (this.type.expressionType == ExpressionType.Sequence ? this : new Scheme(this.vars, new SequenceType([this.type])))
	}
}
export class TypeEnvironment extends Substitutable<TypeEnvironment> {

	constructor(private map: Environment = new Map()) {
		super()
	}
	substitute(s: Substitution): TypeEnvironment {
		return new TypeEnvironment(new Map(Array.from(this.map.entries()).map(([n, t]) => {
			return [n, t.substitute(s)]
		})))
	}
	freeTypeVariables(): Set<TypeVariableType> {
		return Array.from(this.map.values()).reduce((s, t) => new Set([...s, ...t.freeTypeVariables()]), new Set<TypeVariableType>())
	}
	get(name: string): Scheme | undefined {
		return this.map.get(name)
	}
	set(name: string, s: Scheme) {
		this.map.set(name, s)
	}
	has(name: string): boolean {
		return this.map.has(name)
	}
	extend(variable: string, scheme: Scheme) {
		return new TypeEnvironment(new Map(this.map).set(variable, scheme))
	}
	clone(): TypeEnvironment {
		return new TypeEnvironment(new Map(this.map))
	}
}

export abstract class TypeExpression extends ExpressionBase<TypeExpression> {
	constructor(public expressionType: ExpressionType) {
		super()
	}
	abstract substitute(s: Substitution): TypeExpression
	abstract freeTypeVariables(): Set<TypeVariableType>
	generalize(env: TypeEnvironment = new TypeEnvironment()) {
		return new Scheme((Array.from(
			deleteAll(this.freeTypeVariables(), env.freeTypeVariables())
		)), this)
	}
	scheme(): Scheme {
		return new Scheme([], this);
	}
	abstract toString(): string
	override asSchemeSequence(): Scheme {
		return new Scheme([], new SequenceType([this]))
	}

	abstract unify(other: TypeExpression): Substitution

	static bind(variable: TypeVariableType, type: TypeExpression): Substitution {
		if (type.expressionType == ExpressionType.Variable && (type as TypeVariable).variable == variable) {
			return new Map()
		}
		else if (type.freeTypeVariables().has(variable)) {
			throw "Infinite type error"
		}
		else {
			return new Map([[variable, type]])
		}
	}
}
export class TypeVariable extends TypeExpression {
	constructor(public variable: TypeVariableType) {
		super(ExpressionType.Variable)
	}
	substitute(s: Substitution): TypeExpression {
		return s.has(this.variable) ? s.get(this.variable) ?? this : this
	}
	freeTypeVariables() {
		return new Set<TypeVariableType>([this.variable])
	}
	override toString(): string {
		return `${this.variable}`
	}

	static fromInt(int: number) {
		return new TypeVariable(`${int}`)
	}

	static prev: number = 0
	static fresh(): TypeVariable {
		return TypeVariable.fromInt(this.prev++)
	}
	override unify(other: TypeExpression): Substitution {
		return TypeExpression.bind(this.variable, other)
	}
}
export class TypeFunction extends TypeExpression {
	constructor(public input: TypeExpression, public output: TypeExpression) {
		super(ExpressionType.Function)
	}
	substitute(s: Substitution) {
		return new TypeFunction(this.input.substitute(s), this.output.substitute(s))
	}
	freeTypeVariables() {
		return new Set<TypeVariableType>([
			...this.input.freeTypeVariables(),
			...this.output.freeTypeVariables()
		])
	}
	override toString(): string {
		return `(${this.input})->(${this.output})`
	}
	override unify(other: TypeExpression): Substitution {
		if (other.expressionType === ExpressionType.Variable) return other.unify(this)
		if (other.expressionType === ExpressionType.Function) {
			const otherFunc = other as TypeFunction
			const s1 = this.input.unify(otherFunc.input)
			const s2 = this.output.substitute(s1).unify(otherFunc.output.substitute(s1))
			// console.log("A", s1, s2)
			return compose(s2, s1)
		}
		throw new UnificationError(this, other)
	}
}
class UnificationError extends Error {
	constructor(a: TypeExpression, b: TypeExpression) {
		super(`Unification Error: Cannot unify ${a.toString()} and ${b.toString()}`)
	}
}
export function compose(s1: Substitution, s2: Substitution) {
	const newS1 = new Map(s1)
	for (const [key, val] of s2) {
		newS1.set(key, val.substitute(s1))
	}
	return newS1
}

export class ConstantType extends TypeExpression {
	constructor(public type: Type) {
		super(ExpressionType.Constant)
	}
	substitute(s: Substitution) {
		return this
	}
	freeTypeVariables() {
		return new Set<TypeVariableType>()
	}
	override toString(): string {
		return `Const<${TypeNames[this.type]}>`
	}
	override unify(other: TypeExpression): Substitution {
		if (other.expressionType === ExpressionType.Variable) return other.unify(this)
		if (other.expressionType === ExpressionType.Constant) {
			const otherType = (other as ConstantType).type
			if (this.type == Type.Any || otherType == Type.Any || this.type == otherType) {
				return new Map()
			}
		}
		throw new UnificationError(this, other)
	}
}
export class SequenceType extends TypeExpression {
	constructor(public types: TypeExpression[]) {
		super(ExpressionType.Sequence)
	}
	substitute(s: Substitution): SequenceType {
		return new SequenceType(this.types.flatMap(t => {
			const tAfter = t.substitute(s)
			return tAfter.expressionType == ExpressionType.Sequence ? (tAfter as SequenceType).types : tAfter
		}))
	}
	freeTypeVariables() {
		// return this.types.map(x => x.freeTypeVariables()).reduce((prev, s) => deleteAll(s, prev), new Set())
		return this.types.map(x => x.freeTypeVariables()).reduce((prev, s) => new Set(...s, ...prev), new Set())
	}
	override toString(): string {
		return `[${this.types.map(x => x.toString()).join(", ")}]`
	}
	override unify(other: TypeExpression): Substitution {
		if (other.expressionType === ExpressionType.Variable) return other.unify(this)
		if (other.expressionType === ExpressionType.Sequence) {
			const otherSeq = (other as SequenceType)
			if (otherSeq.types.length == this.types.length) {
				return this.types.map((t, i) => t.unify(otherSeq.types[i])).reduce(compose, new Map())
			}
		}
		throw new UnificationError(this, other)
	}
	append(expressionType: TypeExpression) {
		return expressionType.expressionType == ExpressionType.Sequence ? new SequenceType([...this.types, ...(expressionType as SequenceType).types]) : new SequenceType([...this.types, expressionType])
	}
	prepend(expressionType: TypeExpression) {
		return expressionType.expressionType == ExpressionType.Sequence ? new SequenceType([...(expressionType as SequenceType).types, ...this.types]) : new SequenceType([expressionType, ...this.types])
	}
	concatenateSequence(laterSequence: SequenceType) {
		return this.concatenate(laterSequence.types)
	}
	concatenate(laterSequence: TypeExpression[]) {
		return new SequenceType([...this.types, ...laterSequence])
	}

	length(): number {
		return this.types.length
	}

	get(index: number): TypeExpression {
		return this.types[index]
	}
	set(index: number, expression: TypeExpression) {
		const typesCopy = [...this.types]
		if (expression.expressionType == ExpressionType.Sequence) {
			typesCopy.splice(index, 0, ...(expression as SequenceType).types)
		}
		else {
			typesCopy[index] = expression
		}
		return new SequenceType(typesCopy)
	}
	subsequence(start: number, end: number): SequenceType {
		return new SequenceType(this.subsequenceTypes(start, end))
	}
	subsequenceTypes(start: number, end: number) {
		return this.types.slice(start, end)
	}

	headSubsequence(length: number): SequenceType {
		return this.subsequence(0, length + 1)
	}
	headSubsequenceTypes(length: number) {
		return this.subsequenceTypes(0, length + 1)
	}

	tailSubsequence(length: number): SequenceType {
		return this.subsequence(this.types.length - length, this.types.length)
	}
	tailSubsequenceTypes(length: number) {
		return this.subsequenceTypes(this.types.length - length, this.types.length)
	}

	splitAt(index: number): [SequenceType, SequenceType] {
		return [this.subsequence(0, index), this.subsequence(index, this.types.length)]
	}

}

function deleteAll<T>(original: Iterable<T>, toDelete: Iterable<T>): Set<T> {
	const difference = new Set(original)
	for (const t of toDelete) {
		difference.delete(t)
	}
	return difference
}

export interface Signature { inputs: Scheme, outputs: Scheme }