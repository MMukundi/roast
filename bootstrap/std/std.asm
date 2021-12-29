%include "system.asm"

%define AddressBytes 8
%define AddressSize qword
%define DeclarePointer dq
%define ReservePointer resq

%define DataStack rsb
%define DataStackPointer rsp

%define ToastDebug 0

default rel


;; -------- [Begin(String Macros)] --------

;; The unique index for last-defined string
%assign toastStringIndex 0
;; The unique label for last-defined string
%define toastCurrentString string_ %+ toastStringIndex
;; The unique label for last-defined string's length
%define toastCurrentStringLength string_ %+ toastStringIndex %+ _end

;; -- toastDefineString stringConstant [label]? [lengthLabel?] --
;; -- Defines a string constant(%1) in the data section.
;; -- toastCurrentString, toastCurrentStringLength, and
;; -- toastPrintCurrentString will 
;; -- refer to the string defined by the last call of this macro
%macro toastDefineString 1-3
	;; -- Define string %1 --
	%assign toastStringIndex toastStringIndex+1
	;; -- Temporarily switch to data to declare the string --
	[section .data]
%if %0 >= 2
%2:
%endif
toastCurrentString: db %1, 0
	toastCurrentStringLength equ $ - toastCurrentString-1
%if %0 >= 3
	%3 equ toastCurrentStringLength
%endif
	;; -- Switch back to whatever section came before --
	__SECT__
%endmacro
;; -- toastPrintCurrentString --
;; -- Prints the last-defined string
%macro toastPrintCurrentString 0
	toastPrintString toastCurrentString, toastCurrentStringLength
%endmacro
;; -- toastPrintString string [length?] --
;; -- Prints the last-defined string
%macro toastPrintString 1-2 0
	toastFilePrintString 1, %1, %2
%endmacro
; fd str strlen
%macro toastFilePrintString 2-3
	lea r8,[%2]
	push r8
%if %0 = 2
	push r8
	toastCallFunc str_len
%elif %0 = 3
	mov r8, %3
	push r8
%endif
	toastStackPrint %1
%endmacro
;; -------- [End(String Macros)] --------

;; -------- [Begin(Stack Macros)] --------
;; -- toastStackPushHelper value --
;; -- Pushes a value(%1) to the top of the stack
;; -- defined by a stack pointer (rbx),
;; -- leaving the new stack pointer in rbx
%macro  toastStackPushHelper 1-2 AddressSize
	;; ---- Push value %1 to %2---- ;;
	; lea rax, AddressSize[%2]
	; toastStackPushCore %1
	; mov [%1], rbx
	mov rax, %1

	sub rbx, %2
	mov [rbx], rax
%endmacro
;; -- toastStackPush stackPointer value --
;; -- Pushes a value(%2) to the top of the stack
;; -- defined by a stack pointer (%1)
%macro  toastLabelStackPush 2-3 AddressBytes
	;; ---- Push value %2 to %1 ---- ;;
	; lea rax, AddressSize[%2]
	; toastStackPushCore %1
	; mov [%1], rbx
	lea rbx, %1
	mov rbx, [rbx]
	toastStackPushHelper %2, %3
	mov %1, rbx
%endmacro

;; -- toastStackPush stackPointerRegister value --
;; -- Pushes a value(%2) to the top of the stack
;; -- defined by a stack pointer (%1)
%macro  toastRegisterStackPush 2-3 AddressBytes
	;; ---- Push value %2 to %1 ---- ;;
	; lea rax, AddressSize[%2]
	; toastStackPushCore %1
	; mov [%1], rbx
	mov rbx, %1
	toastStackPushHelper %2, %3
	mov %1, rbx
%endmacro
;; -- toastStackPush stackPointerAddress value --
;; -- Pushes a value(%2) to the top of the stack
;; -- defined by a stack pointer (%1)
%macro  toastStackAddressPush 2-3 AddressBytes
	toastLabelStackPush AddressSize[%1], %2, %3
%endmacro

;; -- toastStackPointerPop stackPointerAddress dest --
;; -- Pops the value from the top of the stack defined by 
;; -- the given stackPointer to the destination
%macro  toastStackPointerPop 2-3 AddressBytes
	;; ---- Pop stack ---- ;;
	; Load return stack pointer into rbx
	lea rbx, AddressSize[%1]
	mov rbx, [rbx]

	; Read from the top of the return stack
	mov %2, [rbx]
	; Move the stack pointer "down" one
	add rbx, %3
	; Save the stack pointer value
	mov AddressSize[%1], rbx
	; toastStackPopCore %1, %2
	; mov [%1], rax
