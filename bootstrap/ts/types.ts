import exp from "constants"
import { LexerSource } from "./lexer"
import { Compiler } from "./parser"
import { Token, ToastType, SourceLocation } from "./tokens"
import { TypeChecker } from "./typeChecker"

export function closure<T>(mapping: Map<T, T[]>, common: T[] = []): Map<T, Set<T>> {
	const newMapping: Map<T, Set<T>> = new Map()
	for (const [key, value] of mapping) {
		const newSet = new Set([key])
		newMapping.set(key, newSet)

		const queue: T[] = [...common, ...value]
		while (queue.length) {
			const next = queue.shift()
			newSet.add(next)
			for (const item of mapping.get(next)) {
				if (newMapping.has(item)) {
					for (const other of newMapping.get(item)) {
						newSet.add(other)
					}
				} else {
					queue.push(item)
				}
			}
		}

	}
	return newMapping
}

export const AllTypes = [
	ToastType.Any,

	/** [0-9]+ */
	ToastType.Integer,

	/** [a-zA-Z]+ */
	ToastType.Name,

	/** true, false */
	ToastType.Boolean,

	/** "^["]+" */
	ToastType.String,

	/** "^["]+" */
	ToastType.StringPointer,

	/** [ ...Tokens ] */
	ToastType.Array,

	/** { ...Tokens } */
	ToastType.CodeBlock,

	/** Built-in function, user defined operation */
	ToastType.FunctionPointer,

	/** Any pointer */
	ToastType.Pointer,

	/** A block of addressable memory */
	ToastType.MemoryRegion,

	/** A system code */
	ToastType.Syscode,

	/** for, if, else, ... */
	ToastType.Keyword,

	/** >>, << */
	ToastType.ShiftOperator,

	/** +, -, *, /, % */
	ToastType.MathOperator,

	/** &, |, ~ */
	ToastType.BitwiseOperator,

	/** &&, ||, ! */
	ToastType.LogicOperator,

	/** call */
	ToastType.Call,

	/** call */
	ToastType.FileDescriptor,
]
export const toastImplicitConversions = closure<ToastType>(new Map([
	[ToastType.Keyword, [ToastType.Keyword]],


	[ToastType.Any, [ToastType.Any]],

	[ToastType.Name, [ToastType.Any,]],
	[ToastType.Integer, [ToastType.Any]],

	[ToastType.Byte, [ToastType.Char, ToastType.Integer]],
	[ToastType.Char, [ToastType.Byte]],

	[ToastType.Boolean, [ToastType.Integer]],
	[ToastType.Pointer, [ToastType.Integer]],

	[ToastType.MemoryRegion, [ToastType.Pointer]],

	[ToastType.String, [ToastType.MemoryRegion]],
	[ToastType.StringPointer, [ToastType.StringPointer]],

	[ToastType.Array, [ToastType.MemoryRegion]],

	[ToastType.Syscode, [ToastType.Integer]],
	[ToastType.FunctionPointer, [ToastType.Pointer]],

	[ToastType.FileDescriptor, [ToastType.Integer]],
]))


export const TypeNames: Record<ToastType, string> = {
	[ToastType.Pointer]: "Pointer",
	[ToastType.FunctionPointer]: "FunctionPointer",
	[ToastType.MemoryRegion]: "MemoryRegion",
	[ToastType.Syscode]: "Syscode",
	[ToastType.MathOperator]: "MathOperator",
	[ToastType.ShiftOperator]: "ShiftOperator",
	[ToastType.BitwiseOperator]: "BitwiseOperator",
	[ToastType.LogicOperator]: "LogicOperator",
	[ToastType.FileDescriptor]: "FileDescriptor",
	[ToastType.ComparisonOperator]: "ComparisonOperator",
	[ToastType.BuiltInFunction]: "BuiltInFunction",
	[ToastType.Call]: "Call",

	[ToastType.Byte]: "Byte",
	[ToastType.Char]: "Char",


	[ToastType.Keyword]: "Keyword",

	[ToastType.Any]: "Any",
	[ToastType.Boolean]: "Boolean",
	[ToastType.Name]: "Name",
	[ToastType.Integer]: "Integer",
	[ToastType.CodeBlock]: "CodeBlock",
	[ToastType.Array]: "Array",
	[ToastType.String]: "String",
	[ToastType.StringPointer]: "StringPointer",
}

