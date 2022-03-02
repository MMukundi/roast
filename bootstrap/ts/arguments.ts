import path from "path"

/** All of the arguments to the program (with the node command and the filename) */
const CommandLineArguments = process.argv
/** The arguments to the compiler */
export const CompilerArguments = CommandLineArguments.slice(2)
/** An 'input' is any argument that doesn't start with a dash, and isn't input to an option */
export const Inputs: string[] = []

/** The command line options which consume an input  */
export enum Options {
	/** The file the compiler should output */
	OutputFile = "o",
	/** The directory the output file should be relative to */
	OutputDirectory = "od"
}
/** The command line flags, which set internal booleans */
export enum Flags {
	/** If set, debug information will be printed */
	Debug = "d",
	/** If set, the assembler will also emit
	 * a file with all macros and preprocessor
	 * statements */
	EmitPreprocessed = "p",
	TypeCheck = "t"
}

/** The compiler options, after parsing inputs from the command line  */
export const CompilerOptions: Record<Options, string> = {
	[Options.OutputFile]: null,
	[Options.OutputDirectory]: "./",
}

/** The compiler flags, after parsing inputs from the command line  */
export const CompilerFlags: Record<Flags, boolean> = {
	[Flags.Debug]: false,
	[Flags.EmitPreprocessed]: false,
	[Flags.TypeCheck]: false,
}

// Iterate over the command line arguments, and parse the options and flags
for (let argumentIndex = 0; argumentIndex < CompilerArguments.length; argumentIndex++) {
	if (CompilerArguments[argumentIndex][0] == "-") {
		//Handle options
		const name = CompilerArguments[argumentIndex].substring(1)
		if (name in CompilerFlags) {
			CompilerFlags[name as Flags] = true
		}
		else if (name in CompilerOptions) {
			CompilerOptions[name as Options] = CompilerArguments[++argumentIndex]
		}
	}
	else {
		Inputs.push(CompilerArguments[argumentIndex])
	}
}


/** The first input, assumed to be the source file */
export const SourceFile = Inputs[0]

/** The location of the compiler source directory */
export const CompilerRootDirectory = path.resolve(__dirname, "../")

/** The location of the toast standard library */
export const StandardLibraryDirectory = path.resolve(CompilerRootDirectory, "./std")