%endmacro

;; -------- [End(Stack Macros)] --------
;; -------- [Begin(CodeBlock Macros)] --------
%macro  toastBeginCodeBlock 0
	%push toastCodeBlock
	;; ---- Push block begin address to stack ---- ;;
	lea r8, [%$BlockBegin]
	push r8
	;; ---- Skip blick for now ---- ;;
	jmp %$BlockEnd
%$BlockBegin:
%endmacro
%macro  toastEndCodeBlock 0
	;; ---- Return to previous block ---- ;;
	toastReturn
;; ---- Marker of block end ---- ;;
%$BlockEnd:
%pop
%endmacro
;; -------- [End(CodeBlock Macros)] --------
;; -------- [Begin(Variable Macros)] --------
%macro  toastDefineVariable 0-1
	;; ---- Attempt to just redefine ---- ;;
	; toastDup
	; toastCallFunc find_var

	; ;; Bool -> r8
	; pop r8
	; ;; Value/Address -> r9
	; pop r9

	; cmp r8, 0
	; je %%undefined
	jmp %%undefined

%%defined:
	;; Move 'value', which the memory adress the variable was defined in
	;; Into rbx, where move value takes place
	mov rbx, r9
	;; Throw away name
	pop r9
	jmp %%move_value

%%undefined:
	pop r8
	toastStackAddressPush VariableStackPointer, r8, 2*AddressBytes
%%move_value:
	pop r8
	mov [rbx+StoredVariable.value], r8
;; ---- Marker of block end ---- ;;
%endmacro
;; -------- [End(Variable Macros)] --------

;; -- toastStackPushCore stackPointerAddress --
;; -- Pushes the value in rax
;; -- to the top of the stack defined by the given stackPointer
;; -- Places the new stackPointer in rbx
%macro  toastStackPushCore 1
	;; ---- Push stack ---- ;;
	; Move the stack pointer 'up' by one
	lea rbx, [%1]
	sub rbx, 8

	; Stores return address in at top of return stack
	mov AddressSize[rbx], rax
%endmacro

;; -- toastStackPopCore stackPointerAddress dest --
;; -- Pops the value from the top of the stack defined by 
;; -- the given stackPointer into the destination
;; -- Places the new stackPointer in rax
%macro  toastStackPopCore 2
	;; ---- Pop stack ---- ;;
	; Loads the new top-of-stack pointer into rax
	lea rax, [%1]

	; Move the stack pointer 'down' by one
	mov %2, [rax]
	add rax, 8
%endmacro

;; -- toastStackPointerPushAddressAt stackPointerPointer address --
;; -- Pushes an address at the top of the stack
;; -- defined by the stackPointer at the given stackPointerPointer
%macro  toastStackPointerPushAddress 2
	;; ---- Push address %2 ---- ;;
	lea rax, AddressSize[%2]
	mov rbx, AddressSize[%1]
	toastStackPushCore rbx
	mov [%1], rbx
%endmacro


;; -- toastStackPushValue stackPointerAddress value --
;; -- Pushes the value of the second parameter
;; -- to the top of the stack defined by the given stackPointer
%macro  toastStackPushValue 2
	;; ---- Push value %2 ---- ;;
	mov rax, %2
	toastStackPushCore %1
	mov [%1], rbx
%endmacro

%assign asdf 1

;; -- toastStackPop stackPointer dest --
;; -- Pops the value from the top of the stack defined by 
;; -- the given stackPointer to the destination
%macro  toastStackPop 2
	toastStackPopCore %1, %2
	mov %1, rax
%endmacro
;; -- toastCallFunc functionAddress --
;; -- Calls the function at the provided address, and
;; -- adds the return address to the return stack
%macro  toastCallFunc 1
	;; -- Calling %1 --
    ; toastStackPointerPushAddress ReturnStackPointer, %%return
	; jmp %1
	toastStackAddressPush ReturnStackPointer, %%return
	jmp %1
