import path from "path";

const ZeroCode = '0'.charCodeAt(0)
export function escapeChar(c: string): string {
	switch (c) {
		case "n":
			return '\n' as string;
		case "t":
			return '\t' as string;
		case "r":
			return '\r' as string;
		case '"':
			return '"' as string;
		default:
			return c;
	}
}
export function unescapeChar(c: string): string {
	switch (c) {
		case "\n":
			return '\\n' as string;
		case "\t":
			return '\\t' as string;
		case "\r":
			return '\\r' as string;
		case '"':
			return '"' as string;
		default:
			return c;
	}
}
export function unescapeString(str: string) {
	return str.toString().split('').map(unescapeChar).join("")
}
export function escapeString(str: string) {
	return str.toString().split('').map(escapeChar).join("")
}
export function digitCode(c: string): number {
	return (c.charCodeAt(0) - ZeroCode)
}
export function isDigitCode(c: number): boolean {
	return -1 < c && c < 10;
}
export function isWhitespace(c: string): boolean {
	return c.trim().length === 0
}
export const ToastExtensions = ["toast", "tst", "t"]

export function toToastPath(sourcePath: string): string {
	const extension = path.extname(sourcePath).substring(1)
	const toastExtension = ToastExtensions.indexOf(extension)
	const toastPath = toastExtension != -1 ?
		sourcePath : `${sourcePath}.${ToastExtensions[0]}`
	return toastPath
}
