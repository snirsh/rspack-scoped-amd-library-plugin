export const filePrefix = process.env.FILE_PREFIX || `${__dirname}/.dump`
export const skipCompilation = !!process.env.COMPILE
export const useInMemoryFileSystem = !!process.env.MEMORY_FS
