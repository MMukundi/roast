import exp from "constants"
import { LexerSource } from "./lexer"
import { Compiler } from "./parser"
import { Token, SourceLocation, TokenType } from "./tokens"
import { TypeChecker } from "./typeChecker"

export enum Type {
	// Deprecated delimiter tokens
	// /** [ */
	// OpenArray,
	// /** ] */
	// CloseArray,

	// /** { */
	// OpenBlock,
	// /** } */
	// CloseBlock,

	// /** " */
	// Quote,

	Never,
	/** Unknown */
	Any,

	/** [0-9]+ */
	Integer,

	/** [a-zA-Z]+ */
	Name,

	/** true, false */
	Boolean,

	/** "^["]+" */
	String,

	/** "^["]+" */
	StringPointer,

	/** [ ...Tokens ] */
	Array,

	/** { ...Tokens } */
	CodeBlock,

	/** Built-in function, user defined operation */
	FunctionPointer,

	/** Any pointer */
	Pointer,

	/** A block of addressable memory */
	MemoryRegion,

	/** A system code */
	Syscode,

	/** for, if, else, ... */
	Keyword,

	/** >>, << */
	ShiftOperator,

	/** +, -, *, /, % */
	MathOperator,

	/** &, |, ~ */
	BitwiseOperator,

	/** &&, ||, ! */
	LogicOperator,

	/** >=, <=, >, <, =, != */
	ComparisonOperator,

	/** call */
	Call,

	/** 1,2,3 */
	FileDescriptor,

	/** pop,swap,... */
	BuiltInFunction,

	Byte,
	Char,
}

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
	Type.Any,

	/** [0-9]+ */
	Type.Integer,

	/** [a-zA-Z]+ */
	Type.Name,

	/** true, false */
	Type.Boolean,

	/** "^["]+" */
	Type.String,

	/** "^["]+" */
	Type.StringPointer,

	/** [ ...Tokens ] */
	Type.Array,

	/** { ...Tokens } */
	Type.CodeBlock,

	/** Built-in function, user defined operation */
	Type.FunctionPointer,

	/** Any pointer */
	Type.Pointer,

	/** A block of addressable memory */
	Type.MemoryRegion,

	/** A system code */
	Type.Syscode,

	/** for, if, else, ... */
	Type.Keyword,

	/** >>, << */
	Type.ShiftOperator,

	/** +, -, *, /, % */
	Type.MathOperator,

	/** &, |, ~ */
	Type.BitwiseOperator,

	/** &&, ||, ! */
	Type.LogicOperator,

	/** call */
	Type.Call,

	/** call */
	Type.FileDescriptor,
]
export const toastImplicitConversions = closure<Type>(new Map([
	[Type.Keyword, [Type.Keyword]],


	[Type.Any, [Type.Any]],

	[Type.Name, [Type.Any,]],
	[Type.Integer, [Type.Any]],

	[Type.Byte, [Type.Char, Type.Integer]],
	[Type.Char, [Type.Byte]],

	[Type.Boolean, [Type.Integer]],
	[Type.Pointer, [Type.Integer]],

	[Type.MemoryRegion, [Type.Pointer]],

	[Type.String, [Type.MemoryRegion]],
	[Type.StringPointer, [Type.StringPointer]],

	[Type.Array, [Type.MemoryRegion]],

	[Type.Syscode, [Type.Integer]],
	[Type.FunctionPointer, [Type.Pointer]],

	[Type.FileDescriptor, [Type.Integer]],
]))


export const TypeNames: Record<Type, string> = {
	[Type.Never]: "Never",
	[Type.Pointer]: "Pointer",
	[Type.FunctionPointer]: "FunctionPointer",
	[Type.MemoryRegion]: "MemoryRegion",
	[Type.Syscode]: "Syscode",
	[Type.MathOperator]: "MathOperator",
	[Type.ShiftOperator]: "ShiftOperator",
	[Type.BitwiseOperator]: "BitwiseOperator",
	[Type.LogicOperator]: "LogicOperator",
	[Type.FileDescriptor]: "FileDescriptor",
	[Type.ComparisonOperator]: "ComparisonOperator",
	[Type.BuiltInFunction]: "BuiltInFunction",
	[Type.Call]: "Call",

	[Type.Byte]: "Byte",
	[Type.Char]: "Char",


	[Type.Keyword]: "Keyword",

	[Type.Any]: "Any",
	[Type.Boolean]: "Boolean",
	[Type.Name]: "Name",
	[Type.Integer]: "Integer",
	[Type.CodeBlock]: "CodeBlock",
	[Type.Array]: "Array",
	[Type.String]: "String",
	[Type.StringPointer]: "StringPointer",
}

