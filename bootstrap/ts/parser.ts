import { execSync } from "child_process";
import { cp, writeFileSync } from "fs";
import path from "path";
import { CompilerFlags, CompilerOptions, CompilerRootDirectory, Inputs, Options, StandardLibraryDirectory } from "./arguments";
import { LexerSource, LexerSourceFile } from "./lexer";
import { debugLogger, errorLogger, noteLogger } from "./loggers";
import { Token, SourceLocation, TokenMap, tokenString, TokenValues, ToastType } from "./tokens";
import { escapeString, ToastExtensions, unescapeChar, unescapeString } from "./utils";
import { toastImplicitConversions, closure, CompileTimeConstant } from "./types"

const EntryPoint = "_start"
type TokenProcessor<T> = {
	[type in ToastType]: (context: T, value: TokenMap[type]) => void
}

const SysCodes = { "Exit": "Exit", "Fork": "Fork", "Write": "Write", "Open": "Open", "Exec": "Exec", "Wait": "Wait4" }

function OpenBlock(compiler: Compiler, name?: string) {
	// Start a new label
	compiler.assemblySource += `\ttoastBeginCodeBlock${name ? ` ${name}` : ""}\n`
	compiler.scopeDepth++
}
function CloseBlock(compiler: Compiler, name?: string) {
	compiler.assemblySource += `\ttoastEndCodeBlock${name ? ` ${name}` : ""}\n`
	compiler.scopeDepth--
}

