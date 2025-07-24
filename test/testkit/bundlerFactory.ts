import type { Configuration as WebpackConfiguration } from 'webpack'
import type { RspackOptions } from '@rspack/core'
import { ScopedAmdLibraryPlugin } from '../../src/ScopedAmdLibraryPlugin'
import { ScopedAmdLibraryRspackPlugin } from '../../src/ScopedAmdLibraryRspackPlugin'

export type BundlerConfiguration = WebpackConfiguration | RspackOptions

export const getBundler = () => {
	const bundlerType = process.env.BUNDLER || 'webpack'

	if (bundlerType === 'rspack') {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { rspack } = require('@rspack/core')
		return {
			bundler: rspack,
			type: 'rspack' as const,
		}
	} else {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const webpack = require('webpack')
		return {
			bundler: webpack,
			type: 'webpack' as const,
		}
	}
}

export const getBundlerPlugins = () => {
	const bundlerType = process.env.BUNDLER || 'webpack'

	if (bundlerType === 'rspack') {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { rspack } = require('@rspack/core')
		return {
			ProvidePlugin: rspack.ProvidePlugin,
			ScopedAmdLibraryPlugin: ScopedAmdLibraryRspackPlugin,
		}
	} else {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { ProvidePlugin } = require('webpack')
		return {
			ProvidePlugin,
			ScopedAmdLibraryPlugin: ScopedAmdLibraryPlugin,
		}
	}
}