%%return:
%endmacro
;; -- toastTailCallFunc functionAddress --
;; -- Calls the function at the provided address, withot
;; -- adding the return address to the return stack.
;; -- Meant to be used at the end of a different function
%macro  toastTailCallFunc 1
	;; -- Calling %1 --
	jmp %1
%endmacro

%macro  toastReturn 0	
	;; ---- Pop return address ----
	toastStackPointerPop ReturnStackPointer, rax
	jmp rax

%endmacro

;; -- toastCallStackFunc --
;; -- Calls the function from the address at the top
;; -- of the data stack
%macro  toastCallStackFunc 0
	;; -- Calling func from stack --
	toastStackAddressPush ReturnStackPointer, %%return
	pop r8
	jmp r8
%%return:
%endmacro
;; -- toastTailCallStackFunc --
;; -- Calls the function from the address at the top
;; -- of the data stack without adding a new return address
%macro  toastTailCallStackFunc 0
	;; -- Calling func from stack --
	pop r8
	jmp r8
%%return:
%endmacro

;; -- toastCreateBuffer bufferSize bufferName --
;; -- Calls the function from the address at the top
;; -- of the data stack
%macro toastCreateBuffer 2
%2: resb %1
%endmacro

;; -- toastCreateStack stackSize stackBase stackPointer --
;; -- Calls the function from the address at the top
;; -- of the data stack
%macro toastCreateStack 3
toastCreateBuffer %1, %%buffer
%2:
	;; -- Temporarily switch to declare the pointer --
	[section .data]
%3: DeclarePointer %2
	;; -- Switch back --
	__SECT__
%endmacro

%macro toastStackPrint 0-1 1
	;; -- Print string from stack -- 
	;
	; toastSwap rax, r8
	
	; mov rdi, %1
	; push rdi
	; mov r8, Syscode.Write
	; push r8
	; toastStackSyscall 3

	; TODO: See if this can migrate to the 'stacksyscall' system
	mov rdi, %1
	pop rdx
	pop rsi
	; ; ; mov rax, 0x2000004
	; ; ; syscall
	Syscall.Write
	; toastSwap
%endmacro


;; -- toastScratchRegister scratchRegisterIndex --
;; -- Gets the scratch register at given index
%macro toastScratchRegister 1
	%if %1 = 0
		rax
	%elif %1 = 1
		rcx
	%elif %1 = 2
		rdx
	%elif %1 = 3
		r8
	%elif %1 = 4
		r9
	%elif %1 = 5
		r10
	%else
		TooManyScratchRegistersRequested
	%endif
%endmacro
%assign toastScratchRegisterCount 6


;; -- toastPopTwoStackOperands --
;; -- Loads the top two operands from the stack
%macro toastPopTwoStackOperands 0
	pop rcx
	pop rax
%endmacro
;; -- toastTwoStackOperandsInstruction instructionName --
;; -- Performs an instruction on the top two stack operands -- 
%macro toastTwoStackOperandsInstruction 1
	toastPopTwoStackOperands
	%1 rax, rcx
%endmacro
;; -- toastTwoStackOperandsInstruction instructionName --
;; -- Performs an instruction on the top two stack operands -- 
%macro toastStackCompute 1
	toastTwoStackOperandsInstruction %1
	push rax
%endmacro

;; -- toastStackRAXCompute instructionName [regToPush=rax] --
;; -- Performs an instruction on the top two stack operands -- 
%macro toastStackRAXCompute 1-2 rax
	toastPopTwoStackOperands
	CQO
	%1 rcx 
	push %2
%endmacro
%macro toastPop 0
	pop r8
%endmacro
%macro toastIndex 0-1
%if %0 = 0
	pop r8
%else
	mov r8, %1
%endif
	
	; lea r9, [rsp]
	; times 8 add r9, r8
	lea r9, [rsp+r8*8]

	mov r8, [r9]
	push r8
%endmacro
%macro toastIf 0-1 toastCallFunc
; if
pop r9

; cond
pop rax

cmp rax, 0
je %%endif
%1 r9
%%endif:
%endmacro
%macro toastIfElse 0-1 toastCallFunc
; TODO: swap if and else order
; if
pop r9

; else
pop r10

; cond
pop rax

cmp rax, 0
cmove r9, r10

%1 r9
%endmacro
%macro toastSwap 0-2 r8, r9
	pop %1
	pop %2
	push %1
	push %2
%endmacro

%macro toastDup 0
	pop r8
	push r8
	push r8
