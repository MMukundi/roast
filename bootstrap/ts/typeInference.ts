import { SpecificTypeConstraint, Type, TypeNames } from "./types"

type TypeVariableType = string
type Substitution = Map<TypeVariableType, TypeExpression>
type Environment = Map<TypeVariableType, Scheme>
abstract class Substitutable<T> {
	constructor() { }
	abstract substitute(s: Substitution): T
	abstract freeTypeVariables(): Set<TypeVariableType>
}
const enum ExpressionType {
	Variable,
	Function,
	Constant,

	Sequence
}

class Scheme extends Substitutable<Scheme> {
	constructor(public vars: string[], public type: TypeExpression) {
		super()
	}
	substitute(s: Substitution): Scheme {
		const sPrime = new Map(s)
		this.vars.forEach(v => sPrime.delete(v))
		return new Scheme(this.vars, this.type.substitute(s))
	}
	freeTypeVariables() {
		return deleteAll(this.type.freeTypeVariables(), this.vars)
	}
	instantiate() {
		return this.type.substitute(new Map(this.vars.map(v => [v, TypeVariable.fresh()])))
	}
	override toString() {
		return `Forall ${this.vars.join(",")}.${this.type.toString()}`
	}
}
class TypeEnvironment extends Substitutable<TypeEnvironment> {
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
}
abstract class TypeExpression extends Substitutable<TypeExpression> {
	constructor(public expressionType: ExpressionType) {
		super()
	}
	abstract substitute(s: Substitution): TypeExpression
	abstract freeTypeVariables(): Set<TypeVariableType>
	generalize(env: TypeEnvironment) {
		return new Scheme((Array.from(
			deleteAll(this.freeTypeVariables(), env.freeTypeVariables())
		)), this)
	}
	scheme(): Scheme {
		return new Scheme([], this);
	}
	abstract toString(): string
}
class TypeVariable extends TypeExpression {
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

	static prev: number
	static fresh(): TypeVariable {
		return new TypeVariable((this.prev++).toString())
	}
}
class TypeFunction extends TypeExpression {
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
}
class ConstantType extends TypeExpression {
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
}

function deleteAll<T>(original: Iterable<T>, toDelete: Iterable<T>): Set<T> {
	const difference = new Set(original)
	for (const t of toDelete) {
		difference.delete(t)
	}
	return difference
}
export interface Signature { inputs: SpecificTypeConstraint[], outputs: SpecificTypeConstraint[] }