const compilerProcessor: TokenProcessor<Compiler> = {
	[ToastType.Array](compiler, { value: { end, tokens }, location }) {
		compiler.assemblySource += `\ttoastPushMark\n`
		// compilerProcessor[ToastType.OpenArray](compiler, { value: null, location, type: ToastType.OpenArray });

		compiler.contextStack.push({ index: 0, tokens })
		for (const token of tokens) {
			compiler.writeToken(token)
		}
		compiler.contextStack.pop()

		compiler.assemblySource += `\ttoastArrayUntilMark\n`
		// compilerProcessor[ToastType.CloseArray](compiler, { value: null, location: end, type: ToastType.CloseArray });
	},
	[ToastType.CodeBlock](compiler, { value: { tokens, end }, location }) {
		const nameToken = compiler.lookAhead(1)
		const defToken = compiler.lookAhead(2)

		let name = null

		// If this is a variable definition
		if (defToken && nameToken && nameToken.type === ToastType.Name && defToken.type === ToastType.Keyword && defToken.value == "def") {
			name = nameToken.value
			// Consuming the name and def tokens, as they does not need to recompile in this case
			compiler.currentContext.index += 2
		}

		compiler.contextStack.push({ index: 0, tokens })
		OpenBlock(compiler, name)
		for (; compiler.currentContext.index < tokens.length; compiler.currentContext.index++) {
			compiler.writeToken(compiler.currentContext.tokens[compiler.currentContext.index])
		}
		CloseBlock(compiler, name)
		compiler.contextStack.pop()
	},
	[ToastType.Name](compiler, { value: name, location }) {
		const SysCodeString = 'Syscode'
		const SysCallString = 'Syscall'

		// BuiltInConstants
		if (CompileTimeConstant.getConstant(name)) {
			compiler.assemblySource += `\tmov r8, ${CompileTimeConstant.getConstant(name).assemblyValue}\n\tpush r8\n`
			return
		}

		// Raw syscalls
		let SyscallCount;
		if (name.startsWith(SysCallString.toLocaleLowerCase()) && !isNaN(parseInt(SyscallCount = name.substring(SysCallString.length)))) {
			compiler.assemblySource += `\ttoastStackSyscall ${SyscallCount}\n`
			// compiler.assemblySource += `\tpop rax\n\tsyscall\n\tpush rax\n`
			return;
		}

		switch (name) {

			case '>=':
				compiler.assemblySource += `\ttoastStackCompare ge\n`
				return;
			case '<=':
				compiler.assemblySource += `\ttoastStackCompare le\n`
				return;

			case '>':
				compiler.assemblySource += `\ttoastStackCompare g\n`
				return;
			case '<':
				compiler.assemblySource += `\ttoastStackCompare l\n`
				return;
			case '=':
				compiler.assemblySource += `\ttoastStackCompare e\n`
				return;

			case '!=':
				compiler.assemblySource += `\ttoastStackCompare ne\n`
				return;

			case '!':
				compiler.assemblySource += `\tpush 0\n\ttoastStackCompare e\n`
				return;

			/// StackOps
			case 'pop':
				compiler.assemblySource += `\ttoastPop\n`
				return

			case 'swap':
				compiler.assemblySource += `\ttoastSwap\n`
				return

			case 'dup':
				compiler.assemblySource += `\ttoastDup\n`
				return

			case 'roll':
				compiler.assemblySource += `\t${compiler.functionCall} roll\n`
				return

			//FILE OPS, UNDER DEVELOOMENT
			case 'close':
				compiler.assemblySource += `\ttoastStackCloseFile\n`
				return;
			case 'readOpen':
				compiler.assemblySource += `\ttoastStackReadOpenFile\n`
				return;
			case 'writeOpen':
				compiler.assemblySource += `\ttoastStackWriteOpenFile\n`
				return;

			case 'readFile':
				compiler.assemblySource += `\ttoastCallFunc read_file\n`
				return;
			case 'readFileTo':
				compiler.assemblySource += `\ttoastCallFunc read_file_to\n`
				return;
			case 'array':
				const arraySizeToken = compiler.lookBehind(1)
				if (arraySizeToken?.type == ToastType.Integer && compiler.scopeDepth == 0) {
					// TODO: Here, we can create const size arrays, but only if in the outer scope
					// TODO: Do this in the parse value section
					compiler.assemblySource += `\ttoastStackCreateArray\n`
					return
				} else {
					compiler.assemblySource += `\ttoastStackCreateArray\n`
					return
				}
				errorLogger.flushLog("Array size not provided")
				return;

			case 'buffer':
				const bufferSizeToken = compiler.lookBehind(1)
				if (bufferSizeToken?.type == ToastType.Integer && compiler.scopeDepth == 0) {
					// TODO: Here, we can create const size buffers, but only if in the outer scope
					// TODO: Do this in the parse value section
					compiler.assemblySource += `\ttoastStackCreateBuffer\n`
					return
				} else {
					compiler.assemblySource += `\ttoastStackCreateBuffer\n`
					return
				}
				errorLogger.flushLog("Array size not provided")
				return;

			case 'length':
				// TODO: Change array length to index negative 1
				compiler.assemblySource += `\ttoastStackArrayLength\n`
				return;


			/// IO Ops

			case 'print':
				compiler.assemblySource += `\ttoastStackPrint\n`
				return;


			case 'fprint':
				compiler.assemblySource += `\tpop rdi\t\ntoastStackPrint rdi\n`
				return;

			case 'printf':
				compiler.assemblySource += `\t${compiler.functionCall} print_f\n`
				return;
			case 'sprintf':
				compiler.assemblySource += `\t${compiler.functionCall} sprint_f\n`
				return;
			case 'fprintf':
				compiler.assemblySource += `\t${compiler.functionCall} file_print_f\n`
				return;

			/// IO Ops
			case 'input':
				compiler.assemblySource += `\t${compiler.functionCall} input\n`
				return
			case 'filePrintNum':
				compiler.assemblySource += `\t${compiler.functionCall} file_print_num\n`
				return
			case 'printNum':
				compiler.assemblySource += `\t${compiler.functionCall} print_num\n`
				return
			case 'filePrintNumBase':
				compiler.assemblySource += `\t${compiler.functionCall} file_print_num_base\n`
				return
			case 'printNumBase':
				compiler.assemblySource += `\t${compiler.functionCall} print_num_base\n`
				return

			case 'call':
				compiler.assemblySource += `\t${compiler.stackFunctionCall}\n`
				return;


			case 'strEq':
				compiler.assemblySource += `\t${compiler.functionCall} str_eq\n`
				return
			case 'strLen':
				compiler.assemblySource += `\t${compiler.functionCall} str_len\n`
				return
			case 'copy':
				compiler.assemblySource += `\t${compiler.functionCall} copy\n`
				return;
			case 'index':
				compiler.assemblySource += `\ttoastIndex\n`
				return;
			case 'redef':
				const redefineNameToken = compiler.lookBehind(1)
				if (redefineNameToken.type === ToastType.Name) {
					compiler.assemblySource += `\ttoastRedefineVariable ${redefineNameToken.value}\n`
				} else {
					errorLogger.flushLog("Missing name token to define variable")
				}
				return;

			// New commands
			case 'strCopy':
				compiler.assemblySource += `\ttoastCallFunc strcopy\n`
				return;
			case 'memCopy':
				compiler.assemblySource += `\ttoastCallFunc memcopy\n`
				return;

			case 'memCopyByte':
				compiler.assemblySource += `\ttoastCallFunc memcopy_byte\n`
				return;

			case 'exit':
				compiler.assemblySource += `\tpop r8\n\ttoastExit r8\n`
				return;

			case 'getPtr':
				// ... ptr index get
				compiler.assemblySource += `\tpop r8\n\tpop r9\n\tlea r8, [r9+r8*8]\n\tpush r8\n`
				return;

			case 'getBytePtr':
				// ... ptr index getByte
				compiler.assemblySource += `\tpop r8\n\tpop r9\n\tlea r8, [r9+r8]\n\tpush r8\n`
				return;

			case 'get':
				// ... ptr index get
				compiler.assemblySource += `\tpop r8\n\tpop r9\n\tmov r8, [r9+r8*8]\n\tpush r8\n`
				return;
			case 'set':
				// ... val ptr index set
				compiler.assemblySource += `\tpop r8\n\tpop r9\t\npop r10\n\tmov [r9+r8*8], r10\n`
				return;

			case 'getByte':
				// ... ptr index getByte
				compiler.assemblySource += `\tpop r8\n\tpop r9\n\txor r10, r10\n\tmov r10b, byte[r9+r8]\n\tpush r10\n`
				return;
			case 'setByte':
				// ... val ptr index setByte
				compiler.assemblySource += `\tpop r8\n\tpop r9\t\npop r10\n\tmov byte[r9+r8], r10b\n`
				return;

			case 'read':
				compiler.assemblySource += `\tpop r8\n\tmov r8, [r8]\n\tpush r8\n`
				return;
			case 'write':
				// ... val ptr write
				compiler.assemblySource += `\tpop r8; ptr\n\tpop r9; val\n\tmov [r8], r9\n`
				return;

			case 'readByte':
				compiler.assemblySource += `\tpop r9\n\txor r8, r8\n\tmov r8b, byte[r9]\n\tpush r8\n`
				return;
			case 'writeByte':
				// ... val ptr set
				compiler.assemblySource += `\tpop r8; ptr\n\tpop r9; val\n\tmov byte[r8], r9b\n`
				return;

			case 'intToString':
				compiler.assemblySource += `\t${compiler.functionCall} itoa\n`
				return;
			case 'stringToInt':
				compiler.assemblySource += `\t${compiler.functionCall} atoi\n`
				return;

			case 'popN':
				compiler.assemblySource += `\tpop r8\n\tlea rsp, [rsp+AddressBytes*r8]\n`
				return;
		}

		const defToken = compiler.lookAhead(1)
		compiler.assemblySource += `\tlea r8, [${name}]\n`
		if (defToken && !(defToken.type === ToastType.Keyword && (defToken.value === "def" || defToken.value === "redef")) && compiler.source.functionDefinitions[name] == undefined) {
			compiler.assemblySource += `\tmov r8, [r8]\n`
		}
		compiler.assemblySource += `\tpush r8\n`


		// compiler.assemblySource += `\ttoastDefineString \`${unescapeString(name)}\`\n\tlea r8, [toastCurrentString]\n\tpush r8\n\t${compiler.functionCall} find_var\n`

		// // TODO: Remove when we figure out what to do with that boolean
		// // compiler.assemblySource += `\tpop r8; Bool\n\tpop r9 ; Value\n\tcmp r8, 0\n\t;; -- Only dereference defined variables, not variable names ;; \n\tcmove r9, [r9 + StoredVariable.value]\n\tpush r9\n`
		// compiler.assemblySource += `\tpop r8; Bool\n`

		//#endregion DEBUG
		// compiler.errorHere(`compiling Name tokens(${name}) not yet implemented`, location)
	},
	[ToastType.String](compiler, { value: str }) {
		compiler.assemblySource += `\ttoastDefineString \`${unescapeString(str)}\`\n\tlea r8, [toastCurrentString]\n\tpush r8\n\tmov r8, toastCurrentStringLength\n\tpush r8\n`
	},
	[ToastType.CString](compiler, { value: str }) {
		compiler.assemblySource += `\ttoastDefineString \`${unescapeString(str)}\`\n\tlea r8, [toastCurrentString]\n\tpush r8\n`
	},
	[ToastType.Integer](compiler, { value }) {
		// compiler.errorHere("compiling Value tokens not yet implemented")
		compiler.assemblySource += `\tpush ${value}\n`
		// compiler.textSection += `\tmov r8, 200\n\tpush r8\n`
	},

	// Create actual compilations for new types
	[ToastType.Boolean](compiler, { value }) { `\tpush ${value ? 1 : 0}\n` },
	[ToastType.Any](compiler) { },
	[ToastType.Pointer](compiler) { },
	[ToastType.FunctionPointer](compiler) { },
	[ToastType.MemoryRegion](compiler) { },
	[ToastType.Syscode](compiler) { },

	[ToastType.Keyword](compiler, { value }) {
		switch (value) {
			case 'def':
				const nameToken = compiler.lookBehind(1)
				if (nameToken.type === ToastType.Name) {
					const valueToken = compiler.lookBehind(2)
					if ((valueToken.type === ToastType.CodeBlock || valueToken.type === ToastType.Array) && valueToken.value.name != null) {
						compiler.assemblySource += `\ttoastRedefineVariable ${nameToken.value}\n`
					} else {
						compiler.assemblySource += `\ttoastDefineVariable ${nameToken.value}\n`
					}
				} else {
					errorLogger.flushLog("Missing name token to define variable")
				}
				return;
			case 'ifelse':
				compiler.assemblySource += `\ttoastIfElse ${compiler.functionCall}\n`
				return;
			case 'if':
				compiler.assemblySource += `\ttoastIf ${compiler.functionCall}\n`
				return;
		}
	},
	[ToastType.MathOperator](compiler, { value }) {
		switch (value) {
			/// Math
			case '+':
				compiler.assemblySource += `\ttoastStackCompute add\n`
				return;
			case '-':
				compiler.assemblySource += `\ttoastStackCompute sub\n`
				return;
			case '*':
				compiler.assemblySource += `\ttoastStackRAXCompute imul\n`
				return;
			case '/':
				compiler.assemblySource += `\ttoastStackRAXCompute idiv\n`
				return;
			case '%':
				compiler.assemblySource += `\ttoastStackRAXCompute idiv, rdx\n`
				return;
		}
	},
	[ToastType.BitwiseOperator](compiler, { value }) {
		switch (value) {
			/// Bits
			case '^':
				compiler.assemblySource += `\ttoastStackCompute xor\n`
				return;
			case '|':
				compiler.assemblySource += `\ttoastStackCompute or\n`
				return;
			case '&':
				compiler.assemblySource += `\ttoastStackCompute and\n`
				return;
			case '~':
				compiler.assemblySource += `\toastStackComputeOne not\n`
				return;
		}
	},
	[ToastType.LogicOperator](compiler, { value }) {
		switch (value) {
			case '||':
				compiler.assemblySource += `\ttoastStackCompute add\n`
				// compiler.assemblySource += `\ttoastStackCompute or\n`
				return;
			case '&&':
				compiler.assemblySource += `\ttoastStackRAXCompute imul\n`
				// compiler.assemblySource += `\ttoastStackCompute and\n`
				return;
			// Merge the nots
			case '!':
				compiler.assemblySource += `\tpush 0\n\ttoastStackCompare e\n`
				return;
		}
	},
	[ToastType.ShiftOperator](compiler, { value }) {
		switch (value) {
			/// Bits
			case '<<':
				compiler.assemblySource += `\ttoastStackLogic shl\n`
				return;
			case '>>':
				compiler.assemblySource += `\ttoastStackLogic shr\n`
				return;
		}
	},
}
export class Compiler {
	static fromSource(sourcePath: string): Compiler {
		const c = new Compiler();
		// Only strip toast extensions
		// const toastExtension = ToastExtensions.find((ext) => sourcePath.endsWith(ext))
		// const sourceBasename = toastExtension? sourcePath.substring(0,-toastExtension.length):sourcePath

		const extension = path.extname(sourcePath).substring(1)
		const toastExtension = ToastExtensions.indexOf(extension)
		const sourceBasename = toastExtension != -1 ?
			path.join(path.dirname(sourcePath), path.basename(sourcePath, `.${ToastExtensions[toastExtension]}`)) :
			sourcePath

		c.source = new LexerSourceFile(sourcePath)
		c.outputBasename = path.resolve(CompilerOptions[Options.OutputDirectory], sourceBasename)
		return c
	}

