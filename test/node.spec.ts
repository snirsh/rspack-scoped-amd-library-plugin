import { compile, createWebpackConfig } from './testkit'
import { nodeScopeFactory } from '../src/globalFactories'
import { ProvidePlugin } from 'webpack'
import { ScopedAmdLibraryPlugin } from '../src'

const originalRequireFn = require

describe('node', () => {
	beforeEach(() => {
		// @ts-ignore: referenced by webpack runtime
		global.require = jest.fn(originalRequireFn)
		// @ts-ignore: used in application code in our test
		global.atob = jest.fn((x) => `host: ${x}`)
	})

	afterEach(() => {
		// @ts-ignore: cleanup
		global.require = originalRequireFn
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
			target: 'node',
			plugins: [new ScopedAmdLibraryPlugin({ scopeDependencyName })],
			externals: [
				{
					[scopeDependencyName]: scopeDependencyName,
				},
			],
		})

		const { modules, loadFileSync } = await compile(files, config)

		expect(Object.keys(modules).sort()).toEqual(['chunky.chunk.js', 'index.bundle.js'])

		const scope = nodeScopeFactory(config.output!.path! + '/', loadFileSync)

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
			target: 'node',
			plugins: [new ScopedAmdLibraryPlugin({ scopeDependencyName })],
			externals: [
				{
					[scopeDependencyName]: scopeDependencyName,
				},
			],
		})

		const { modules, loadFileSync } = await compile(files, config)

		const scope = nodeScopeFactory(config.output!.path! + '/', loadFileSync)
		scope.require = jest.fn(scope.require)

		expect(global.require).not.toHaveBeenCalled()
		expect(scope.require).not.toHaveBeenCalled()

		// load module
		const moduleExports = await modules['index.bundle.js'].load({ [scopeDependencyName]: scope })

		// check that module is loaded
		expect(moduleExports).toMatchObject({ chunkyPromise: expect.any(Promise) })

		// check that module chunk is loaded
		expect(await moduleExports.chunkyPromise).toMatchObject({ msg: 'msg from chunk' })

		expect(global.require).not.toHaveBeenCalled()
		expect(scope.require).toHaveBeenCalled()
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
			target: 'node',
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

		const { modules, loadFileSync } = await compile(files, config)

		const scope = nodeScopeFactory(config.output!.path! + '/', loadFileSync) as any
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
