# ToastScript

A PostScript-inspired language bootstrapped with Typescript

## Usage:

`{toastCommand} sourceFile [-- compilerArgs]`

- Compile using the specified compiler
  - toastCompiler: The toast compiler command to use
  - sourceFile: The file to compile
  - compilerArgs: Any arguments to pass trough to the compiler

## Compilers:

### TypeScript:

`npm run tsCompile`

- Compile using the TypeScript compiler
  - Example:
  - `npm run tsCompile sourceFile [-- compilerArgs]`

`npm run tsWatchCompile`

- Compile using the TypeScript compiler, rebuilding if the source files or compiler source files are changed
  - Example:
  - `npm run tsWatchCompile sourceFile [-- compilerArgs]`

### Self-Hosted(Not-yet implemented):

`toast`

- The command to run compile using the self-hosted compiler
  - Example:
  - `toast sourceFile [-- compilerArgs]`