	// definedNames: Record<string, { locationDefined: SourceLocation }> = {}
	namedFunctions: Record<string, { functionLocation: SourceLocation }> = {}

	scopeDepth: number = 0

	outputBasename: string = "./out"
	source: LexerSource;


	functionCall: string;
	stackFunctionCall: string;

	assemblySource: string = `%include "std.asm"\n\tglobal ${EntryPoint}\n\tdefault rel\n\n\tsection .text\n${EntryPoint}:`

	variableTypes: Record<string, ToastType> = {}

	contextStack: { index: number, tokens: Token[] }[] = []

	constructor() {

	}
	errorHere(error: string, location: SourceLocation) {
		errorLogger.flushLog(`[${this.source.locationString(location)}] ${error}`)
	}
	writeToken(token: Token) {
		//? Fun note: This replacement enables tail recursion :O
		// const nextToken = this.lookAhead(1)

		// if (nextToken && nextToken.type === TokenType.CloseBlock) {
		// 	this.functionCall = "toastTailCallFunc"
		// 	this.stackFunctionCall = "toastTailCallStackFunc"
		// } else {
		this.functionCall = "toastCallFunc"
		this.stackFunctionCall = "toastCallStackFunc"
		// }

		if (token) {
			// this.assemblySource += `\n\t%line ${token.location.line}+0 ${token.location.sourceName}\n`
			this.assemblySource += `\t;;--- ${unescapeString(tokenString(token))} ---\n`
			compilerProcessor[token.type](this, token as any)
		}

	}
	write(s: string) {
		this.assemblySource += s
	}

