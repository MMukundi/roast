import { CompilerArguments, CompilerFlags, Flags } from "./arguments"
import { BufferedStyledLogger, ConsoleColor } from "./style"

/** Writes to stdout */
export const stdWrite = process.stdout.write.bind(process.stdout)

/** The logger for toast errors */
export const errorLogger = new BufferedStyledLogger(stdWrite, "toast {error}: ", "\n", ConsoleColor.Red)
/** The logger for toast warnings */
export const warningLogger = new BufferedStyledLogger(stdWrite, "toast {warn}: ", "\n", ConsoleColor.Yellow)
/** The logger for toast notes */
export const noteLogger = new BufferedStyledLogger(stdWrite, "toast {note}: ", "\n", ConsoleColor.Blue)
/** The logger for toast debug statements */
export const debugLogger = new BufferedStyledLogger((buffer) => CompilerFlags[Flags.Debug] ? stdWrite(buffer) : null, "toast {debug}: ", "\n", ConsoleColor.Purple)