%endmacro
%macro toastDup2 0
	pop r8
	pop r9

	push r9
	push r8

	push r9
	push r8
%endmacro
;; -- toastTwoStackOperandsInstruction comparison --
;; -- Performs an instruction on the top two stack operands -- 
%macro toastStackCompare 1
	mov rdx, 0
	toastTwoStackOperandsInstruction cmp
	cmov%+1 rdx, [Constant_One]
	push rdx
%endmacro

%macro toastDataStackAddressPush 1
	lea r8,[%1]
	push r8
	; push %1
%endmacro
%macro toastDataStackValuePush 1
	mov r8,%1
	push r8
	; push %1
%endmacro


; %macro ToastDefineDebug 0
; 	%if ToastDebug = 1
; 		;; -- toastCreateStack stackSize stackBase stackPointer --
; 		;; -- Calls the function from the address at the top
; 		;; -- of the data stack
; 		%macro toastDebugRegistersHelper 0
; 			%define scratchReg %[toastScratchRegister i]
; 			%assign i 0
; 			%rep toastScratchRegisterCount
; 			push scratchReg
; 			%assign i i+1
; 			%endrep

; 			%assign i 0
; 			%rep toastScratchRegisterCount

; 			%assign i i+1
; 			%endrep

; 			%assign i i-1
; 			%rep toastScratchRegisterCount
; 			pop scratchReg
; 			%assign i i-1
; 			%endrep
; 			%undef sratchReg
; 		%endmacro	
; 		%define toastDebugRegisters toastDebugRegistersHelper
; 	%else
; 	%endif
; %endmacro
; %assign ToastDebug 0
; ToastDefineDebug
; toastDebugRegisters
%macro toastCreateArray 1
	toastStackAddressPush ArrayStackPointer, 0, %1
	mov r9, AddressSize[ArrayStackPointer]
	push r9
	toastStackAddressPush ArrayStackPointer, %1
%endmacro
%macro toastStackCreateArray 0
	pop r9
	toastCreateArray r9
%endmacro

%macro toastStackArrayLength 0
	pop r8
	toastArrayLength r8
%endmacro
%macro toastArrayLength 1
	mov r8, [%1+StoredArray.length]
	push r8
%endmacro

%macro toastPushMark 0
	;; -- exit --
	toastStackAddressPush MarkStackPointer, rsp
%endmacro
%macro toastArrayUntilMark 0
	;; -- exit --
	toastStackPointerPop MarkStackPointer, r8
	xor r9, r9
%%array_until_loop:
	cmp r8, rsp
	je %%array_until_done

	pop r10
	inc r9

	push r8
	push r9
	toastStackAddressPush ArrayStackPointer, r10
	pop r9
	pop r8
	
	jmp %%array_until_loop

%%array_until_done:
	mov r8, AddressSize[ArrayStackPointer]
	push r8
	toastStackAddressPush ArrayStackPointer, r9
%endmacro
%macro toastPopUntilMark 0
	;; -- exit --
	toastStackPointerPop MarkStackPointer, r8
%%pop_until_loop:
	cmp r8, rsp
	jne %%pop_until_loop

%endmacro
; 0x00007ff7bfeff978
%macro toastExit 0-1
	%if %0 = 0
	;; -- safe exit --
	xor rdi, rdi
	%else
	;; -- exit with arg --
	mov rdi, %1
	%endif
	xor rsi, rsi
	; mov rax, 0x2000001  ; SYS_EXIT
	; syscall
	Syscall.Exit
%endmacro
%macro toastStackExit 0
	;; -- exit --
	pop rdi
	toastExit rdi
%endmacro

%macro toastPrint 0
	mov rdi, 1
	pop rdx
	pop rsi
	; ; mov rax, 0x2000004  ; SYS_WRITE
	; ; syscall
	Syscall.Write
%endmacro

%macro toastReadOpenFile 1
	mov rdi, %1
	mov rsi, 0644o
	mov rdx, 0
	Syscall.Open

	push rax
%endmacro
%macro toastWriteOpenFile 1
	mov rdi, %1
	; mov rsi, 0644o
	mov rsi, 0202h
	mov rdx, 0
	; mov rax, 0x2000005 ; SYS_OPEN
	; syscall
	Syscall.Open


	; mov rax, 5       ; Open system call = 5
	; push 0     ; Mode = 0
	; push 2     ; Read/Write flag
	; push %1  ; Path
	; sub rsp, 4       ; Reserved space for system call
	; int 0x80

	; int 0x80
	push rax
