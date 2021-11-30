export enum ConsoleColor {
	// NormalColors
	Black,
	Red,
	Green,
	Yellow,
	Blue,
	Purple,
	Cyan,
	White,
	// 'Bright' colors
	BrightGrey,
	BrightRed,
	BrightGreen,
	BrightYellow,
	BrightBlue,
	BrightPurple,
	BrightCyan,
	BrightWhite,
	// Reset
	Default,
}
enum ConsoleCodes {
	Foreground = 3,
	Background = 4
}
type AnyLogger = (...args: any[]) => any;
type StringLogger = (...strings: string[]) => any;

const DefaultColorCode = 9
export class StyledLogger<Logger extends AnyLogger> {
	constructor(private logger: Logger, private background: ConsoleColor = ConsoleColor.Default, private foreground: ConsoleColor = ConsoleColor.Default) {
	}
	bg(background: ConsoleColor): StyledLogger<Logger> {
		this.background = background;
		return this;
	}
	fg(foreground: ConsoleColor): StyledLogger<Logger> {
		this.foreground = foreground;
		return this;
	}
	setColors(colors = [[ConsoleCodes.Foreground, this.foreground], [ConsoleCodes.Background, this.background]]) {
		this.logger(`\u001b[${colors.map(([fgOrBG, color]) => `${fgOrBG}${color === ConsoleColor.Default ? DefaultColorCode : color}`).join(';')}m`)
	}
	log(...logArgs: Parameters<Logger>) {
		this.logger(...logArgs)
	}
	colorLog(...logArgs: Parameters<Logger>) {
		this.setColors()
		this.logger(...logArgs)
		this.resetAll()
	}

	styleLog(s: string) {
		const startStyle = "{"
		const endStyle = "}"
		const doubleEndStyle = endStyle + endStyle

		let indexAfterStyleEnd = 0;
		let styleStartIndex = -1;
		this.resetAll()
		while ((styleStartIndex = s.indexOf(startStyle, indexAfterStyleEnd)) != -1) {
			// Check for escapes (if the next 'style region' begins immediately after)
			let afterThisStart = styleStartIndex + startStyle.length
			if (s.indexOf(startStyle, afterThisStart) - afterThisStart == 0) {
				this.logger(s.substring(indexAfterStyleEnd, styleStartIndex + startStyle.length).replace(doubleEndStyle, endStyle))
				indexAfterStyleEnd = afterThisStart + startStyle.length
				continue
			}

			// Log the items outside of the brackets normally
			this.logger(s.substring(indexAfterStyleEnd, styleStartIndex).replace(doubleEndStyle, endStyle))

			// Skip the delim
			styleStartIndex += startStyle.length

			// Find end of style region
			let searchStart = styleStartIndex
			indexAfterStyleEnd = s.indexOf(endStyle, searchStart)
			// Skip escaped ends
			while (s.indexOf(endStyle, indexAfterStyleEnd) - indexAfterStyleEnd == endStyle.length && indexAfterStyleEnd < s.length) {
				this.logger(s.substring(indexAfterStyleEnd, styleStartIndex + startStyle.length).replace(doubleEndStyle, endStyle))
				indexAfterStyleEnd = styleStartIndex + 2 * startStyle.length
			}

			// Log the style region in style
			this.setColors()
			this.logger(s.substring(styleStartIndex, indexAfterStyleEnd).replace(doubleEndStyle, endStyle))
			this.resetAll()

			// Skip the delim
			indexAfterStyleEnd += endStyle.length
		}
		// Print whatever may be left as usual
		this.logger(s.substring(indexAfterStyleEnd).replace(doubleEndStyle, endStyle))
	}

	reset(fgOrBG: ConsoleCodes.Foreground | ConsoleCodes.Background) {
		this.setColors([[fgOrBG, ConsoleColor.Default]])
	}
	resetAll() {
		this.setColors([[ConsoleCodes.Foreground, ConsoleColor.Default], [ConsoleCodes.Background, ConsoleColor.Default]])
	}
}

export class StringStyler extends StyledLogger<StringLogger>{
	private buffer = ""
	constructor(background: ConsoleColor = ConsoleColor.Default, foreground: ConsoleColor = ConsoleColor.Default) {
		super((...strings: string[]) => this.buffer += strings.join(''), background, foreground)
	}
	flush() {
		let oldBuffer = this.buffer;
		this.buffer = ""
		return oldBuffer
	}
}

export class BufferedStyledLogger<FlushLogger extends AnyLogger> extends StringStyler {
	constructor(private flushLogger: FlushLogger, background: ConsoleColor = ConsoleColor.Default, foreground: ConsoleColor = ConsoleColor.Default) {
		super(background, foreground)
	}
	flush() {
		const oldBuffer = super.flush();
		this.flushLogger(oldBuffer)
		return oldBuffer;
	}
}



