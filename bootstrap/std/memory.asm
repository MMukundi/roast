; Heap

; Porth: https://www.youtube.com/watch?v=8QP2fDBIxjM&list=PLpM-Dvs8t0VbMZA7wW9aR3EtBqe2kinu4
; Heap stuff: https://youtu.be/UTii4dyhR5c

;; [SSSSSSSA] Data [SSSSSSSA] | [SSSSSSSA] Data [SSSSSSSA] | [SSSSSSSA] Data [SSSSSSSA]

;; Allocated block:
;; - Header: [SSSSSSSA]
;; - DATA:   [...]
;; - Footer: [SSSSSSSA]

	section .bss
Heap: ; 1024-8-8 actual bytes
	resb 0x10000000000 ;0 0 0 0 0 0 0 0 0 0 0 0

	section .data
IsAllocatedMask: dq 0x00000007 ; Last 3 bits, so 8 aligned
SizeMask: dq 0xFFFFFFF8 ; Last 3 bits, so 8 aligned

	section .text
toastInitHeap:
	lea r8, qword[Heap]
	mov r9, 1008
	mov [r8], r9
	mov [r8+1016], r9
	ret

; int -> ptr
toastAllocate:
	;; TODO: Ensure int is positive
	pop r9 ; Handle return address
	pop r8
	push r9 ; Handle return address
	;; TODO: 2-align the size

	lea r9, qword[Heap]
toastAllocateLoop:
	mov r10, [r9]
	and r10, [IsAllocatedMask]
	cmp r10b, 0
	jne toastAllocateLoop

	mov r10, [r9]
	and r10,  [SizeMask]
	push r10
	sub r10, 16
	cmp r8, r10
	jle toastAllocateFoundFree

	pop r10
	lea r9, [r9+r10+16]
	jmp toastAllocateLoop
toastAllocateFoundFree:
	pop r10 ; Get the old size
	push r8 ; save new size
	; ... [OldSize0] [...............Free..............] [OldSize0] ...
	; ... [NewSize1] [Data] [NewSize1] [Old-New0] [Free] [Old-New0] ...

	add r8, 1 ; Set allocated bit
	mov [r9], r8 ; Store new block data in header

	pop r11 ; get new size
	; add r9, 8
	lea r9, [r9+8] ; skip data

	push r9 ; save data adress

	; add r9, r11
	lea r9, [r9+r11] ; Skip header & data, goto foote
	mov [r9], r8 ; Store new block data in footer

	lea r9, [r9+8] ; Skip the footer, goto next block's header

	sub r10, r11
	lea r10, [r10 - 16] ; new size of old block

	mov [r9], r10; store the header

	lea r9, [r9+r10+8]; skip header and data, goto footer
	mov [r9], r10 ; store footer

	; pop r8
	; pop r9
	; push r9
	; push r8
toastAllocateDone:	
	; TODO: Set header and footer of new block
	; TODO: Return pointer
	ret