%endmacro

%macro toastStackReadOpenFile 0
	pop r8
	toastReadOpenFile r8
%endmacro
%macro toastStackWriteOpenFile 0
	pop r8
	toastWriteOpenFile r8
%endmacro

%macro toastSyscall 1-7
	%if %0 > 1
	mov rdi, %2
	%endif
	%if %0 > 2
	mov rsi, %3
	%endif
	%if %0 > 3
	mov rdx, %4
	%endif
	%if %0 > 4
	mov r10, %5
	%endif
	%if %0 > 4
	mov r8, %6
	%endif
	%if %0 > 4
	mov r9, %7
	%endif
	Syscall. %+ %1
%endmacro

%macro toastStackSyscall 1
	; SyscallName, argC, args to skip
	%if %1 > 0
	mov rdi, [rsp+ 1 * AddressBytes]
	%endif
	%if %1 > 1
	mov rsi, [rsp+ 2 * AddressBytes]
	%endif
	%if %1 > 2
	mov rdx, [rsp+ 3 *AddressBytes]
	%endif
	%if %1 > 3
	mov r10, [rsp+ 4 *AddressBytes]
	%endif
	%if %1 > 4
	mov r8, [rsp+ 5 * AddressBytes]
	%endif
	%if %1 > 5
	mov r9, [rsp+ 6 * AddressBytes]
	%endif

	mov rax, [rsp]
	syscall
	
	lea rsp, [rsp+ (%1+1)*AddressBytes]
	
	; TODO: Think of a beeter way to handle assembly return values
	push rdx
	push rax

%endmacro

%macro toastExecCommand 2
	; File, args
%endmacro

	section .data
Constant_Zero: DeclarePointer 0
Constant_One: DeclarePointer 1
	section .bss

; toastCreateStack 20, ReturnStack, ReturnStackPointer
; toastCreateStack 20, VariableStack, VariableStackPointer
; toastCreateStack 20, StringHeap, StringHeapPointer

; toastCreateStack 2048, ReturnStack, ReturnStackPointer
toastCreateStack 1024, ReturnStack, ReturnStackPointer
toastCreateStack 1024, VariableStack, VariableStackPointer
toastCreateStack 1024, MarkStack, MarkStackPointer

; toastCreateStack 8192, ArrayStack, ArrayStackPointer
toastCreateStack 1024, ArrayStack, ArrayStackPointer ; Small heap
; toastCreateStack 16384, StringHeap, StringHeapPointer
toastCreateStack 1024, StringHeap, StringHeapPointer ; Small heap

toastDefineString `0123456789ABCDEF`, DigitString
toastDefineString `\n`, NewlineString

	section .text
file_print_num:
	pop rdi
	jmp print_num_base_10
print_num:
	mov rdi, 1

print_num_base_10:
	mov rbx, 10
	push rbx
	jmp print_num_base_core

file_print_num_base:
	pop rdi
	jmp print_num_base_core

print_num_base:
	mov rdi, 1
print_num_base_core:
	pop rbx
	pop rax
	enter 32+8+1, 0
	mov rsi, rbp
	sub rsi,9

	mov AddressSize[rbp-9],0

	;; boolean isNeg
	mov byte[rbp-1],0

	cmp rax, 0
	jnl print_num_loop

	;; NegativeSetup
	mov byte[rbp-1],1

	;; Negate input
	mov AddressSize[rbp-9],0
	sub AddressSize[rbp-9],rax
	mov rax, AddressSize[rbp-9]

	mov AddressSize[rbp-9],0

print_num_loop:
	;xor rdx, rdx
	CQO
	mov rcx, rbx
	idiv rcx

	lea r9, AddressSize[DigitString]
	add r9, rdx

	mov r9, [r9]
	dec rsi
	mov byte[rsi], r9b

	add AddressSize[rbp-9],1

	cmp rax, 0
	jne print_num_loop

	mov al, byte[rbp-1]
	cmp al, 0
	je print_num_print

	;; Add negative sign
	dec rsi
	mov byte[rsi], '-'

	add AddressSize[rbp-9],1

