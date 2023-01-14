import { dirname, joinPath } from '../src/globalFactories/pathUtils'
import nodePath from 'path'

describe('dirname', () => {
	test('blank path', () => {
		const path = ''
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('single segment', () => {
		const path = 'root'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('two segments', () => {
		const path = 'root/dir'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('multiple segments', () => {
		const path = 'root/dir/subdir'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('leading slash', () => {
		const path = '/root/dir/subdir'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('trailing slash', () => {
		const path = 'root/dir/subdir/'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('relative path', () => {
		const path = '../dir/subdir'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('with current path', () => {
		const path = './dir/subdir'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})

	test('consecutive slashes', () => {
		const path = 'root//dir/subdir'
		expect(dirname(path)).toEqual(nodePath.dirname(path))
	})
})

describe('joinPath', () => {
	test('single segment', () => {
		const base = 'root'
		const path = 'dir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('multiple segments', () => {
		const base = 'root'
		const path = 'dir/subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('relative to current', () => {
		const base = 'root'
		const path = './dir/subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('with back step', () => {
		const base = 'root/dir'
		const path = '../dir/subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('base leading slash', () => {
		const base = '/root'
		const path = 'dir/subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('consecutive flashes', () => {
		const base = 'root'
		const path = 'dir//subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('base trailing slash', () => {
		const base = 'root/'
		const path = 'dir/subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('path trailing slash', () => {
		const base = 'root'
		const path = 'dir/subdir/'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('path leading slash', () => {
		const base = 'root'
		const path = '/dir/subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})

	test('blank base', () => {
		const base = ''
		const path = '/dir/subdir'
		expect(joinPath(base, path)).toEqual(nodePath.join(base, path))
	})
})
