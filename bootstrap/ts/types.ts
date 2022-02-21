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

	[ToastType.FileDescriptor, [ToastType.Integer]],
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

/** call */
ToastType.FileDescriptor,
]

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


	[ToastType.Keyword]: "Keyword",

	[ToastType.Any]: "Any",
	[ToastType.Boolean]: "Boolean",
	[ToastType.Name]: "Name",
	[ToastType.Integer]: "Integer",
	[ToastType.CodeBlock]: "CodeBlock",
	[ToastType.Array]: "Array",
	[ToastType.String]: "String",
	[ToastType.CString]: "CString",
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
	abstract getToken(): Token | null
	abstract getType(): SpecificTypeConstraint
	abstract canConvertTo(type: ToastType): boolean;
}

export class SpecificTypeConstraint extends TypeConstraint {
	static specificConstraints: Record<ToastType, SpecificTypeConstraint> = {} as any
	constructor(public type: ToastType) {
		super();
	}

	static for(type: ToastType) {
		return this.specificConstraints[type]
	}

	canConvertTo(type: ToastType): boolean {
		return toastImplicitConversions.get(this.type).has(type)
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
		return this.getType().canConvertTo(type)
	}
}
for (const type of AllTypes) {
	SpecificTypeConstraint.specificConstraints[type] = new SpecificTypeConstraint(type)
}

export class NameConstraint extends ToastTypeConstraint {
	constructor(public nameToken: Token, public nameMap: NameMap) { super() }

	getType(): SpecificTypeConstraint {
		let valueConstraint = this.nameMap[this.nameToken.value]
		let valueToken = valueConstraint.getToken()
		while (valueToken?.type == ToastType.Name) {
			valueConstraint = this.nameMap[valueToken.value]
			valueToken = valueConstraint.getToken()
		}
		return valueConstraint.getType()
	}

	getToken() {
		let valueConstraint = this.nameMap[this.nameToken.value]
		let valueToken = valueConstraint.getToken()
		while (valueToken?.type == ToastType.Name) {
			valueConstraint = this.nameMap[valueToken.value]
			valueToken = valueConstraint.getToken()
		}
		return valueToken
	}
}
export class TokenConstraint extends ToastTypeConstraint {
	constructor(public token: Token, public nameMap: NameMap) { super() }

	getType(): SpecificTypeConstraint {
		// return new SpecificTypeConstraint(this.token.type)
		return this.token.type == ToastType.Name ? new NameConstraint(this.token, this.nameMap).getType() : new SpecificTypeConstraint(this.token.type)
	}
	getToken(): Token {
		// return this.token
		return this.token.type == ToastType.Name ? new NameConstraint(this.token, this.nameMap).getToken() : this.token
	}
}

export interface Signature { inputs: SpecificTypeConstraint[], outputs: SpecificTypeConstraint[] }


