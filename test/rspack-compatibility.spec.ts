import { compile, createWebpackConfig } from './testkit'
import { getBundlerPlugins, getBundler } from './testkit/bundlerFactory'

describe('Rspack Compatibility', () => {
	// Only run these tests when using rspack
	const shouldSkip = process.env.BUNDLER !== 'rspack'
	const describeBlock = shouldSkip ? describe.skip : describe

	describeBlock('Source compatibility', () => {
		test('should handle ConcatSource without sourceAndMap errors', async () => {
			const { ScopedAmdLibraryPlugin } = getBundlerPlugins()

			const files = {
				['index.js']: `export const msg = 'simple export'`,
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

			// This should not throw "source.sourceAndMap is not a function"
			await expect(compile(files, config)).resolves.toBeDefined()
		})

		test('should handle dynamic imports without chunk loading failures', async () => {
			const { ScopedAmdLibraryPlugin } = getBundlerPlugins()

			const files = {
				['index.js']: `const chunk = import('./chunky' /* webpackChunkName: "chunky" */); export const chunkyPromise = chunk`,
				['chunky.js']: `export const msg = 'msg from chunk'`,
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

			// This should compile without chunk loading errors
			const result = await compile(files, config)
			expect(Object.keys(result.modules)).toContain('chunky.chunk.js')
			expect(Object.keys(result.modules)).toContain('index.bundle.js')
		})
	})

	describeBlock('External module detection', () => {
		test('should properly detect external modules using compilation hooks', async () => {
			const { ScopedAmdLibraryPlugin } = getBundlerPlugins()

			const files = {
				['index.js']: `
					import React from 'react'
					export const MyComponent = () => React.createElement('div', null, 'Hello')
				`,
			}

			const scopeDependencyName = 'myScope'
			const config = createWebpackConfig({
				target: 'web',
				plugins: [new ScopedAmdLibraryPlugin({ scopeDependencyName })],
				externals: {
					react: 'react',
					[scopeDependencyName]: scopeDependencyName,
				},
				externalsType: 'amd',
			})

			const result = await compile(files, config)
			const bundleCode = result.modules['index.bundle.js'].code

			// Should contain proper AMD define with react dependency
			expect(bundleCode).toMatch(/define\s*\(\s*.*,\s*\[.*"react".*\]/)
		})
	})

	describeBlock('Runtime pattern detection', () => {
		test('should inject shadow variables for rspack-specific runtime patterns', async () => {
			const { ScopedAmdLibraryPlugin } = getBundlerPlugins()

			const files = {
				['index.js']: `
					// This will trigger rspack runtime patterns
					const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
					export const chunkyPromise = chunk
				`,
				['chunky.js']: `export const msg = 'msg from chunk'`,
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

			const result = await compile(files, config)
			const bundleCode = result.modules['index.bundle.js'].code

			// Should contain shadow variable injection for scope isolation
			expect(bundleCode).toMatch(/var document|var window|var globalThis/)
		})
	})
})
