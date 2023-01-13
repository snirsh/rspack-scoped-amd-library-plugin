import { runPlugin, createWebpackConfig } from './testkit'
import { webScopeFactory } from '../src/globalFactories/webScopeFactory'
import { nodeScopeFactory } from '../src/globalFactories/nodeScopeFactory'
import { webworkerScopeFactory } from '../src/globalFactories/webworkerScopeFactory'

test('web', async () => {
	const files = {
		['index.js']:
			// language=JavaScript
			`const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
			chunk.then((moduleChunk) => console.log('chunk returned', moduleChunk))
			export const crap = 'crap'`,
		['chunky.js']:
			// language=JavaScript
			`export const hello = 'hello'
			console.log(hello, 'other')`,
	}

	const config = createWebpackConfig({ target: 'web' })
	const projectRoot = config.output!.path! + '/'
	const { modules, loadFile } = await runPlugin(files, config)

	try {
		const fakeGlobal = webScopeFactory(projectRoot, loadFile)
		const moduleExports = await modules['index.bundle.js'].load({ fakeGlobal })
		console.log(moduleExports)
	} catch (e) {
		console.log(modules['index.bundle.js'].code)
		throw e
	}
})

test('node', async () => {
	const files = {
		['index.js']:
			// language=JavaScript
			`const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
			chunk.then((moduleChunk) => console.log('chunk returned', moduleChunk))
			export const crap = 'crap'`,
		['chunky.js']:
			// language=JavaScript
			`export const hello = 'hello'
			console.log(hello, 'other')`,
	}

	const config = createWebpackConfig({ target: 'node' })
	const projectRoot = config.output!.path! + '/'
	const { modules, loadFileSync } = await runPlugin(files, config)

	try {
		// @ts-ignore: temp until a proper require analog is written
		const fakeGlobal = nodeScopeFactory(projectRoot, loadFileSync)
		const moduleExports = await modules['index.bundle.js'].load({ fakeGlobal })
		console.log(moduleExports)
	} catch (e) {
		console.log(modules['index.bundle.js'].code)
		throw e
	}
})

test('webworker', async () => {
	const files = {
		['index.js']:
			// language=JavaScript
			`const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
			chunk.then((moduleChunk) => console.log('chunk returned', moduleChunk))
			export const crap = 'crap'`,
		['chunky.js']:
			// language=JavaScript
			`export const hello = 'hello'
			console.log(hello, 'other')`,
	}

	const config = createWebpackConfig({ target: 'webworker' })
	const projectRoot = config.output!.path! + '/'
	const { modules, loadFileSync } = await runPlugin(files, config)

	try {
		const fakeGlobal = webworkerScopeFactory(projectRoot, loadFileSync)
		const moduleExports = await modules['index.bundle.js'].load({ fakeGlobal })
		console.log(moduleExports)
	} catch (e) {
		console.log(modules['index.bundle.js'].code)
		throw e
	}
})
