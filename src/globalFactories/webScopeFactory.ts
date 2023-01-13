import type { LoadFile, LoadFileSync } from '../types'

type DOMElement = {
	type: string
	attributes: { [name: string]: any }
	getAttribute: (attr: string) => unknown
	setAttribute: (attr: string, value: unknown) => void
}

type DOMScript = DOMElement & {
	type: 'script'
	onload?: Function
	onerror?: Function
	src?: string
}

/**
 * Generates the minimal required object for proper web targeted amd scripts built in webpack
 *
 * @param projectRoot a path representing the base route for any relative url in your bundles
 * @param loadFile a function that returns file/url content
 */
export const webScopeFactory = (projectRoot: string, loadFile: LoadFile | LoadFileSync) => {
	if (!/^https?:/i.test(projectRoot) && !projectRoot.endsWith('/')) {
		throw new Error('non-url projectRoot argument must end with a "/"')
	}

	const elements: Array<DOMElement> = []
	const promisifiedLoadFile: LoadFile = (...args) => Promise.resolve(loadFile(...args))

	const loadScriptFromScriptTag = ({ src, onerror, onload }: DOMScript) => {
		promisifiedLoadFile(src!)
			.then((payload: string) => {
				// eslint-disable-next-line no-eval
				eval(payload)
				onload?.()
			})
			.catch((err: unknown) => {
				onerror?.(err)
			})
	}

	const createElementWithType = (type: string): DOMElement => {
		const elem: DOMElement = {
			type,
			attributes: {},
			getAttribute(attr) {
				return elem.attributes[attr]
			},
			setAttribute(attr, value) {
				elem.attributes[attr] = value
			},
		}

		return elem
	}

	const document = {
		createElement(type: string) {
			const elem = createElementWithType(type)
			elements.push(elem)
			return elem
		},
		getElementsByTagName(tagName: string): Array<DOMElement> {
			return elements.filter((elem) => elem.type === tagName)
		},
		head: {
			appendChild(element: DOMElement) {
				if (element.type === 'script') {
					loadScriptFromScriptTag(element as DOMScript)
				}
				return element
			},
		},
	}

	;(document.createElement('script') as DOMScript).src = projectRoot

	return {
		document,
	}
}