export class CompileTimeConstant {
	static getConstant(name: string) {
		return this.BuiltIns[name as keyof typeof this.BuiltIns]
	}
	static BuiltIns = {
		"ExitSyscode": new CompileTimeConstant("Syscode.Exit", Type.Syscode),
		"ForkSyscode": new CompileTimeConstant("Syscode.Fork", Type.Syscode),
		"WriteSyscode": new CompileTimeConstant("Syscode.Write", Type.Syscode),
		"OpenSyscode": new CompileTimeConstant("Syscode.Open", Type.Syscode),
		"ExecSyscode": new CompileTimeConstant("Syscode.Exec", Type.Syscode),
		"WaitSyscode": new CompileTimeConstant("Syscode.Wait4", Type.Syscode),

		"True": new CompileTimeConstant("1", Type.Boolean),
		"False": new CompileTimeConstant("0", Type.Boolean)
	}
	constructor(public assemblyValue: string, public type: Type) { }
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
	abstract canConvertTo(type: Type): boolean;
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
	canConvertTo(type: Type): boolean {
		if (type == Type.Any) return true;
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

	constructor(location: SourceLocation, public type: Type) {
		super(location);
	}

	canMatch(type: TypeConstraint): boolean {
		return this.canConvertTo(type.getType().type)
	}
	canConvertTo(type: Type): boolean {
		return this.type == Type.Any || toastImplicitConversions.get(this.type).has(type)
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
	canConvertTo(type: Type): boolean {
		return type == Type.Any || this.getType().canConvertTo(type)
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
		while (valueToken?.type == TokenType.Name) {
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

function toType(toastType: TokenType): Type {
	switch (toastType) {
		case TokenType.Any: return Type.Any;

		/** [0-9]+ */
		case TokenType.Integer: return Type.Integer;

		/** [a-zA-Z]+ */
		case TokenType.Name: return Type.Any;

		/** true, false */
		case TokenType.Boolean: return Type.Boolean;

		/** "^["]+" */
		case TokenType.String: return Type.String;

		/** "^["]+" */
		case TokenType.StringPointer: return Type.StringPointer;

		/** [ ...Tokens ] */
		case TokenType.Array: return Type.Array;

		/** { ...Tokens } */
		case TokenType.CodeBlock: return Type.CodeBlock;

		/** Built-in function, user defined operation */
		case TokenType.FunctionPointer: return Type.FunctionPointer;

		/** Any pointer */
		case TokenType.Pointer: return Type.Pointer;

		/** A block of addressable memory */
		case TokenType.MemoryRegion: return Type.MemoryRegion;

		/** A system code */
		case TokenType.Syscode: return Type.Syscode;

		/** for, if, else, ... */
		case TokenType.Keyword: return Type.Keyword;

		/** >>, << */
		case TokenType.ShiftOperator: return Type.ShiftOperator;

		/** +, -, *, /, % */
		case TokenType.MathOperator: return Type.MathOperator;

		/** &, |, ~ */
		case TokenType.BitwiseOperator: return Type.BitwiseOperator;

		/** &&, ||, ! */
		case TokenType.LogicOperator: return Type.LogicOperator;

		/** >=, <=, >, <, =, != */
		case TokenType.ComparisonOperator: return Type.ComparisonOperator;

		/** call */
		case TokenType.Call: return Type.Call;

		/** 1,2,3 */
		case TokenType.FileDescriptor: return Type.FileDescriptor;

		/** pop,swap,... */
		case TokenType.BuiltInFunction: return Type.BuiltInFunction;

		case TokenType.Byte: return Type.Byte;
		case TokenType.Char: return Type.Char;
	}
}

export class TokenConstraint extends ToastTypeConstraint {
	canMatch(type: TypeConstraint): boolean {
		throw new Error("Method not implemented.")
	}
	constructor(public token: Token, public nameMap: NameMap) { super(token.location) }

	getType(): SpecificTypeConstraint {
		// return new SpecificTypeConstraint(location, This.token.type)
		return this.token.type == TokenType.Name ? new NameConstraint(this.token, this.nameMap).getType() : new SpecificTypeConstraint(this.location, toType(this.token.type))
	}
	getToken(): Token {
		// return this.token
		return this.token.type == TokenType.Name ? new NameConstraint(this.token, this.nameMap).getToken() : this.token
	}
}
export class FunctionSignatureConstraint extends ToastTypeConstraint {
	constructor(public desiredSignature: Signature, private typeChecker: TypeChecker, location: SourceLocation) { super(location) }
	canMatch(type: TypeConstraint): boolean {
		const token = type.getToken()
		if (token) {
			if (token.type == TokenType.CodeBlock) {
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
		return new SpecificTypeConstraint(this.location, Type.CodeBlock)
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
		inputs: [new SpecificTypeConstraint(location, Type.Any)],
		outputs: []
	}),

	// TODO! Variadic number of inputs
	'popN': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Any)],
		outputs: []
	}),

	'swap': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Any), new SpecificTypeConstraint(location, Type.Any)],
		outputs: [new SpecificTypeConstraint(location, Type.Any), new SpecificTypeConstraint(location, Type.Any)]
	}),
	'dup': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Any)],
		outputs: [new SpecificTypeConstraint(location, Type.Any), new SpecificTypeConstraint(location, Type.Any)]
	}),

	// -- ROLL --
	'roll': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Any)],
		outputs: [new SpecificTypeConstraint(location, Type.Any), new SpecificTypeConstraint(location, Type.Any)]
	}),

	'close': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.FileDescriptor)],
		outputs: []
	}),

	'readOpen': (t, location) => ({
		inputs: [],
		outputs: [new SpecificTypeConstraint(location, Type.FileDescriptor)]
	}),
	'writeOpen': (t, location) => ({
		inputs: [],
		outputs: [new SpecificTypeConstraint(location, Type.FileDescriptor)]
	}),

	'readFile': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.FileDescriptor)],
		outputs: [new SpecificTypeConstraint(location, Type.MemoryRegion), new SpecificTypeConstraint(location, Type.Integer)]
	}),
	'readFileTo': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.MemoryRegion), new SpecificTypeConstraint(location, Type.FileDescriptor)],
		outputs: [new SpecificTypeConstraint(location, Type.Integer)]
	}),

	'array': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer)],
		outputs: [new SpecificTypeConstraint(location, Type.Array)]
	}),

	'buffer': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer)],
		outputs: [new SpecificTypeConstraint(location, Type.MemoryRegion)]
	}),

	'length': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Array)],
		outputs: [new SpecificTypeConstraint(location, Type.Integer)]
	}),

	'print': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: []
	}),

	'fprint': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.FileDescriptor), new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: []
	}),

	// TODO! Variadic typing for printf
	'printf': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: []
	}),
	'fprintf': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.FileDescriptor), new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: []
	}),

	'sprintf': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, Type.StringPointer)]
	}),

	'input': (t, location) => ({
		inputs: [],
		outputs: [new SpecificTypeConstraint(location, Type.StringPointer)]
	}),

	'filePrintNum': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.FileDescriptor), new SpecificTypeConstraint(location, Type.Integer)],
		outputs: []
	}),
	'printNum': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer)],
		outputs: []
	}),
	'filePrintNumBase': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.FileDescriptor), new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Integer)],
		outputs: []
	}),
	'printNumBase': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Integer)],
		outputs: []
	}),

	'strEq': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.StringPointer), new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Boolean)]
	}),

	'strLen': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Integer)]
	}),

	// TODO! Variadic typing for copy
	'copy': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer)],
		outputs: []
	}),

	// TODO! Variadic typing for index
	'index': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer)],
		outputs: []
	}),

	'strCopy': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.StringPointer), new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: []
	}),
	'memCopy': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.MemoryRegion), new SpecificTypeConstraint(location, Type.MemoryRegion)],
		outputs: []
	}),

	// TODO! Typing for bytes vs values
	'memCopyByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.MemoryRegion), new SpecificTypeConstraint(location, Type.MemoryRegion)],
		outputs: []
	}),

	'exit': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer)],
		outputs: []
	}),

	// TODO! Change to 'type that can convert to pointer'
	'getPtr': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Pointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Pointer)]
	}),
	// TODO! More specific than any?
	'get': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Pointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Any)]
	}),
	'set': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Pointer), new SpecificTypeConstraint(location, Type.Any)],
		outputs: []
	}),
	'read': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Pointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Any)]
	}),
	'write': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Pointer), new SpecificTypeConstraint(location, Type.Any)],
		outputs: []
	}),

	// TODO! Change to 'type that can convert to pointer'
	// TODO! Typing for bytes vs values
	'getBytePtr': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Pointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Pointer)]
	}),
	// TODO! More specific than any?
	'getByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Pointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Byte)]
	}),
	'setByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.Pointer), new SpecificTypeConstraint(location, Type.Byte)],
		outputs: []
	}),
	'readByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Pointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Byte)]
	}),
	'writeByte': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Pointer), new SpecificTypeConstraint(location, Type.Byte)],
		outputs: []
	}),

	'intToString': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.Integer)],
		outputs: [new SpecificTypeConstraint(location, Type.Integer), new SpecificTypeConstraint(location, Type.StringPointer)]
	}),
	'stringToInt': (t, location) => ({
		inputs: [new SpecificTypeConstraint(location, Type.StringPointer)],
		outputs: [new SpecificTypeConstraint(location, Type.Integer)]
	}),
}