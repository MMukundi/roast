import { SourceLocation } from "./tokens";
import { TypeChecker } from "./typeChecker";
import { Signature } from "./typeInference";
import { SpecificTypeConstraint, Type } from "./types";

export const BuiltInFunctionSignature: Record<string, (type: TypeChecker, location: SourceLocation) => Signature> = {
	/// StackOps

	// ...rest, b -> ...rest
	'pop':
		(t, location) => ({
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