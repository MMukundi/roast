import { Compiler } from "./parser"
import { Token, ToastType } from "./tokens"

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

export const toastImplicitConversions = closure<ToastType>(new Map([
	[ToastType.Keyword, [ToastType.Keyword]],


	[ToastType.Any, [ToastType.Any]],

	[ToastType.Name, [ToastType.Any,]],
	[ToastType.Integer, [ToastType.Any,]],

	[ToastType.Boolean, [ToastType.Integer]],
	[ToastType.Pointer, [ToastType.Integer]],

	[ToastType.MemoryRegion, [ToastType.Pointer]],

	[ToastType.String, [ToastType.MemoryRegion]],
	[ToastType.CString, [ToastType.CString]],

	[ToastType.Array, [ToastType.MemoryRegion]],

	[ToastType.Syscode, [ToastType.Integer]],
	[ToastType.FunctionPointer, [ToastType.Pointer]],
]))
export const AllTypes = [ToastType.Any,

/** [0-9]+ */
ToastType.Integer,

/** [a-zA-Z]+ */
ToastType.Name,

/** true, false */
ToastType.Boolean,

/** "^["]+" */
ToastType.String,

/** "^["]+" */
ToastType.CString,

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
]

interface TypeConstraint {
	// Matches
	(token: Token, lexer: Compiler): boolean;
}

function BasicConstraint(type: ToastType): TypeConstraint {
	return (k, l) => k.type == type
}

class Signature {
	constructor(public inputs: TypeConstraint[], public output: TypeConstraint[]) { }
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
