import { runPlugin, createWebpackConfig } from './testkit'
import { webScopeFactory } from '../src/globalFactories/webScopeFactory'
import { nodeScopeFactory } from '../src/globalFactories/nodeScopeFactory'
import { webworkerScopeFactory } from '../src/globalFactories/webworkerScopeFactory'

test('web', async () => {
	// language=JavaScript
	const index = `
        const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
        chunk.then((moduleChunk) => console.log('chunk returned', moduleChunk))
        export const crap = 'crap'
    `

	// language=JavaScript
	const chunky = `
        export const hello = 'hello'
        console.log(hello, 'other')
    `

	const { modules, loadFile } = await runPlugin(
		{
			'index.js': index,
			'chunky.js': chunky,
		},
		createWebpackConfig({ target: 'web' })
	)

	try {
		const fakeGlobal = webScopeFactory(loadFile, modules['index.js'].fullFilePath)
		const moduleExports = await modules['index.js'].load({ fakeGlobal })
		console.log(moduleExports)
	} catch (e) {
		console.log(modules['index.js'].code)
		throw e
	}
})

test('node', async () => {
	// language=JavaScript
	const index = `
        const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
        chunk.then((moduleChunk) => console.log('chunk returned', moduleChunk))
        export const crap = 'crap'
    `

	// language=JavaScript
	const chunky = `
        export const hello = 'hello'
        console.log(hello, 'other')
    `

	const { modules, loadFile } = await runPlugin(
		{
			'index.js': index,
			'chunky.js': chunky,
		},
		createWebpackConfig({ target: 'node' })
	)

	try {
		// @ts-ignore: temp until a proper require analog is written
		const fakeGlobal = nodeScopeFactory((path) => {
			return {
				modules: [],
				ids: [path],
			}
		})
		const moduleExports = await modules['index.js'].load({ fakeGlobal })
		console.log(moduleExports)
	} catch (e) {
		console.log(modules['index.js'].code)
		throw e
	}
})

test('webworker', async () => {
	// language=JavaScript
	const index = `
        const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
        chunk.then((moduleChunk) => console.log('chunk returned', moduleChunk))
        export const crap = 'crap'
    `

	// language=JavaScript
	const chunky = `
        export const hello = 'hello'
        console.log(hello, 'other')
    `

	const { modules, loadFileSync } = await runPlugin(
		{
			'index.js': index,
			'chunky.js': chunky,
		},
		createWebpackConfig({ target: 'webworker' })
	)

	try {
		const fakeGlobal = webworkerScopeFactory(loadFileSync, modules['index.js'].fullFilePath)
		const moduleExports = await modules['index.js'].load({ fakeGlobal })
		console.log(moduleExports)
	} catch (e) {
		console.log(modules['index.js'].code)
		throw e
	}
})
