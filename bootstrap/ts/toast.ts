import { exit } from "process"
import { CompilerFlags, CompilerOptions, Flags, Options, SourceFile } from "./arguments"
import { LexerSourceFile } from "./lexer"
import { debugLogger, errorLogger, noteLogger, warningLogger } from "./loggers"
import { Compiler } from "./parser"


noteLogger.flushLog('toast only partially implemented')
if (!SourceFile) {
	errorLogger.flushLog('no source file provided')
	process.exit()
}

let compiler;
try {
	compiler = Compiler.fromSource(SourceFile);
} catch (e: any) {
	// No such file
	if (e?.code === "ENOENT") {
		errorLogger.flushLog(`file '${SourceFile}' does not exist`)
	} else {
		errorLogger.flushLog(`error reading file '${SourceFile}'`)
	}
	process.exit()
}
if (!compiler.generateAssembly()) {
	errorLogger.styleLog("Compilation failed.")
	exit(1)
}
compiler.generateAssembly()
compiler.write("\ttoastExit 0\n")
compiler.save()
compiler.compile(CompilerFlags[Flags.EmitPreprocessed])
if (CompilerFlags[Flags.RunAfterCompile]) {
	try {
		compiler.run()
	} catch (e) {
		const error = e as any
		const pref = '\t> '
		errorLogger.flushLog(`------------Run Failed----------------`)
		errorLogger.flushLog(`${pref}File: ${compiler.source.name} `)
		errorLogger.flushLog(`${pref}Exit Code: ${error.status} `)
		errorLogger.flushLog(`${pref}Exit Signal: ${error.signal} `)
		errorLogger.flushLog(`${pref}Exit output: ${error.stderr?.toString() || "N/A"} `)
		process.exit(error.status)
	}
}