export class CompileTimeConstant {
	static getConstant(name: string) {
		return this.BuiltIns[name as keyof typeof this.BuiltIns]
	}
	static BuiltIns = {
		"ExitSyscode": new CompileTimeConstant("Syscode.Exit", ToastType.Syscode),
		"ForkSyscode": new CompileTimeConstant("Syscode.Fork", ToastType.Syscode),
		"WriteSyscode": new CompileTimeConstant("Syscode.Write", ToastType.Syscode),
		"OpenSyscode": new CompileTimeConstant("Syscode.Open", ToastType.Syscode),
		"ExecSyscode": new CompileTimeConstant("Syscode.Exec", ToastType.Syscode),
		"WaitSyscode": new CompileTimeConstant("Syscode.Wait4", ToastType.Syscode),

		"True": new CompileTimeConstant("1", ToastType.Boolean),
		"False": new CompileTimeConstant("0", ToastType.Boolean)
	}
	constructor(public assemblyValue: string, public type: ToastType) { }
}

export class Operator {
	static BuiltIns = {
		// "<<": [`toastStackLogic shl`, new Signature([])],
		"<<": `toastStackLogic shl`,
		">>": `toastStackLogic shr`,

		"^": `toastStackCompute xor`,
		"|": `toastStackCompute or`,
		"&": `toastStackCompute and`,
		"~": `toastStackComputeOne not`,
	}
}

export type NameMap = Record<string, TypeConstraint>

export abstract class TypeConstraint {
	constructor(public location: SourceLocation) { }
	abstract getToken(): Token | null
	abstract getType(): SpecificTypeConstraint
	abstract canConvertTo(type: ToastType): boolean;
	abstract canMatch(type: TypeConstraint): boolean;
}

export class GenericTypeConstraint extends TypeConstraint {
	canMatch(type: TypeConstraint): boolean {
		throw new Error("Method not implemented.")
	}
	static potentialTypes: Record<string, Set<TypeConstraint>> = {}
	constructor(location: SourceLocation, public name: string) {
		super(location);
		if (!GenericTypeConstraint.potentialTypes[name]) {
			GenericTypeConstraint.restrict(this.name, AllTypes.map(x => new SpecificTypeConstraint(location, x)))
		}
	}

	static restrict(name: string, types: Iterable<TypeConstraint>) {
		const newTypes = new Set(types)
		if (this.potentialTypes[name]) {
			this.potentialTypes[name] = new Set([...this.potentialTypes[name]].filter(i => newTypes.has(i)))
		} else {
			this.potentialTypes[name] = newTypes
		}
	}
	static reset() {
		this.potentialTypes = {}
	}

	getToken(): Token {
		return null;
	}
	getType(): SpecificTypeConstraint {
		throw new Error("Method not implemented.")
	}
	canConvertTo(type: ToastType): boolean {
		if (type == ToastType.Any) return true;
		const newTypes = new Set<TypeConstraint>()
		for (const potentialType of GenericTypeConstraint.potentialTypes[this.name]) {
			if (potentialType.canConvertTo(type)) {
				for (const otherType of toastImplicitConversions.get(potentialType.getType().type)) {
					newTypes.add(new SpecificTypeConstraint(this.location, otherType))
				}
			}
		}
		GenericTypeConstraint.restrict(this.name, newTypes)
		return newTypes.size > 0
	}
}

export class SpecificTypeConstraint extends TypeConstraint {

	constructor(location: SourceLocation, public type: ToastType) {
		super(location);
	}

