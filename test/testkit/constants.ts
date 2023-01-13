export const filePrefix = process.env.FILE_PREFIX || `${__dirname}/.dump`
export const skipCompilation = process.env.DONT_COMPILE === 'true'
export const useInMemoryFileSystem = typeof process.env.MEMORY_FS === 'undefined' || process.env.MEMORY_FS === 'true'
