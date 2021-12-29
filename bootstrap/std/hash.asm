%include "std.asm"
	global _main
	default rel

%define HashTableSize 1021

struc HashNode
	.key: ReservePointer 1
	.value: ReservePointer 1
	.next: ReservePointer 1
endstruc

	section .bss

HashTable:
	resb HashTableSize * 8

HashTableNodes:
	resb HashTableSize * 8

	section .data
HashTableNodesPointer: dq HashTableNodes

	section .text
_main:
	toastDefineString `StringA`
	lea r8, [toastCurrentString]
	push r8
	toastCallFunc HashString

	mov r8, [HashTable+920*8]
	mov r8, [r8]
	push r8
	toastDefineString `First string: [%s]\n`
	lea r8, [toastCurrentString]
	push r8
	toastCallFunc print_f

	toastDefineString `StringB`
	lea r8, [toastCurrentString]
	push r8
	toastCallFunc HashString

	mov r8, [HashTable+176*8]
	push r8
	toastDefineString `First string: [%s]\n`
	lea r8, [toastCurrentString]
	push r8
	toastCallFunc print_f

	toastExit 9
HashString:
	; ... stringPointer
	pop r8

	mov rbx, r8
	xor rax, rax
	xor r10, r10
	mov rcx, 31
HashStringLoop:
	mov r10b, byte [r8]
	imul rcx

	add rax, r10
	inc r8

	cmp r10, 0 
	jne HashStringLoop

	; push rax
	; push rcx
	; push rdx
	; push rbx

	; push r10
	; toastCallFunc print_num

	; pop rbx
	; pop rdx
	; pop rcx
	; pop rax

	xor rdx, rdx
	mov rcx, HashTableSize
	idiv rcx



	and rdx, 0xFFFFFF8

	push rdx
	push rbx

	push rdx
	toastDefineString `Hash: [%d]\n`
	lea r8, [toastCurrentString]
	push r8
	toastCallFunc print_f

	pop rbx
	pop rdx

	lea r8, [HashTableNodesPointer]
	sub r8, HashNode_size

	mov AddressSize[r8+HashNode.key], rbx
	mov AddressSize[r8+HashNode.value], AddressSize 0
	mov AddressSize[r8+HashNode.next], AddressSize 0
	
	lea r9, [HashTable]
	mov [r9 + rdx*8], r8
	toastReturn

; nasm hash.asm -fmacho64 -g; ld -e _main -static hash.o -o hash; lldb ./hash -o "b HashString" -o "run" 
; nasm hash.asm -fmacho64 -g; ld -e _main -static hash.o -o hash; ./hash