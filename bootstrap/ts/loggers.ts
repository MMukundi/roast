import { CompilerArguments, CompilerFlags, Flags } from "./arguments"
import { BufferedStyledLogger, ConsoleColor } from "./style"

export const stdWrite = process.stdout.write.bind(process.stdout)

export const errorLogger = new BufferedStyledLogger(stdWrite, "toast {error}: ", "\n", ConsoleColor.Red)
export const warningLogger = new BufferedStyledLogger(stdWrite, "toast {warn}: ", "\n", ConsoleColor.Yellow)
export const noteLogger = new BufferedStyledLogger(stdWrite, "toast {note}: ", "\n", ConsoleColor.Blue)
export const debugLogger = new BufferedStyledLogger((buffer) => CompilerFlags[Flags.Debug] ? stdWrite(buffer) : null, "toast {debug}: ", "\n", ConsoleColor.Purple)