	canMatch(type: TypeConstraint): boolean {
		return this.canConvertTo(type.getType().type)
	}
	canConvertTo(type: ToastType): boolean {
		return this.type == ToastType.Any || toastImplicitConversions.get(this.type).has(type)
	}
	getToken(): Token | null {
		return null;
	}
	getType(): SpecificTypeConstraint {
		return this;
	}
}

export abstract class ToastTypeConstraint extends TypeConstraint {
	abstract getType(): SpecificTypeConstraint
	canConvertTo(type: ToastType): boolean {
		return type == ToastType.Any || this.getType().canConvertTo(type)
	}
}

export class NameConstraint extends ToastTypeConstraint {
	canMatch(type: TypeConstraint): boolean {
		throw new Error("Method not implemented.")
	}
	constructor(public nameToken: Token, public nameMap: NameMap) { super(nameToken.location) }

	getType(): SpecificTypeConstraint {
		let valueConstraint = this.nameMap[this.nameToken.value]
		let valueToken = valueConstraint?.getToken()
		while (valueToken?.type == ToastType.Name) {
			valueConstraint = this.nameMap[valueToken.value]
			valueToken = valueConstraint.getToken()
		}
		return valueConstraint.getType()
	}

	getToken() {
		return this.nameToken
		// let valueConstraint = this.nameMap[this.nameToken.value]
		// let valueToken = valueConstraint?.getToken()
		// while (valueToken?.type == ToastType.Name) {
		// 	valueConstraint = this.nameMap[valueToken.value]
		// 	valueToken = valueConstraint.getToken()
		// }
		// return valueToken
	}
}
export class TokenConstraint extends ToastTypeConstraint {
	canMatch(type: TypeConstraint): boolean {
		throw new Error("Method not implemented.")
	}
	constructor(public token: Token, public nameMap: NameMap) { super(token.location) }

	getType(): SpecificTypeConstraint {
		// return new SpecificTypeConstraint(location, This.token.type)
		return this.token.type == ToastType.Name ? new NameConstraint(this.token, this.nameMap).getType() : new SpecificTypeConstraint(this.location, this.token.type)
	}
	getToken(): Token {
		// return this.token
		return this.token.type == ToastType.Name ? new NameConstraint(this.token, this.nameMap).getToken() : this.token
	}
}
export class FunctionSignatureConstraint extends ToastTypeConstraint {
	constructor(public desiredSignature: Signature, private typeChecker: TypeChecker, location: SourceLocation) { super(location) }
	canMatch(type: TypeConstraint): boolean {
		const token = type.getToken()
		if (token) {
			if (token.type == ToastType.CodeBlock) {
				if (this.typeChecker.blockTypes[token.value.index]) {
					const { inputs, outputs } = this.typeChecker.blockTypes[token.value.index]

					if (inputs.length < this.desiredSignature.inputs.length) {
						this.typeChecker.logError(`Not enough input types`, type.location)
						return false
					}
					if (inputs.length > this.desiredSignature.inputs.length) {
						this.typeChecker.logError(`Too many input types`, type.location)
						return false;
					}

					for (const expectedType of this.desiredSignature.inputs) {
						if (!inputs[0].canConvertTo(expectedType.type)) {
							const actualType = inputs[0].getType()
							console.log(actualType, expectedType)
							this.typeChecker.logError(`Cannot convert ${TypeNames[actualType?.type]} to ${TypeNames[expectedType.type]}\n\t - ${TypeNames[actualType?.type]} introduced ${LexerSource.locationString(actualType.location)}\n\t - ${TypeNames[expectedType.type]} introduced ${LexerSource.locationString(expectedType.location)}`, expectedType.location)
						}
						inputs.shift()
					}
					return true;
				}
			}
		}

	}

	getType(): SpecificTypeConstraint {
		return new SpecificTypeConstraint(this.location, ToastType.CodeBlock)
	}
	getToken(): Token {
		// return this.token
		return null
	}
}

export interface Signature { inputs: SpecificTypeConstraint[], outputs: SpecificTypeConstraint[] }


