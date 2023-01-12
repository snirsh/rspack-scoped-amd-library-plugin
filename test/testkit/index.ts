// @ts-ignore: allow us to run web based tests in node (self is used by Webpack in those cases )
global.self = global

export { runPlugin } from './runPlugin'
export { createWebpackConfig } from './createWebpackConfig'
