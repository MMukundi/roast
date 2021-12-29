export enum ToastType {
	Integer,
	Boolean,
	Pointer,
	String,
	Array,
	MemoryRegion,
}

export function closure<T>(mapping: Map<T, T[]>): Map<T, Set<T>> {
	const newMapping: Map<T, Set<T>> = new Map()
	for (const [key, value] of mapping) {
		const newSet = new Set([key])
		newMapping.set(key, newSet)

		const queue: T[] = [...value]
		while (queue.length) {
			const next = queue.shift()
			newSet.add(next)
			for (const item of mapping.get(next)) {
				if (newMapping.has(item)) {
					for (const other of newMapping.get(item)) {
						newSet.add(other)
					}
				} else {
					queue.push(item)
				}
			}
		}

	}
	return newMapping
}


export const toastImplicitConversions = closure<ToastType>(new Map([
	[ToastType.Integer, []],
	[ToastType.Boolean, [ToastType.Integer]],
	[ToastType.Pointer, [ToastType.Integer]],

	[ToastType.String, [ToastType.MemoryRegion]],
	[ToastType.Array, [ToastType.MemoryRegion]],

	[ToastType.MemoryRegion, [ToastType.Pointer]],
]))