print_num_print:
	mov rdx, AddressSize[rbp-9]
	Syscall.Write
	leave

	toastReturn


str_eq:
	; return value
	mov r10, 1

	; str ptr 1
	pop r8
	sub r8, 1

	; str ptr 2
	pop r9
	sub r9, 1

	xor rax, rax
	xor rbx, rbx
str_eq_loop:
	add r8, 1
	add r9, 1
	
	mov al, byte[r8]
	mov bl, byte[r9]

	; Compare the characters at this index
	cmp al, bl
	; Fail if they're different
	jne str_eq_fail

	; Exit if they're both 0
	cmp al, 0
	je str_eq_done

	jmp str_eq_loop

str_eq_fail:
	xor r10, r10
str_eq_done:
	push r10
	toastReturn

str_len:
	pop r8
	xor r9, r9
str_len_loop:
	mov al, byte[r8]
	cmp al, 0
	je str_len_done

	add r9, 1
	add r8, 1

	jmp str_len_loop
str_len_done:
	push r9
	toastReturn
roll:
	;; j - amount to roll
	pop r8
	
	;; n - number of items to roll
	pop r9

	;; ensure j -> [0, n)
	mov rax, r8
	; xor rdx, rdx
	CQO
	mov rcx, r9
	idiv rcx
	
	cmp rdx, 0
	jnl roll_core

	add rdx, r9

roll_core:
	mov r8, rdx

	cmp r8, 0
	je roll_done

	;; saved stack top -> rax
	lea rax, [rsp]
	lea r10, [8 * r8]
	sub rax, r10

	;; moving stack top -> rbx
	mov rbx, rax

	;; roll group top -> rcx
	lea rcx, [rsp]

	;; roll group bottom -> rdx
	lea rdx, [rax + 8 * r9]

	;; roll group bottom -> rdx
	lea rdx, [rcx + 8 * r9]

roll_shift_loop:
	pop r11
	mov[rbx], r11
	add rbx, 8
	
	cmp rsp, rdx
	jne roll_shift_loop
	
	mov rbx, rsp
	mov rsp, rax

	lea rbx, [rax + 8 * r9]
	mov rsp, rax
roll_copy_loop:
	pop r11
	mov[rbx], r11
	add rbx, 8

	cmp rsp, rcx
	jne roll_copy_loop

	;mov rsp, rcx


roll_done:
	toastReturn

copy:
	;; n - number of items to copy
	pop r8

	;; stack top -> r8
	lea rax, [rsp]
	lea r8, [8 * r8]
	sub rax, r8
	mov r8, rax

	;; saved stack top -> r9
	mov r9, r8

	;; old stack top -> rax
	lea rax, [rsp]

copy_loop:
	pop r10
	mov[r8], r10
	add r8, 8
	
	cmp r8, rax
	jne copy_loop

	mov rsp, r9
	toastReturn

find_var:
	;; Variable name
	pop r8
	
	;; Current pointer into array
	mov r9, [VariableStackPointer]
	sub r9, StoredVariable_size
	
	;; End pointer in array
	lea r10, [VariableStack]

	xor rax, rax
find_var_loop:
	;; Increment pointer
	add r9, StoredVariable_size

	;; Fail if at end
	cmp r9, r10
	je find_var_fail

	;; Variable name from stack -> r11
	mov r11, [r9+ StoredVariable.name]

	; Call str_eq
	;; Preserve r8, r9, 10
	push r8
	push r9
	push r10
	push rax

	;; Push original(r8) and stack(r11) strings for comparison
	push r8
	push r11
	toastCallFunc str_eq
	pop r11


	pop rax
	pop r10
	pop r9
	pop r8

	cmp r11, 0
	je find_var_loop


find_var_success:
	;; -- In order to return a pointer, derefrencing responsibilities
	;; -- are now on callee
	mov rax, [r9 + StoredVariable.value]
	push rax
	; push r9

	mov rax, 1
	jmp find_var_end
find_var_fail:
	push r8
	mov rax, 0
	jmp find_var_end
find_var_end:
	push rax
	toastReturn


%macro toastReadToCore 2
	; (ptr,size)
	mov rsi, %1
	mov rdx, %2
	; mov rax, 0x2000003 ; SYS_READ
	; syscall
	Syscall.Read
	
	push rax
%endmacro

