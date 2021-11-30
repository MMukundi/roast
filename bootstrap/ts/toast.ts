import { SourceFile } from "./arguments"
import { BufferedStyledLogger, ConsoleColor, StringStyler } from "./style"
const errorStyler = new BufferedStyledLogger(process.stdout.write.bind(process.stdout))
errorStyler.fg(ConsoleColor.Red)
const warningStyler = new BufferedStyledLogger(process.stdout.write.bind(process.stdout))
warningStyler.fg(ConsoleColor.Yellow)

function toastError(errorString: string) {
	errorStyler.styleLog(`toast {error}: ${errorString}\n`)
	errorStyler.flush()
}
function toastWarning(errorString: string) {
	warningStyler.styleLog(`toast {warn} : ${errorString}\n`)
	warningStyler.flush()
}

toastWarning('toast not implemented')
if (!SourceFile) {
	toastError('no source file provided')
}

