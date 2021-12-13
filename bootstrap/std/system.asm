%define Syscode.Exit 0x2000001
%define Syscode.Read 0x2000003
%define Syscode.Write 0x2000004
%define Syscode.Open 0x2000005

%macro __Toast__Make__Syscall__ 1
	mov rax, %1
	syscall
%endmacro

%macro Syscall.Exit 0
	__Toast__Make__Syscall__ Syscode.Exit
%endmacro
%macro Syscall.Read 0
	__Toast__Make__Syscall__ Syscode.Read
%endmacro
%macro Syscall.Write 0
	__Toast__Make__Syscall__ Syscode.Write
%endmacro
%macro Syscall.Open 0
	__Toast__Make__Syscall__ Syscode.Open
%endmacro