export const BuiltInFunctionSignature: Record<string, (type: TypeChecker, location: SourceLocation) => Signature> = {
	/// StackOps
	'pop': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Any)],
		outputs: []
	}),

	// TODO! Variadic number of inputs
	'popN': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Any)],
		outputs: []
	}),

	'swap': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Any), new SpecificTypeConstraint(location, ToastType.Any)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Any), new SpecificTypeConstraint(location, ToastType.Any)]
	}),
	'dup': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Any)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Any), new SpecificTypeConstraint(location, ToastType.Any)]
	}),

	// -- ROLL --
	'roll': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Any)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Any), new SpecificTypeConstraint(location, ToastType.Any)]
	}),

	'close': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor)],
		outputs: []
	}),

	'readOpen': (t, location) => ({
		inputs: [],
		outputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor)]
	}),
	'writeOpen': (t, location) => ({
		inputs: [],
		outputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor)]
	}),

	'readFile': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor)],
		outputs: [new SpecificTypeConstraint(location, ToastType.MemoryRegion), new SpecificTypeConstraint(location, ToastType.Integer)]
	}),
	'readFileTo': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.MemoryRegion), new SpecificTypeConstraint(location, ToastType.FileDescriptor)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Integer)]
	}),

	'array': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Array)]
	}),

	'buffer': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.MemoryRegion)]
	}),

	'length': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Array)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Integer)]
	}),

	'print': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.String)],
		outputs: []
	}),

	'fprint': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor), new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.String)],
		outputs: []
	}),

	// TODO! Variadic typing for printf
	'printf': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.StringPointer)],
		outputs: []
	}),
	'fprintf': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor), new SpecificTypeConstraint(location, ToastType.String)],
		outputs: []
	}),

	'sprintf': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.StringPointer)]
	}),

	'input': (t, location) => ({
		inputs: [],
		outputs: [new SpecificTypeConstraint(location, ToastType.StringPointer)]
	}),

	'filePrintNum': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor), new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: []
	}),
	'printNum': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: []
	}),
	'filePrintNumBase': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.FileDescriptor), new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: []
	}),
	'printNumBase': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: []
	}),

	'strEq': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.StringPointer), new SpecificTypeConstraint(location, ToastType.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Boolean)]
	}),

	'strLen': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Integer)]
	}),

	// TODO! Variadic typing for copy
	'copy': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: []
	}),

	// TODO! Variadic typing for index
	'index': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: []
	}),

	'strCopy': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.StringPointer), new SpecificTypeConstraint(location, ToastType.StringPointer)],
		outputs: []
	}),
	'memCopy': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.MemoryRegion), new SpecificTypeConstraint(location, ToastType.MemoryRegion)],
		outputs: []
	}),

	// TODO! Typing for bytes vs values
	'memCopyByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.MemoryRegion), new SpecificTypeConstraint(location, ToastType.MemoryRegion)],
		outputs: []
	}),

	'exit': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: []
	}),

	// TODO! Change to 'type that can convert to pointer'
	'getPtr': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Pointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Pointer)]
	}),
	// TODO! More specific than any?
	'get': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Pointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Any)]
	}),
	'set': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Pointer), new SpecificTypeConstraint(location, ToastType.Any)],
		outputs: []
	}),
	'read': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Pointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Any)]
	}),
	'write': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Pointer), new SpecificTypeConstraint(location, ToastType.Any)],
		outputs: []
	}),

	// TODO! Change to 'type that can convert to pointer'
	// TODO! Typing for bytes vs values
	'getBytePtr': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Pointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Pointer)]
	}),
	// TODO! More specific than any?
	'getByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Pointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Byte)]
	}),
	'setByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.Pointer), new SpecificTypeConstraint(location, ToastType.Byte)],
		outputs: []
	}),
	'readByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Pointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Byte)]
	}),
	'writeByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Pointer), new SpecificTypeConstraint(location, ToastType.Byte)],
		outputs: []
	}),

	'intToString': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.Integer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Integer), new SpecificTypeConstraint(location, ToastType.StringPointer)]
	}),
	'stringToInt': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, ToastType.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, ToastType.Integer)]
	}),
}