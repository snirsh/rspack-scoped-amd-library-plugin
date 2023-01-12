import type { LoadFile } from '../types'

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
 * @param loadFile a function that returns file/url content
 * @param src a path representing the current script's url as per https://developer.mozilla.org/en-US/docs/Web/API/Document/currentScript
 */
export const webScopeFactory = (loadFile: LoadFile, src: string) => {
	const elements: Array<DOMElement> = []

	const loadScriptFromScriptTag = ({ src, onerror, onload }: DOMScript) => {
		loadFile(src!)
			.then((payload: string) => {
				// eslint-disable-next-line no-eval
				eval(payload)
				onload?.()
			})
			.catch((err: unknown) => {
				console.error('failed loading script', src, err)
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

	;(document.createElement('script') as DOMScript).src = src

	return {
		document,
	}
}
