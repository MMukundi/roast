import { SourceFile } from "./arguments"
import { BufferedStyledLogger, ConsoleColor, StringStyler } from "./style"
const errorStyler = new BufferedStyledLogger(process.stdout.write.bind(process.stdout))
errorStyler.fg(ConsoleColor.Red)

function toastError(errorString: string) {
	errorStyler.styleLog(`toast {error}: ${errorString}\n`)
	errorStyler.flush()
}

toastError('toast not implemented')
if (!SourceFile) {
	toastError('no source file provided')
}