%macro toastHeapReadCore 0
	lea r8, [StringHeapPointer]
	mov r8, [r8]
	mov r9, StringHeap

	mov rsi, r8
	; TODO: Make the 1024 a variable or equ or something 
	mov rdx, 1024; some length
	add rdx, r9
	sub rdx, r8

	toastReadToCore rsi, rdx
	pop rax
	push r8
	push rax
%endmacro


memcopy:
	; ... src dest size
	pop rcx ; size
	pop r9 ; dest
	pop r8 ; src
	
	cmp rcx, 0
	je .done
.loop:
	mov r10, [r8]
	mov [r9], r10

	lea r8, [r8+AddressBytes]
	lea r9, [r9+AddressBytes]

	loop .loop
.done:
	toastReturn

memcopy_byte:
	; ... src dest bytes
	pop rcx ; bytes
	pop r9 ; dest
	pop r8 ; src
	cmp rcx, 0
	je .done
.loop:
	mov r10b, byte[r8]
	mov byte[r9], r10b
	inc r8
	inc r9
	loop .loop
.done:
	toastReturn

strcopy:
	; ... src dest
	pop r9 ; dest_str
	pop r8 ; src_str

	mov r10b, byte[r8]
	cmp r10b, 0
	je .done
.loop:
	mov byte[r9], r10b
	inc r8
	inc r9

	mov r10b, byte[r8]
	cmp r10b, 0
	jne .loop
.done:
	push r9
	toastReturn

sprint_f:
	;; Iterate until next formatting character
	;; -- If s: print string
	;; -- If d: print_num
	pop r8
	mov rdi, [StringHeapPointer]
	xor r9, r9
.find_format:
	mov al, byte[r8+r9]

	cmp al, 0
	je .done

	
	inc r9

	cmp al, '%'
	jne .find_format
	
	;; Once a percent is found:

	;; -- Look at the next char
	mov al, byte[r8+r9]
	
	;; -- Escape if %% => %
	; Skip % if %, dont skip if %%
	mov r10, 1
	cmp al, '%'
	cmove r10, [Constant_Zero]
	;; TODO: This prints the percent if its at the end. think that over
	; cmp al, '0'
	; cmovne r10, [Constant_One]
	; inc r10 
	
	;; -- Print what came before:
	sub r9,r10
	push rdi
	push rax
	push r10
	push r8
	push r9

	; toastFilePrintString rdi, r8, r9
	push r8 ; src
	mov r8, [StringHeapPointer] ;dest
	push r8
	push r9 ;size

	;; Increment
	mov r8, [StringHeapPointer] ;dest
	lea r8, [r8+r9]
	mov [StringHeapPointer], r8

	toastCallFunc memcopy_byte


	pop r9
	pop r8
	pop r10
	pop rax
	pop rdi
	add r9,r10

	

	;; No format char!
	cmp al, 0
	je .error

	add r9, 1
	add r8, r9

	;; Handle formatting char
	cmp al, 'd'
	je .num

	cmp al, 's'
	je .str

	; cmp al, '%'
	; je print_f_next

	jmp .next
.num:
	pop rax
	push r8

	push rax
	toastCallFunc itoa_base_10
	pop rax
	pop rax

	pop r8
	jmp .next
.str:
	pop rax
	push rdi
	push r8
	; toastFilePrintString rdi,rax 
	; pop r8
	; pop rdi

	push rax ; src
	mov r8, [StringHeapPointer]
	push r8 ; dest
	toastCallFunc strcopy
	;; Increment
	pop rax ; copyEnd
	mov [StringHeapPointer], rax
	
	pop r8
	pop rdi
	jmp .next
.next:
	xor r9, r9
	jmp .find_format
.done:
	; toastFilePrintString rdi, r8

	push r8 ; src
	mov r8, [StringHeapPointer] ; dest
	push r8
	toastCallFunc strcopy
	;; Increment
	pop rax ; copyEnd
	inc rax
	mov [StringHeapPointer], rax
	mov AddressSize[rax], 0

	push rdi

.error:
	toastReturn

read_file_to:
	pop rdx ; size
	pop rsi ; ptr
	pop rdi
	toastReadToCore rsi, rdx
	toastReturn

read_file:
	pop rdi
	toastHeapReadCore
	toastReturn

