import { SourceFile } from "./arguments"
import { LexerSourceFile } from "./lexer"
import { BufferedStyledLogger, ConsoleColor } from "./style"

const errorStyler = new BufferedStyledLogger(process.stdout.write.bind(process.stdout))
errorStyler.fg(ConsoleColor.Red)
const warningStyler = new BufferedStyledLogger(process.stdout.write.bind(process.stdout))
warningStyler.fg(ConsoleColor.Yellow)

function toastError(errorString: string) {
	errorStyler.styleLog(`toast {error}: ${errorString}\n`)
	errorStyler.flush()
}
function toastWarning(warning: string) {
	warningStyler.styleLog(`toast {warn}: ${warning}\n`)
	warningStyler.flush()
}


toastWarning('toast not implemented')
if (!SourceFile) {
	toastError('no source file provided')
	process.exit()
}

let sourceFile;
try {
	sourceFile = new LexerSourceFile(SourceFile)
} catch (e: any) {
	// No such file
	if (e?.code === "ENOENT") {
		toastError(`file '${SourceFile}' does not exist`)
	} else {
		toastError(`error reading file '${SourceFile}'`)
	}
	process.exit()
}