	get currentContext() {
		return this.contextStack[this.contextStack.length - 1]
	}

	generateAssembly() {
		this.source.getAllTokens()
		this.contextStack.push({ index: 0, tokens: this.source.deepestScope.prevTokens })
		while (this.contextStack.length) {
			const token = this.currentContext.tokens[this.currentContext.index]
			this.writeToken(token)
			if (this.currentContext?.index >= this.currentContext?.tokens.length) {
				this.contextStack.pop()
			}
			if (this.currentContext) {
				this.currentContext.index++
			}
		}
	}

	lookAhead(index = 1) {
		return this.currentContext.tokens[this.currentContext.index + index]
	}
	lookBehind(index = 1) {
		return this.currentContext.tokens[this.currentContext.index - index]
	}

	save(): void {
		if (this.outputBasename) {
			execSync(`mkdir -p ${path.dirname(this.outputBasename)}`, {
				stdio: 'inherit'
			})
			writeFileSync(`${this.outputBasename}.asm`, this.assemblySource)
		}
		// writeFileSync(`${path}.asm`, `\tglobal ${EntryPoint} \n\tdefault rel\n${this.bufferSection} \n${this.functionDefs} \n${this.textSection} \n\tmov r8, 0\n\tpush r8\n\tjmp exit\n\n${this.dataSection} `)
	}

	compile(EmitPreprocessed: boolean) {
		if (this.outputBasename) {
			// TODO: Only include -g in debug mode
			if (EmitPreprocessed) {
				execSync(`nasm ${this.outputBasename}.asm -i ${StandardLibraryDirectory} -e -o ${this.outputBasename}_preproc.asm`, {
					stdio: 'inherit'
				})
			}

			execSync(`nasm ${this.outputBasename}.asm -fmacho64 -g -i ${StandardLibraryDirectory}`, {
				stdio: 'inherit'
			})

			//ld hello.o -o hello -macosx_version_min 10.13 -L/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib -lSystem
			execSync(`ld -e ${EntryPoint} -static ${this.outputBasename}.o -o ${this.outputBasename} `, {
				stdio: 'inherit'
			})
		}
	}

	run() {
		if (this.outputBasename) {

			execSync(`${this.outputBasename}`, {
				stdio: 'inherit'
			});

		}
	}
}