input:
	xor rdi, rdi

	toastHeapReadCore

	;; Replace newline with \\0
	add r8, rax
	mov[StringHeapPointer], r8
	
	sub r8, 1
	lea r9, [r8]
	mov qword[r9], 0
	toastReturn


file_print_f:
	pop rdi
	jmp print_f_core
print_f:
	mov rdi,1

print_f_core:
	;; Iterate until next formatting character
	;; -- If s: print string
	;; -- If d: print_num
	pop r8
	xor r9, r9
print_f_find_format:
	mov al, byte[r8+r9]

	cmp al, 0
	je print_f_done

	
	add r9, 1

	cmp al, '%'
	jne print_f_find_format
	
	;; Once a percent is found:

	;; -- Look at the next char
	mov al, byte[r8+r9]
	
	;; -- Escape if %% => %
	; Skip % if %, dont skip if %%
	mov r10, 1
	cmp al, '%'
	cmove r10, [Constant_Zero]
	;; TODO: This prints the percent if its at the end. think that over
	; cmp al, '0'
	; cmovne r10, [Constant_One]
	; inc r10 
	
	;; -- Print what came before:
	sub r9,r10
	push rdi
	push rax
	push r10
	push r8
	push r9
	toastFilePrintString rdi, r8, r9
	pop r9
	pop r8
	pop r10
	pop rax
	pop rdi
	add r9,r10

	

	;; No format char!
	cmp al, 0
	je print_f_error

	add r9, 1
	add r8, r9

	;; Handle formatting char
	cmp al, 'd'
	je print_f_num

	cmp al, 's'
	je print_f_str

	; cmp al, '%'
	; je print_f_next

	jmp print_f_next
print_f_num:
	pop rax
	push r8
	push rax
	push rdi
	toastCallFunc file_print_num
	pop r8
	jmp print_f_next
print_f_str:
	pop rax
	push rdi
	push r8
	toastFilePrintString rdi,rax 
	pop r8
	pop rdi
	jmp print_f_next
print_f_next:
	xor r9, r9
	jmp print_f_find_format
print_f_done:
	toastFilePrintString rdi, r8
print_f_error:
	toastReturn

atoi:
	mov rbx, 10
	push rbx
atoi_base:
	pop rbx
	pop r8
	
	;; Allocate space for the int
	xor rax, rax
	xor r9, r9
atoi_loop:
	mov r9b, byte[r8]

	cmp r9b, 0
	je atoi_done

	sub r9b, `0`

	xor rdx, rdx
	mov rcx, rbx
	mul rcx

	add rax, r9

	inc r8
	jmp atoi_loop
atoi_done:
	push rax
	toastReturn

itoa:

itoa_base_10:
	mov rbx, 10
	push rbx
	jmp itoa_base_core

itoa_base_core:
	pop rbx
	pop rax
	enter 32+8+1, 0
	mov rsi, rbp
	sub rsi,9

	mov AddressSize[rbp-9],0
	
	dec rsi
	mov byte[rsi],0

	;; boolean isNeg
	mov byte[rbp-1],0

	cmp rax, 0
	jnl .loop

	;; NegativeSetup
	mov byte[rbp-1],1

	;; Negate input
	mov AddressSize[rbp-9],0
	sub AddressSize[rbp-9],rax
	mov rax, AddressSize[rbp-9]

	mov AddressSize[rbp-9],0

.loop:
	;xor rdx, rdx
	CQO
	mov rcx, rbx
	idiv rcx

	lea r9, AddressSize[DigitString]
	add r9, rdx

	mov r9, [r9]
	dec rsi
	mov byte[rsi], r9b

	add AddressSize[rbp-9],1

	cmp rax, 0
	jne .loop

	mov al, byte[rbp-1]
	cmp al, 0
	je .print

	;; Add negative sign
	dec rsi
	mov byte[rsi], '-'

	add AddressSize[rbp-9],1

.print:
	mov rax, [StringHeapPointer]
	push rax

	push rsi
	push rax
	toastCallFunc strcopy

	pop rax
	mov [StringHeapPointer], rax

	pop rsi
	mov rax, AddressSize[rbp-9]

	leave
	push rsi
	push rax

	toastReturn



struc StoredVariable
	.name: ReservePointer 1
	.value: ReservePointer 1
endstruc

; struc StoredArray, -AddressSize
struc StoredArray, -8
	.length: ReservePointer 1
	.data: ReservePointer 1
endstruc

