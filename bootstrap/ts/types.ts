import { SourceLocation } from "./tokens"
import { TypeChecker } from "./typeChecker"

export enum Type {
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
export class SpecificTypeConstraint {
	constructor(location: SourceLocation, public type: Type) {
		throw "SpecificTypeConstraint is deprecated."
	}
}


