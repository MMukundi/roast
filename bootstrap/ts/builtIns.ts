import { SourceLocation } from "./tokens";
import { TypeChecker } from "./typeChecker";
import { ConstantType, Scheme, SequenceType, Signature, TypeFunction } from "./typeInference";
import { Type } from "./types";

export const BuiltInFunctionSignature: Record<string, Scheme> = {
	/// StackOps

	// ...rest, b -> ...rest
	'pop': new TypeFunction(
		new SequenceType([new ConstantType(Type.Any)]),
		new SequenceType([])
	).generalize(),

	// TODO! Variadic number of inputs
	'popN': new TypeFunction(
		new SequenceType([new ConstantType(Type.Any)]),
		new SequenceType([])
	).generalize(),

	'swap': new TypeFunction(
		new SequenceType([new ConstantType(Type.Any), new ConstantType(Type.Any)]),
		new SequenceType([new ConstantType(Type.Any), new ConstantType(Type.Any)])
	).generalize(),
	'dup': new TypeFunction(
		new SequenceType([new ConstantType(Type.Any)]),
		new SequenceType([new ConstantType(Type.Any), new ConstantType(Type.Any)])
	).generalize(),

	// -- ROLL --
	'roll': new TypeFunction(
		new SequenceType([new ConstantType(Type.Any)]),
		new SequenceType([new ConstantType(Type.Any), new ConstantType(Type.Any)])
	).generalize(),

	'close': new TypeFunction(
		new SequenceType([new ConstantType(Type.FileDescriptor)]),
		new SequenceType([])
	).generalize(),

	'readOpen': new TypeFunction(
		new SequenceType([]),
		new SequenceType([new ConstantType(Type.FileDescriptor)])
	).generalize(),
	'writeOpen': new TypeFunction(
		new SequenceType([]),
		new SequenceType([new ConstantType(Type.FileDescriptor)])
	).generalize(),

	'readFile': new TypeFunction(
		new SequenceType([new ConstantType(Type.FileDescriptor)]),
		new SequenceType([new ConstantType(Type.MemoryRegion), new ConstantType(Type.Integer)])
	).generalize(),
	'readFileTo': new TypeFunction(
		new SequenceType([new ConstantType(Type.MemoryRegion), new ConstantType(Type.FileDescriptor)]),
		new SequenceType([new ConstantType(Type.Integer)])
	).generalize(),

	'array': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer)]),
		new SequenceType([new ConstantType(Type.Array)])
	).generalize(),

	'buffer': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer)]),
		new SequenceType([new ConstantType(Type.MemoryRegion)])
	).generalize(),

	'length': new TypeFunction(
		new SequenceType([new ConstantType(Type.Array)]),
		new SequenceType([new ConstantType(Type.Integer)])
	).generalize(),

	'print': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.StringPointer)]),
		new SequenceType([])
	).generalize(),

	'fprint': new TypeFunction(
		new SequenceType([new ConstantType(Type.FileDescriptor), new ConstantType(Type.Integer), new ConstantType(Type.StringPointer)]),
		new SequenceType([])
	).generalize(),

	// TODO! Variadic typing for printf
	'printf': new TypeFunction(
		new SequenceType([new ConstantType(Type.StringPointer)]),
		new SequenceType([])
	).generalize(),
	'fprintf': new TypeFunction(
		new SequenceType([new ConstantType(Type.FileDescriptor), new ConstantType(Type.StringPointer)]),
		new SequenceType([])
	).generalize(),

	'sprintf': new TypeFunction(
		new SequenceType([new ConstantType(Type.StringPointer)]),
		new SequenceType([new ConstantType(Type.StringPointer)])
	).generalize(),

	'input': new TypeFunction(
		new SequenceType([]),
		new SequenceType([new ConstantType(Type.StringPointer)])
	).generalize(),

	'filePrintNum': new TypeFunction(
		new SequenceType([new ConstantType(Type.FileDescriptor), new ConstantType(Type.Integer)]),
		new SequenceType([])
	).generalize(),
	'printNum': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer)]),
		new SequenceType([])
	).generalize(),
	'filePrintNumBase': new TypeFunction(
		new SequenceType([new ConstantType(Type.FileDescriptor), new ConstantType(Type.Integer), new ConstantType(Type.Integer)]),
		new SequenceType([])
	).generalize(),
	'printNumBase': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.Integer)]),
		new SequenceType([])
	).generalize(),

	'strEq': new TypeFunction(
		new SequenceType([new ConstantType(Type.StringPointer), new ConstantType(Type.StringPointer)]),
		new SequenceType([new ConstantType(Type.Boolean)])
	).generalize(),

	'strLen': new TypeFunction(
		new SequenceType([new ConstantType(Type.StringPointer)]),
		new SequenceType([new ConstantType(Type.Integer)])
	).generalize(),

	// TODO! Variadic typing for copy
	'copy': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer)]),
		new SequenceType([])
	).generalize(),

	// TODO! Variadic typing for index
	'index': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer)]),
		new SequenceType([])
	).generalize(),

	'strCopy': new TypeFunction(
		new SequenceType([new ConstantType(Type.StringPointer), new ConstantType(Type.StringPointer)]),
		new SequenceType([])
	).generalize(),
	'memCopy': new TypeFunction(
		new SequenceType([new ConstantType(Type.MemoryRegion), new ConstantType(Type.MemoryRegion)]),
		new SequenceType([])
	).generalize(),

	// TODO! Typing for bytes vs values
	'memCopyByte': new TypeFunction(
		new SequenceType([new ConstantType(Type.MemoryRegion), new ConstantType(Type.MemoryRegion)]),
		new SequenceType([])
	).generalize(),

	'exit': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer)]),
		new SequenceType([])
	).generalize(),

	// TODO! Change to 'type that can convert to pointer'
	'getPtr': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.Pointer)]),
		new SequenceType([new ConstantType(Type.Pointer)])
	).generalize(),
	// TODO! More specific than any?
	'get': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.Pointer)]),
		new SequenceType([new ConstantType(Type.Any)])
	).generalize(),
	'set': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.Pointer), new ConstantType(Type.Any)]),
		new SequenceType([])
	).generalize(),
	'read': new TypeFunction(
		new SequenceType([new ConstantType(Type.Pointer)]),
		new SequenceType([new ConstantType(Type.Any)])
	).generalize(),
	'write': new TypeFunction(
		new SequenceType([new ConstantType(Type.Pointer), new ConstantType(Type.Any)]),
		new SequenceType([])
	).generalize(),

	// TODO! Change to 'type that can convert to pointer'
	// TODO! Typing for bytes vs values
	'getBytePtr': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.Pointer)]),
		new SequenceType([new ConstantType(Type.Pointer)])
	).generalize(),
	// TODO! More specific than any?
	'getByte': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.Pointer)]),
		new SequenceType([new ConstantType(Type.Byte)])
	).generalize(),
	'setByte': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.Pointer), new ConstantType(Type.Byte)]),
		new SequenceType([])
	).generalize(),
	'readByte': new TypeFunction(
		new SequenceType([new ConstantType(Type.Pointer)]),
		new SequenceType([new ConstantType(Type.Byte)])
	).generalize(),
	'writeByte': new TypeFunction(
		new SequenceType([new ConstantType(Type.Pointer), new ConstantType(Type.Byte)]),
		new SequenceType([])
	).generalize(),

	'intToString': new TypeFunction(
		new SequenceType([new ConstantType(Type.Integer)]),
		new SequenceType([new ConstantType(Type.Integer), new ConstantType(Type.StringPointer)])
	).generalize(),
	'stringToInt': new TypeFunction(
		new SequenceType([new ConstantType(Type.StringPointer)]),
		new SequenceType([new ConstantType(Type.Integer)])
	).generalize(),
}