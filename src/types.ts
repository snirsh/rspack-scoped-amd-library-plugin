export type LoadFile = (url: string) => Promise<string>
export type LoadFileSync = (url: string) => string
export type ScopedAmdLibraryPluginOptions = {
	scopeDependencyName: string
	requireAsWrapper?: boolean
}
