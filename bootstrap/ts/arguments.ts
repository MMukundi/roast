import path from "path"

// All of the arguments to the program (with the node command and the filename)
const CommandLineArguments = process.argv
// The arguments to the compiler
export const CompilerArguments = CommandLineArguments.slice(2)

// An 'input' is any argument that doesn't start with a dash
export const Inputs = CompilerArguments.filter(arg => !arg.startsWith('-'))

// The first input is assumed to be the source file
export const SourceFile = Inputs[0]

// The location of the compiler source files
export const CompilerDirectory = path.resolve(__dirname, "../ts")