import { compile, createWebpackConfig } from './testkit'
import { webScopeFactory } from '../src/globalFactories/webScopeFactory'
import { ProvidePlugin } from 'webpack'
import ScopedAmdLibraryPlugin from '../src/ScopedAmdLibraryPlugin'

declare global {
	// eslint-disable-next-line no-var
	var document: any
}

describe('web', () => {
	beforeEach(() => {
		// establish web like globals in test environment
		// @ts-ignore: referenced by webpack runtime
		global.self = global
		// @ts-ignore: referenced by webpack runtime
		global.window = global
		// @ts-ignore: referenced by webpack runtime
		global.document = {
			createElement: jest.fn(),
			getElementsByTagName: jest.fn(),
		}
		// @ts-ignore: used in application code in our test
		global.atob = jest.fn((x) => `host: ${x}`)
	})

	afterEach(() => {
		// @ts-ignore: remove the one webpack global we cant yet shadow in web environment - it acts as url->module mapping cache (we use the same file names in all of our tests, so they conflict)
		delete global.webpackChunkproject_name
		// @ts-ignore: cleanup
		delete global.self
		// @ts-ignore: cleanup
		delete global.window
		// @ts-ignore: cleanup
		delete global.document
		// @ts-ignore: cleanup
		delete global.atob
		jest.clearAllMocks()
		jest.clearAllTimers()
	})

	test('Load module chunks', async () => {
		const files = {
			['index.js']:
				// language=JavaScript
				`const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
				export const chunkyPromise = chunk`,
			['chunky.js']:
				// language=JavaScript
				`export const msg = 'msg from chunk'`,
		}

		const scopeDependencyName = 'myScope'
		const config = createWebpackConfig({
			target: 'web',
			plugins: [new ScopedAmdLibraryPlugin({ scopeDependencyName })],
			externals: [
				{
					[scopeDependencyName]: scopeDependencyName,
				},
			],
		})

		const { modules, loadFile } = await compile(files, config)

		expect(Object.keys(modules).sort()).toEqual(['chunky.chunk.js', 'index.bundle.js'])

		const scope = webScopeFactory(config.output!.path! + '/', loadFile)

		// load module
		const moduleExports = await modules['index.bundle.js'].load({ [scopeDependencyName]: scope })

		// check that module is returning its own exports
		expect(moduleExports).toMatchObject({ chunkyPromise: expect.any(Promise) })

		// check that module chunk is loaded and returning its own exports
		expect(await moduleExports.chunkyPromise).toMatchObject({ msg: 'msg from chunk' })
	})

	test('Prevent access to host global scope from webpack runtime code', async () => {
		const files = {
			['index.js']:
				// language=JavaScript
				`const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
				export const chunkyPromise = chunk`,
			['chunky.js']:
				// language=JavaScript
				`export const msg = 'msg from chunk'`,
		}

		const scopeDependencyName = 'myScope'
		const config = createWebpackConfig({
			target: 'web',
			plugins: [new ScopedAmdLibraryPlugin({ scopeDependencyName })],
			externals: [
				{
					[scopeDependencyName]: scopeDependencyName,
				},
			],
		})

		const { modules, loadFile } = await compile(files, config)

		const scope = webScopeFactory(config.output!.path! + '/', loadFile)
		scope.document.getElementsByTagName = jest.fn(scope.document.getElementsByTagName)

		expect(global.document.getElementsByTagName).not.toHaveBeenCalled()
		expect(scope.document.getElementsByTagName).not.toHaveBeenCalled()

		// load module
		const moduleExports = await modules['index.bundle.js'].load({ [scopeDependencyName]: scope })

		// check that module is loaded
		expect(moduleExports).toMatchObject({ chunkyPromise: expect.any(Promise) })

		// check that module chunk is loaded
		expect(await moduleExports.chunkyPromise).toMatchObject({ msg: 'msg from chunk' })

		expect(global.document.getElementsByTagName).not.toHaveBeenCalled()
		expect(scope.document.getElementsByTagName).toHaveBeenCalled()
	})

	test('Replace application code global scope access with the provided scope', async () => {
		const files = {
			['index.js']:
				// language=JavaScript
				`const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
				export const bundleBase64 = atob('hello')
				export const chunkyPromise = chunk`,
			['chunky.js']:
				// language=JavaScript
				`export const msg = 'msg from chunk'
				 export const chunkBase64 = atob('chunk')`,
		}

		const scopeDependencyName = 'myScope'
		const config = createWebpackConfig({
			target: 'web',
			plugins: [
				new ProvidePlugin({
					atob: [scopeDependencyName, 'atob'],
				}),
				new ScopedAmdLibraryPlugin({ scopeDependencyName }),
			],
			externals: [
				{
					[scopeDependencyName]: scopeDependencyName,
				},
			],
		})

		const { modules, loadFile } = await compile(files, config)

		const scope = webScopeFactory(config.output!.path! + '/', loadFile) as any
		scope.atob = jest.fn((x) => `scope: ${x}`)

		expect(global.atob).not.toHaveBeenCalled()
		expect(scope.atob).not.toHaveBeenCalled()

		// load module
		const moduleExports = await modules['index.bundle.js'].load({ [scopeDependencyName]: scope })

		// check that module is loaded and using the correct scope
		expect(moduleExports).toMatchObject({
			bundleBase64: 'scope: hello',
			chunkyPromise: expect.any(Promise),
		})

		// check that module chunk is loaded and using the correct scope
		expect(await moduleExports.chunkyPromise).toMatchObject({
			chunkBase64: 'scope: chunk',
			msg: 'msg from chunk',
		})

		expect(global.atob).not.toHaveBeenCalled()
		expect(scope.atob).toHaveBeenCalledTimes(2)
	})
})
