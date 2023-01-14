[![Run tests](https://github.com/lirancr/scoped-amd-library-plugin/actions/workflows/test.yml/badge.svg)](https://github.com/lirancr/scoped-amd-library-plugin/actions/workflows/test.yml)
[![NPM Version](https://badge.fury.io/js/scoped-amd-library-plugin.svg?style=flat)](https://www.npmjs.com/package/scoped-amd-library-plugin)

# Scoped AMD Library Webpack Plugin

This plugin is based on the [AmdLibraryPlugin](https://github.com/webpack/webpack/blob/main/lib/library/AmdLibraryPlugin.js)

This plugin let you shadow your environment globals from Webpack's own runtime and provide your own global scope implementation instead.
This may come in handy in case where you either wanna to load multiple pieces of code written by a **trusted** party without having them
affecting your global scope.

Additionally, you may use this plugin to provide an easy way for your library consumer to load it in a different
environment than it was originally packaged for (e.g. consume amd bundles built for node targets in the browser) without bloating your bundle with
the additional runtime code required for a full-blown umd bundle format or creating duplicate bundle files for each target.

### Webpack versions support

Webpack 5

## Usage

1. Install package
    ```shell
    npm install scoped-amd-library-plugin
    ```
2. Set `library.type` configuration to `scoped-amd`.
3. Set the `externalsType` configuration to `amd`.
4. Add plugin to plugins list and pass the scope dependency name which will be provided by your amd loader.
    ```javascript
    const { ScopedAmdLibraryPlugin } = require('scoped-amd-library-plugin')
    new ScopedAmdLibraryPlugin({ scopeDependencyName: 'myScope' })
    ```
5. Use the [ProvidePlugin](https://webpack.js.org/plugins/provide-plugin/) point any global namespaces your code access (and you wish to scope) to your scope dependency.
6. If your scope is not provided from a npm library but rather directly by you at runtime, declare your scope dependency as external by adding it to the `externals` array.
   Otherwise, webpack will look it up in your `node_modules` directory and fail

Following the steps above, your configuration file would end up looking something like this:

**webpack.config.js**

```javascript
const { ProvidePlugin } = require('webpack')
const { ScopedAmdLibraryPlugin } = require('scoped-amd-library-plugin')

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
			fetch: [scopeDependencyName, 'fetch'],
		}),
	],
	externals: [
		{
			[scopeDependencyName]: scopeDependencyName, // optional step 5
		},
	],
}
```

## Global factories

In addition to the plugin itself, this library also comes packaged with global scope object factories which create the minimal global object implementation
needed to load amd files generated for each supported target. These implementations are completely environment independent and require no additional code
so you can use the web scope factory in node and vice versa without any concerns. You may use these implementations as a base for your own global
scope implementation.

```javascript
const {
	webScopeFactory,
	webworkerScopeFactory,
	nodeScopeFactory,
} = require('scoped-amd-library-plugin/globalFactories')
```

## Security

You might be tempted to use this plugin to scope code from an untrusted source and so you can run in securely inside your own
environment - DON'T!.

While you can theoretically map every single available global namespace of your environment using the [ProvidePlugin](https://webpack.js.org/plugins/provide-plugin/)
in reality this "counter measure" can easily be worked around by malicious code - for example:

```javascript
;(function () {
	return this
})()
```

This plugin was never designed for code sand-boxing. it's simply a way to separate dynamically imported bundles and their chunks into different scopes.

## Caveats

### web & webworker target un-scopable globals

When targeted for web / webworker environments, Webpack's runtime code require access to some globals that cannot be scoped
due to the nature of how the runtime code act to register chunks. The globals are:

-   self - used in the runtime to write the `webpackChunk` global, [chunk code](https://github.com/webpack/webpack/blob/d28592e9daf1f483c621708451534fc1ec7240c6/examples/code-splitting/README.md#dist796outputjs)
    will look up this global directly from `self`.
-   webpackChunk\* - custom webpack set global used as a chunk registry and cache, usually suffixed by the project name

## Contribute

Contributions are welcome!
