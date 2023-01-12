import fs from 'fs'

export type FS = typeof fs
export type FilesContent = { [filename: string]: string }
