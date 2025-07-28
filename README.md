# Scoped AMD Library Plugin for Rspack

An Rspack plugin that provides scoped AMD library support, preventing global scope pollution in AMD modules.

## Features

-   ✅ **Scoped Variable Injection**: Replaces global variables with scoped alternatives
-   ✅ **AMD Library Support**: Converts Rspack output to AMD format with dependencies
-   ✅ **Multiple Targets**: Supports web, webworker, and node environments
-   ✅ **Chunk Loading**: Preserves Rspack's chunk loading functionality
-   ✅ **TypeScript Support**: Full TypeScript definitions included

## Installation

```bash
npm install scoped-amd-library-plugin-rspack
```

## Usage

```javascript
const { ScopedAmdLibraryRspackPlugin } = require('scoped-amd-library-plugin-rspack')

module.exports = {
	plugins: [
		new ScopedAmdLibraryRspackPlugin({
			scopeDependencyName: 'myScope',
		}),
	],
	// Rspack configuration
	output: {
		library: {
			type: 'amd',
			name: 'my-library',
		},
	},
}
```

## Options

### `scopeDependencyName: string`

The name of the scope dependency that will be injected into your AMD module.

### `requireAsWrapper?: boolean`

Whether to use `require()` as a wrapper instead of `define()`. Default: `false`.

## How It Works

This plugin:

1. **Detects Rspack Output**: Identifies when Rspack generates non-AMD bundles
2. **AMD Wrapping**: Wraps the bundle in AMD `define()` format
3. **Scope Injection**: Injects scoped variables to prevent global pollution
4. **Target-Specific**: Adapts behavior based on target environment (web/node/webworker)

### Example Output

**Before (Rspack bundle):**

```javascript
;(() => {
	// webpack bootstrap
	const chunk = __webpack_require__.e('chunk')
	// ... bundle code
})()
```

**After (with plugin):**

```javascript
define('my-library', ['myScope'], function (__SCOPED_AMD_EXTERNAL_MODULE_myScope__) {
	var require = (__SCOPED_AMD_EXTERNAL_MODULE_myScope__.require =
		__SCOPED_AMD_EXTERNAL_MODULE_myScope__.require || __SCOPED_AMD_EXTERNAL_MODULE_myScope__)

	// Original bundle code with scoped variables
	// ...

	return exports
})
```

## Target Environments

### Web

-   Replaces `globalThis`, `window` with scoped alternatives
-   Provides scoped `document` access

### Node.js

-   Provides scoped `require` function
-   Preserves chunk loading functionality

### Web Worker

-   Replaces `globalThis` with scoped alternative
-   Provides scoped `importScripts` and `location`

## Rspack Compatibility

-   **Rspack Version**: `>=0.7.0`
-   **Tree-Shaking**: Compatible with Rspack's aggressive optimization
-   **Library Output**: Works with all Rspack library output formats

## Related Packages

-   [`scoped-amd-library-plugin`](https://www.npmjs.com/package/scoped-amd-library-plugin) - Webpack version

## License

ISC

## Contributing

Issues and pull requests are welcome on GitHub.
