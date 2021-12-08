import { execSync } from "child_process";
import { cp, writeFileSync } from "fs";
import path from "path";
import { CompilerFlags, CompilerOptions, CompilerRootDirectory, Inputs, Options } from "./arguments";
import { LexerSource, LexerSourceFile } from "./lexer";
import { debugLogger, errorLogger, noteLogger } from "./loggers";
import { Token, SourceLocation, TokenMap, tokenString, TokenType, TokenValues } from "./tokens";
import { escapeString, unescapeChar, unescapeString } from "./utils";

const EntryPoint = "_main"
const ToastExtensions = ["t", "tst", "toast"]
type TokenProcessor<T> = {
	[type in TokenType]: (context: T, value: TokenMap[type]) => void
}
const compilerProcessor: TokenProcessor<Compiler> = {
	[TokenType.OpenList](compiler) {
		// compiler.textSection += compiler.pushAddressToStack(compiler.listStack, "rsp")
		compiler.assemblySource += `\ttoastPushMark\n`
		// compiler.errorHere("compiling OpenList tokens not yet implemented")
	},
	[TokenType.CloseList](compiler, { location }) {
		// Pop a bunch of stuff from the list
		// compiler.popStack(compiler.listStack, "r8")
		compiler.assemblySource += `\ttoastPopUntilMark\n`
		// compiler.errorHere("compiling CloseList tokens not yet implemented", location)
	},
	[TokenType.List](compiler, { location }) {
		// compiler.errorHere("compiling List tokens not yet implemented", location)
	},
	[TokenType.OpenBlock](compiler) {
		// Start a new label
		compiler.assemblySource += `\ttoastBeginCodeBlock\n`
	},
	[TokenType.CloseBlock](compiler) {
		compiler.assemblySource += `\ttoastEndCodeBlock\n`
	},
	[TokenType.CodeBlock](compiler, { location }) {
		// compiler.errorHere("compiling CodeBlock tokens not yet implemented", location)
	},
	[TokenType.Name](compiler, { value: name, location }) {
		switch (name) {
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

			/// IO Ops
			case 'print':
				compiler.assemblySource += `\ttoastStackPrint\n`
				return;

			case 'printf':
				compiler.assemblySource += `\t${compiler.functionCall} print_f\n`
				return;

			/// IO Ops
			case 'input':
				compiler.assemblySource += `\t${compiler.functionCall} input\n`
				return
			case 'printNum':
				compiler.assemblySource += `\t${compiler.functionCall} print_num\n`
				return
			case 'printNumBase':
				compiler.assemblySource += `\t${compiler.functionCall} print_num_base\n`
				return

			case 'call':
				compiler.assemblySource += `\t${compiler.stackFunctionCall}\n`
				return;

			case 'ifelse':
				compiler.assemblySource += `\ttoastIfElse ${compiler.functionCall}\n`
				return;
			case 'if':
				compiler.assemblySource += `\ttoastIf ${compiler.functionCall}\n`
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
			case 'def':
				compiler.assemblySource += `\ttoastDefineVariable\n`
				return;
			// New commands

			case 'exit':
				compiler.assemblySource += `\tpop r8\n\ttoastExit r8\n`
				return;

			case 'get':
				// ... ptr index get
				compiler.assemblySource += `\tpop r8\n\tpop r9\n\tmov r8, [r9+r8*8+8]\n\tpush r8\n`
				return;
			case 'set':
				// ... val ptr index set
				compiler.assemblySource += `\tpop r8\n\tpop r9\t\npop r10\n\tmov [r9+r8*8+8], r10\n`
				return;

			case 'read':
				compiler.assemblySource += `\tpop r8\n\tmov r8, [r8]\n\tpush r8\n`
				return;
			case 'write':
				// ... val ptr write
				compiler.assemblySource += `\tpop r8; val\n\tpop r9; ptr\n\tmov [r9], r8\n`
				return;

			case 'readByte':
				compiler.assemblySource += `\tpop r9\n\txor r8, r8\n\tmov r8b, byte[r9]\n\tpush r8\n`
				return;
			case 'writeByte':
				// ... val ptr set
				compiler.assemblySource += `\tpop r8; val\n\tpop r9; ptr\n\tmov byte[r9], r8b\n`
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


		compiler.assemblySource += `\ttoastDefineString \`${unescapeString(name)}\`\n\tlea r8, [toastCurrentString]\n\tpush r8\n${compiler.functionCall} find_var\n`

		// TODO: Remove when we figure out what to do with that boolean
		// compiler.assemblySource += `\tpop r8; Bool\n\tpop r9 ; Value\n\tcmp r8, 0\n\t;; -- Only dereference defined variables, not variable names ;; \n\tcmove r9, [r9 + StoredVariable.value]\n\tpush r9\n`
		compiler.assemblySource += `\tpop r8; Bool\n`

		//#endregion DEBUG
		// compiler.errorHere(`compiling Name tokens(${name}) not yet implemented`, location)
	},
	[TokenType.Quote](compiler, { location }) {
		compiler.errorHere("compiling Quote tokens not yet implemented", location)
	},
	[TokenType.String](compiler, { value: str }) {
		compiler.assemblySource += `\ttoastDefineString \`${unescapeString(str)}\`\n\tlea r8, [toastCurrentString]\n\tpush r8\n\tmov r8, toastCurrentStringLength\n\tpush r8\n`
	},
	[TokenType.Value](compiler, { value }) {
		// compiler.errorHere("compiling Value tokens not yet implemented")
		compiler.assemblySource += `\tpush ${value}\n`
		// compiler.textSection += `\tmov r8, 200\n\tpush r8\n`
	}
}
export class Compiler {
	static fromSource(sourcePath: string): Compiler {
		const c = new Compiler();
		// Only strip toast extensions
		// const toastExtension = ToastExtensions.find((ext) => sourcePath.endsWith(ext))
		// const sourceBasename = toastExtension? sourcePath.substring(0,-toastExtension.length):sourcePath

		const extension = path.extname(sourcePath).substr(1)
		const toastExtension = ToastExtensions.indexOf(extension)
		const sourceBasename = toastExtension != -1 ?
			path.join(path.dirname(sourcePath), path.basename(sourcePath, `.${ToastExtensions[toastExtension]}`)) :
			sourcePath

		c.source = new LexerSourceFile(sourcePath)
		c.outputBasename = path.resolve(CompilerOptions[Options.OutputDirectory], sourceBasename)
		return c
	}
	outputBasename: string = "./out"
	source: LexerSource;

	lastToken: Token = null
	nextToken: Token = null
	functionCall: string;
	stackFunctionCall: string;

	assemblySource: string = `%include "${path.join(CompilerRootDirectory, "./std/std.asm")}"\n\tglobal ${EntryPoint}\n\tdefault rel\n\n\tsection .text\n_main:`

	constructor() {

	}
	errorHere(error: string, location: SourceLocation) {
		errorLogger.flushLog(`[${this.source.locationString(location)}] ${error}`)
	}

	writeToken(token: Token) {
		const curr = this.nextToken
		this.nextToken = token

		//? Fun note: This replacement enables tail recursion :O
		// this.functionCall = this.nextToken.type == TokenType.CloseBlock ? "toastTailCallFunc" : "toastCallFunc";
		// this.stackFunctionCall = this.nextToken.type == TokenType.CloseBlock ? "toastTailCallStackFunc" : "toastCallStackFunc";
		this.functionCall = "toastCallFunc";
		this.stackFunctionCall = "toastCallStackFunc";

		if (curr) {
			this.assemblySource += `\n\t%line ${curr.location.line}+1 to\n`
			this.assemblySource += `\t;;--- ${unescapeString(tokenString(curr))} ---\n`
			compilerProcessor[curr.type](this, curr as any)
		}
		this.lastToken = token
	}
	write(s: string) {
		this.assemblySource += s
	}
	generateAssembly() {
		while (!this.source.done()) {
			// for (let i = 0; !p.done() && i < 70; i++) {
			const t = this.source.readToken()
			if (t) {
				this.writeToken(t)
			}
		}
		this.writeToken(this.lastToken)
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

	compile() {
		if (this.outputBasename) {
			execSync(`nasm ${this.outputBasename}.asm -fmacho64`, {
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

