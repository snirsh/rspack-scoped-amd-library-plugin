# Scoped AMD Library Webpack Plugin

# Usage

1. Set `library.type` configuration to `scoped-amd`.
2. Set the `externalsType` configuration to `amd`.
3. Add plugin to plugins list and pass the scope dependency name which will be provided by your amd loader.
    ```javascript
    new ScopedAmdLibraryPlugin({ scopeDependencyName: 'myScope' })
    ```
4. Use the [ProvidePlugin](https://webpack.js.org/plugins/provide-plugin/) to hook up any global namespaces your code access to your scope dependency.
5. If your scope is not provided from a npm library but rather directly by you at runtime, declare your scope dependency as external by adding it to the `externals` array.

Your configuration file should end up looking something like this:

**webpack.config.js**

```javascript
const { ProvidePlugin } = require('webpack')
const ScopedAmdLibraryPlugin = require('scoped-amd-library-plugin')

const scopeDependencyName = 'myScope'

module.exports = {
	output: {
		library: {
			type: 'scoped-amd', // step 1
		},
	},
	externalsType: 'amd', // step 2
	plugins: [
		new ScopedAmdLibraryPlugin({ scopeDependencyName }), // step 3
		new ProvidePlugin({
			// step 4
			window: scopeDependencyName,
			document: [scopeDependencyName, 'document'],
		}),
	],
	externals: [
		{
			[scopeDependencyName]: scopeDependencyName, // optional step 5
		},
	],
}
```
