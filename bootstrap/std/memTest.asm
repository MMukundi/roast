%include "memory.asm"
%include "std.asm"
	global _main
	default rel

	section .text
_main:
	call toastInitHeap
	push 10
	call toastAllocate
	toastExit 0

; nasm memTest.asm -fmacho64 -g; ld -e _main -static memTest.o -o memTest; lldb ./memTest -o "b toastAllocateFoundFree" -o "run" 