export const BuiltInFunctionSignature: Record<string, Signature> = {
	/// StackOps
	'pop': { inputs: [new SpecificTypeConstraint(ToastType.Any)], outputs: [] },

	// TODO! Variadic number of inputs
	'popN': { inputs: [new SpecificTypeConstraint(ToastType.Any)], outputs: [] },

	'swap': { inputs: [new SpecificTypeConstraint(ToastType.Any), new SpecificTypeConstraint(ToastType.Any)], outputs: [new SpecificTypeConstraint(ToastType.Any), new SpecificTypeConstraint(ToastType.Any)] },
	'dup': { inputs: [new SpecificTypeConstraint(ToastType.Any)], outputs: [new SpecificTypeConstraint(ToastType.Any), new SpecificTypeConstraint(ToastType.Any)] },

	// -- ROLL --
	'roll': { inputs: [new SpecificTypeConstraint(ToastType.Any)], outputs: [new SpecificTypeConstraint(ToastType.Any), new SpecificTypeConstraint(ToastType.Any)] },

	'close': { inputs: [new SpecificTypeConstraint(ToastType.FileDescriptor)], outputs: [] },

	'readOpen': { inputs: [], outputs: [new SpecificTypeConstraint(ToastType.FileDescriptor)] },
	'writeOpen': { inputs: [], outputs: [new SpecificTypeConstraint(ToastType.FileDescriptor)] },

	'readFile': { inputs: [new SpecificTypeConstraint(ToastType.FileDescriptor)], outputs: [new SpecificTypeConstraint(ToastType.MemoryRegion), new SpecificTypeConstraint(ToastType.Integer)] },
	'readFileTo': { inputs: [new SpecificTypeConstraint(ToastType.MemoryRegion), new SpecificTypeConstraint(ToastType.FileDescriptor)], outputs: [new SpecificTypeConstraint(ToastType.Integer)] },

	'array': { inputs: [new SpecificTypeConstraint(ToastType.Integer)], outputs: [new SpecificTypeConstraint(ToastType.Array)] },

	'buffer': { inputs: [new SpecificTypeConstraint(ToastType.Integer)], outputs: [new SpecificTypeConstraint(ToastType.MemoryRegion)] },

	'length': { inputs: [new SpecificTypeConstraint(ToastType.Array)], outputs: [new SpecificTypeConstraint(ToastType.Integer)] },

	'print': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.String)], outputs: [] },

	'fprint': { inputs: [new SpecificTypeConstraint(ToastType.FileDescriptor), new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.String)], outputs: [] },

	// TODO! Variadic typing for printf
	'printf': { inputs: [new SpecificTypeConstraint(ToastType.String)], outputs: [] },
	'fprintf': { inputs: [new SpecificTypeConstraint(ToastType.FileDescriptor), new SpecificTypeConstraint(ToastType.String)], outputs: [] },

	'sprintf': { inputs: [new SpecificTypeConstraint(ToastType.String)], outputs: [new SpecificTypeConstraint(ToastType.String)] },

	'input': { inputs: [], outputs: [new SpecificTypeConstraint(ToastType.String)] },

	'filePrintNum': { inputs: [new SpecificTypeConstraint(ToastType.FileDescriptor), new SpecificTypeConstraint(ToastType.Integer)], outputs: [] },
	'printNum': { inputs: [new SpecificTypeConstraint(ToastType.Integer)], outputs: [] },
	'filePrintNumBase': { inputs: [new SpecificTypeConstraint(ToastType.FileDescriptor), new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Integer)], outputs: [] },
	'printNumBase': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Integer)], outputs: [] },

	'strEq': { inputs: [new SpecificTypeConstraint(ToastType.String), new SpecificTypeConstraint(ToastType.String)], outputs: [new SpecificTypeConstraint(ToastType.Boolean)] },

	'strLen': { inputs: [new SpecificTypeConstraint(ToastType.String)], outputs: [new SpecificTypeConstraint(ToastType.Integer)] },

	// TODO! Variadic typing for copy
	'copy': { inputs: [new SpecificTypeConstraint(ToastType.Integer)], outputs: [] },

	// TODO! Variadic typing for index
	'index': { inputs: [new SpecificTypeConstraint(ToastType.Integer)], outputs: [] },

	'strCopy': { inputs: [new SpecificTypeConstraint(ToastType.String), new SpecificTypeConstraint(ToastType.String)], outputs: [] },
	'memCopy': { inputs: [new SpecificTypeConstraint(ToastType.MemoryRegion), new SpecificTypeConstraint(ToastType.MemoryRegion)], outputs: [] },

	// TODO! Typing for bytes vs values
	'memCopyByte': { inputs: [new SpecificTypeConstraint(ToastType.MemoryRegion), new SpecificTypeConstraint(ToastType.MemoryRegion)], outputs: [] },

	'exit': { inputs: [new SpecificTypeConstraint(ToastType.Integer)], outputs: [] },

	// TODO! Change to 'type that can convert to pointer'
	'getPtr': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Pointer)], outputs: [new SpecificTypeConstraint(ToastType.Pointer)] },
	// TODO! More specific than any?
	'get': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Pointer)], outputs: [new SpecificTypeConstraint(ToastType.Any)] },
	'set': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Pointer), new SpecificTypeConstraint(ToastType.Any)], outputs: [] },
	'read': { inputs: [new SpecificTypeConstraint(ToastType.Pointer)], outputs: [new SpecificTypeConstraint(ToastType.Any)] },
	'write': { inputs: [new SpecificTypeConstraint(ToastType.Pointer), new SpecificTypeConstraint(ToastType.Any)], outputs: [] },

	// TODO! Change to 'type that can convert to pointer'
	// TODO! Typing for bytes vs values
	'getBytePtr': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Pointer)], outputs: [new SpecificTypeConstraint(ToastType.Pointer)] },
	// TODO! More specific than any?
	'getByte': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Pointer)], outputs: [new SpecificTypeConstraint(ToastType.Any)] },
	'setByte': { inputs: [new SpecificTypeConstraint(ToastType.Integer), new SpecificTypeConstraint(ToastType.Pointer), new SpecificTypeConstraint(ToastType.Any)], outputs: [] },
	'readByte': { inputs: [new SpecificTypeConstraint(ToastType.Pointer)], outputs: [new SpecificTypeConstraint(ToastType.Any)] },
	'writeByte': { inputs: [new SpecificTypeConstraint(ToastType.Pointer), new SpecificTypeConstraint(ToastType.Any)], outputs: [] },

	'intToString': { inputs: [new SpecificTypeConstraint(ToastType.Integer)], outputs: [new SpecificTypeConstraint(ToastType.String)] },
	'stringToInt': { inputs: [new SpecificTypeConstraint(ToastType.String)], outputs: [new SpecificTypeConstraint(ToastType.Integer)] },
}