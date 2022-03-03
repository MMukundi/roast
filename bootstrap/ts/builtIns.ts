import { SourceLocation } from "./tokens";
import { TypeChecker } from "./typeChecker";
import { ConstantType, Signature } from "./typeInference";
import { Type } from "./types";

export const BuiltInFunctionSignature: Record<string, Signature> = {
	/// StackOps

	// ...rest, b -> ...rest
	'pop': {
		inputs: [new ConstantType(Type.Any)],
		outputs: []
	},

	// TODO! Variadic number of inputs
	'popN': {
		inputs: [new ConstantType(Type.Any)],
		outputs: []
	},

	'swap': {
		inputs: [new ConstantType(Type.Any), new ConstantType(Type.Any)],
		outputs: [new ConstantType(Type.Any), new ConstantType(Type.Any)]
	},
	'dup': {
		inputs: [new ConstantType(Type.Any)],
		outputs: [new ConstantType(Type.Any), new ConstantType(Type.Any)]
	},

	// -- ROLL --
	'roll': {
		inputs: [new ConstantType(Type.Any)],
		outputs: [new ConstantType(Type.Any), new ConstantType(Type.Any)]
	},

	'close': {
		inputs: [new ConstantType(Type.FileDescriptor)],
		outputs: []
	},

	'readOpen': {
		inputs: [],
		outputs: [new ConstantType(Type.FileDescriptor)]
	},
	'writeOpen': {
		inputs: [],
		outputs: [new ConstantType(Type.FileDescriptor)]
	},

	'readFile': {
		inputs: [new ConstantType(Type.FileDescriptor)],
		outputs: [new ConstantType(Type.MemoryRegion), new ConstantType(Type.Integer)]
	},
	'readFileTo': {
		inputs: [new ConstantType(Type.MemoryRegion), new ConstantType(Type.FileDescriptor)],
		outputs: [new ConstantType(Type.Integer)]
	},

	'array': {
		inputs: [new ConstantType(Type.Integer)],
		outputs: [new ConstantType(Type.Array)]
	},

	'buffer': {
		inputs: [new ConstantType(Type.Integer)],
		outputs: [new ConstantType(Type.MemoryRegion)]
	},

	'length': {
		inputs: [new ConstantType(Type.Array)],
		outputs: [new ConstantType(Type.Integer)]
	},

	'print': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.StringPointer)],
		outputs: []
	},

	'fprint': {
		inputs: [new ConstantType(Type.FileDescriptor), new ConstantType(Type.Integer), new ConstantType(Type.StringPointer)],
		outputs: []
	},

	// TODO! Variadic typing for printf
	'printf': {
		inputs: [new ConstantType(Type.StringPointer)],
		outputs: []
	},
	'fprintf': {
		inputs: [new ConstantType(Type.FileDescriptor), new ConstantType(Type.StringPointer)],
		outputs: []
	},

	'sprintf': {
		inputs: [new ConstantType(Type.StringPointer)],
		outputs: [new ConstantType(Type.StringPointer)]
	},

	'input': {
		inputs: [],
		outputs: [new ConstantType(Type.StringPointer)]
	},

	'filePrintNum': {
		inputs: [new ConstantType(Type.FileDescriptor), new ConstantType(Type.Integer)],
		outputs: []
	},
	'printNum': {
		inputs: [new ConstantType(Type.Integer)],
		outputs: []
	},
	'filePrintNumBase': {
		inputs: [new ConstantType(Type.FileDescriptor), new ConstantType(Type.Integer), new ConstantType(Type.Integer)],
		outputs: []
	},
	'printNumBase': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.Integer)],
		outputs: []
	},

	'strEq': {
		inputs: [new ConstantType(Type.StringPointer), new ConstantType(Type.StringPointer)],
		outputs: [new ConstantType(Type.Boolean)]
	},

	'strLen': {
		inputs: [new ConstantType(Type.StringPointer)],
		outputs: [new ConstantType(Type.Integer)]
	},

	// TODO! Variadic typing for copy
	'copy': {
		inputs: [new ConstantType(Type.Integer)],
		outputs: []
	},

	// TODO! Variadic typing for index
	'index': {
		inputs: [new ConstantType(Type.Integer)],
		outputs: []
	},

	'strCopy': {
		inputs: [new ConstantType(Type.StringPointer), new ConstantType(Type.StringPointer)],
		outputs: []
	},
	'memCopy': {
		inputs: [new ConstantType(Type.MemoryRegion), new ConstantType(Type.MemoryRegion)],
		outputs: []
	},

	// TODO! Typing for bytes vs values
	'memCopyByte': {
		inputs: [new ConstantType(Type.MemoryRegion), new ConstantType(Type.MemoryRegion)],
		outputs: []
	},

	'exit': {
		inputs: [new ConstantType(Type.Integer)],
		outputs: []
	},

	// TODO! Change to 'type that can convert to pointer'
	'getPtr': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.Pointer)],
		outputs: [new ConstantType(Type.Pointer)]
	},
	// TODO! More specific than any?
	'get': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.Pointer)],
		outputs: [new ConstantType(Type.Any)]
	},
	'set': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.Pointer), new ConstantType(Type.Any)],
		outputs: []
	},
	'read': {
		inputs: [new ConstantType(Type.Pointer)],
		outputs: [new ConstantType(Type.Any)]
	},
	'write': {
		inputs: [new ConstantType(Type.Pointer), new ConstantType(Type.Any)],
		outputs: []
	},

	// TODO! Change to 'type that can convert to pointer'
	// TODO! Typing for bytes vs values
	'getBytePtr': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.Pointer)],
		outputs: [new ConstantType(Type.Pointer)]
	},
	// TODO! More specific than any?
	'getByte': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.Pointer)],
		outputs: [new ConstantType(Type.Byte)]
	},
	'setByte': {
		inputs: [new ConstantType(Type.Integer), new ConstantType(Type.Pointer), new ConstantType(Type.Byte)],
		outputs: []
	},
	'readByte': {
		inputs: [new ConstantType(Type.Pointer)],
		outputs: [new ConstantType(Type.Byte)]
	},
	'writeByte': {
		inputs: [new ConstantType(Type.Pointer), new ConstantType(Type.Byte)],
		outputs: []
	},

	'intToString': {
		inputs: [new ConstantType(Type.Integer)],
		outputs: [new ConstantType(Type.Integer), new ConstantType(Type.StringPointer)]
	},
	'stringToInt': {
		inputs: [new ConstantType(Type.StringPointer)],
		outputs: [new ConstantType(Type.Integer)]
	},
}