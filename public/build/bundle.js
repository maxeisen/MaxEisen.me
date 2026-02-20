
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35730/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

	const identity = (x) => x;

	/**
	 * @template T
	 * @template S
	 * @param {T} tar
	 * @param {S} src
	 * @returns {T & S}
	 */
	function assign(tar, src) {
		// @ts-ignore
		for (const k in src) tar[k] = src[k];
		return /** @type {T & S} */ (tar);
	}

	/** @returns {void} */
	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	/**
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function run_all(fns) {
		fns.forEach(run);
	}

	/**
	 * @param {any} thing
	 * @returns {thing is Function}
	 */
	function is_function(thing) {
		return typeof thing === 'function';
	}

	/** @returns {boolean} */
	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
	}

	let src_url_equal_anchor;

	/**
	 * @param {string} element_src
	 * @param {string} url
	 * @returns {boolean}
	 */
	function src_url_equal(element_src, url) {
		if (element_src === url) return true;
		if (!src_url_equal_anchor) {
			src_url_equal_anchor = document.createElement('a');
		}
		// This is actually faster than doing URL(..).href
		src_url_equal_anchor.href = url;
		return element_src === src_url_equal_anchor.href;
	}

	/** @param {string} srcset */
	function split_srcset(srcset) {
		return srcset.split(',').map((src) => src.trim().split(' ').filter(Boolean));
	}

	/**
	 * @param {HTMLSourceElement | HTMLImageElement} element_srcset
	 * @param {string | undefined | null} srcset
	 * @returns {boolean}
	 */
	function srcset_url_equal(element_srcset, srcset) {
		const element_urls = split_srcset(element_srcset.srcset);
		const urls = split_srcset(srcset || '');

		return (
			urls.length === element_urls.length &&
			urls.every(
				([url, width], i) =>
					width === element_urls[i][1] &&
					// We need to test both ways because Vite will create an a full URL with
					// `new URL(asset, import.meta.url).href` for the client when `base: './'`, and the
					// relative URLs inside srcset are not automatically resolved to absolute URLs by
					// browsers (in contrast to img.src). This means both SSR and DOM code could
					// contain relative or absolute URLs.
					(src_url_equal(element_urls[i][0], url) || src_url_equal(url, element_urls[i][0]))
			)
		);
	}

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}

	function create_slot(definition, ctx, $$scope, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, $$scope, fn) {
		return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
	}

	function get_slot_changes(definition, $$scope, dirty, fn) {
		if (definition[2] && fn) {
			const lets = definition[2](fn(dirty));
			if ($$scope.dirty === undefined) {
				return lets;
			}
			if (typeof lets === 'object') {
				const merged = [];
				const len = Math.max($$scope.dirty.length, lets.length);
				for (let i = 0; i < len; i += 1) {
					merged[i] = $$scope.dirty[i] | lets[i];
				}
				return merged;
			}
			return $$scope.dirty | lets;
		}
		return $$scope.dirty;
	}

	/** @returns {void} */
	function update_slot_base(
		slot,
		slot_definition,
		ctx,
		$$scope,
		slot_changes,
		get_slot_context_fn
	) {
		if (slot_changes) {
			const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
			slot.p(slot_context, slot_changes);
		}
	}

	/** @returns {any[] | -1} */
	function get_all_dirty_from_scope($$scope) {
		if ($$scope.ctx.length > 32) {
			const dirty = [];
			const length = $$scope.ctx.length / 32;
			for (let i = 0; i < length; i++) {
				dirty[i] = -1;
			}
			return dirty;
		}
		return -1;
	}

	/** @returns {{}} */
	function exclude_internal_props(props) {
		const result = {};
		for (const k in props) if (k[0] !== '$') result[k] = props[k];
		return result;
	}

	/** @returns {{}} */
	function compute_rest_props(props, keys) {
		const rest = {};
		keys = new Set(keys);
		for (const k in props) if (!keys.has(k) && k[0] !== '$') rest[k] = props[k];
		return rest;
	}

	function null_to_empty(value) {
		return value == null ? '' : value;
	}

	const is_client = typeof window !== 'undefined';

	/** @type {() => number} */
	let now = is_client ? () => window.performance.now() : () => Date.now();

	let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;

	const tasks = new Set();

	/**
	 * @param {number} now
	 * @returns {void}
	 */
	function run_tasks(now) {
		tasks.forEach((task) => {
			if (!task.c(now)) {
				tasks.delete(task);
				task.f();
			}
		});
		if (tasks.size !== 0) raf(run_tasks);
	}

	/**
	 * Creates a new task that runs on each raf frame
	 * until it returns a falsy value or is aborted
	 * @param {import('./private.js').TaskCallback} callback
	 * @returns {import('./private.js').Task}
	 */
	function loop(callback) {
		/** @type {import('./private.js').TaskEntry} */
		let task;
		if (tasks.size === 0) raf(run_tasks);
		return {
			promise: new Promise((fulfill) => {
				tasks.add((task = { c: callback, f: fulfill }));
			}),
			abort() {
				tasks.delete(task);
			}
		};
	}

	/** @type {typeof globalThis} */
	const globals =
		typeof window !== 'undefined'
			? window
			: typeof globalThis !== 'undefined'
			? globalThis
			: // @ts-ignore Node typings have this
			  global;

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append(target, node) {
		target.appendChild(node);
	}

	/**
	 * @param {Node} node
	 * @returns {ShadowRoot | Document}
	 */
	function get_root_for_style(node) {
		if (!node) return document;
		const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
		if (root && /** @type {ShadowRoot} */ (root).host) {
			return /** @type {ShadowRoot} */ (root);
		}
		return node.ownerDocument;
	}

	/**
	 * @param {Node} node
	 * @returns {CSSStyleSheet}
	 */
	function append_empty_stylesheet(node) {
		const style_element = element('style');
		// For transitions to work without 'style-src: unsafe-inline' Content Security Policy,
		// these empty tags need to be allowed with a hash as a workaround until we move to the Web Animations API.
		// Using the hash for the empty string (for an empty tag) works in all browsers except Safari.
		// So as a workaround for the workaround, when we append empty style tags we set their content to /* empty */.
		// The hash 'sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=' will then work even in Safari.
		style_element.textContent = '/* empty */';
		append_stylesheet(get_root_for_style(node), style_element);
		return style_element.sheet;
	}

	/**
	 * @param {ShadowRoot | Document} node
	 * @param {HTMLStyleElement} style
	 * @returns {CSSStyleSheet}
	 */
	function append_stylesheet(node, style) {
		append(/** @type {Document} */ (node).head || node, style);
		return style.sheet;
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	}

	/**
	 * @returns {void} */
	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	/**
	 * @template {keyof HTMLElementTagNameMap} K
	 * @param {K} name
	 * @returns {HTMLElementTagNameMap[K]}
	 */
	function element(name) {
		return document.createElement(name);
	}

	/**
	 * @template {keyof SVGElementTagNameMap} K
	 * @param {K} name
	 * @returns {SVGElement}
	 */
	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	}

	/**
	 * @param {string} data
	 * @returns {Text}
	 */
	function text(data) {
		return document.createTextNode(data);
	}

	/**
	 * @returns {Text} */
	function space() {
		return text(' ');
	}

	/**
	 * @returns {Text} */
	function empty() {
		return text('');
	}

	/**
	 * @param {EventTarget} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @returns {() => void}
	 */
	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
	}

	/**
	 * @returns {void} */
	function set_custom_element_data(node, prop, value) {
		const lower = prop.toLowerCase(); // for backwards compatibility with existing behavior we do lowercase first
		if (lower in node) {
			node[lower] = typeof node[lower] === 'boolean' && value === '' ? true : value;
		} else if (prop in node) {
			node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
		} else {
			attr(node, prop, value);
		}
	}

	/**
	 * @param {Element} element
	 * @returns {ChildNode[]}
	 */
	function children(element) {
		return Array.from(element.childNodes);
	}

	/**
	 * @returns {void} */
	function set_style(node, key, value, important) {
		if (value == null) {
			node.style.removeProperty(key);
		} else {
			node.style.setProperty(key, value, important ? 'important' : '');
		}
	}

	/**
	 * @returns {void} */
	function toggle_class(element, name, toggle) {
		// The `!!` is required because an `undefined` flag means flipping the current state.
		element.classList.toggle(name, !!toggle);
	}

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
	 * @returns {CustomEvent<T>}
	 */
	function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
		return new CustomEvent(type, { detail, bubbles, cancelable });
	}
	/** */
	class HtmlTag {
		/**
		 * @private
		 * @default false
		 */
		is_svg = false;
		/** parent for creating node */
		e = undefined;
		/** html tag nodes */
		n = undefined;
		/** target */
		t = undefined;
		/** anchor */
		a = undefined;
		constructor(is_svg = false) {
			this.is_svg = is_svg;
			this.e = this.n = null;
		}

		/**
		 * @param {string} html
		 * @returns {void}
		 */
		c(html) {
			this.h(html);
		}

		/**
		 * @param {string} html
		 * @param {HTMLElement | SVGElement} target
		 * @param {HTMLElement | SVGElement} anchor
		 * @returns {void}
		 */
		m(html, target, anchor = null) {
			if (!this.e) {
				if (this.is_svg)
					this.e = svg_element(/** @type {keyof SVGElementTagNameMap} */ (target.nodeName));
				/** #7364  target for <template> may be provided as #document-fragment(11) */ else
					this.e = element(
						/** @type {keyof HTMLElementTagNameMap} */ (
							target.nodeType === 11 ? 'TEMPLATE' : target.nodeName
						)
					);
				this.t =
					target.tagName !== 'TEMPLATE'
						? target
						: /** @type {HTMLTemplateElement} */ (target).content;
				this.c(html);
			}
			this.i(anchor);
		}

		/**
		 * @param {string} html
		 * @returns {void}
		 */
		h(html) {
			this.e.innerHTML = html;
			this.n = Array.from(
				this.e.nodeName === 'TEMPLATE' ? this.e.content.childNodes : this.e.childNodes
			);
		}

		/**
		 * @returns {void} */
		i(anchor) {
			for (let i = 0; i < this.n.length; i += 1) {
				insert(this.t, this.n[i], anchor);
			}
		}

		/**
		 * @param {string} html
		 * @returns {void}
		 */
		p(html) {
			this.d();
			this.h(html);
			this.i(this.a);
		}

		/**
		 * @returns {void} */
		d() {
			this.n.forEach(detach);
		}
	}

	/**
	 * @typedef {Node & {
	 * 	claim_order?: number;
	 * 	hydrate_init?: true;
	 * 	actual_end_child?: NodeEx;
	 * 	childNodes: NodeListOf<NodeEx>;
	 * }} NodeEx
	 */

	/** @typedef {ChildNode & NodeEx} ChildNodeEx */

	/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

	/**
	 * @typedef {ChildNodeEx[] & {
	 * 	claim_info?: {
	 * 		last_index: number;
	 * 		total_claimed: number;
	 * 	};
	 * }} ChildNodeArray
	 */

	// we need to store the information for multiple documents because a Svelte application could also contain iframes
	// https://github.com/sveltejs/svelte/issues/3624
	/** @type {Map<Document | ShadowRoot, import('./private.d.ts').StyleInformation>} */
	const managed_styles = new Map();

	let active = 0;

	// https://github.com/darkskyapp/string-hash/blob/master/index.js
	/**
	 * @param {string} str
	 * @returns {number}
	 */
	function hash(str) {
		let hash = 5381;
		let i = str.length;
		while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
		return hash >>> 0;
	}

	/**
	 * @param {Document | ShadowRoot} doc
	 * @param {Element & ElementCSSInlineStyle} node
	 * @returns {{ stylesheet: any; rules: {}; }}
	 */
	function create_style_information(doc, node) {
		const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
		managed_styles.set(doc, info);
		return info;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {number} a
	 * @param {number} b
	 * @param {number} duration
	 * @param {number} delay
	 * @param {(t: number) => number} ease
	 * @param {(t: number, u: number) => string} fn
	 * @param {number} uid
	 * @returns {string}
	 */
	function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
		const step = 16.666 / duration;
		let keyframes = '{\n';
		for (let p = 0; p <= 1; p += step) {
			const t = a + (b - a) * ease(p);
			keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
		}
		const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
		const name = `__svelte_${hash(rule)}_${uid}`;
		const doc = get_root_for_style(node);
		const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
		if (!rules[name]) {
			rules[name] = true;
			stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
		}
		const animation = node.style.animation || '';
		node.style.animation = `${
		animation ? `${animation}, ` : ''
	}${name} ${duration}ms linear ${delay}ms 1 both`;
		active += 1;
		return name;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {string} [name]
	 * @returns {void}
	 */
	function delete_rule(node, name) {
		const previous = (node.style.animation || '').split(', ');
		const next = previous.filter(
			name
				? (anim) => anim.indexOf(name) < 0 // remove specific animation
				: (anim) => anim.indexOf('__svelte') === -1 // remove all Svelte animations
		);
		const deleted = previous.length - next.length;
		if (deleted) {
			node.style.animation = next.join(', ');
			active -= deleted;
			if (!active) clear_rules();
		}
	}

	/** @returns {void} */
	function clear_rules() {
		raf(() => {
			if (active) return;
			managed_styles.forEach((info) => {
				const { ownerNode } = info.stylesheet;
				// there is no ownerNode if it runs on jsdom.
				if (ownerNode) detach(ownerNode);
			});
			managed_styles.clear();
		});
	}

	let current_component;

	/** @returns {void} */
	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error('Function called outside component initialization');
		return current_component;
	}

	/**
	 * Schedules a callback to run immediately before the component is updated after any state change.
	 *
	 * The first time the callback runs will be before the initial `onMount`
	 *
	 * https://svelte.dev/docs/svelte#beforeupdate
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function beforeUpdate(fn) {
		get_current_component().$$.before_update.push(fn);
	}

	/**
	 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
	 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
	 * it can be called from an external module).
	 *
	 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
	 *
	 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
	 *
	 * https://svelte.dev/docs/svelte#onmount
	 * @template T
	 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
	 * @returns {void}
	 */
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	/**
	 * Schedules a callback to run immediately after the component has been updated.
	 *
	 * The first time the callback runs will be after the initial `onMount`
	 *
	 * https://svelte.dev/docs/svelte#afterupdate
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function afterUpdate(fn) {
		get_current_component().$$.after_update.push(fn);
	}

	/**
	 * Schedules a callback to run immediately before the component is unmounted.
	 *
	 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
	 * only one that runs inside a server-side component.
	 *
	 * https://svelte.dev/docs/svelte#ondestroy
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	/**
	 * Creates an event dispatcher that can be used to dispatch [component events](https://svelte.dev/docs#template-syntax-component-directives-on-eventname).
	 * Event dispatchers are functions that can take two arguments: `name` and `detail`.
	 *
	 * Component events created with `createEventDispatcher` create a
	 * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
	 * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
	 * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
	 * property and can contain any type of data.
	 *
	 * The event dispatcher can be typed to narrow the allowed event names and the type of the `detail` argument:
	 * ```ts
	 * const dispatch = createEventDispatcher<{
	 *  loaded: never; // does not take a detail argument
	 *  change: string; // takes a detail argument of type string, which is required
	 *  optional: number | null; // takes an optional detail argument of type number
	 * }>();
	 * ```
	 *
	 * https://svelte.dev/docs/svelte#createeventdispatcher
	 * @template {Record<string, any>} [EventMap=any]
	 * @returns {import('./public.js').EventDispatcher<EventMap>}
	 */
	function createEventDispatcher() {
		const component = get_current_component();
		return (type, detail, { cancelable = false } = {}) => {
			const callbacks = component.$$.callbacks[type];
			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(/** @type {string} */ (type), detail, { cancelable });
				callbacks.slice().forEach((fn) => {
					fn.call(component, event);
				});
				return !event.defaultPrevented;
			}
			return true;
		};
	}

	/**
	 * Associates an arbitrary `context` object with the current component and the specified `key`
	 * and returns that object. The context is then available to children of the component
	 * (including slotted content) with `getContext`.
	 *
	 * Like lifecycle functions, this must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#setcontext
	 * @template T
	 * @param {any} key
	 * @param {T} context
	 * @returns {T}
	 */
	function setContext(key, context) {
		get_current_component().$$.context.set(key, context);
		return context;
	}

	/**
	 * Retrieves the context that belongs to the closest parent component with the specified `key`.
	 * Must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#getcontext
	 * @template T
	 * @param {any} key
	 * @returns {T}
	 */
	function getContext(key) {
		return get_current_component().$$.context.get(key);
	}

	/**
	 * Retrieves the whole context map that belongs to the closest parent component.
	 * Must be called during component initialisation. Useful, for example, if you
	 * programmatically create a component and want to pass the existing context to it.
	 *
	 * https://svelte.dev/docs/svelte#getallcontexts
	 * @template {Map<any, any>} [T=Map<any, any>]
	 * @returns {T}
	 */
	function getAllContexts() {
		return get_current_component().$$.context;
	}

	/**
	 * Checks whether a given `key` has been set in the context of a parent component.
	 * Must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#hascontext
	 * @param {any} key
	 * @returns {boolean}
	 */
	function hasContext(key) {
		return get_current_component().$$.context.has(key);
	}

	const dirty_components = [];
	const binding_callbacks = [];

	let render_callbacks = [];

	const flush_callbacks = [];

	const resolved_promise = /* @__PURE__ */ Promise.resolve();

	let update_scheduled = false;

	/** @returns {void} */
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	/** @returns {Promise<void>} */
	function tick() {
		schedule_update();
		return resolved_promise;
	}

	/** @returns {void} */
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	/** @returns {void} */
	function add_flush_callback(fn) {
		flush_callbacks.push(fn);
	}

	// flush() calls callbacks in this order:
	// 1. All beforeUpdate callbacks, in order: parents before children
	// 2. All bind:this callbacks, in reverse order: children before parents.
	// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
	//    for afterUpdates called during the initial onMount, which are called in
	//    reverse order: children before parents.
	// Since callbacks might update component values, which could trigger another
	// call to flush(), the following steps guard against this:
	// 1. During beforeUpdate, any updated components will be added to the
	//    dirty_components array and will cause a reentrant call to flush(). Because
	//    the flush index is kept outside the function, the reentrant call will pick
	//    up where the earlier call left off and go through all dirty components. The
	//    current_component value is saved and restored so that the reentrant call will
	//    not interfere with the "parent" flush() call.
	// 2. bind:this callbacks cannot trigger new flush() calls.
	// 3. During afterUpdate, any updated components will NOT have their afterUpdate
	//    callback called a second time; the seen_callbacks set, outside the flush()
	//    function, guarantees this behavior.
	const seen_callbacks = new Set();

	let flushidx = 0; // Do *not* move this inside the flush() function

	/** @returns {void} */
	function flush() {
		// Do not reenter flush while dirty components are updated, as this can
		// result in an infinite loop. Instead, let the inner flush handle it.
		// Reentrancy is ok afterwards for bindings etc.
		if (flushidx !== 0) {
			return;
		}
		const saved_component = current_component;
		do {
			// first, call beforeUpdate functions
			// and update components
			try {
				while (flushidx < dirty_components.length) {
					const component = dirty_components[flushidx];
					flushidx++;
					set_current_component(component);
					update(component.$$);
				}
			} catch (e) {
				// reset dirty state to not end up in a deadlocked state and then rethrow
				dirty_components.length = 0;
				flushidx = 0;
				throw e;
			}
			set_current_component(null);
			dirty_components.length = 0;
			flushidx = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			for (let i = 0; i < render_callbacks.length; i += 1) {
				const callback = render_callbacks[i];
				if (!seen_callbacks.has(callback)) {
					// ...so guard against infinite loops
					seen_callbacks.add(callback);
					callback();
				}
			}
			render_callbacks.length = 0;
		} while (dirty_components.length);
		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}
		update_scheduled = false;
		seen_callbacks.clear();
		set_current_component(saved_component);
	}

	/** @returns {void} */
	function update($$) {
		if ($$.fragment !== null) {
			$$.update();
			run_all($$.before_update);
			const dirty = $$.dirty;
			$$.dirty = [-1];
			$$.fragment && $$.fragment.p($$.ctx, dirty);
			$$.after_update.forEach(add_render_callback);
		}
	}

	/**
	 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function flush_render_callbacks(fns) {
		const filtered = [];
		const targets = [];
		render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
		targets.forEach((c) => c());
		render_callbacks = filtered;
	}

	/**
	 * @type {Promise<void> | null}
	 */
	let promise;

	/**
	 * @returns {Promise<void>}
	 */
	function wait() {
		if (!promise) {
			promise = Promise.resolve();
			promise.then(() => {
				promise = null;
			});
		}
		return promise;
	}

	/**
	 * @param {Element} node
	 * @param {INTRO | OUTRO | boolean} direction
	 * @param {'start' | 'end'} kind
	 * @returns {void}
	 */
	function dispatch(node, direction, kind) {
		node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
	}

	const outroing = new Set();

	/**
	 * @type {Outro}
	 */
	let outros;

	/**
	 * @returns {void} */
	function group_outros() {
		outros = {
			r: 0,
			c: [],
			p: outros // parent group
		};
	}

	/**
	 * @returns {void} */
	function check_outros() {
		if (!outros.r) {
			run_all(outros.c);
		}
		outros = outros.p;
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} [local]
	 * @returns {void}
	 */
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} local
	 * @param {0 | 1} [detach]
	 * @param {() => void} [callback]
	 * @returns {void}
	 */
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		} else if (callback) {
			callback();
		}
	}

	/**
	 * @type {import('../transition/public.js').TransitionConfig}
	 */
	const null_transition = { duration: 0 };

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {TransitionFn} fn
	 * @param {any} params
	 * @param {boolean} intro
	 * @returns {{ run(b: 0 | 1): void; end(): void; }}
	 */
	function create_bidirectional_transition(node, fn, params, intro) {
		/**
		 * @type {TransitionOptions} */
		const options = { direction: 'both' };
		let config = fn(node, params, options);
		let t = intro ? 0 : 1;

		/**
		 * @type {Program | null} */
		let running_program = null;

		/**
		 * @type {PendingProgram | null} */
		let pending_program = null;
		let animation_name = null;

		/** @type {boolean} */
		let original_inert_value;

		/**
		 * @returns {void} */
		function clear_animation() {
			if (animation_name) delete_rule(node, animation_name);
		}

		/**
		 * @param {PendingProgram} program
		 * @param {number} duration
		 * @returns {Program}
		 */
		function init(program, duration) {
			const d = /** @type {Program['d']} */ (program.b - t);
			duration *= Math.abs(d);
			return {
				a: t,
				b: program.b,
				d,
				duration,
				start: program.start,
				end: program.start + duration,
				group: program.group
			};
		}

		/**
		 * @param {INTRO | OUTRO} b
		 * @returns {void}
		 */
		function go(b) {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick = noop,
				css
			} = config || null_transition;

			/**
			 * @type {PendingProgram} */
			const program = {
				start: now() + delay,
				b
			};

			if (!b) {
				// @ts-ignore todo: improve typings
				program.group = outros;
				outros.r += 1;
			}

			if ('inert' in node) {
				if (b) {
					if (original_inert_value !== undefined) {
						// aborted/reversed outro — restore previous inert value
						node.inert = original_inert_value;
					}
				} else {
					original_inert_value = /** @type {HTMLElement} */ (node).inert;
					node.inert = true;
				}
			}

			if (running_program || pending_program) {
				pending_program = program;
			} else {
				// if this is an intro, and there's a delay, we need to do
				// an initial tick and/or apply CSS animation immediately
				if (css) {
					clear_animation();
					animation_name = create_rule(node, t, b, duration, delay, easing, css);
				}
				if (b) tick(0, 1);
				running_program = init(program, duration);
				add_render_callback(() => dispatch(node, b, 'start'));
				loop((now) => {
					if (pending_program && now > pending_program.start) {
						running_program = init(pending_program, duration);
						pending_program = null;
						dispatch(node, running_program.b, 'start');
						if (css) {
							clear_animation();
							animation_name = create_rule(
								node,
								t,
								running_program.b,
								running_program.duration,
								0,
								easing,
								config.css
							);
						}
					}
					if (running_program) {
						if (now >= running_program.end) {
							tick((t = running_program.b), 1 - t);
							dispatch(node, running_program.b, 'end');
							if (!pending_program) {
								// we're done
								if (running_program.b) {
									// intro — we can tidy up immediately
									clear_animation();
								} else {
									// outro — needs to be coordinated
									if (!--running_program.group.r) run_all(running_program.group.c);
								}
							}
							running_program = null;
						} else if (now >= running_program.start) {
							const p = now - running_program.start;
							t = running_program.a + running_program.d * easing(p / running_program.duration);
							tick(t, 1 - t);
						}
					}
					return !!(running_program || pending_program);
				});
			}
		}
		return {
			run(b) {
				if (is_function(config)) {
					wait().then(() => {
						const opts = { direction: b ? 'in' : 'out' };
						// @ts-ignore
						config = config(opts);
						go(b);
					});
				} else {
					go(b);
				}
			},
			end() {
				clear_animation();
				running_program = pending_program = null;
			}
		};
	}

	/** @typedef {1} INTRO */
	/** @typedef {0} OUTRO */
	/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
	/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

	/**
	 * @typedef {Object} Outro
	 * @property {number} r
	 * @property {Function[]} c
	 * @property {Object} p
	 */

	/**
	 * @typedef {Object} PendingProgram
	 * @property {number} start
	 * @property {INTRO|OUTRO} b
	 * @property {Outro} [group]
	 */

	/**
	 * @typedef {Object} Program
	 * @property {number} a
	 * @property {INTRO|OUTRO} b
	 * @property {1|-1} d
	 * @property {number} duration
	 * @property {number} start
	 * @property {number} end
	 * @property {Outro} [group]
	 */

	// general each functions:

	function ensure_array_like(array_like_or_iterator) {
		return array_like_or_iterator?.length !== undefined
			? array_like_or_iterator
			: Array.from(array_like_or_iterator);
	}

	/** @returns {{}} */
	function get_spread_update(levels, updates) {
		const update = {};
		const to_null_out = {};
		const accounted_for = { $$scope: 1 };
		let i = levels.length;
		while (i--) {
			const o = levels[i];
			const n = updates[i];
			if (n) {
				for (const key in o) {
					if (!(key in n)) to_null_out[key] = 1;
				}
				for (const key in n) {
					if (!accounted_for[key]) {
						update[key] = n[key];
						accounted_for[key] = 1;
					}
				}
				levels[i] = n;
			} else {
				for (const key in o) {
					accounted_for[key] = 1;
				}
			}
		}
		for (const key in to_null_out) {
			if (!(key in update)) update[key] = undefined;
		}
		return update;
	}

	function get_spread_object(spread_props) {
		return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
	}

	/** @returns {void} */
	function bind$1(component, name, callback) {
		const index = component.$$.props[name];
		if (index !== undefined) {
			component.$$.bound[index] = callback;
			callback(component.$$.ctx[index]);
		}
	}

	/** @returns {void} */
	function create_component(block) {
		block && block.c();
	}

	/** @returns {void} */
	function mount_component(component, target, anchor) {
		const { fragment, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {
			const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
			// if the component was destroyed immediately
			// it will update the `$$.on_destroy` reference to `null`.
			// the destructured on_destroy may still reference to the old array
			if (component.$$.on_destroy) {
				component.$$.on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
		after_update.forEach(add_render_callback);
	}

	/** @returns {void} */
	function destroy_component(component, detaching) {
		const $$ = component.$$;
		if ($$.fragment !== null) {
			flush_render_callbacks($$.after_update);
			run_all($$.on_destroy);
			$$.fragment && $$.fragment.d(detaching);
			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			$$.on_destroy = $$.fragment = null;
			$$.ctx = [];
		}
	}

	/** @returns {void} */
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}

	// TODO: Document the other params
	/**
	 * @param {SvelteComponent} component
	 * @param {import('./public.js').ComponentConstructorOptions} options
	 *
	 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
	 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
	 * This will be the `add_css` function from the compiled component.
	 *
	 * @returns {void}
	 */
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles = null,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		/** @type {import('./private.js').T$$} */
		const $$ = (component.$$ = {
			fragment: null,
			ctx: [],
			// state
			props,
			update: noop,
			not_equal,
			bound: blank_object(),
			// lifecycle
			on_mount: [],
			on_destroy: [],
			on_disconnect: [],
			before_update: [],
			after_update: [],
			context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
			// everything else
			callbacks: blank_object(),
			dirty,
			skip_bound: false,
			root: options.target || parent_component.$$.root
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
					}
					return ret;
			  })
			: [];
		$$.update();
		ready = true;
		run_all($$.before_update);
		// `false` as a special case of no DOM component
		$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
		if (options.target) {
			if (options.hydrate) {
				// TODO: what is the correct type here?
				// @ts-expect-error
				const nodes = children(options.target);
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(component, options.target, options.anchor);
			flush();
		}
		set_current_component(parent_component);
	}

	/**
	 * Base class for Svelte components. Used when dev=false.
	 *
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 */
	class SvelteComponent {
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$ = undefined;
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$set = undefined;

		/** @returns {void} */
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		/**
		 * @template {Extract<keyof Events, string>} K
		 * @param {K} type
		 * @param {((e: Events[K]) => void) | null | undefined} callback
		 * @returns {() => void}
		 */
		$on(type, callback) {
			if (!is_function(callback)) {
				return noop;
			}
			const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		/**
		 * @param {Partial<Props>} props
		 * @returns {void}
		 */
		$set(props) {
			if (this.$$set && !is_empty(props)) {
				this.$$.skip_bound = true;
				this.$$set(props);
				this.$$.skip_bound = false;
			}
		}
	}

	/**
	 * @typedef {Object} CustomElementPropDefinition
	 * @property {string} [attribute]
	 * @property {boolean} [reflect]
	 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
	 */

	// generated during release, do not modify

	/**
	 * The current version, as set in package.json.
	 *
	 * https://svelte.dev/docs/svelte-compiler#svelte-version
	 * @type {string}
	 */
	const VERSION = '4.2.20';
	const PUBLIC_VERSION = '4';

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @returns {void}
	 */
	function dispatch_dev(type, detail) {
		document.dispatchEvent(custom_event(type, { version: VERSION, ...detail }, { bubbles: true }));
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append_dev(target, node) {
		dispatch_dev('SvelteDOMInsert', { target, node });
		append(target, node);
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert_dev(target, node, anchor) {
		dispatch_dev('SvelteDOMInsert', { target, node, anchor });
		insert(target, node, anchor);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach_dev(node) {
		dispatch_dev('SvelteDOMRemove', { node });
		detach(node);
	}

	/**
	 * @param {Node} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @param {boolean} [has_prevent_default]
	 * @param {boolean} [has_stop_propagation]
	 * @param {boolean} [has_stop_immediate_propagation]
	 * @returns {() => void}
	 */
	function listen_dev(
		node,
		event,
		handler,
		options,
		has_prevent_default,
		has_stop_propagation,
		has_stop_immediate_propagation
	) {
		const modifiers =
			options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
		if (has_prevent_default) modifiers.push('preventDefault');
		if (has_stop_propagation) modifiers.push('stopPropagation');
		if (has_stop_immediate_propagation) modifiers.push('stopImmediatePropagation');
		dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
		const dispose = listen(node, event, handler, options);
		return () => {
			dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
			dispose();
		};
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr_dev(node, attribute, value) {
		attr(node, attribute, value);
		if (value == null) dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
		else dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
	}

	/**
	 * @param {Text} text
	 * @param {unknown} data
	 * @returns {void}
	 */
	function set_data_dev(text, data) {
		data = '' + data;
		if (text.data === data) return;
		dispatch_dev('SvelteDOMSetData', { node: text, data });
		text.data = /** @type {string} */ (data);
	}

	function ensure_array_like_dev(arg) {
		if (
			typeof arg !== 'string' &&
			!(arg && typeof arg === 'object' && 'length' in arg) &&
			!(typeof Symbol === 'function' && arg && Symbol.iterator in arg)
		) {
			throw new Error('{#each} only works with iterable values.');
		}
		return ensure_array_like(arg);
	}

	/**
	 * @returns {void} */
	function validate_slots(name, slot, keys) {
		for (const slot_key of Object.keys(slot)) {
			if (!~keys.indexOf(slot_key)) {
				console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
			}
		}
	}

	function construct_svelte_component_dev(component, props) {
		const error_message = 'this={...} of <svelte:component> should specify a Svelte component.';
		try {
			const instance = new component(props);
			if (!instance.$$ || !instance.$set || !instance.$on || !instance.$destroy) {
				throw new Error(error_message);
			}
			return instance;
		} catch (err) {
			const { message } = err;
			if (typeof message === 'string' && message.indexOf('is not a constructor') !== -1) {
				throw new Error(error_message);
			} else {
				throw err;
			}
		}
	}

	/**
	 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
	 *
	 * Can be used to create strongly typed Svelte components.
	 *
	 * #### Example:
	 *
	 * You have component library on npm called `component-library`, from which
	 * you export a component called `MyComponent`. For Svelte+TypeScript users,
	 * you want to provide typings. Therefore you create a `index.d.ts`:
	 * ```ts
	 * import { SvelteComponent } from "svelte";
	 * export class MyComponent extends SvelteComponent<{foo: string}> {}
	 * ```
	 * Typing this makes it possible for IDEs like VS Code with the Svelte extension
	 * to provide intellisense and to use the component like this in a Svelte file
	 * with TypeScript:
	 * ```svelte
	 * <script lang="ts">
	 * 	import { MyComponent } from "component-library";
	 * </script>
	 * <MyComponent foo={'bar'} />
	 * ```
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 * @template {Record<string, any>} [Slots=any]
	 * @extends {SvelteComponent<Props, Events>}
	 */
	class SvelteComponentDev extends SvelteComponent {
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Props}
		 */
		$$prop_def;
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Events}
		 */
		$$events_def;
		/**
		 * For type checking capabilities only.
		 * Does not exist at runtime.
		 * ### DO NOT USE!
		 *
		 * @type {Slots}
		 */
		$$slot_def;

		/** @param {import('./public.js').ComponentConstructorOptions<Props>} options */
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error("'target' is a required option");
			}
			super();
		}

		/** @returns {void} */
		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn('Component was already destroyed'); // eslint-disable-line no-console
			};
		}

		/** @returns {void} */
		$capture_state() {}

		/** @returns {void} */
		$inject_state() {}
	}
	/**
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 * @template {Record<string, any>} [Slots=any]
	 * @deprecated Use `SvelteComponent` instead. See PR for more information: https://github.com/sveltejs/svelte/pull/8512
	 * @extends {SvelteComponentDev<Props, Events, Slots>}
	 */
	class SvelteComponentTyped extends SvelteComponentDev {}

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

	/* src/components/MenuBar.svelte generated by Svelte v4.2.20 */
	const file$o = "src/components/MenuBar.svelte";

	// (23:20) {#if !isSafari}
	function create_if_block$9(ctx) {
		let source0;
		let source0_src_value;
		let source1;
		let source1_src_value;

		const block = {
			c: function create() {
				source0 = element("source");
				source1 = element("source");
				attr_dev(source0, "id", "icon-video-webm");
				if (!src_url_equal(source0.src, source0_src_value = "./img/additional/memoji_cycle.webm")) attr_dev(source0, "src", source0_src_value);
				attr_dev(source0, "type", "video/webm");
				add_location(source0, file$o, 23, 24, 1233);
				attr_dev(source1, "id", "icon-video-mp4");
				if (!src_url_equal(source1.src, source1_src_value = "./img/additional/memoji_cycle.mp4")) attr_dev(source1, "src", source1_src_value);
				attr_dev(source1, "type", "video/mp4");
				add_location(source1, file$o, 24, 24, 1347);
			},
			m: function mount(target, anchor) {
				insert_dev(target, source0, anchor);
				insert_dev(target, source1, anchor);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(source0);
					detach_dev(source1);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$9.name,
			type: "if",
			source: "(23:20) {#if !isSafari}",
			ctx
		});

		return block;
	}

	function create_fragment$o(ctx) {
		let div2;
		let header;
		let div0;
		let a0;
		let img;
		let img_src_value;
		let t0;
		let video;
		let t1;
		let div1;
		let nav;
		let ul;
		let li0;
		let a1;
		let t3;
		let li1;
		let a2;
		let t5;
		let li2;
		let a3;
		let t7;
		let li3;
		let a4;
		let t9;
		let li4;
		let a5;
		let t11;
		let li5;
		let a6;
		let b;
		let if_block = !/*isSafari*/ ctx[0] && create_if_block$9(ctx);

		const block = {
			c: function create() {
				div2 = element("div");
				header = element("header");
				div0 = element("div");
				a0 = element("a");
				img = element("img");
				t0 = space();
				video = element("video");
				if (if_block) if_block.c();
				t1 = space();
				div1 = element("div");
				nav = element("nav");
				ul = element("ul");
				li0 = element("li");
				a1 = element("a");
				a1.textContent = "Experience";
				t3 = space();
				li1 = element("li");
				a2 = element("a");
				a2.textContent = "Projects";
				t5 = space();
				li2 = element("li");
				a3 = element("a");
				a3.textContent = "Blog";
				t7 = space();
				li3 = element("li");
				a4 = element("a");
				a4.textContent = "Education";
				t9 = space();
				li4 = element("li");
				a5 = element("a");
				a5.textContent = "Skills";
				t11 = space();
				li5 = element("li");
				a6 = element("a");
				b = element("b");
				b.textContent = "Resume";
				attr_dev(img, "class", "home-icon-mobile");
				if (!src_url_equal(img.src, img_src_value = "./img/additional/memoji_cycle_small.gif")) attr_dev(img, "src", img_src_value);
				attr_dev(img, "width", "75px");
				attr_dev(img, "height", "88px");
				attr_dev(img, "alt", "Memoji gif for mobile");
				add_location(img, file$o, 20, 16, 913);
				attr_dev(video, "class", "home-icon");
				attr_dev(video, "poster", "./img/additional/memoji_cycle_small.gif");
				video.autoplay = true;
				video.loop = true;
				video.muted = true;
				video.playsInline = true;
				add_location(video, file$o, 21, 16, 1062);
				attr_dev(a0, "href", "/#");
				attr_dev(a0, "aria-label", "Home");
				attr_dev(a0, "onclick", "toggleTheme()");
				add_location(a0, file$o, 19, 12, 842);
				attr_dev(div0, "class", "home-icon-container");
				add_location(div0, file$o, 18, 8, 795);
				attr_dev(a1, "href", "#experience");
				add_location(a1, file$o, 32, 42, 1687);
				attr_dev(li0, "id", "nav-bar-item");
				add_location(li0, file$o, 32, 20, 1665);
				attr_dev(a2, "href", "#projects");
				add_location(a2, file$o, 33, 42, 1772);
				attr_dev(li1, "id", "nav-bar-item");
				add_location(li1, file$o, 33, 20, 1750);
				attr_dev(a3, "href", "#blog");
				add_location(a3, file$o, 34, 42, 1853);
				attr_dev(li2, "id", "nav-bar-item");
				add_location(li2, file$o, 34, 20, 1831);
				attr_dev(a4, "href", "#education");
				add_location(a4, file$o, 35, 42, 1926);
				attr_dev(li3, "id", "nav-bar-item");
				add_location(li3, file$o, 35, 20, 1904);
				attr_dev(a5, "href", "#skills");
				add_location(a5, file$o, 36, 42, 2009);
				attr_dev(li4, "id", "nav-bar-item");
				add_location(li4, file$o, 36, 20, 1987);
				add_location(b, file$o, 37, 60, 2104);
				attr_dev(a6, "href", "/resume");
				add_location(a6, file$o, 37, 42, 2086);
				attr_dev(li5, "id", "nav-bar-item");
				add_location(li5, file$o, 37, 20, 2064);
				attr_dev(ul, "class", "nav-bar-list");
				attr_dev(ul, "id", "nav-bar-list");
				add_location(ul, file$o, 31, 16, 1600);
				add_location(nav, file$o, 30, 12, 1577);
				attr_dev(div1, "class", "nav-bar");
				attr_dev(div1, "id", "nav-bar");
				add_location(div1, file$o, 29, 8, 1529);
				attr_dev(header, "id", "header");
				add_location(header, file$o, 17, 4, 765);
				attr_dev(div2, "class", "header-container");
				add_location(div2, file$o, 16, 0, 729);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div2, anchor);
				append_dev(div2, header);
				append_dev(header, div0);
				append_dev(div0, a0);
				append_dev(a0, img);
				append_dev(a0, t0);
				append_dev(a0, video);
				if (if_block) if_block.m(video, null);
				append_dev(header, t1);
				append_dev(header, div1);
				append_dev(div1, nav);
				append_dev(nav, ul);
				append_dev(ul, li0);
				append_dev(li0, a1);
				append_dev(ul, t3);
				append_dev(ul, li1);
				append_dev(li1, a2);
				append_dev(ul, t5);
				append_dev(ul, li2);
				append_dev(li2, a3);
				append_dev(ul, t7);
				append_dev(ul, li3);
				append_dev(li3, a4);
				append_dev(ul, t9);
				append_dev(ul, li4);
				append_dev(li4, a5);
				append_dev(ul, t11);
				append_dev(ul, li5);
				append_dev(li5, a6);
				append_dev(a6, b);
			},
			p: noop,
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div2);
				}

				if (if_block) if_block.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$o.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function scrollFunction() {
		if (document.body.scrollTop > 70 || document.documentElement.scrollTop > 70) {
			document.getElementById("nav-bar").style.fontSize = "20px";
			document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0.9)";
			document.getElementById("nav-bar-list").style.backdropFilter = "blur(3px)";
		} else {
			document.getElementById("nav-bar").style.fontSize = "30px";
			document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0)";
		}
	}

	function instance$o($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('MenuBar', slots, []);
		var isSafari = window.safari !== undefined;

		window.onscroll = function () {
			scrollFunction();
		};

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MenuBar> was created with unknown prop '${key}'`);
		});

		$$self.$capture_state = () => ({ isSafari, scrollFunction });

		$$self.$inject_state = $$props => {
			if ('isSafari' in $$props) $$invalidate(0, isSafari = $$props.isSafari);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [isSafari];
	}

	class MenuBar extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$o, create_fragment$o, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "MenuBar",
				options,
				id: create_fragment$o.name
			});
		}
	}

	/* node_modules/svelte-icons/components/IconBase.svelte generated by Svelte v4.2.20 */
	const file$n = "node_modules/svelte-icons/components/IconBase.svelte";

	// (18:2) {#if title}
	function create_if_block$8(ctx) {
		let title_1;
		let t;

		const block = {
			c: function create() {
				title_1 = svg_element("title");
				t = text(/*title*/ ctx[0]);
				add_location(title_1, file$n, 18, 4, 298);
			},
			m: function mount(target, anchor) {
				insert_dev(target, title_1, anchor);
				append_dev(title_1, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*title*/ 1) set_data_dev(t, /*title*/ ctx[0]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(title_1);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$8.name,
			type: "if",
			source: "(18:2) {#if title}",
			ctx
		});

		return block;
	}

	function create_fragment$n(ctx) {
		let svg;
		let if_block_anchor;
		let current;
		let if_block = /*title*/ ctx[0] && create_if_block$8(ctx);
		const default_slot_template = /*#slots*/ ctx[3].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

		const block = {
			c: function create() {
				svg = svg_element("svg");
				if (if_block) if_block.c();
				if_block_anchor = empty();
				if (default_slot) default_slot.c();
				attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
				attr_dev(svg, "viewBox", /*viewBox*/ ctx[1]);
				attr_dev(svg, "class", "svelte-c8tyih");
				add_location(svg, file$n, 16, 0, 229);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, svg, anchor);
				if (if_block) if_block.m(svg, null);
				append_dev(svg, if_block_anchor);

				if (default_slot) {
					default_slot.m(svg, null);
				}

				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (/*title*/ ctx[0]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$8(ctx);
						if_block.c();
						if_block.m(svg, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[2],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
							null
						);
					}
				}

				if (!current || dirty & /*viewBox*/ 2) {
					attr_dev(svg, "viewBox", /*viewBox*/ ctx[1]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(svg);
				}

				if (if_block) if_block.d();
				if (default_slot) default_slot.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$n.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$n($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('IconBase', slots, ['default']);
		let { title = null } = $$props;
		let { viewBox } = $$props;

		$$self.$$.on_mount.push(function () {
			if (viewBox === undefined && !('viewBox' in $$props || $$self.$$.bound[$$self.$$.props['viewBox']])) {
				console.warn("<IconBase> was created without expected prop 'viewBox'");
			}
		});

		const writable_props = ['title', 'viewBox'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<IconBase> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('title' in $$props) $$invalidate(0, title = $$props.title);
			if ('viewBox' in $$props) $$invalidate(1, viewBox = $$props.viewBox);
			if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => ({ title, viewBox });

		$$self.$inject_state = $$props => {
			if ('title' in $$props) $$invalidate(0, title = $$props.title);
			if ('viewBox' in $$props) $$invalidate(1, viewBox = $$props.viewBox);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [title, viewBox, $$scope, slots];
	}

	class IconBase extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$n, create_fragment$n, safe_not_equal, { title: 0, viewBox: 1 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "IconBase",
				options,
				id: create_fragment$n.name
			});
		}

		get title() {
			throw new Error("<IconBase>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<IconBase>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get viewBox() {
			throw new Error("<IconBase>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set viewBox(value) {
			throw new Error("<IconBase>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* node_modules/svelte-icons/io/IoLogoLinkedin.svelte generated by Svelte v4.2.20 */
	const file$m = "node_modules/svelte-icons/io/IoLogoLinkedin.svelte";

	// (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
	function create_default_slot$7(ctx) {
		let path;

		const block = {
			c: function create() {
				path = svg_element("path");
				attr_dev(path, "d", "M417.2 64H96.8C79.3 64 64 76.6 64 93.9V415c0 17.4 15.3 32.9 32.8 32.9h320.3c17.6 0 30.8-15.6 30.8-32.9V93.9C448 76.6 434.7 64 417.2 64zM183 384h-55V213h55v171zm-25.6-197h-.4c-17.6 0-29-13.1-29-29.5 0-16.7 11.7-29.5 29.7-29.5s29 12.7 29.4 29.5c0 16.4-11.4 29.5-29.7 29.5zM384 384h-55v-93.5c0-22.4-8-37.7-27.9-37.7-15.2 0-24.2 10.3-28.2 20.3-1.5 3.6-1.9 8.5-1.9 13.5V384h-55V213h55v23.8c8-11.4 20.5-27.8 49.6-27.8 36.1 0 63.4 23.8 63.4 75.1V384z");
				add_location(path, file$m, 4, 10, 153);
			},
			m: function mount(target, anchor) {
				insert_dev(target, path, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(path);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$7.name,
			type: "slot",
			source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
			ctx
		});

		return block;
	}

	function create_fragment$m(ctx) {
		let iconbase;
		let current;
		const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

		let iconbase_props = {
			$$slots: { default: [create_default_slot$7] },
			$$scope: { ctx }
		};

		for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
			iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
		}

		iconbase = new IconBase({ props: iconbase_props, $$inline: true });

		const block = {
			c: function create() {
				create_component(iconbase.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(iconbase, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const iconbase_changes = (dirty & /*$$props*/ 1)
				? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
				: {};

				if (dirty & /*$$scope*/ 2) {
					iconbase_changes.$$scope = { dirty, ctx };
				}

				iconbase.$set(iconbase_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(iconbase.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(iconbase.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(iconbase, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$m.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$m($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('IoLogoLinkedin', slots, []);

		$$self.$$set = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
		};

		$$self.$capture_state = () => ({ IconBase });

		$$self.$inject_state = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$props = exclude_internal_props($$props);
		return [$$props];
	}

	class IoLogoLinkedin extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$m, create_fragment$m, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "IoLogoLinkedin",
				options,
				id: create_fragment$m.name
			});
		}
	}

	/* node_modules/svelte-icons/io/IoLogoGithub.svelte generated by Svelte v4.2.20 */
	const file$l = "node_modules/svelte-icons/io/IoLogoGithub.svelte";

	// (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
	function create_default_slot$6(ctx) {
		let path;

		const block = {
			c: function create() {
				path = svg_element("path");
				attr_dev(path, "d", "M256 32C132.3 32 32 134.9 32 261.7c0 101.5 64.2 187.5 153.2 217.9 1.4.3 2.6.4 3.8.4 8.3 0 11.5-6.1 11.5-11.4 0-5.5-.2-19.9-.3-39.1-8.4 1.9-15.9 2.7-22.6 2.7-43.1 0-52.9-33.5-52.9-33.5-10.2-26.5-24.9-33.6-24.9-33.6-19.5-13.7-.1-14.1 1.4-14.1h.1c22.5 2 34.3 23.8 34.3 23.8 11.2 19.6 26.2 25.1 39.6 25.1 10.5 0 20-3.4 25.6-6 2-14.8 7.8-24.9 14.2-30.7-49.7-5.8-102-25.5-102-113.5 0-25.1 8.7-45.6 23-61.6-2.3-5.8-10-29.2 2.2-60.8 0 0 1.6-.5 5-.5 8.1 0 26.4 3.1 56.6 24.1 17.9-5.1 37-7.6 56.1-7.7 19 .1 38.2 2.6 56.1 7.7 30.2-21 48.5-24.1 56.6-24.1 3.4 0 5 .5 5 .5 12.2 31.6 4.5 55 2.2 60.8 14.3 16.1 23 36.6 23 61.6 0 88.2-52.4 107.6-102.3 113.3 8 7.1 15.2 21.1 15.2 42.5 0 30.7-.3 55.5-.3 63 0 5.4 3.1 11.5 11.4 11.5 1.2 0 2.6-.1 4-.4C415.9 449.2 480 363.1 480 261.7 480 134.9 379.7 32 256 32z");
				add_location(path, file$l, 4, 10, 153);
			},
			m: function mount(target, anchor) {
				insert_dev(target, path, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(path);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$6.name,
			type: "slot",
			source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
			ctx
		});

		return block;
	}

	function create_fragment$l(ctx) {
		let iconbase;
		let current;
		const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

		let iconbase_props = {
			$$slots: { default: [create_default_slot$6] },
			$$scope: { ctx }
		};

		for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
			iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
		}

		iconbase = new IconBase({ props: iconbase_props, $$inline: true });

		const block = {
			c: function create() {
				create_component(iconbase.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(iconbase, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const iconbase_changes = (dirty & /*$$props*/ 1)
				? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
				: {};

				if (dirty & /*$$scope*/ 2) {
					iconbase_changes.$$scope = { dirty, ctx };
				}

				iconbase.$set(iconbase_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(iconbase.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(iconbase.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(iconbase, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$l.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$l($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('IoLogoGithub', slots, []);

		$$self.$$set = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
		};

		$$self.$capture_state = () => ({ IconBase });

		$$self.$inject_state = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$props = exclude_internal_props($$props);
		return [$$props];
	}

	class IoLogoGithub extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$l, create_fragment$l, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "IoLogoGithub",
				options,
				id: create_fragment$l.name
			});
		}
	}

	/* node_modules/svelte-icons/io/IoLogoTwitter.svelte generated by Svelte v4.2.20 */
	const file$k = "node_modules/svelte-icons/io/IoLogoTwitter.svelte";

	// (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
	function create_default_slot$5(ctx) {
		let path;

		const block = {
			c: function create() {
				path = svg_element("path");
				attr_dev(path, "d", "M492 109.5c-17.4 7.7-36 12.9-55.6 15.3 20-12 35.4-31 42.6-53.6-18.7 11.1-39.4 19.2-61.5 23.5C399.8 75.8 374.6 64 346.8 64c-53.5 0-96.8 43.4-96.8 96.9 0 7.6.8 15 2.5 22.1-80.5-4-151.9-42.6-199.6-101.3-8.3 14.3-13.1 31-13.1 48.7 0 33.6 17.2 63.3 43.2 80.7-16-.4-31-4.8-44-12.1v1.2c0 47 33.4 86.1 77.7 95-8.1 2.2-16.7 3.4-25.5 3.4-6.2 0-12.3-.6-18.2-1.8 12.3 38.5 48.1 66.5 90.5 67.3-33.1 26-74.9 41.5-120.3 41.5-7.8 0-15.5-.5-23.1-1.4C62.8 432 113.7 448 168.3 448 346.6 448 444 300.3 444 172.2c0-4.2-.1-8.4-.3-12.5C462.6 146 479 129 492 109.5z");
				add_location(path, file$k, 4, 10, 153);
			},
			m: function mount(target, anchor) {
				insert_dev(target, path, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(path);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$5.name,
			type: "slot",
			source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
			ctx
		});

		return block;
	}

	function create_fragment$k(ctx) {
		let iconbase;
		let current;
		const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

		let iconbase_props = {
			$$slots: { default: [create_default_slot$5] },
			$$scope: { ctx }
		};

		for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
			iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
		}

		iconbase = new IconBase({ props: iconbase_props, $$inline: true });

		const block = {
			c: function create() {
				create_component(iconbase.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(iconbase, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const iconbase_changes = (dirty & /*$$props*/ 1)
				? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
				: {};

				if (dirty & /*$$scope*/ 2) {
					iconbase_changes.$$scope = { dirty, ctx };
				}

				iconbase.$set(iconbase_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(iconbase.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(iconbase.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(iconbase, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$k.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$k($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('IoLogoTwitter', slots, []);

		$$self.$$set = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
		};

		$$self.$capture_state = () => ({ IconBase });

		$$self.$inject_state = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$props = exclude_internal_props($$props);
		return [$$props];
	}

	class IoLogoTwitter extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$k, create_fragment$k, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "IoLogoTwitter",
				options,
				id: create_fragment$k.name
			});
		}
	}

	/* node_modules/svelte-icons/io/IoIosMail.svelte generated by Svelte v4.2.20 */
	const file$j = "node_modules/svelte-icons/io/IoIosMail.svelte";

	// (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
	function create_default_slot$4(ctx) {
		let path0;
		let t;
		let path1;

		const block = {
			c: function create() {
				path0 = svg_element("path");
				t = space();
				path1 = svg_element("path");
				attr_dev(path0, "d", "M460.6 147.3L353 256.9c-.8.8-.8 2 0 2.8l75.3 80.2c5.1 5.1 5.1 13.3 0 18.4-2.5 2.5-5.9 3.8-9.2 3.8s-6.7-1.3-9.2-3.8l-75-79.9c-.8-.8-2.1-.8-2.9 0L313.7 297c-15.3 15.5-35.6 24.1-57.4 24.2-22.1.1-43.1-9.2-58.6-24.9l-17.6-17.9c-.8-.8-2.1-.8-2.9 0l-75 79.9c-2.5 2.5-5.9 3.8-9.2 3.8s-6.7-1.3-9.2-3.8c-5.1-5.1-5.1-13.3 0-18.4l75.3-80.2c.7-.8.7-2 0-2.8L51.4 147.3c-1.3-1.3-3.4-.4-3.4 1.4V368c0 17.6 14.4 32 32 32h352c17.6 0 32-14.4 32-32V148.7c0-1.8-2.2-2.6-3.4-1.4z");
				add_location(path0, file$j, 4, 10, 153);
				attr_dev(path1, "d", "M256 295.1c14.8 0 28.7-5.8 39.1-16.4L452 119c-5.5-4.4-12.3-7-19.8-7H79.9c-7.5 0-14.4 2.6-19.8 7L217 278.7c10.3 10.5 24.2 16.4 39 16.4z");
				add_location(path1, file$j, 5, 0, 624);
			},
			m: function mount(target, anchor) {
				insert_dev(target, path0, anchor);
				insert_dev(target, t, anchor);
				insert_dev(target, path1, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(path0);
					detach_dev(t);
					detach_dev(path1);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$4.name,
			type: "slot",
			source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
			ctx
		});

		return block;
	}

	function create_fragment$j(ctx) {
		let iconbase;
		let current;
		const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

		let iconbase_props = {
			$$slots: { default: [create_default_slot$4] },
			$$scope: { ctx }
		};

		for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
			iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
		}

		iconbase = new IconBase({ props: iconbase_props, $$inline: true });

		const block = {
			c: function create() {
				create_component(iconbase.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(iconbase, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const iconbase_changes = (dirty & /*$$props*/ 1)
				? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
				: {};

				if (dirty & /*$$scope*/ 2) {
					iconbase_changes.$$scope = { dirty, ctx };
				}

				iconbase.$set(iconbase_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(iconbase.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(iconbase.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(iconbase, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$j.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$j($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('IoIosMail', slots, []);

		$$self.$$set = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
		};

		$$self.$capture_state = () => ({ IconBase });

		$$self.$inject_state = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$props = exclude_internal_props($$props);
		return [$$props];
	}

	class IoIosMail extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "IoIosMail",
				options,
				id: create_fragment$j.name
			});
		}
	}

	const t="http://www.w3.org/2000/svg";class e{constructor(t){this.seed=t;}next(){return this.seed?(2**31-1&(this.seed=Math.imul(48271,this.seed)))/2**31:Math.random()}}function s(t,e,s,i,n){return {type:"path",ops:c(t,e,s,i,n)}}function i(t,e,i){const n=(t||[]).length;if(n>2){const s=[];for(let e=0;e<n-1;e++)s.push(...c(t[e][0],t[e][1],t[e+1][0],t[e+1][1],i));return e&&s.push(...c(t[n-1][0],t[n-1][1],t[0][0],t[0][1],i)),{type:"path",ops:s}}return 2===n?s(t[0][0],t[0][1],t[1][0],t[1][1],i):{type:"path",ops:[]}}function n(t,e,s,n,o){return function(t,e){return i(t,!0,e)}([[t,e],[t+s,e],[t+s,e+n],[t,e+n]],o)}function o(t,e,s,i,n){return function(t,e,s,i){const[n,o]=l(i.increment,t,e,i.rx,i.ry,1,i.increment*h(.1,h(.4,1,s),s),s);let r=f(n,null,s);if(!s.disableMultiStroke){const[n]=l(i.increment,t,e,i.rx,i.ry,1.5,0,s),o=f(n,null,s);r=r.concat(o);}return {estimatedPoints:o,opset:{type:"path",ops:r}}}(t,e,n,function(t,e,s){const i=Math.sqrt(2*Math.PI*Math.sqrt((Math.pow(t/2,2)+Math.pow(e/2,2))/2)),n=Math.max(s.curveStepCount,s.curveStepCount/Math.sqrt(200)*i),o=2*Math.PI/n;let r=Math.abs(t/2),h=Math.abs(e/2);const c=1-s.curveFitting;return r+=a(r*c,s),h+=a(h*c,s),{increment:o,rx:r,ry:h}}(s,i,n)).opset}function r(t){return t.randomizer||(t.randomizer=new e(t.seed||0)),t.randomizer.next()}function h(t,e,s,i=1){return s.roughness*i*(r(s)*(e-t)+t)}function a(t,e,s=1){return h(-t,t,e,s)}function c(t,e,s,i,n,o=!1){const r=o?n.disableMultiStrokeFill:n.disableMultiStroke,h=u(t,e,s,i,n,!0,!1);if(r)return h;const a=u(t,e,s,i,n,!0,!0);return h.concat(a)}function u(t,e,s,i,n,o,h){const c=Math.pow(t-s,2)+Math.pow(e-i,2),u=Math.sqrt(c);let f=1;f=u<200?1:u>500?.4:-.0016668*u+1.233334;let l=n.maxRandomnessOffset||0;l*l*100>c&&(l=u/10);const g=l/2,d=.2+.2*r(n);let p=n.bowing*n.maxRandomnessOffset*(i-e)/200,_=n.bowing*n.maxRandomnessOffset*(t-s)/200;p=a(p,n,f),_=a(_,n,f);const m=[],w=()=>a(g,n,f),v=()=>a(l,n,f);return o&&(h?m.push({op:"move",data:[t+w(),e+w()]}):m.push({op:"move",data:[t+a(l,n,f),e+a(l,n,f)]})),h?m.push({op:"bcurveTo",data:[p+t+(s-t)*d+w(),_+e+(i-e)*d+w(),p+t+2*(s-t)*d+w(),_+e+2*(i-e)*d+w(),s+w(),i+w()]}):m.push({op:"bcurveTo",data:[p+t+(s-t)*d+v(),_+e+(i-e)*d+v(),p+t+2*(s-t)*d+v(),_+e+2*(i-e)*d+v(),s+v(),i+v()]}),m}function f(t,e,s){const i=t.length,n=[];if(i>3){const o=[],r=1-s.curveTightness;n.push({op:"move",data:[t[1][0],t[1][1]]});for(let e=1;e+2<i;e++){const s=t[e];o[0]=[s[0],s[1]],o[1]=[s[0]+(r*t[e+1][0]-r*t[e-1][0])/6,s[1]+(r*t[e+1][1]-r*t[e-1][1])/6],o[2]=[t[e+1][0]+(r*t[e][0]-r*t[e+2][0])/6,t[e+1][1]+(r*t[e][1]-r*t[e+2][1])/6],o[3]=[t[e+1][0],t[e+1][1]],n.push({op:"bcurveTo",data:[o[1][0],o[1][1],o[2][0],o[2][1],o[3][0],o[3][1]]});}if(e&&2===e.length){const t=s.maxRandomnessOffset;n.push({op:"lineTo",data:[e[0]+a(t,s),e[1]+a(t,s)]});}}else 3===i?(n.push({op:"move",data:[t[1][0],t[1][1]]}),n.push({op:"bcurveTo",data:[t[1][0],t[1][1],t[2][0],t[2][1],t[2][0],t[2][1]]})):2===i&&n.push(...c(t[0][0],t[0][1],t[1][0],t[1][1],s));return n}function l(t,e,s,i,n,o,r,h){const c=[],u=[],f=a(.5,h)-Math.PI/2;u.push([a(o,h)+e+.9*i*Math.cos(f-t),a(o,h)+s+.9*n*Math.sin(f-t)]);for(let r=f;r<2*Math.PI+f-.01;r+=t){const t=[a(o,h)+e+i*Math.cos(r),a(o,h)+s+n*Math.sin(r)];c.push(t),u.push(t);}return u.push([a(o,h)+e+i*Math.cos(f+2*Math.PI+.5*r),a(o,h)+s+n*Math.sin(f+2*Math.PI+.5*r)]),u.push([a(o,h)+e+.98*i*Math.cos(f+r),a(o,h)+s+.98*n*Math.sin(f+r)]),u.push([a(o,h)+e+.9*i*Math.cos(f+.5*r),a(o,h)+s+.9*n*Math.sin(f+.5*r)]),[u,c]}function g(t,e){return {maxRandomnessOffset:2,roughness:"highlight"===t?3:1.5,bowing:1,stroke:"#000",strokeWidth:1.5,curveTightness:0,curveFitting:.95,curveStepCount:9,fillStyle:"hachure",fillWeight:-1,hachureAngle:-41,hachureGap:-1,dashOffset:-1,dashGap:-1,zigzagOffset:-1,combineNestedSvgPaths:!1,disableMultiStroke:"double"!==t,disableMultiStrokeFill:!1,seed:e}}function d(e,r,h,a,c,u){const f=[];let l=h.strokeWidth||2;const d=function(t){const e=t.padding;if(e||0===e){if("number"==typeof e)return [e,e,e,e];if(Array.isArray(e)){const t=e;if(t.length)switch(t.length){case 4:return [...t];case 1:return [t[0],t[0],t[0],t[0]];case 2:return [...t,...t];case 3:return [...t,t[1]];default:return [t[0],t[1],t[2],t[3]]}}}return [5,5,5,5]}(h),p=void 0===h.animate||!!h.animate,_=h.iterations||2,m=g("single",u);switch(h.type){case"underline":{const t=r.y+r.h+d[2];for(let e=0;e<_;e++)e%2?f.push(s(r.x+r.w,t,r.x,t,m)):f.push(s(r.x,t,r.x+r.w,t,m));break}case"strike-through":{const t=r.y+r.h/2;for(let e=0;e<_;e++)e%2?f.push(s(r.x+r.w,t,r.x,t,m)):f.push(s(r.x,t,r.x+r.w,t,m));break}case"box":{const t=r.x-d[3],e=r.y-d[0],s=r.w+(d[1]+d[3]),i=r.h+(d[0]+d[2]);for(let o=0;o<_;o++)f.push(n(t,e,s,i,m));break}case"bracket":{const t=Array.isArray(h.brackets)?h.brackets:h.brackets?[h.brackets]:["right"],e=r.x-2*d[3],s=r.x+r.w+2*d[1],n=r.y-2*d[0],o=r.y+r.h+2*d[2];for(const h of t){let t;switch(h){case"bottom":t=[[e,r.y+r.h],[e,o],[s,o],[s,r.y+r.h]];break;case"top":t=[[e,r.y],[e,n],[s,n],[s,r.y]];break;case"left":t=[[r.x,n],[e,n],[e,o],[r.x,o]];break;case"right":t=[[r.x+r.w,n],[s,n],[s,o],[r.x+r.w,o]];}t&&f.push(i(t,!1,m));}break}case"crossed-off":{const t=r.x,e=r.y,i=t+r.w,n=e+r.h;for(let o=0;o<_;o++)o%2?f.push(s(i,n,t,e,m)):f.push(s(t,e,i,n,m));for(let o=0;o<_;o++)o%2?f.push(s(t,n,i,e,m)):f.push(s(i,e,t,n,m));break}case"circle":{const t=g("double",u),e=r.w+(d[1]+d[3]),s=r.h+(d[0]+d[2]),i=r.x-d[3]+e/2,n=r.y-d[0]+s/2,h=Math.floor(_/2),a=_-2*h;for(let r=0;r<h;r++)f.push(o(i,n,e,s,t));for(let t=0;t<a;t++)f.push(o(i,n,e,s,m));break}case"highlight":{const t=g("highlight",u);l=.95*r.h;const e=r.y+r.h/2;for(let i=0;i<_;i++)i%2?f.push(s(r.x+r.w,e,r.x,e,t)):f.push(s(r.x,e,r.x+r.w,e,t));break}}if(f.length){const s=function(t){const e=[];for(const s of t){let t="";for(const i of s.ops){const s=i.data;switch(i.op){case"move":t.trim()&&e.push(t.trim()),t=`M${s[0]} ${s[1]} `;break;case"bcurveTo":t+=`C${s[0]} ${s[1]}, ${s[2]} ${s[3]}, ${s[4]} ${s[5]} `;break;case"lineTo":t+=`L${s[0]} ${s[1]} `;}}t.trim()&&e.push(t.trim());}return e}(f),i=[],n=[];let o=0;const r=(t,e,s)=>t.setAttribute(e,s);for(const a of s){const s=document.createElementNS(t,"path");if(r(s,"d",a),r(s,"fill","none"),r(s,"stroke",h.color||"currentColor"),r(s,"stroke-width",""+l),p){const t=s.getTotalLength();i.push(t),o+=t;}e.appendChild(s),n.push(s);}if(p){let t=0;for(let e=0;e<n.length;e++){const s=n[e],r=i[e],h=o?c*(r/o):0,u=a+t,f=s.style;f.strokeDashoffset=""+r,f.strokeDasharray=""+r,f.animation=`rough-notation-dash ${h}ms ease-out ${u}ms forwards`,t+=h;}}}}class p{constructor(t,e){this._state="unattached",this._resizing=!1,this._seed=Math.floor(Math.random()*2**31),this._lastSizes=[],this._animationDelay=0,this._resizeListener=()=>{this._resizing||(this._resizing=!0,setTimeout(()=>{this._resizing=!1,"showing"===this._state&&this.haveRectsChanged()&&this.show();},400));},this._e=t,this._config=JSON.parse(JSON.stringify(e)),this.attach();}get animate(){return this._config.animate}set animate(t){this._config.animate=t;}get animationDuration(){return this._config.animationDuration}set animationDuration(t){this._config.animationDuration=t;}get iterations(){return this._config.iterations}set iterations(t){this._config.iterations=t;}get color(){return this._config.color}set color(t){this._config.color!==t&&(this._config.color=t,this.refresh());}get strokeWidth(){return this._config.strokeWidth}set strokeWidth(t){this._config.strokeWidth!==t&&(this._config.strokeWidth=t,this.refresh());}get padding(){return this._config.padding}set padding(t){this._config.padding!==t&&(this._config.padding=t,this.refresh());}attach(){if("unattached"===this._state&&this._e.parentElement){!function(){if(!window.__rno_kf_s){const t=window.__rno_kf_s=document.createElement("style");t.textContent="@keyframes rough-notation-dash { to { stroke-dashoffset: 0; } }",document.head.appendChild(t);}}();const e=this._svg=document.createElementNS(t,"svg");e.setAttribute("class","rough-annotation");const s=e.style;s.position="absolute",s.top="0",s.left="0",s.overflow="visible",s.pointerEvents="none",s.width="100px",s.height="100px";const i="highlight"===this._config.type;if(this._e.insertAdjacentElement(i?"beforebegin":"afterend",e),this._state="not-showing",i){const t=window.getComputedStyle(this._e).position;(!t||"static"===t)&&(this._e.style.position="relative");}this.attachListeners();}}detachListeners(){window.removeEventListener("resize",this._resizeListener),this._ro&&this._ro.unobserve(this._e);}attachListeners(){this.detachListeners(),window.addEventListener("resize",this._resizeListener,{passive:!0}),!this._ro&&"ResizeObserver"in window&&(this._ro=new window.ResizeObserver(t=>{for(const e of t)e.contentRect&&this._resizeListener();})),this._ro&&this._ro.observe(this._e);}haveRectsChanged(){if(this._lastSizes.length){const t=this.rects();if(t.length!==this._lastSizes.length)return !0;for(let e=0;e<t.length;e++)if(!this.isSameRect(t[e],this._lastSizes[e]))return !0}return !1}isSameRect(t,e){const s=(t,e)=>Math.round(t)===Math.round(e);return s(t.x,e.x)&&s(t.y,e.y)&&s(t.w,e.w)&&s(t.h,e.h)}isShowing(){return "not-showing"!==this._state}refresh(){this.isShowing()&&!this.pendingRefresh&&(this.pendingRefresh=Promise.resolve().then(()=>{this.isShowing()&&this.show(),delete this.pendingRefresh;}));}show(){switch(this._state){case"unattached":break;case"showing":this.hide(),this._svg&&this.render(this._svg,!0);break;case"not-showing":this.attach(),this._svg&&this.render(this._svg,!1);}}hide(){if(this._svg)for(;this._svg.lastChild;)this._svg.removeChild(this._svg.lastChild);this._state="not-showing";}remove(){this._svg&&this._svg.parentElement&&this._svg.parentElement.removeChild(this._svg),this._svg=void 0,this._state="unattached",this.detachListeners();}render(t,e){let s=this._config;e&&(s=JSON.parse(JSON.stringify(this._config)),s.animate=!1);const i=this.rects();let n=0;i.forEach(t=>n+=t.w);const o=s.animationDuration||800;let r=0;for(let e=0;e<i.length;e++){const h=o*(i[e].w/n);d(t,i[e],s,r+this._animationDelay,h,this._seed),r+=h;}this._lastSizes=i,this._state="showing";}rects(){const t=[];if(this._svg)if(this._config.multiline){const e=this._e.getClientRects();for(let s=0;s<e.length;s++)t.push(this.svgRect(this._svg,e[s]));}else t.push(this.svgRect(this._svg,this._e.getBoundingClientRect()));return t}svgRect(t,e){const s=t.getBoundingClientRect(),i=e;return {x:(i.x||i.left)-(s.x||s.left),y:(i.y||i.top)-(s.y||s.top),w:i.width,h:i.height}}}function _(t,e){return new p(t,e)}

	var svelte = /*#__PURE__*/Object.freeze({
		__proto__: null,
		SvelteComponent: SvelteComponentDev,
		onMount: onMount,
		onDestroy: onDestroy,
		beforeUpdate: beforeUpdate,
		afterUpdate: afterUpdate,
		setContext: setContext,
		getContext: getContext,
		getAllContexts: getAllContexts,
		hasContext: hasContext,
		tick: tick,
		createEventDispatcher: createEventDispatcher,
		SvelteComponentTyped: SvelteComponentTyped
	});

	/* node_modules/svelte-rough-notation/src/RoughNotation.svelte generated by Svelte v4.2.20 */
	const file$i = "node_modules/svelte-rough-notation/src/RoughNotation.svelte";

	function create_fragment$i(ctx) {
		let div;
		let current;
		const default_slot_template = /*#slots*/ ctx[18].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[17], null);

		const block = {
			c: function create() {
				div = element("div");
				if (default_slot) default_slot.c();
				set_style(div, "display", "inline");
				add_location(div, file$i, 98, 0, 2579);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);

				if (default_slot) {
					default_slot.m(div, null);
				}

				/*div_binding*/ ctx[19](div);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 131072)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[17],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[17])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[17], dirty, null),
							null
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				if (default_slot) default_slot.d(detaching);
				/*div_binding*/ ctx[19](null);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$i.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$i($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"visible","animate","animationDuration","animationDelay","color","strokeWidth","padding","iterations","multiline","brackets","_animationGroupDelay","_animationDelay","show","hide","isShowing","annotation"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('RoughNotation', slots, ['default']);
		let container;
		let { visible = false } = $$props;
		let { animate = undefined } = $$props;
		let { animationDuration = undefined } = $$props;
		let { animationDelay = undefined } = $$props;
		let { color = undefined } = $$props;
		let { strokeWidth = undefined } = $$props;
		let { padding = undefined } = $$props;
		let { iterations = undefined } = $$props;
		let { multiline = undefined } = $$props;
		let { brackets = undefined } = $$props;
		let { _animationGroupDelay = undefined } = $$props;
		let { _animationDelay = undefined } = $$props;
		const show = () => $$invalidate(1, visible = true);
		const hide = () => $$invalidate(1, visible = false);
		const isShowing = () => visible;
		let { annotation = undefined } = $$props;

		onMount(() => {
			$$invalidate(2, annotation = _(container, {
				animate,
				animationDuration,
				animationDelay,
				color,
				strokeWidth,
				padding,
				iterations,
				multiline,
				brackets,
				// Graceful fallback for if new props are added
				...$$restProps
			}));

			return () => annotation.remove();
		});

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				container = $$value;
				$$invalidate(0, container);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(20, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('visible' in $$new_props) $$invalidate(1, visible = $$new_props.visible);
			if ('animate' in $$new_props) $$invalidate(3, animate = $$new_props.animate);
			if ('animationDuration' in $$new_props) $$invalidate(4, animationDuration = $$new_props.animationDuration);
			if ('animationDelay' in $$new_props) $$invalidate(5, animationDelay = $$new_props.animationDelay);
			if ('color' in $$new_props) $$invalidate(6, color = $$new_props.color);
			if ('strokeWidth' in $$new_props) $$invalidate(7, strokeWidth = $$new_props.strokeWidth);
			if ('padding' in $$new_props) $$invalidate(8, padding = $$new_props.padding);
			if ('iterations' in $$new_props) $$invalidate(9, iterations = $$new_props.iterations);
			if ('multiline' in $$new_props) $$invalidate(10, multiline = $$new_props.multiline);
			if ('brackets' in $$new_props) $$invalidate(11, brackets = $$new_props.brackets);
			if ('_animationGroupDelay' in $$new_props) $$invalidate(12, _animationGroupDelay = $$new_props._animationGroupDelay);
			if ('_animationDelay' in $$new_props) $$invalidate(13, _animationDelay = $$new_props._animationDelay);
			if ('annotation' in $$new_props) $$invalidate(2, annotation = $$new_props.annotation);
			if ('$$scope' in $$new_props) $$invalidate(17, $$scope = $$new_props.$$scope);
		};

		$$self.$capture_state = () => ({
			annotate: _,
			onMount,
			container,
			visible,
			animate,
			animationDuration,
			animationDelay,
			color,
			strokeWidth,
			padding,
			iterations,
			multiline,
			brackets,
			_animationGroupDelay,
			_animationDelay,
			show,
			hide,
			isShowing,
			annotation
		});

		$$self.$inject_state = $$new_props => {
			if ('container' in $$props) $$invalidate(0, container = $$new_props.container);
			if ('visible' in $$props) $$invalidate(1, visible = $$new_props.visible);
			if ('animate' in $$props) $$invalidate(3, animate = $$new_props.animate);
			if ('animationDuration' in $$props) $$invalidate(4, animationDuration = $$new_props.animationDuration);
			if ('animationDelay' in $$props) $$invalidate(5, animationDelay = $$new_props.animationDelay);
			if ('color' in $$props) $$invalidate(6, color = $$new_props.color);
			if ('strokeWidth' in $$props) $$invalidate(7, strokeWidth = $$new_props.strokeWidth);
			if ('padding' in $$props) $$invalidate(8, padding = $$new_props.padding);
			if ('iterations' in $$props) $$invalidate(9, iterations = $$new_props.iterations);
			if ('multiline' in $$props) $$invalidate(10, multiline = $$new_props.multiline);
			if ('brackets' in $$props) $$invalidate(11, brackets = $$new_props.brackets);
			if ('_animationGroupDelay' in $$props) $$invalidate(12, _animationGroupDelay = $$new_props._animationGroupDelay);
			if ('_animationDelay' in $$props) $$invalidate(13, _animationDelay = $$new_props._animationDelay);
			if ('annotation' in $$props) $$invalidate(2, annotation = $$new_props.annotation);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*annotation, animate*/ 12) {
				if (annotation && animate !== undefined) {
					$$invalidate(2, annotation.animate = animate, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, animationDuration*/ 20) {
				if (annotation && animationDuration !== undefined) {
					$$invalidate(2, annotation.animationDuration = animationDuration, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, animationDelay*/ 36) {
				if (annotation && animationDelay !== undefined) {
					$$invalidate(2, annotation.animationDelay = animationDelay, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, color*/ 68) {
				if (annotation && color !== undefined) {
					$$invalidate(2, annotation.color = color, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, strokeWidth*/ 132) {
				if (annotation && strokeWidth !== undefined) {
					$$invalidate(2, annotation.strokeWidth = strokeWidth, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, padding*/ 260) {
				if (annotation && padding !== undefined) {
					$$invalidate(2, annotation.padding = padding, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, iterations*/ 516) {
				if (annotation && iterations !== undefined) {
					$$invalidate(2, annotation.iterations = iterations, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, brackets*/ 2052) {
				if (annotation && brackets !== undefined) {
					$$invalidate(2, annotation.brackets = brackets, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, _animationGroupDelay*/ 4100) {
				if (annotation && _animationGroupDelay !== undefined) {
					$$invalidate(2, annotation._animationGroupDelay = _animationGroupDelay, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, _animationDelay*/ 8196) {
				if (annotation && _animationDelay !== undefined) {
					$$invalidate(2, annotation._animationDelay = _animationDelay, annotation);
				}
			}

			if ($$self.$$.dirty & /*annotation, visible*/ 6) {
				if (annotation) {
					if (visible) {
						annotation.show();
					} else {
						annotation.hide();
					}
				}
			}
		};

		return [
			container,
			visible,
			annotation,
			animate,
			animationDuration,
			animationDelay,
			color,
			strokeWidth,
			padding,
			iterations,
			multiline,
			brackets,
			_animationGroupDelay,
			_animationDelay,
			show,
			hide,
			isShowing,
			$$scope,
			slots,
			div_binding
		];
	}

	class RoughNotation extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$i, create_fragment$i, safe_not_equal, {
				visible: 1,
				animate: 3,
				animationDuration: 4,
				animationDelay: 5,
				color: 6,
				strokeWidth: 7,
				padding: 8,
				iterations: 9,
				multiline: 10,
				brackets: 11,
				_animationGroupDelay: 12,
				_animationDelay: 13,
				show: 14,
				hide: 15,
				isShowing: 16,
				annotation: 2
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "RoughNotation",
				options,
				id: create_fragment$i.name
			});
		}

		get visible() {
			return this.$$.ctx[1];
		}

		set visible(visible) {
			this.$$set({ visible });
			flush();
		}

		get animate() {
			return this.$$.ctx[3];
		}

		set animate(animate) {
			this.$$set({ animate });
			flush();
		}

		get animationDuration() {
			return this.$$.ctx[4];
		}

		set animationDuration(animationDuration) {
			this.$$set({ animationDuration });
			flush();
		}

		get animationDelay() {
			return this.$$.ctx[5];
		}

		set animationDelay(animationDelay) {
			this.$$set({ animationDelay });
			flush();
		}

		get color() {
			return this.$$.ctx[6];
		}

		set color(color) {
			this.$$set({ color });
			flush();
		}

		get strokeWidth() {
			return this.$$.ctx[7];
		}

		set strokeWidth(strokeWidth) {
			this.$$set({ strokeWidth });
			flush();
		}

		get padding() {
			return this.$$.ctx[8];
		}

		set padding(padding) {
			this.$$set({ padding });
			flush();
		}

		get iterations() {
			return this.$$.ctx[9];
		}

		set iterations(iterations) {
			this.$$set({ iterations });
			flush();
		}

		get multiline() {
			return this.$$.ctx[10];
		}

		set multiline(multiline) {
			this.$$set({ multiline });
			flush();
		}

		get brackets() {
			return this.$$.ctx[11];
		}

		set brackets(brackets) {
			this.$$set({ brackets });
			flush();
		}

		get _animationGroupDelay() {
			return this.$$.ctx[12];
		}

		set _animationGroupDelay(_animationGroupDelay) {
			this.$$set({ _animationGroupDelay });
			flush();
		}

		get _animationDelay() {
			return this.$$.ctx[13];
		}

		set _animationDelay(_animationDelay) {
			this.$$set({ _animationDelay });
			flush();
		}

		get show() {
			return this.$$.ctx[14];
		}

		set show(value) {
			throw new Error("<RoughNotation>: Cannot set read-only property 'show'");
		}

		get hide() {
			return this.$$.ctx[15];
		}

		set hide(value) {
			throw new Error("<RoughNotation>: Cannot set read-only property 'hide'");
		}

		get isShowing() {
			return this.$$.ctx[16];
		}

		set isShowing(value) {
			throw new Error("<RoughNotation>: Cannot set read-only property 'isShowing'");
		}

		get annotation() {
			return this.$$.ctx[2];
		}

		set annotation(annotation) {
			this.$$set({ annotation });
			flush();
		}
	}

	/* src/components/Profile.svelte generated by Svelte v4.2.20 */
	const file$h = "src/components/Profile.svelte";

	// (19:4) <Annotation bind:visible type="highlight" color="var(--intro-highlight-colour)">
	function create_default_slot$3(ctx) {
		let t;

		const block = {
			c: function create() {
				t = text("Max Eisen");
			},
			m: function mount(target, anchor) {
				insert_dev(target, t, anchor);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$3.name,
			type: "slot",
			source: "(19:4) <Annotation bind:visible type=\\\"highlight\\\" color=\\\"var(--intro-highlight-colour)\\\">",
			ctx
		});

		return block;
	}

	function create_fragment$h(ctx) {
		let h1;
		let annotation;
		let updating_visible;
		let t0;
		let h20;
		let t1;
		let b;
		let t3;
		let t4;
		let h21;
		let t6;
		let div0;
		let a0;
		let linkedinlogo;
		let t7;
		let a1;
		let githublogo;
		let t8;
		let a2;
		let twitterlogo;
		let t9;
		let a3;
		let mailicon;
		let t10;
		let div1;
		let picture;
		let source0;
		let source0_srcset_value;
		let t11;
		let source1;
		let source1_srcset_value;
		let t12;
		let img;
		let img_src_value;
		let current;

		function annotation_visible_binding(value) {
			/*annotation_visible_binding*/ ctx[2](value);
		}

		let annotation_props = {
			type: "highlight",
			color: "var(--intro-highlight-colour)",
			$$slots: { default: [create_default_slot$3] },
			$$scope: { ctx }
		};

		if (/*visible*/ ctx[0] !== void 0) {
			annotation_props.visible = /*visible*/ ctx[0];
		}

		annotation = new RoughNotation({ props: annotation_props, $$inline: true });
		binding_callbacks.push(() => bind$1(annotation, 'visible', annotation_visible_binding));
		linkedinlogo = new IoLogoLinkedin({ $$inline: true });
		githublogo = new IoLogoGithub({ $$inline: true });
		twitterlogo = new IoLogoTwitter({ $$inline: true });
		mailicon = new IoIosMail({ $$inline: true });

		const block = {
			c: function create() {
				h1 = element("h1");
				create_component(annotation.$$.fragment);
				t0 = space();
				h20 = element("h2");
				t1 = text("SDE ");
				b = element("b");
				b.textContent = "@";
				t3 = text(" Amazon");
				t4 = space();
				h21 = element("h2");
				h21.textContent = "Toronto, ON";
				t6 = space();
				div0 = element("div");
				a0 = element("a");
				create_component(linkedinlogo.$$.fragment);
				t7 = space();
				a1 = element("a");
				create_component(githublogo.$$.fragment);
				t8 = space();
				a2 = element("a");
				create_component(twitterlogo.$$.fragment);
				t9 = space();
				a3 = element("a");
				create_component(mailicon.$$.fragment);
				t10 = space();
				div1 = element("div");
				picture = element("picture");
				source0 = element("source");
				t11 = space();
				source1 = element("source");
				t12 = space();
				img = element("img");
				add_location(h1, file$h, 18, 0, 560);
				set_style(b, "color", "var(--paragraph-colour)");
				set_style(b, "font-weight", "300");
				add_location(b, file$h, 19, 23, 695);
				attr_dev(h20, "class", "status svelte-t07b25");
				add_location(h20, file$h, 19, 0, 672);
				attr_dev(h21, "class", "location svelte-t07b25");
				add_location(h21, file$h, 20, 0, 773);
				attr_dev(a0, "class", "social-link linkedin-link svelte-t07b25");
				attr_dev(a0, "aria-label", "LinkedIn");
				attr_dev(a0, "href", "https://linkedin.com/in/maxeisen/");
				attr_dev(a0, "rel", "noreferrer");
				attr_dev(a0, "target", "_blank");
				add_location(a0, file$h, 22, 4, 852);
				attr_dev(a1, "class", "social-link github-link svelte-t07b25");
				attr_dev(a1, "aria-label", "GitHub");
				attr_dev(a1, "href", "https://github.com/maxeisen/");
				attr_dev(a1, "rel", "noreferrer");
				attr_dev(a1, "target", "_blank");
				add_location(a1, file$h, 23, 4, 1010);
				attr_dev(a2, "class", "social-link twitter-link svelte-t07b25");
				attr_dev(a2, "aria-label", "Twitter");
				attr_dev(a2, "href", "https://twitter.com/maxeisen/");
				attr_dev(a2, "rel", "noreferrer");
				attr_dev(a2, "target", "_blank");
				add_location(a2, file$h, 24, 4, 1157);
				attr_dev(a3, "class", "social-link svelte-t07b25");
				attr_dev(a3, "aria-label", "Email");
				attr_dev(a3, "href", "mailto:profile@maxeisen.me");
				attr_dev(a3, "rel", "noreferrer");
				attr_dev(a3, "target", "_blank");
				add_location(a3, file$h, 25, 4, 1308);
				attr_dev(div0, "class", "social-links-container svelte-t07b25");
				add_location(div0, file$h, 21, 0, 811);
				attr_dev(source0, "class", "headshot svelte-t07b25");
				if (!srcset_url_equal(source0, source0_srcset_value = `${/*headshotPath*/ ctx[1]}.webp`)) attr_dev(source0, "srcset", source0_srcset_value);
				attr_dev(source0, "type", "image/webp");
				add_location(source0, file$h, 30, 8, 1487);
				attr_dev(source1, "class", "headshot svelte-t07b25");
				if (!srcset_url_equal(source1, source1_srcset_value = `${/*headshotPath*/ ctx[1]}.png`)) attr_dev(source1, "srcset", source1_srcset_value);
				attr_dev(source1, "type", "image/png");
				add_location(source1, file$h, 31, 8, 1571);
				attr_dev(img, "class", "headshot svelte-t07b25");
				attr_dev(img, "id", "headshot");
				attr_dev(img, "width", "200px");
				attr_dev(img, "height", "200px");
				if (!src_url_equal(img.src, img_src_value = `${/*headshotPath*/ ctx[1]}.webp`)) attr_dev(img, "src", img_src_value);
				attr_dev(img, "alt", "Current headshot");
				add_location(img, file$h, 32, 8, 1653);
				add_location(picture, file$h, 29, 4, 1469);
				attr_dev(div1, "class", "headshot svelte-t07b25");
				add_location(div1, file$h, 28, 0, 1442);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, h1, anchor);
				mount_component(annotation, h1, null);
				insert_dev(target, t0, anchor);
				insert_dev(target, h20, anchor);
				append_dev(h20, t1);
				append_dev(h20, b);
				append_dev(h20, t3);
				insert_dev(target, t4, anchor);
				insert_dev(target, h21, anchor);
				insert_dev(target, t6, anchor);
				insert_dev(target, div0, anchor);
				append_dev(div0, a0);
				mount_component(linkedinlogo, a0, null);
				append_dev(div0, t7);
				append_dev(div0, a1);
				mount_component(githublogo, a1, null);
				append_dev(div0, t8);
				append_dev(div0, a2);
				mount_component(twitterlogo, a2, null);
				append_dev(div0, t9);
				append_dev(div0, a3);
				mount_component(mailicon, a3, null);
				insert_dev(target, t10, anchor);
				insert_dev(target, div1, anchor);
				append_dev(div1, picture);
				append_dev(picture, source0);
				append_dev(picture, t11);
				append_dev(picture, source1);
				append_dev(picture, t12);
				append_dev(picture, img);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const annotation_changes = {};

				if (dirty & /*$$scope*/ 8) {
					annotation_changes.$$scope = { dirty, ctx };
				}

				if (!updating_visible && dirty & /*visible*/ 1) {
					updating_visible = true;
					annotation_changes.visible = /*visible*/ ctx[0];
					add_flush_callback(() => updating_visible = false);
				}

				annotation.$set(annotation_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(annotation.$$.fragment, local);
				transition_in(linkedinlogo.$$.fragment, local);
				transition_in(githublogo.$$.fragment, local);
				transition_in(twitterlogo.$$.fragment, local);
				transition_in(mailicon.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(annotation.$$.fragment, local);
				transition_out(linkedinlogo.$$.fragment, local);
				transition_out(githublogo.$$.fragment, local);
				transition_out(twitterlogo.$$.fragment, local);
				transition_out(mailicon.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h1);
					detach_dev(t0);
					detach_dev(h20);
					detach_dev(t4);
					detach_dev(h21);
					detach_dev(t6);
					detach_dev(div0);
					detach_dev(t10);
					detach_dev(div1);
				}

				destroy_component(annotation);
				destroy_component(linkedinlogo);
				destroy_component(githublogo);
				destroy_component(twitterlogo);
				destroy_component(mailicon);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$h.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$h($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Profile', slots, []);
		let headshotPath = './img/headshots/clean_headshot';
		let visible = false;

		onMount(() => {
			setTimeout(
				() => {
					$$invalidate(0, visible = true);
				},
				1000
			);
		});

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Profile> was created with unknown prop '${key}'`);
		});

		function annotation_visible_binding(value) {
			visible = value;
			$$invalidate(0, visible);
		}

		$$self.$capture_state = () => ({
			headshotPath,
			LinkedInLogo: IoLogoLinkedin,
			GitHubLogo: IoLogoGithub,
			TwitterLogo: IoLogoTwitter,
			MailIcon: IoIosMail,
			Annotation: RoughNotation,
			onMount,
			visible
		});

		$$self.$inject_state = $$props => {
			if ('headshotPath' in $$props) $$invalidate(1, headshotPath = $$props.headshotPath);
			if ('visible' in $$props) $$invalidate(0, visible = $$props.visible);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [visible, headshotPath, annotation_visible_binding];
	}

	class Profile extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$h, create_fragment$h, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Profile",
				options,
				id: create_fragment$h.name
			});
		}
	}

	/* src/components/modals/ActivityModal.svelte generated by Svelte v4.2.20 */
	const file$g = "src/components/modals/ActivityModal.svelte";

	// (9:4) {#if image}
	function create_if_block_2$1(ctx) {
		let picture;
		let source0;
		let source0_srcset_value;
		let t0;
		let source1;
		let source1_srcset_value;
		let t1;
		let img;
		let img_src_value;

		const block = {
			c: function create() {
				picture = element("picture");
				source0 = element("source");
				t0 = space();
				source1 = element("source");
				t1 = space();
				img = element("img");
				if (!srcset_url_equal(source0, source0_srcset_value = `./img/activities/${/*image*/ ctx[0]}.webp`)) attr_dev(source0, "srcset", source0_srcset_value);
				attr_dev(source0, "type", "image/webp");
				add_location(source0, file$g, 10, 12, 189);
				if (!srcset_url_equal(source1, source1_srcset_value = `./img/activities/${/*image*/ ctx[0]}.jpg`)) attr_dev(source1, "srcset", source1_srcset_value);
				attr_dev(source1, "type", "image/jpeg");
				add_location(source1, file$g, 11, 12, 270);
				attr_dev(img, "class", "activity-image svelte-1aisj69");
				if (!src_url_equal(img.src, img_src_value = `./img/activities/${/*image*/ ctx[0]}.jpg`)) attr_dev(img, "src", img_src_value);
				attr_dev(img, "alt", /*description*/ ctx[3]);
				add_location(img, file$g, 12, 12, 351);
				add_location(picture, file$g, 9, 8, 167);
			},
			m: function mount(target, anchor) {
				insert_dev(target, picture, anchor);
				append_dev(picture, source0);
				append_dev(picture, t0);
				append_dev(picture, source1);
				append_dev(picture, t1);
				append_dev(picture, img);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*image*/ 1 && source0_srcset_value !== (source0_srcset_value = `./img/activities/${/*image*/ ctx[0]}.webp`)) {
					attr_dev(source0, "srcset", source0_srcset_value);
				}

				if (dirty & /*image*/ 1 && source1_srcset_value !== (source1_srcset_value = `./img/activities/${/*image*/ ctx[0]}.jpg`)) {
					attr_dev(source1, "srcset", source1_srcset_value);
				}

				if (dirty & /*image*/ 1 && !src_url_equal(img.src, img_src_value = `./img/activities/${/*image*/ ctx[0]}.jpg`)) {
					attr_dev(img, "src", img_src_value);
				}

				if (dirty & /*description*/ 8) {
					attr_dev(img, "alt", /*description*/ ctx[3]);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(picture);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_2$1.name,
			type: "if",
			source: "(9:4) {#if image}",
			ctx
		});

		return block;
	}

	// (16:4) {#if audio}
	function create_if_block_1$4(ctx) {
		let audio_1;
		let source;
		let source_src_value;
		let track;
		let t;

		const block = {
			c: function create() {
				audio_1 = element("audio");
				source = element("source");
				track = element("track");
				t = text("\n            Your browser does not support the audio element.");
				if (!src_url_equal(source.src, source_src_value = /*audio*/ ctx[1])) attr_dev(source, "src", source_src_value);
				attr_dev(source, "type", "audio/mpeg");
				add_location(source, file$g, 17, 12, 541);
				attr_dev(track, "kind", "captions");
				add_location(track, file$g, 18, 12, 592);
				attr_dev(audio_1, "class", "activity-audio svelte-1aisj69");
				audio_1.controls = true;
				add_location(audio_1, file$g, 16, 8, 489);
			},
			m: function mount(target, anchor) {
				insert_dev(target, audio_1, anchor);
				append_dev(audio_1, source);
				append_dev(audio_1, track);
				append_dev(audio_1, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*audio*/ 2 && !src_url_equal(source.src, source_src_value = /*audio*/ ctx[1])) {
					attr_dev(source, "src", source_src_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(audio_1);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$4.name,
			type: "if",
			source: "(16:4) {#if audio}",
			ctx
		});

		return block;
	}

	// (23:4) {#if video}
	function create_if_block$7(ctx) {
		let iframe;
		let iframe_src_value;

		const block = {
			c: function create() {
				iframe = element("iframe");
				attr_dev(iframe, "width", "100%");
				attr_dev(iframe, "height", "315");
				if (!src_url_equal(iframe.src, iframe_src_value = "" + (/*video*/ ctx[2] + "hd=1&autoplay=0&modestbranding=1&showinfo=0&rel=0"))) attr_dev(iframe, "src", iframe_src_value);
				attr_dev(iframe, "title", /*description*/ ctx[3]);
				attr_dev(iframe, "frameborder", "0");
				attr_dev(iframe, "allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
				iframe.allowFullscreen = true;
				add_location(iframe, file$g, 23, 8, 728);
			},
			m: function mount(target, anchor) {
				insert_dev(target, iframe, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*video*/ 4 && !src_url_equal(iframe.src, iframe_src_value = "" + (/*video*/ ctx[2] + "hd=1&autoplay=0&modestbranding=1&showinfo=0&rel=0"))) {
					attr_dev(iframe, "src", iframe_src_value);
				}

				if (dirty & /*description*/ 8) {
					attr_dev(iframe, "title", /*description*/ ctx[3]);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(iframe);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$7.name,
			type: "if",
			source: "(23:4) {#if video}",
			ctx
		});

		return block;
	}

	function create_fragment$g(ctx) {
		let div;
		let t0;
		let t1;
		let t2;
		let h3;
		let if_block0 = /*image*/ ctx[0] && create_if_block_2$1(ctx);
		let if_block1 = /*audio*/ ctx[1] && create_if_block_1$4(ctx);
		let if_block2 = /*video*/ ctx[2] && create_if_block$7(ctx);

		const block = {
			c: function create() {
				div = element("div");
				if (if_block0) if_block0.c();
				t0 = space();
				if (if_block1) if_block1.c();
				t1 = space();
				if (if_block2) if_block2.c();
				t2 = space();
				h3 = element("h3");
				attr_dev(h3, "class", "activity-description svelte-1aisj69");
				set_style(h3, "text-align", "center");
				add_location(h3, file$g, 25, 4, 1000);
				attr_dev(div, "class", "activity-modal svelte-1aisj69");
				add_location(div, file$g, 7, 0, 114);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				if (if_block0) if_block0.m(div, null);
				append_dev(div, t0);
				if (if_block1) if_block1.m(div, null);
				append_dev(div, t1);
				if (if_block2) if_block2.m(div, null);
				append_dev(div, t2);
				append_dev(div, h3);
				h3.innerHTML = /*description*/ ctx[3];
			},
			p: function update(ctx, [dirty]) {
				if (/*image*/ ctx[0]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_2$1(ctx);
						if_block0.c();
						if_block0.m(div, t0);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (/*audio*/ ctx[1]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block_1$4(ctx);
						if_block1.c();
						if_block1.m(div, t1);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (/*video*/ ctx[2]) {
					if (if_block2) {
						if_block2.p(ctx, dirty);
					} else {
						if_block2 = create_if_block$7(ctx);
						if_block2.c();
						if_block2.m(div, t2);
					}
				} else if (if_block2) {
					if_block2.d(1);
					if_block2 = null;
				}

				if (dirty & /*description*/ 8) h3.innerHTML = /*description*/ ctx[3];		},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
				if (if_block2) if_block2.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$g.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$g($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('ActivityModal', slots, []);
		let { image } = $$props;
		let { audio } = $$props;
		let { video } = $$props;
		let { description } = $$props;

		$$self.$$.on_mount.push(function () {
			if (image === undefined && !('image' in $$props || $$self.$$.bound[$$self.$$.props['image']])) {
				console.warn("<ActivityModal> was created without expected prop 'image'");
			}

			if (audio === undefined && !('audio' in $$props || $$self.$$.bound[$$self.$$.props['audio']])) {
				console.warn("<ActivityModal> was created without expected prop 'audio'");
			}

			if (video === undefined && !('video' in $$props || $$self.$$.bound[$$self.$$.props['video']])) {
				console.warn("<ActivityModal> was created without expected prop 'video'");
			}

			if (description === undefined && !('description' in $$props || $$self.$$.bound[$$self.$$.props['description']])) {
				console.warn("<ActivityModal> was created without expected prop 'description'");
			}
		});

		const writable_props = ['image', 'audio', 'video', 'description'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ActivityModal> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('image' in $$props) $$invalidate(0, image = $$props.image);
			if ('audio' in $$props) $$invalidate(1, audio = $$props.audio);
			if ('video' in $$props) $$invalidate(2, video = $$props.video);
			if ('description' in $$props) $$invalidate(3, description = $$props.description);
		};

		$$self.$capture_state = () => ({ image, audio, video, description });

		$$self.$inject_state = $$props => {
			if ('image' in $$props) $$invalidate(0, image = $$props.image);
			if ('audio' in $$props) $$invalidate(1, audio = $$props.audio);
			if ('video' in $$props) $$invalidate(2, video = $$props.video);
			if ('description' in $$props) $$invalidate(3, description = $$props.description);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [image, audio, video, description];
	}

	class ActivityModal extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$g, create_fragment$g, safe_not_equal, {
				image: 0,
				audio: 1,
				video: 2,
				description: 3
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "ActivityModal",
				options,
				id: create_fragment$g.name
			});
		}

		get image() {
			throw new Error("<ActivityModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set image(value) {
			throw new Error("<ActivityModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get audio() {
			throw new Error("<ActivityModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set audio(value) {
			throw new Error("<ActivityModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get video() {
			throw new Error("<ActivityModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set video(value) {
			throw new Error("<ActivityModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get description() {
			throw new Error("<ActivityModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set description(value) {
			throw new Error("<ActivityModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/components/Intro.svelte generated by Svelte v4.2.20 */
	const file$f = "src/components/Intro.svelte";

	function create_fragment$f(ctx) {
		let div1;
		let h1;
		let t1;
		let div0;
		let p0;
		let t2;
		let a0;
		let t4;
		let a1;
		let t6;
		let t7;
		let p1;
		let t8;
		let activity0;
		let t10;
		let t11;
		let p2;
		let t12;
		let activity1;
		let t14;
		let activity2;
		let t16;
		let activity3;
		let t18;
		let activity4;
		let t20;
		let activity5;
		let t22;
		let activity6;
		let t24;
		let activity7;
		let t26;
		let activity8;
		let t28;
		let t29;
		let p3;
		let t30;
		let a2;
		let t32;
		let t33;
		let p4;
		let t34;
		let span;
		let t36;
		let a3;
		let t38;
		let mounted;
		let dispose;

		const block = {
			c: function create() {
				div1 = element("div");
				h1 = element("h1");
				h1.textContent = "Who is Max?";
				t1 = space();
				div0 = element("div");
				p0 = element("p");
				t2 = text("I am a Software Development Engineer, at ");
				a0 = element("a");
				a0.textContent = "Wealthsimple";
				t4 = text(",\n        and a Computer Science graduate from ");
				a1 = element("a");
				a1.textContent = "Queen's University";
				t6 = text(",\n        with a creative and curious mind, a passion for adventure, and a fascination for all technology.");
				t7 = space();
				p1 = element("p");
				t8 = text("Also a computational thinker, I am experienced in software and web development, hardware repair, agile methodologies, UI/UX design, and ");
				activity0 = element("activity");
				activity0.textContent = "iOS app reviewing";
				t10 = text(".\n        As a software engineer by day, I enjoy working with teams and being around like-minded people. With every new role I take on, I strive to communicate effectively and confidently, and lead the team as a creative problem solver.");
				t11 = space();
				p2 = element("p");
				t12 = text("In my free time, I love to ");
				activity1 = element("activity");
				activity1.textContent = "run";
				t14 = text(", ");
				activity2 = element("activity");
				activity2.textContent = "cycle";
				t16 = text(", ");
				activity3 = element("activity");
				activity3.textContent = "play guitar";
				t18 = text(", ");
				activity4 = element("activity");
				activity4.textContent = "fly drones";
				t20 = text(",\n        ");
				activity5 = element("activity");
				activity5.textContent = "ski";
				t22 = text(", ");
				activity6 = element("activity");
				activity6.textContent = "hike";
				t24 = text(", ");
				activity7 = element("activity");
				activity7.textContent = "travel";
				t26 = text(", and ");
				activity8 = element("activity");
				activity8.textContent = "work with cool technology";
				t28 = text(".");
				t29 = space();
				p3 = element("p");
				t30 = text("Please explore and enjoy my portfolio website, click on things for more information, and ");
				a2 = element("a");
				a2.textContent = "email me";
				t32 = text(" if you have any questions or comments.");
				t33 = space();
				p4 = element("p");
				t34 = text("If you are ");
				span = element("span");
				span.textContent = "recruiting";
				t36 = text(", please view and download (print to PDF) my ");
				a3 = element("a");
				a3.textContent = "resume";
				t38 = text(".");
				attr_dev(h1, "class", "section-title-intro svelte-vwcyka");
				add_location(h1, file$f, 93, 4, 3544);
				attr_dev(a0, "class", "intro-link svelte-vwcyka");
				attr_dev(a0, "href", "https://wealthsimple.com");
				attr_dev(a0, "rel", "noreferrer");
				attr_dev(a0, "target", "_blank");
				add_location(a0, file$f, 95, 76, 3703);
				attr_dev(a1, "class", "intro-link svelte-vwcyka");
				attr_dev(a1, "href", "https://www.queensu.ca/");
				attr_dev(a1, "rel", "noreferrer");
				attr_dev(a1, "target", "_blank");
				add_location(a1, file$f, 96, 45, 3853);
				attr_dev(p0, "class", "title-extension svelte-vwcyka");
				add_location(p0, file$f, 95, 8, 3635);
				attr_dev(activity0, "tabindex", "0");
				attr_dev(activity0, "class", "svelte-vwcyka");
				add_location(activity0, file$f, 99, 147, 4220);
				add_location(p1, file$f, 99, 8, 4081);
				attr_dev(activity1, "tabindex", "0");
				attr_dev(activity1, "class", "svelte-vwcyka");
				add_location(activity1, file$f, 102, 38, 4593);
				attr_dev(activity2, "tabindex", "0");
				attr_dev(activity2, "class", "svelte-vwcyka");
				add_location(activity2, file$f, 102, 97, 4652);
				attr_dev(activity3, "tabindex", "0");
				attr_dev(activity3, "class", "svelte-vwcyka");
				add_location(activity3, file$f, 102, 160, 4715);
				attr_dev(activity4, "tabindex", "0");
				attr_dev(activity4, "class", "svelte-vwcyka");
				add_location(activity4, file$f, 102, 229, 4784);
				attr_dev(activity5, "tabindex", "0");
				attr_dev(activity5, "class", "svelte-vwcyka");
				add_location(activity5, file$f, 103, 8, 4860);
				attr_dev(activity6, "tabindex", "0");
				attr_dev(activity6, "class", "svelte-vwcyka");
				add_location(activity6, file$f, 103, 70, 4922);
				attr_dev(activity7, "tabindex", "0");
				attr_dev(activity7, "class", "svelte-vwcyka");
				add_location(activity7, file$f, 103, 133, 4985);
				attr_dev(activity8, "tabindex", "0");
				attr_dev(activity8, "class", "svelte-vwcyka");
				add_location(activity8, file$f, 103, 206, 5058);
				add_location(p2, file$f, 102, 8, 4563);
				attr_dev(a2, "class", "intro-link svelte-vwcyka");
				attr_dev(a2, "href", "mailto:intro@maxeisen.me");
				attr_dev(a2, "rel", "noreferrer");
				attr_dev(a2, "target", "_blank");
				add_location(a2, file$f, 105, 100, 5253);
				add_location(p3, file$f, 105, 8, 5161);
				attr_dev(span, "class", "static-highlight svelte-vwcyka");
				add_location(span, file$f, 107, 22, 5427);
				attr_dev(a3, "class", "intro-link svelte-vwcyka");
				attr_dev(a3, "href", "/resume");
				add_location(a3, file$f, 107, 113, 5518);
				add_location(p4, file$f, 107, 8, 5413);
				attr_dev(div0, "class", "intro-paragraph svelte-vwcyka");
				add_location(div0, file$f, 94, 4, 3597);
				attr_dev(div1, "class", "intro-container");
				add_location(div1, file$f, 92, 0, 3510);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div1, anchor);
				append_dev(div1, h1);
				append_dev(div1, t1);
				append_dev(div1, div0);
				append_dev(div0, p0);
				append_dev(p0, t2);
				append_dev(p0, a0);
				append_dev(p0, t4);
				append_dev(p0, a1);
				append_dev(p0, t6);
				append_dev(div0, t7);
				append_dev(div0, p1);
				append_dev(p1, t8);
				append_dev(p1, activity0);
				append_dev(p1, t10);
				append_dev(div0, t11);
				append_dev(div0, p2);
				append_dev(p2, t12);
				append_dev(p2, activity1);
				append_dev(p2, t14);
				append_dev(p2, activity2);
				append_dev(p2, t16);
				append_dev(p2, activity3);
				append_dev(p2, t18);
				append_dev(p2, activity4);
				append_dev(p2, t20);
				append_dev(p2, activity5);
				append_dev(p2, t22);
				append_dev(p2, activity6);
				append_dev(p2, t24);
				append_dev(p2, activity7);
				append_dev(p2, t26);
				append_dev(p2, activity8);
				append_dev(p2, t28);
				append_dev(div0, t29);
				append_dev(div0, p3);
				append_dev(p3, t30);
				append_dev(p3, a2);
				append_dev(p3, t32);
				append_dev(div0, t33);
				append_dev(div0, p4);
				append_dev(p4, t34);
				append_dev(p4, span);
				append_dev(p4, t36);
				append_dev(p4, a3);
				append_dev(p4, t38);

				if (!mounted) {
					dispose = [
						listen_dev(activity0, "click", /*appstorereviewersModal*/ ctx[0], false, false, false, false),
						listen_dev(activity1, "click", /*runModal*/ ctx[1], false, false, false, false),
						listen_dev(activity2, "click", /*cycleModal*/ ctx[2], false, false, false, false),
						listen_dev(activity3, "click", /*musicModal*/ ctx[4], false, false, false, false),
						listen_dev(activity4, "click", /*droneModal*/ ctx[3], false, false, false, false),
						listen_dev(activity5, "click", /*skiingModal*/ ctx[5], false, false, false, false),
						listen_dev(activity6, "click", /*hikingModal*/ ctx[6], false, false, false, false),
						listen_dev(activity7, "click", /*travellingModal*/ ctx[7], false, false, false, false),
						listen_dev(activity8, "click", /*techModal*/ ctx[8], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: noop,
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div1);
				}

				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$f.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$f($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Intro', slots, []);
		const { open } = getContext('simple-modal');

		const appstorereviewers = {
			video: "https://www.youtube.com/embed/1raFNOEm5rA?start=171&",
			description: "A compilation from my old iOS app reviewing YouTube channel, <a href=\"https://www.youtube.com/user/AppStoreReviewers/videos\" rel=\"noreferrer\" target=\"_blank\">AppStoreReviewers</a> (~79,000 viewers strong)"
		};

		const run = {
			image: "run",
			description: "Me running the 2025 Toronto Waterfront Half Marathon</iframe>"
		};

		const cycle = {
			image: "cycle2",
			description: "Me crossing the finish line of the 122km <a href=\"https://www.rbcgranfondo.com/whistler/\" rel=\"noreferrer\" target=\"_blank\"> 2023 GranFondo Whistler</a> and my latest rides (below)</br></br><iframe height='160' width='85%' frameborder='0' allowtransparency='true' scrolling='no' src='https://www.strava.com/athletes/92118908/activity-summary/dc478a7fc29bd0ba2e32f9cf7fb702d2f7e31df4'></iframe>"
		};

		const drone = {
			video: "https://www.youtube.com/embed/fULlZkgpw50?",
			description: "A promotional spot that I shot and edited of the new GV70 from <a href=\"https://www.genesisyorkdale.ca/\" rel=\"noreferrer\" target=\"_blank\">Genesis Yorkdale</a>"
		};

		const music = {
			image: "guitar",
			description: "Me playing guitar... duh"
		}; // audio: "./media/audio/helplessly_hoping-max_eisen.mp3",
		// description: "My cover of <a href=\"https://www.youtube.com/watch?v=kyquqw6GeXk\" rel=\"noreferrer\" target=\"_blank\">'Helplessly Hoping' by CSN</a>"

		const skiing = {
			image: "ski",
			description: "Whistler, BC"
		};

		const hiking = {
			image: "hike",
			description: "Lake Country, BC"
		};

		const travelling = {
			image: "travel2",
			description: "St. Barths"
		};

		const tech = {
			image: "frc",
			description: "Captaining my high school robotics team at the 2016 FIRST Robotics Competition"
		};

		const appstorereviewersModal = () => {
			open(ActivityModal, {
				video: appstorereviewers.video,
				description: appstorereviewers.description
			});
		};

		const runModal = () => {
			open(ActivityModal, {
				image: run.image,
				description: run.description
			});
		};

		const cycleModal = () => {
			open(ActivityModal, {
				image: cycle.image,
				description: cycle.description
			});
		};

		const droneModal = () => {
			open(ActivityModal, {
				video: drone.video,
				description: drone.description
			});
		};

		const musicModal = () => {
			open(ActivityModal, {
				image: music.image,
				audio: music.audio,
				description: music.description
			});
		};

		const skiingModal = () => {
			open(ActivityModal, {
				image: skiing.image,
				description: skiing.description
			});
		};

		const hikingModal = () => {
			open(ActivityModal, {
				image: hiking.image,
				description: hiking.description
			});
		};

		const travellingModal = () => {
			open(ActivityModal, {
				image: travelling.image,
				description: travelling.description
			});
		};

		const techModal = () => {
			open(ActivityModal, {
				image: tech.image,
				description: tech.description
			});
		};

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Intro> was created with unknown prop '${key}'`);
		});

		$$self.$capture_state = () => ({
			getContext,
			ActivityModal,
			open,
			appstorereviewers,
			run,
			cycle,
			drone,
			music,
			skiing,
			hiking,
			travelling,
			tech,
			appstorereviewersModal,
			runModal,
			cycleModal,
			droneModal,
			musicModal,
			skiingModal,
			hikingModal,
			travellingModal,
			techModal
		});

		return [
			appstorereviewersModal,
			runModal,
			cycleModal,
			droneModal,
			musicModal,
			skiingModal,
			hikingModal,
			travellingModal,
			techModal
		];
	}

	class Intro extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$f, create_fragment$f, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Intro",
				options,
				id: create_fragment$f.name
			});
		}
	}

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var queryString = {};

	var strictUriEncode = str => encodeURIComponent(str).replace(/[!'()*]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);

	var token = '%[a-f0-9]{2}';
	var singleMatcher = new RegExp('(' + token + ')|([^%]+?)', 'gi');
	var multiMatcher = new RegExp('(' + token + ')+', 'gi');

	function decodeComponents(components, split) {
		try {
			// Try to decode the entire string first
			return [decodeURIComponent(components.join(''))];
		} catch (err) {
			// Do nothing
		}

		if (components.length === 1) {
			return components;
		}

		split = split || 1;

		// Split the array in 2 parts
		var left = components.slice(0, split);
		var right = components.slice(split);

		return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
	}

	function decode(input) {
		try {
			return decodeURIComponent(input);
		} catch (err) {
			var tokens = input.match(singleMatcher) || [];

			for (var i = 1; i < tokens.length; i++) {
				input = decodeComponents(tokens, i).join('');

				tokens = input.match(singleMatcher) || [];
			}

			return input;
		}
	}

	function customDecodeURIComponent(input) {
		// Keep track of all the replacements and prefill the map with the `BOM`
		var replaceMap = {
			'%FE%FF': '\uFFFD\uFFFD',
			'%FF%FE': '\uFFFD\uFFFD'
		};

		var match = multiMatcher.exec(input);
		while (match) {
			try {
				// Decode as big chunks as possible
				replaceMap[match[0]] = decodeURIComponent(match[0]);
			} catch (err) {
				var result = decode(match[0]);

				if (result !== match[0]) {
					replaceMap[match[0]] = result;
				}
			}

			match = multiMatcher.exec(input);
		}

		// Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
		replaceMap['%C2'] = '\uFFFD';

		var entries = Object.keys(replaceMap);

		for (var i = 0; i < entries.length; i++) {
			// Replace all decoded components
			var key = entries[i];
			input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
		}

		return input;
	}

	var decodeUriComponent = function (encodedURI) {
		if (typeof encodedURI !== 'string') {
			throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
		}

		try {
			encodedURI = encodedURI.replace(/\+/g, ' ');

			// Try the built in decoder first
			return decodeURIComponent(encodedURI);
		} catch (err) {
			// Fallback to a more advanced decoder
			return customDecodeURIComponent(encodedURI);
		}
	};

	var splitOnFirst = (string, separator) => {
		if (!(typeof string === 'string' && typeof separator === 'string')) {
			throw new TypeError('Expected the arguments to be of type `string`');
		}

		if (separator === '') {
			return [string];
		}

		const separatorIndex = string.indexOf(separator);

		if (separatorIndex === -1) {
			return [string];
		}

		return [
			string.slice(0, separatorIndex),
			string.slice(separatorIndex + separator.length)
		];
	};

	var filterObj = function (obj, predicate) {
		var ret = {};
		var keys = Object.keys(obj);
		var isArr = Array.isArray(predicate);

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			var val = obj[key];

			if (isArr ? predicate.indexOf(key) !== -1 : predicate(key, val, obj)) {
				ret[key] = val;
			}
		}

		return ret;
	};

	(function (exports) {
		const strictUriEncode$1 = strictUriEncode;
		const decodeComponent = decodeUriComponent;
		const splitOnFirst$1 = splitOnFirst;
		const filterObject = filterObj;

		const isNullOrUndefined = value => value === null || value === undefined;

		function encoderForArrayFormat(options) {
			switch (options.arrayFormat) {
				case 'index':
					return key => (result, value) => {
						const index = result.length;

						if (
							value === undefined ||
							(options.skipNull && value === null) ||
							(options.skipEmptyString && value === '')
						) {
							return result;
						}

						if (value === null) {
							return [...result, [encode(key, options), '[', index, ']'].join('')];
						}

						return [
							...result,
							[encode(key, options), '[', encode(index, options), ']=', encode(value, options)].join('')
						];
					};

				case 'bracket':
					return key => (result, value) => {
						if (
							value === undefined ||
							(options.skipNull && value === null) ||
							(options.skipEmptyString && value === '')
						) {
							return result;
						}

						if (value === null) {
							return [...result, [encode(key, options), '[]'].join('')];
						}

						return [...result, [encode(key, options), '[]=', encode(value, options)].join('')];
					};

				case 'comma':
				case 'separator':
					return key => (result, value) => {
						if (value === null || value === undefined || value.length === 0) {
							return result;
						}

						if (result.length === 0) {
							return [[encode(key, options), '=', encode(value, options)].join('')];
						}

						return [[result, encode(value, options)].join(options.arrayFormatSeparator)];
					};

				default:
					return key => (result, value) => {
						if (
							value === undefined ||
							(options.skipNull && value === null) ||
							(options.skipEmptyString && value === '')
						) {
							return result;
						}

						if (value === null) {
							return [...result, encode(key, options)];
						}

						return [...result, [encode(key, options), '=', encode(value, options)].join('')];
					};
			}
		}

		function parserForArrayFormat(options) {
			let result;

			switch (options.arrayFormat) {
				case 'index':
					return (key, value, accumulator) => {
						result = /\[(\d*)\]$/.exec(key);

						key = key.replace(/\[\d*\]$/, '');

						if (!result) {
							accumulator[key] = value;
							return;
						}

						if (accumulator[key] === undefined) {
							accumulator[key] = {};
						}

						accumulator[key][result[1]] = value;
					};

				case 'bracket':
					return (key, value, accumulator) => {
						result = /(\[\])$/.exec(key);
						key = key.replace(/\[\]$/, '');

						if (!result) {
							accumulator[key] = value;
							return;
						}

						if (accumulator[key] === undefined) {
							accumulator[key] = [value];
							return;
						}

						accumulator[key] = [].concat(accumulator[key], value);
					};

				case 'comma':
				case 'separator':
					return (key, value, accumulator) => {
						const isArray = typeof value === 'string' && value.includes(options.arrayFormatSeparator);
						const isEncodedArray = (typeof value === 'string' && !isArray && decode(value, options).includes(options.arrayFormatSeparator));
						value = isEncodedArray ? decode(value, options) : value;
						const newValue = isArray || isEncodedArray ? value.split(options.arrayFormatSeparator).map(item => decode(item, options)) : value === null ? value : decode(value, options);
						accumulator[key] = newValue;
					};

				default:
					return (key, value, accumulator) => {
						if (accumulator[key] === undefined) {
							accumulator[key] = value;
							return;
						}

						accumulator[key] = [].concat(accumulator[key], value);
					};
			}
		}

		function validateArrayFormatSeparator(value) {
			if (typeof value !== 'string' || value.length !== 1) {
				throw new TypeError('arrayFormatSeparator must be single character string');
			}
		}

		function encode(value, options) {
			if (options.encode) {
				return options.strict ? strictUriEncode$1(value) : encodeURIComponent(value);
			}

			return value;
		}

		function decode(value, options) {
			if (options.decode) {
				return decodeComponent(value);
			}

			return value;
		}

		function keysSorter(input) {
			if (Array.isArray(input)) {
				return input.sort();
			}

			if (typeof input === 'object') {
				return keysSorter(Object.keys(input))
					.sort((a, b) => Number(a) - Number(b))
					.map(key => input[key]);
			}

			return input;
		}

		function removeHash(input) {
			const hashStart = input.indexOf('#');
			if (hashStart !== -1) {
				input = input.slice(0, hashStart);
			}

			return input;
		}

		function getHash(url) {
			let hash = '';
			const hashStart = url.indexOf('#');
			if (hashStart !== -1) {
				hash = url.slice(hashStart);
			}

			return hash;
		}

		function extract(input) {
			input = removeHash(input);
			const queryStart = input.indexOf('?');
			if (queryStart === -1) {
				return '';
			}

			return input.slice(queryStart + 1);
		}

		function parseValue(value, options) {
			if (options.parseNumbers && !Number.isNaN(Number(value)) && (typeof value === 'string' && value.trim() !== '')) {
				value = Number(value);
			} else if (options.parseBooleans && value !== null && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
				value = value.toLowerCase() === 'true';
			}

			return value;
		}

		function parse(query, options) {
			options = Object.assign({
				decode: true,
				sort: true,
				arrayFormat: 'none',
				arrayFormatSeparator: ',',
				parseNumbers: false,
				parseBooleans: false
			}, options);

			validateArrayFormatSeparator(options.arrayFormatSeparator);

			const formatter = parserForArrayFormat(options);

			// Create an object with no prototype
			const ret = Object.create(null);

			if (typeof query !== 'string') {
				return ret;
			}

			query = query.trim().replace(/^[?#&]/, '');

			if (!query) {
				return ret;
			}

			for (const param of query.split('&')) {
				if (param === '') {
					continue;
				}

				let [key, value] = splitOnFirst$1(options.decode ? param.replace(/\+/g, ' ') : param, '=');

				// Missing `=` should be `null`:
				// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
				value = value === undefined ? null : ['comma', 'separator'].includes(options.arrayFormat) ? value : decode(value, options);
				formatter(decode(key, options), value, ret);
			}

			for (const key of Object.keys(ret)) {
				const value = ret[key];
				if (typeof value === 'object' && value !== null) {
					for (const k of Object.keys(value)) {
						value[k] = parseValue(value[k], options);
					}
				} else {
					ret[key] = parseValue(value, options);
				}
			}

			if (options.sort === false) {
				return ret;
			}

			return (options.sort === true ? Object.keys(ret).sort() : Object.keys(ret).sort(options.sort)).reduce((result, key) => {
				const value = ret[key];
				if (Boolean(value) && typeof value === 'object' && !Array.isArray(value)) {
					// Sort object keys, not values
					result[key] = keysSorter(value);
				} else {
					result[key] = value;
				}

				return result;
			}, Object.create(null));
		}

		exports.extract = extract;
		exports.parse = parse;

		exports.stringify = (object, options) => {
			if (!object) {
				return '';
			}

			options = Object.assign({
				encode: true,
				strict: true,
				arrayFormat: 'none',
				arrayFormatSeparator: ','
			}, options);

			validateArrayFormatSeparator(options.arrayFormatSeparator);

			const shouldFilter = key => (
				(options.skipNull && isNullOrUndefined(object[key])) ||
				(options.skipEmptyString && object[key] === '')
			);

			const formatter = encoderForArrayFormat(options);

			const objectCopy = {};

			for (const key of Object.keys(object)) {
				if (!shouldFilter(key)) {
					objectCopy[key] = object[key];
				}
			}

			const keys = Object.keys(objectCopy);

			if (options.sort !== false) {
				keys.sort(options.sort);
			}

			return keys.map(key => {
				const value = object[key];

				if (value === undefined) {
					return '';
				}

				if (value === null) {
					return encode(key, options);
				}

				if (Array.isArray(value)) {
					return value
						.reduce(formatter(key), [])
						.join('&');
				}

				return encode(key, options) + '=' + encode(value, options);
			}).filter(x => x.length > 0).join('&');
		};

		exports.parseUrl = (url, options) => {
			options = Object.assign({
				decode: true
			}, options);

			const [url_, hash] = splitOnFirst$1(url, '#');

			return Object.assign(
				{
					url: url_.split('?')[0] || '',
					query: parse(extract(url), options)
				},
				options && options.parseFragmentIdentifier && hash ? {fragmentIdentifier: decode(hash, options)} : {}
			);
		};

		exports.stringifyUrl = (object, options) => {
			options = Object.assign({
				encode: true,
				strict: true
			}, options);

			const url = removeHash(object.url).split('?')[0] || '';
			const queryFromUrl = exports.extract(object.url);
			const parsedQueryFromUrl = exports.parse(queryFromUrl, {sort: false});

			const query = Object.assign(parsedQueryFromUrl, object.query);
			let queryString = exports.stringify(query, options);
			if (queryString) {
				queryString = `?${queryString}`;
			}

			let hash = getHash(object.url);
			if (object.fragmentIdentifier) {
				hash = `#${encode(object.fragmentIdentifier, options)}`;
			}

			return `${url}${queryString}${hash}`;
		};

		exports.pick = (input, filter, options) => {
			options = Object.assign({
				parseFragmentIdentifier: true
			}, options);

			const {url, query, fragmentIdentifier} = exports.parseUrl(input, options);
			return exports.stringifyUrl({
				url,
				query: filterObject(query, filter),
				fragmentIdentifier
			}, options);
		};

		exports.exclude = (input, filter, options) => {
			const exclusionFilter = Array.isArray(filter) ? key => !filter.includes(key) : (key, value) => !filter(key, value);

			return exports.pick(input, exclusionFilter, options);
		}; 
	} (queryString));

	var qs = /*@__PURE__*/getDefaultExportFromCjs(queryString);

	/**
	 * marked v4.3.0 - a markdown parser
	 * Copyright (c) 2011-2023, Christopher Jeffrey. (MIT Licensed)
	 * https://github.com/markedjs/marked
	 */

	/**
	 * DO NOT EDIT THIS FILE
	 * The code in this file is generated from files in ./src/
	 */

	function getDefaults() {
	  return {
	    async: false,
	    baseUrl: null,
	    breaks: false,
	    extensions: null,
	    gfm: true,
	    headerIds: true,
	    headerPrefix: '',
	    highlight: null,
	    hooks: null,
	    langPrefix: 'language-',
	    mangle: true,
	    pedantic: false,
	    renderer: null,
	    sanitize: false,
	    sanitizer: null,
	    silent: false,
	    smartypants: false,
	    tokenizer: null,
	    walkTokens: null,
	    xhtml: false
	  };
	}

	let defaults = getDefaults();

	function changeDefaults(newDefaults) {
	  defaults = newDefaults;
	}

	/**
	 * Helpers
	 */
	const escapeTest = /[&<>"']/;
	const escapeReplace = new RegExp(escapeTest.source, 'g');
	const escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
	const escapeReplaceNoEncode = new RegExp(escapeTestNoEncode.source, 'g');
	const escapeReplacements = {
	  '&': '&amp;',
	  '<': '&lt;',
	  '>': '&gt;',
	  '"': '&quot;',
	  "'": '&#39;'
	};
	const getEscapeReplacement = (ch) => escapeReplacements[ch];
	function escape(html, encode) {
	  if (encode) {
	    if (escapeTest.test(html)) {
	      return html.replace(escapeReplace, getEscapeReplacement);
	    }
	  } else {
	    if (escapeTestNoEncode.test(html)) {
	      return html.replace(escapeReplaceNoEncode, getEscapeReplacement);
	    }
	  }

	  return html;
	}

	const unescapeTest = /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig;

	/**
	 * @param {string} html
	 */
	function unescape(html) {
	  // explicitly match decimal, hex, and named HTML entities
	  return html.replace(unescapeTest, (_, n) => {
	    n = n.toLowerCase();
	    if (n === 'colon') return ':';
	    if (n.charAt(0) === '#') {
	      return n.charAt(1) === 'x'
	        ? String.fromCharCode(parseInt(n.substring(2), 16))
	        : String.fromCharCode(+n.substring(1));
	    }
	    return '';
	  });
	}

	const caret = /(^|[^\[])\^/g;

	/**
	 * @param {string | RegExp} regex
	 * @param {string} opt
	 */
	function edit(regex, opt) {
	  regex = typeof regex === 'string' ? regex : regex.source;
	  opt = opt || '';
	  const obj = {
	    replace: (name, val) => {
	      val = val.source || val;
	      val = val.replace(caret, '$1');
	      regex = regex.replace(name, val);
	      return obj;
	    },
	    getRegex: () => {
	      return new RegExp(regex, opt);
	    }
	  };
	  return obj;
	}

	const nonWordAndColonTest = /[^\w:]/g;
	const originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i;

	/**
	 * @param {boolean} sanitize
	 * @param {string} base
	 * @param {string} href
	 */
	function cleanUrl(sanitize, base, href) {
	  if (sanitize) {
	    let prot;
	    try {
	      prot = decodeURIComponent(unescape(href))
	        .replace(nonWordAndColonTest, '')
	        .toLowerCase();
	    } catch (e) {
	      return null;
	    }
	    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
	      return null;
	    }
	  }
	  if (base && !originIndependentUrl.test(href)) {
	    href = resolveUrl(base, href);
	  }
	  try {
	    href = encodeURI(href).replace(/%25/g, '%');
	  } catch (e) {
	    return null;
	  }
	  return href;
	}

	const baseUrls = {};
	const justDomain = /^[^:]+:\/*[^/]*$/;
	const protocol = /^([^:]+:)[\s\S]*$/;
	const domain = /^([^:]+:\/*[^/]*)[\s\S]*$/;

	/**
	 * @param {string} base
	 * @param {string} href
	 */
	function resolveUrl(base, href) {
	  if (!baseUrls[' ' + base]) {
	    // we can ignore everything in base after the last slash of its path component,
	    // but we might need to add _that_
	    // https://tools.ietf.org/html/rfc3986#section-3
	    if (justDomain.test(base)) {
	      baseUrls[' ' + base] = base + '/';
	    } else {
	      baseUrls[' ' + base] = rtrim(base, '/', true);
	    }
	  }
	  base = baseUrls[' ' + base];
	  const relativeBase = base.indexOf(':') === -1;

	  if (href.substring(0, 2) === '//') {
	    if (relativeBase) {
	      return href;
	    }
	    return base.replace(protocol, '$1') + href;
	  } else if (href.charAt(0) === '/') {
	    if (relativeBase) {
	      return href;
	    }
	    return base.replace(domain, '$1') + href;
	  } else {
	    return base + href;
	  }
	}

	const noopTest = { exec: function noopTest() {} };

	function splitCells(tableRow, count) {
	  // ensure that every cell-delimiting pipe has a space
	  // before it to distinguish it from an escaped pipe
	  const row = tableRow.replace(/\|/g, (match, offset, str) => {
	      let escaped = false,
	        curr = offset;
	      while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
	      if (escaped) {
	        // odd number of slashes means | is escaped
	        // so we leave it alone
	        return '|';
	      } else {
	        // add space before unescaped |
	        return ' |';
	      }
	    }),
	    cells = row.split(/ \|/);
	  let i = 0;

	  // First/last cell in a row cannot be empty if it has no leading/trailing pipe
	  if (!cells[0].trim()) { cells.shift(); }
	  if (cells.length > 0 && !cells[cells.length - 1].trim()) { cells.pop(); }

	  if (cells.length > count) {
	    cells.splice(count);
	  } else {
	    while (cells.length < count) cells.push('');
	  }

	  for (; i < cells.length; i++) {
	    // leading or trailing whitespace is ignored per the gfm spec
	    cells[i] = cells[i].trim().replace(/\\\|/g, '|');
	  }
	  return cells;
	}

	/**
	 * Remove trailing 'c's. Equivalent to str.replace(/c*$/, '').
	 * /c*$/ is vulnerable to REDOS.
	 *
	 * @param {string} str
	 * @param {string} c
	 * @param {boolean} invert Remove suffix of non-c chars instead. Default falsey.
	 */
	function rtrim(str, c, invert) {
	  const l = str.length;
	  if (l === 0) {
	    return '';
	  }

	  // Length of suffix matching the invert condition.
	  let suffLen = 0;

	  // Step left until we fail to match the invert condition.
	  while (suffLen < l) {
	    const currChar = str.charAt(l - suffLen - 1);
	    if (currChar === c && !invert) {
	      suffLen++;
	    } else if (currChar !== c && invert) {
	      suffLen++;
	    } else {
	      break;
	    }
	  }

	  return str.slice(0, l - suffLen);
	}

	function findClosingBracket(str, b) {
	  if (str.indexOf(b[1]) === -1) {
	    return -1;
	  }
	  const l = str.length;
	  let level = 0,
	    i = 0;
	  for (; i < l; i++) {
	    if (str[i] === '\\') {
	      i++;
	    } else if (str[i] === b[0]) {
	      level++;
	    } else if (str[i] === b[1]) {
	      level--;
	      if (level < 0) {
	        return i;
	      }
	    }
	  }
	  return -1;
	}

	function checkSanitizeDeprecation(opt) {
	  if (opt && opt.sanitize && !opt.silent) {
	    console.warn('marked(): sanitize and sanitizer parameters are deprecated since version 0.7.0, should not be used and will be removed in the future. Read more here: https://marked.js.org/#/USING_ADVANCED.md#options');
	  }
	}

	// copied from https://stackoverflow.com/a/5450113/806777
	/**
	 * @param {string} pattern
	 * @param {number} count
	 */
	function repeatString(pattern, count) {
	  if (count < 1) {
	    return '';
	  }
	  let result = '';
	  while (count > 1) {
	    if (count & 1) {
	      result += pattern;
	    }
	    count >>= 1;
	    pattern += pattern;
	  }
	  return result + pattern;
	}

	function outputLink(cap, link, raw, lexer) {
	  const href = link.href;
	  const title = link.title ? escape(link.title) : null;
	  const text = cap[1].replace(/\\([\[\]])/g, '$1');

	  if (cap[0].charAt(0) !== '!') {
	    lexer.state.inLink = true;
	    const token = {
	      type: 'link',
	      raw,
	      href,
	      title,
	      text,
	      tokens: lexer.inlineTokens(text)
	    };
	    lexer.state.inLink = false;
	    return token;
	  }
	  return {
	    type: 'image',
	    raw,
	    href,
	    title,
	    text: escape(text)
	  };
	}

	function indentCodeCompensation(raw, text) {
	  const matchIndentToCode = raw.match(/^(\s+)(?:```)/);

	  if (matchIndentToCode === null) {
	    return text;
	  }

	  const indentToCode = matchIndentToCode[1];

	  return text
	    .split('\n')
	    .map(node => {
	      const matchIndentInNode = node.match(/^\s+/);
	      if (matchIndentInNode === null) {
	        return node;
	      }

	      const [indentInNode] = matchIndentInNode;

	      if (indentInNode.length >= indentToCode.length) {
	        return node.slice(indentToCode.length);
	      }

	      return node;
	    })
	    .join('\n');
	}

	/**
	 * Tokenizer
	 */
	class Tokenizer {
	  constructor(options) {
	    this.options = options || defaults;
	  }

	  space(src) {
	    const cap = this.rules.block.newline.exec(src);
	    if (cap && cap[0].length > 0) {
	      return {
	        type: 'space',
	        raw: cap[0]
	      };
	    }
	  }

	  code(src) {
	    const cap = this.rules.block.code.exec(src);
	    if (cap) {
	      const text = cap[0].replace(/^ {1,4}/gm, '');
	      return {
	        type: 'code',
	        raw: cap[0],
	        codeBlockStyle: 'indented',
	        text: !this.options.pedantic
	          ? rtrim(text, '\n')
	          : text
	      };
	    }
	  }

	  fences(src) {
	    const cap = this.rules.block.fences.exec(src);
	    if (cap) {
	      const raw = cap[0];
	      const text = indentCodeCompensation(raw, cap[3] || '');

	      return {
	        type: 'code',
	        raw,
	        lang: cap[2] ? cap[2].trim().replace(this.rules.inline._escapes, '$1') : cap[2],
	        text
	      };
	    }
	  }

	  heading(src) {
	    const cap = this.rules.block.heading.exec(src);
	    if (cap) {
	      let text = cap[2].trim();

	      // remove trailing #s
	      if (/#$/.test(text)) {
	        const trimmed = rtrim(text, '#');
	        if (this.options.pedantic) {
	          text = trimmed.trim();
	        } else if (!trimmed || / $/.test(trimmed)) {
	          // CommonMark requires space before trailing #s
	          text = trimmed.trim();
	        }
	      }

	      return {
	        type: 'heading',
	        raw: cap[0],
	        depth: cap[1].length,
	        text,
	        tokens: this.lexer.inline(text)
	      };
	    }
	  }

	  hr(src) {
	    const cap = this.rules.block.hr.exec(src);
	    if (cap) {
	      return {
	        type: 'hr',
	        raw: cap[0]
	      };
	    }
	  }

	  blockquote(src) {
	    const cap = this.rules.block.blockquote.exec(src);
	    if (cap) {
	      const text = cap[0].replace(/^ *>[ \t]?/gm, '');
	      const top = this.lexer.state.top;
	      this.lexer.state.top = true;
	      const tokens = this.lexer.blockTokens(text);
	      this.lexer.state.top = top;
	      return {
	        type: 'blockquote',
	        raw: cap[0],
	        tokens,
	        text
	      };
	    }
	  }

	  list(src) {
	    let cap = this.rules.block.list.exec(src);
	    if (cap) {
	      let raw, istask, ischecked, indent, i, blankLine, endsWithBlankLine,
	        line, nextLine, rawLine, itemContents, endEarly;

	      let bull = cap[1].trim();
	      const isordered = bull.length > 1;

	      const list = {
	        type: 'list',
	        raw: '',
	        ordered: isordered,
	        start: isordered ? +bull.slice(0, -1) : '',
	        loose: false,
	        items: []
	      };

	      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;

	      if (this.options.pedantic) {
	        bull = isordered ? bull : '[*+-]';
	      }

	      // Get next list item
	      const itemRegex = new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`);

	      // Check if current bullet point can start a new List Item
	      while (src) {
	        endEarly = false;
	        if (!(cap = itemRegex.exec(src))) {
	          break;
	        }

	        if (this.rules.block.hr.test(src)) { // End list if bullet was actually HR (possibly move into itemRegex?)
	          break;
	        }

	        raw = cap[0];
	        src = src.substring(raw.length);

	        line = cap[2].split('\n', 1)[0].replace(/^\t+/, (t) => ' '.repeat(3 * t.length));
	        nextLine = src.split('\n', 1)[0];

	        if (this.options.pedantic) {
	          indent = 2;
	          itemContents = line.trimLeft();
	        } else {
	          indent = cap[2].search(/[^ ]/); // Find first non-space char
	          indent = indent > 4 ? 1 : indent; // Treat indented code blocks (> 4 spaces) as having only 1 indent
	          itemContents = line.slice(indent);
	          indent += cap[1].length;
	        }

	        blankLine = false;

	        if (!line && /^ *$/.test(nextLine)) { // Items begin with at most one blank line
	          raw += nextLine + '\n';
	          src = src.substring(nextLine.length + 1);
	          endEarly = true;
	        }

	        if (!endEarly) {
	          const nextBulletRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`);
	          const hrRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`);
	          const fencesBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`);
	          const headingBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`);

	          // Check if following lines should be included in List Item
	          while (src) {
	            rawLine = src.split('\n', 1)[0];
	            nextLine = rawLine;

	            // Re-align to follow commonmark nesting rules
	            if (this.options.pedantic) {
	              nextLine = nextLine.replace(/^ {1,4}(?=( {4})*[^ ])/g, '  ');
	            }

	            // End list item if found code fences
	            if (fencesBeginRegex.test(nextLine)) {
	              break;
	            }

	            // End list item if found start of new heading
	            if (headingBeginRegex.test(nextLine)) {
	              break;
	            }

	            // End list item if found start of new bullet
	            if (nextBulletRegex.test(nextLine)) {
	              break;
	            }

	            // Horizontal rule found
	            if (hrRegex.test(src)) {
	              break;
	            }

	            if (nextLine.search(/[^ ]/) >= indent || !nextLine.trim()) { // Dedent if possible
	              itemContents += '\n' + nextLine.slice(indent);
	            } else {
	              // not enough indentation
	              if (blankLine) {
	                break;
	              }

	              // paragraph continuation unless last line was a different block level element
	              if (line.search(/[^ ]/) >= 4) { // indented code block
	                break;
	              }
	              if (fencesBeginRegex.test(line)) {
	                break;
	              }
	              if (headingBeginRegex.test(line)) {
	                break;
	              }
	              if (hrRegex.test(line)) {
	                break;
	              }

	              itemContents += '\n' + nextLine;
	            }

	            if (!blankLine && !nextLine.trim()) { // Check if current line is blank
	              blankLine = true;
	            }

	            raw += rawLine + '\n';
	            src = src.substring(rawLine.length + 1);
	            line = nextLine.slice(indent);
	          }
	        }

	        if (!list.loose) {
	          // If the previous item ended with a blank line, the list is loose
	          if (endsWithBlankLine) {
	            list.loose = true;
	          } else if (/\n *\n *$/.test(raw)) {
	            endsWithBlankLine = true;
	          }
	        }

	        // Check for task list items
	        if (this.options.gfm) {
	          istask = /^\[[ xX]\] /.exec(itemContents);
	          if (istask) {
	            ischecked = istask[0] !== '[ ] ';
	            itemContents = itemContents.replace(/^\[[ xX]\] +/, '');
	          }
	        }

	        list.items.push({
	          type: 'list_item',
	          raw,
	          task: !!istask,
	          checked: ischecked,
	          loose: false,
	          text: itemContents
	        });

	        list.raw += raw;
	      }

	      // Do not consume newlines at end of final item. Alternatively, make itemRegex *start* with any newlines to simplify/speed up endsWithBlankLine logic
	      list.items[list.items.length - 1].raw = raw.trimRight();
	      list.items[list.items.length - 1].text = itemContents.trimRight();
	      list.raw = list.raw.trimRight();

	      const l = list.items.length;

	      // Item child tokens handled here at end because we needed to have the final item to trim it first
	      for (i = 0; i < l; i++) {
	        this.lexer.state.top = false;
	        list.items[i].tokens = this.lexer.blockTokens(list.items[i].text, []);

	        if (!list.loose) {
	          // Check if list should be loose
	          const spacers = list.items[i].tokens.filter(t => t.type === 'space');
	          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some(t => /\n.*\n/.test(t.raw));

	          list.loose = hasMultipleLineBreaks;
	        }
	      }

	      // Set all items to loose if list is loose
	      if (list.loose) {
	        for (i = 0; i < l; i++) {
	          list.items[i].loose = true;
	        }
	      }

	      return list;
	    }
	  }

	  html(src) {
	    const cap = this.rules.block.html.exec(src);
	    if (cap) {
	      const token = {
	        type: 'html',
	        raw: cap[0],
	        pre: !this.options.sanitizer
	          && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
	        text: cap[0]
	      };
	      if (this.options.sanitize) {
	        const text = this.options.sanitizer ? this.options.sanitizer(cap[0]) : escape(cap[0]);
	        token.type = 'paragraph';
	        token.text = text;
	        token.tokens = this.lexer.inline(text);
	      }
	      return token;
	    }
	  }

	  def(src) {
	    const cap = this.rules.block.def.exec(src);
	    if (cap) {
	      const tag = cap[1].toLowerCase().replace(/\s+/g, ' ');
	      const href = cap[2] ? cap[2].replace(/^<(.*)>$/, '$1').replace(this.rules.inline._escapes, '$1') : '';
	      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline._escapes, '$1') : cap[3];
	      return {
	        type: 'def',
	        tag,
	        raw: cap[0],
	        href,
	        title
	      };
	    }
	  }

	  table(src) {
	    const cap = this.rules.block.table.exec(src);
	    if (cap) {
	      const item = {
	        type: 'table',
	        header: splitCells(cap[1]).map(c => { return { text: c }; }),
	        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
	        rows: cap[3] && cap[3].trim() ? cap[3].replace(/\n[ \t]*$/, '').split('\n') : []
	      };

	      if (item.header.length === item.align.length) {
	        item.raw = cap[0];

	        let l = item.align.length;
	        let i, j, k, row;
	        for (i = 0; i < l; i++) {
	          if (/^ *-+: *$/.test(item.align[i])) {
	            item.align[i] = 'right';
	          } else if (/^ *:-+: *$/.test(item.align[i])) {
	            item.align[i] = 'center';
	          } else if (/^ *:-+ *$/.test(item.align[i])) {
	            item.align[i] = 'left';
	          } else {
	            item.align[i] = null;
	          }
	        }

	        l = item.rows.length;
	        for (i = 0; i < l; i++) {
	          item.rows[i] = splitCells(item.rows[i], item.header.length).map(c => { return { text: c }; });
	        }

	        // parse child tokens inside headers and cells

	        // header child tokens
	        l = item.header.length;
	        for (j = 0; j < l; j++) {
	          item.header[j].tokens = this.lexer.inline(item.header[j].text);
	        }

	        // cell child tokens
	        l = item.rows.length;
	        for (j = 0; j < l; j++) {
	          row = item.rows[j];
	          for (k = 0; k < row.length; k++) {
	            row[k].tokens = this.lexer.inline(row[k].text);
	          }
	        }

	        return item;
	      }
	    }
	  }

	  lheading(src) {
	    const cap = this.rules.block.lheading.exec(src);
	    if (cap) {
	      return {
	        type: 'heading',
	        raw: cap[0],
	        depth: cap[2].charAt(0) === '=' ? 1 : 2,
	        text: cap[1],
	        tokens: this.lexer.inline(cap[1])
	      };
	    }
	  }

	  paragraph(src) {
	    const cap = this.rules.block.paragraph.exec(src);
	    if (cap) {
	      const text = cap[1].charAt(cap[1].length - 1) === '\n'
	        ? cap[1].slice(0, -1)
	        : cap[1];
	      return {
	        type: 'paragraph',
	        raw: cap[0],
	        text,
	        tokens: this.lexer.inline(text)
	      };
	    }
	  }

	  text(src) {
	    const cap = this.rules.block.text.exec(src);
	    if (cap) {
	      return {
	        type: 'text',
	        raw: cap[0],
	        text: cap[0],
	        tokens: this.lexer.inline(cap[0])
	      };
	    }
	  }

	  escape(src) {
	    const cap = this.rules.inline.escape.exec(src);
	    if (cap) {
	      return {
	        type: 'escape',
	        raw: cap[0],
	        text: escape(cap[1])
	      };
	    }
	  }

	  tag(src) {
	    const cap = this.rules.inline.tag.exec(src);
	    if (cap) {
	      if (!this.lexer.state.inLink && /^<a /i.test(cap[0])) {
	        this.lexer.state.inLink = true;
	      } else if (this.lexer.state.inLink && /^<\/a>/i.test(cap[0])) {
	        this.lexer.state.inLink = false;
	      }
	      if (!this.lexer.state.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
	        this.lexer.state.inRawBlock = true;
	      } else if (this.lexer.state.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
	        this.lexer.state.inRawBlock = false;
	      }

	      return {
	        type: this.options.sanitize
	          ? 'text'
	          : 'html',
	        raw: cap[0],
	        inLink: this.lexer.state.inLink,
	        inRawBlock: this.lexer.state.inRawBlock,
	        text: this.options.sanitize
	          ? (this.options.sanitizer
	            ? this.options.sanitizer(cap[0])
	            : escape(cap[0]))
	          : cap[0]
	      };
	    }
	  }

	  link(src) {
	    const cap = this.rules.inline.link.exec(src);
	    if (cap) {
	      const trimmedUrl = cap[2].trim();
	      if (!this.options.pedantic && /^</.test(trimmedUrl)) {
	        // commonmark requires matching angle brackets
	        if (!(/>$/.test(trimmedUrl))) {
	          return;
	        }

	        // ending angle bracket cannot be escaped
	        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), '\\');
	        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
	          return;
	        }
	      } else {
	        // find closing parenthesis
	        const lastParenIndex = findClosingBracket(cap[2], '()');
	        if (lastParenIndex > -1) {
	          const start = cap[0].indexOf('!') === 0 ? 5 : 4;
	          const linkLen = start + cap[1].length + lastParenIndex;
	          cap[2] = cap[2].substring(0, lastParenIndex);
	          cap[0] = cap[0].substring(0, linkLen).trim();
	          cap[3] = '';
	        }
	      }
	      let href = cap[2];
	      let title = '';
	      if (this.options.pedantic) {
	        // split pedantic href and title
	        const link = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(href);

	        if (link) {
	          href = link[1];
	          title = link[3];
	        }
	      } else {
	        title = cap[3] ? cap[3].slice(1, -1) : '';
	      }

	      href = href.trim();
	      if (/^</.test(href)) {
	        if (this.options.pedantic && !(/>$/.test(trimmedUrl))) {
	          // pedantic allows starting angle bracket without ending angle bracket
	          href = href.slice(1);
	        } else {
	          href = href.slice(1, -1);
	        }
	      }
	      return outputLink(cap, {
	        href: href ? href.replace(this.rules.inline._escapes, '$1') : href,
	        title: title ? title.replace(this.rules.inline._escapes, '$1') : title
	      }, cap[0], this.lexer);
	    }
	  }

	  reflink(src, links) {
	    let cap;
	    if ((cap = this.rules.inline.reflink.exec(src))
	        || (cap = this.rules.inline.nolink.exec(src))) {
	      let link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
	      link = links[link.toLowerCase()];
	      if (!link) {
	        const text = cap[0].charAt(0);
	        return {
	          type: 'text',
	          raw: text,
	          text
	        };
	      }
	      return outputLink(cap, link, cap[0], this.lexer);
	    }
	  }

	  emStrong(src, maskedSrc, prevChar = '') {
	    let match = this.rules.inline.emStrong.lDelim.exec(src);
	    if (!match) return;

	    // _ can't be between two alphanumerics. \p{L}\p{N} includes non-english alphabet/numbers as well
	    if (match[3] && prevChar.match(/[\p{L}\p{N}]/u)) return;

	    const nextChar = match[1] || match[2] || '';

	    if (!nextChar || (nextChar && (prevChar === '' || this.rules.inline.punctuation.exec(prevChar)))) {
	      const lLength = match[0].length - 1;
	      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;

	      const endReg = match[0][0] === '*' ? this.rules.inline.emStrong.rDelimAst : this.rules.inline.emStrong.rDelimUnd;
	      endReg.lastIndex = 0;

	      // Clip maskedSrc to same section of string as src (move to lexer?)
	      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);

	      while ((match = endReg.exec(maskedSrc)) != null) {
	        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];

	        if (!rDelim) continue; // skip single * in __abc*abc__

	        rLength = rDelim.length;

	        if (match[3] || match[4]) { // found another Left Delim
	          delimTotal += rLength;
	          continue;
	        } else if (match[5] || match[6]) { // either Left or Right Delim
	          if (lLength % 3 && !((lLength + rLength) % 3)) {
	            midDelimTotal += rLength;
	            continue; // CommonMark Emphasis Rules 9-10
	          }
	        }

	        delimTotal -= rLength;

	        if (delimTotal > 0) continue; // Haven't found enough closing delimiters

	        // Remove extra characters. *a*** -> *a*
	        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);

	        const raw = src.slice(0, lLength + match.index + (match[0].length - rDelim.length) + rLength);

	        // Create `em` if smallest delimiter has odd char count. *a***
	        if (Math.min(lLength, rLength) % 2) {
	          const text = raw.slice(1, -1);
	          return {
	            type: 'em',
	            raw,
	            text,
	            tokens: this.lexer.inlineTokens(text)
	          };
	        }

	        // Create 'strong' if smallest delimiter has even char count. **a***
	        const text = raw.slice(2, -2);
	        return {
	          type: 'strong',
	          raw,
	          text,
	          tokens: this.lexer.inlineTokens(text)
	        };
	      }
	    }
	  }

	  codespan(src) {
	    const cap = this.rules.inline.code.exec(src);
	    if (cap) {
	      let text = cap[2].replace(/\n/g, ' ');
	      const hasNonSpaceChars = /[^ ]/.test(text);
	      const hasSpaceCharsOnBothEnds = /^ /.test(text) && / $/.test(text);
	      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
	        text = text.substring(1, text.length - 1);
	      }
	      text = escape(text, true);
	      return {
	        type: 'codespan',
	        raw: cap[0],
	        text
	      };
	    }
	  }

	  br(src) {
	    const cap = this.rules.inline.br.exec(src);
	    if (cap) {
	      return {
	        type: 'br',
	        raw: cap[0]
	      };
	    }
	  }

	  del(src) {
	    const cap = this.rules.inline.del.exec(src);
	    if (cap) {
	      return {
	        type: 'del',
	        raw: cap[0],
	        text: cap[2],
	        tokens: this.lexer.inlineTokens(cap[2])
	      };
	    }
	  }

	  autolink(src, mangle) {
	    const cap = this.rules.inline.autolink.exec(src);
	    if (cap) {
	      let text, href;
	      if (cap[2] === '@') {
	        text = escape(this.options.mangle ? mangle(cap[1]) : cap[1]);
	        href = 'mailto:' + text;
	      } else {
	        text = escape(cap[1]);
	        href = text;
	      }

	      return {
	        type: 'link',
	        raw: cap[0],
	        text,
	        href,
	        tokens: [
	          {
	            type: 'text',
	            raw: text,
	            text
	          }
	        ]
	      };
	    }
	  }

	  url(src, mangle) {
	    let cap;
	    if (cap = this.rules.inline.url.exec(src)) {
	      let text, href;
	      if (cap[2] === '@') {
	        text = escape(this.options.mangle ? mangle(cap[0]) : cap[0]);
	        href = 'mailto:' + text;
	      } else {
	        // do extended autolink path validation
	        let prevCapZero;
	        do {
	          prevCapZero = cap[0];
	          cap[0] = this.rules.inline._backpedal.exec(cap[0])[0];
	        } while (prevCapZero !== cap[0]);
	        text = escape(cap[0]);
	        if (cap[1] === 'www.') {
	          href = 'http://' + cap[0];
	        } else {
	          href = cap[0];
	        }
	      }
	      return {
	        type: 'link',
	        raw: cap[0],
	        text,
	        href,
	        tokens: [
	          {
	            type: 'text',
	            raw: text,
	            text
	          }
	        ]
	      };
	    }
	  }

	  inlineText(src, smartypants) {
	    const cap = this.rules.inline.text.exec(src);
	    if (cap) {
	      let text;
	      if (this.lexer.state.inRawBlock) {
	        text = this.options.sanitize ? (this.options.sanitizer ? this.options.sanitizer(cap[0]) : escape(cap[0])) : cap[0];
	      } else {
	        text = escape(this.options.smartypants ? smartypants(cap[0]) : cap[0]);
	      }
	      return {
	        type: 'text',
	        raw: cap[0],
	        text
	      };
	    }
	  }
	}

	/**
	 * Block-Level Grammar
	 */
	const block = {
	  newline: /^(?: *(?:\n|$))+/,
	  code: /^( {4}[^\n]+(?:\n(?: *(?:\n|$))*)?)+/,
	  fences: /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,
	  hr: /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,
	  heading: /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,
	  blockquote: /^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/,
	  list: /^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/,
	  html: '^ {0,3}(?:' // optional indentation
	    + '<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)' // (1)
	    + '|comment[^\\n]*(\\n+|$)' // (2)
	    + '|<\\?[\\s\\S]*?(?:\\?>\\n*|$)' // (3)
	    + '|<![A-Z][\\s\\S]*?(?:>\\n*|$)' // (4)
	    + '|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)' // (5)
	    + '|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n *)+\\n|$)' // (6)
	    + '|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)' // (7) open tag
	    + '|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)' // (7) closing tag
	    + ')',
	  def: /^ {0,3}\[(label)\]: *(?:\n *)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n *)?| *\n *)(title))? *(?:\n+|$)/,
	  table: noopTest,
	  lheading: /^((?:.|\n(?!\n))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
	  // regex template, placeholders will be replaced according to different paragraph
	  // interruption rules of commonmark and the original markdown spec:
	  _paragraph: /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,
	  text: /^[^\n]+/
	};

	block._label = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
	block._title = /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/;
	block.def = edit(block.def)
	  .replace('label', block._label)
	  .replace('title', block._title)
	  .getRegex();

	block.bullet = /(?:[*+-]|\d{1,9}[.)])/;
	block.listItemStart = edit(/^( *)(bull) */)
	  .replace('bull', block.bullet)
	  .getRegex();

	block.list = edit(block.list)
	  .replace(/bull/g, block.bullet)
	  .replace('hr', '\\n+(?=\\1?(?:(?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$))')
	  .replace('def', '\\n+(?=' + block.def.source + ')')
	  .getRegex();

	block._tag = 'address|article|aside|base|basefont|blockquote|body|caption'
	  + '|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption'
	  + '|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe'
	  + '|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option'
	  + '|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr'
	  + '|track|ul';
	block._comment = /<!--(?!-?>)[\s\S]*?(?:-->|$)/;
	block.html = edit(block.html, 'i')
	  .replace('comment', block._comment)
	  .replace('tag', block._tag)
	  .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
	  .getRegex();

	block.paragraph = edit(block._paragraph)
	  .replace('hr', block.hr)
	  .replace('heading', ' {0,3}#{1,6} ')
	  .replace('|lheading', '') // setex headings don't interrupt commonmark paragraphs
	  .replace('|table', '')
	  .replace('blockquote', ' {0,3}>')
	  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
	  .replace('list', ' {0,3}(?:[*+-]|1[.)]) ') // only lists starting from 1 can interrupt
	  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
	  .replace('tag', block._tag) // pars can be interrupted by type (6) html blocks
	  .getRegex();

	block.blockquote = edit(block.blockquote)
	  .replace('paragraph', block.paragraph)
	  .getRegex();

	/**
	 * Normal Block Grammar
	 */

	block.normal = { ...block };

	/**
	 * GFM Block Grammar
	 */

	block.gfm = {
	  ...block.normal,
	  table: '^ *([^\\n ].*\\|.*)\\n' // Header
	    + ' {0,3}(?:\\| *)?(:?-+:? *(?:\\| *:?-+:? *)*)(?:\\| *)?' // Align
	    + '(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)' // Cells
	};

	block.gfm.table = edit(block.gfm.table)
	  .replace('hr', block.hr)
	  .replace('heading', ' {0,3}#{1,6} ')
	  .replace('blockquote', ' {0,3}>')
	  .replace('code', ' {4}[^\\n]')
	  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
	  .replace('list', ' {0,3}(?:[*+-]|1[.)]) ') // only lists starting from 1 can interrupt
	  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
	  .replace('tag', block._tag) // tables can be interrupted by type (6) html blocks
	  .getRegex();

	block.gfm.paragraph = edit(block._paragraph)
	  .replace('hr', block.hr)
	  .replace('heading', ' {0,3}#{1,6} ')
	  .replace('|lheading', '') // setex headings don't interrupt commonmark paragraphs
	  .replace('table', block.gfm.table) // interrupt paragraphs with table
	  .replace('blockquote', ' {0,3}>')
	  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
	  .replace('list', ' {0,3}(?:[*+-]|1[.)]) ') // only lists starting from 1 can interrupt
	  .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
	  .replace('tag', block._tag) // pars can be interrupted by type (6) html blocks
	  .getRegex();
	/**
	 * Pedantic grammar (original John Gruber's loose markdown specification)
	 */

	block.pedantic = {
	  ...block.normal,
	  html: edit(
	    '^ *(?:comment *(?:\\n|\\s*$)'
	    + '|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)' // closed tag
	    + '|<tag(?:"[^"]*"|\'[^\']*\'|\\s[^\'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))')
	    .replace('comment', block._comment)
	    .replace(/tag/g, '(?!(?:'
	      + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub'
	      + '|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)'
	      + '\\b)\\w+(?!:|[^\\w\\s@]*@)\\b')
	    .getRegex(),
	  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
	  heading: /^(#{1,6})(.*)(?:\n+|$)/,
	  fences: noopTest, // fences not supported
	  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
	  paragraph: edit(block.normal._paragraph)
	    .replace('hr', block.hr)
	    .replace('heading', ' *#{1,6} *[^\n]')
	    .replace('lheading', block.lheading)
	    .replace('blockquote', ' {0,3}>')
	    .replace('|fences', '')
	    .replace('|list', '')
	    .replace('|html', '')
	    .getRegex()
	};

	/**
	 * Inline-Level Grammar
	 */
	const inline = {
	  escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,
	  autolink: /^<(scheme:[^\s\x00-\x1f<>]*|email)>/,
	  url: noopTest,
	  tag: '^comment'
	    + '|^</[a-zA-Z][\\w:-]*\\s*>' // self-closing tag
	    + '|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>' // open tag
	    + '|^<\\?[\\s\\S]*?\\?>' // processing instruction, e.g. <?php ?>
	    + '|^<![a-zA-Z]+\\s[\\s\\S]*?>' // declaration, e.g. <!DOCTYPE html>
	    + '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>', // CDATA section
	  link: /^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/,
	  reflink: /^!?\[(label)\]\[(ref)\]/,
	  nolink: /^!?\[(ref)\](?:\[\])?/,
	  reflinkSearch: 'reflink|nolink(?!\\()',
	  emStrong: {
	    lDelim: /^(?:\*+(?:([punct_])|[^\s*]))|^_+(?:([punct*])|([^\s_]))/,
	    //        (1) and (2) can only be a Right Delimiter. (3) and (4) can only be Left.  (5) and (6) can be either Left or Right.
	    //          () Skip orphan inside strong                                      () Consume to delim     (1) #***                (2) a***#, a***                             (3) #***a, ***a                 (4) ***#              (5) #***#                 (6) a***a
	    rDelimAst: /^(?:[^_*\\]|\\.)*?\_\_(?:[^_*\\]|\\.)*?\*(?:[^_*\\]|\\.)*?(?=\_\_)|(?:[^*\\]|\\.)+(?=[^*])|[punct_](\*+)(?=[\s]|$)|(?:[^punct*_\s\\]|\\.)(\*+)(?=[punct_\s]|$)|[punct_\s](\*+)(?=[^punct*_\s])|[\s](\*+)(?=[punct_])|[punct_](\*+)(?=[punct_])|(?:[^punct*_\s\\]|\\.)(\*+)(?=[^punct*_\s])/,
	    rDelimUnd: /^(?:[^_*\\]|\\.)*?\*\*(?:[^_*\\]|\\.)*?\_(?:[^_*\\]|\\.)*?(?=\*\*)|(?:[^_\\]|\\.)+(?=[^_])|[punct*](\_+)(?=[\s]|$)|(?:[^punct*_\s\\]|\\.)(\_+)(?=[punct*\s]|$)|[punct*\s](\_+)(?=[^punct*_\s])|[\s](\_+)(?=[punct*])|[punct*](\_+)(?=[punct*])/ // ^- Not allowed for _
	  },
	  code: /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
	  br: /^( {2,}|\\)\n(?!\s*$)/,
	  del: noopTest,
	  text: /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,
	  punctuation: /^([\spunctuation])/
	};

	// list of punctuation marks from CommonMark spec
	// without * and _ to handle the different emphasis markers * and _
	inline._punctuation = '!"#$%&\'()+\\-.,/:;<=>?@\\[\\]`^{|}~';
	inline.punctuation = edit(inline.punctuation).replace(/punctuation/g, inline._punctuation).getRegex();

	// sequences em should skip over [title](link), `code`, <html>
	inline.blockSkip = /\[[^\]]*?\]\([^\)]*?\)|`[^`]*?`|<[^>]*?>/g;
	// lookbehind is not available on Safari as of version 16
	// inline.escapedEmSt = /(?<=(?:^|[^\\)(?:\\[^])*)\\[*_]/g;
	inline.escapedEmSt = /(?:^|[^\\])(?:\\\\)*\\[*_]/g;

	inline._comment = edit(block._comment).replace('(?:-->|$)', '-->').getRegex();

	inline.emStrong.lDelim = edit(inline.emStrong.lDelim)
	  .replace(/punct/g, inline._punctuation)
	  .getRegex();

	inline.emStrong.rDelimAst = edit(inline.emStrong.rDelimAst, 'g')
	  .replace(/punct/g, inline._punctuation)
	  .getRegex();

	inline.emStrong.rDelimUnd = edit(inline.emStrong.rDelimUnd, 'g')
	  .replace(/punct/g, inline._punctuation)
	  .getRegex();

	inline._escapes = /\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/g;

	inline._scheme = /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/;
	inline._email = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/;
	inline.autolink = edit(inline.autolink)
	  .replace('scheme', inline._scheme)
	  .replace('email', inline._email)
	  .getRegex();

	inline._attribute = /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/;

	inline.tag = edit(inline.tag)
	  .replace('comment', inline._comment)
	  .replace('attribute', inline._attribute)
	  .getRegex();

	inline._label = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
	inline._href = /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/;
	inline._title = /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/;

	inline.link = edit(inline.link)
	  .replace('label', inline._label)
	  .replace('href', inline._href)
	  .replace('title', inline._title)
	  .getRegex();

	inline.reflink = edit(inline.reflink)
	  .replace('label', inline._label)
	  .replace('ref', block._label)
	  .getRegex();

	inline.nolink = edit(inline.nolink)
	  .replace('ref', block._label)
	  .getRegex();

	inline.reflinkSearch = edit(inline.reflinkSearch, 'g')
	  .replace('reflink', inline.reflink)
	  .replace('nolink', inline.nolink)
	  .getRegex();

	/**
	 * Normal Inline Grammar
	 */

	inline.normal = { ...inline };

	/**
	 * Pedantic Inline Grammar
	 */

	inline.pedantic = {
	  ...inline.normal,
	  strong: {
	    start: /^__|\*\*/,
	    middle: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
	    endAst: /\*\*(?!\*)/g,
	    endUnd: /__(?!_)/g
	  },
	  em: {
	    start: /^_|\*/,
	    middle: /^()\*(?=\S)([\s\S]*?\S)\*(?!\*)|^_(?=\S)([\s\S]*?\S)_(?!_)/,
	    endAst: /\*(?!\*)/g,
	    endUnd: /_(?!_)/g
	  },
	  link: edit(/^!?\[(label)\]\((.*?)\)/)
	    .replace('label', inline._label)
	    .getRegex(),
	  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/)
	    .replace('label', inline._label)
	    .getRegex()
	};

	/**
	 * GFM Inline Grammar
	 */

	inline.gfm = {
	  ...inline.normal,
	  escape: edit(inline.escape).replace('])', '~|])').getRegex(),
	  _extended_email: /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/,
	  url: /^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,
	  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
	  del: /^(~~?)(?=[^\s~])([\s\S]*?[^\s~])\1(?=[^~]|$)/,
	  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
	};

	inline.gfm.url = edit(inline.gfm.url, 'i')
	  .replace('email', inline.gfm._extended_email)
	  .getRegex();
	/**
	 * GFM + Line Breaks Inline Grammar
	 */

	inline.breaks = {
	  ...inline.gfm,
	  br: edit(inline.br).replace('{2,}', '*').getRegex(),
	  text: edit(inline.gfm.text)
	    .replace('\\b_', '\\b_| {2,}\\n')
	    .replace(/\{2,\}/g, '*')
	    .getRegex()
	};

	/**
	 * smartypants text replacement
	 * @param {string} text
	 */
	function smartypants(text) {
	  return text
	    // em-dashes
	    .replace(/---/g, '\u2014')
	    // en-dashes
	    .replace(/--/g, '\u2013')
	    // opening singles
	    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
	    // closing singles & apostrophes
	    .replace(/'/g, '\u2019')
	    // opening doubles
	    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
	    // closing doubles
	    .replace(/"/g, '\u201d')
	    // ellipses
	    .replace(/\.{3}/g, '\u2026');
	}

	/**
	 * mangle email addresses
	 * @param {string} text
	 */
	function mangle(text) {
	  let out = '',
	    i,
	    ch;

	  const l = text.length;
	  for (i = 0; i < l; i++) {
	    ch = text.charCodeAt(i);
	    if (Math.random() > 0.5) {
	      ch = 'x' + ch.toString(16);
	    }
	    out += '&#' + ch + ';';
	  }

	  return out;
	}

	/**
	 * Block Lexer
	 */
	class Lexer {
	  constructor(options) {
	    this.tokens = [];
	    this.tokens.links = Object.create(null);
	    this.options = options || defaults;
	    this.options.tokenizer = this.options.tokenizer || new Tokenizer();
	    this.tokenizer = this.options.tokenizer;
	    this.tokenizer.options = this.options;
	    this.tokenizer.lexer = this;
	    this.inlineQueue = [];
	    this.state = {
	      inLink: false,
	      inRawBlock: false,
	      top: true
	    };

	    const rules = {
	      block: block.normal,
	      inline: inline.normal
	    };

	    if (this.options.pedantic) {
	      rules.block = block.pedantic;
	      rules.inline = inline.pedantic;
	    } else if (this.options.gfm) {
	      rules.block = block.gfm;
	      if (this.options.breaks) {
	        rules.inline = inline.breaks;
	      } else {
	        rules.inline = inline.gfm;
	      }
	    }
	    this.tokenizer.rules = rules;
	  }

	  /**
	   * Expose Rules
	   */
	  static get rules() {
	    return {
	      block,
	      inline
	    };
	  }

	  /**
	   * Static Lex Method
	   */
	  static lex(src, options) {
	    const lexer = new Lexer(options);
	    return lexer.lex(src);
	  }

	  /**
	   * Static Lex Inline Method
	   */
	  static lexInline(src, options) {
	    const lexer = new Lexer(options);
	    return lexer.inlineTokens(src);
	  }

	  /**
	   * Preprocessing
	   */
	  lex(src) {
	    src = src
	      .replace(/\r\n|\r/g, '\n');

	    this.blockTokens(src, this.tokens);

	    let next;
	    while (next = this.inlineQueue.shift()) {
	      this.inlineTokens(next.src, next.tokens);
	    }

	    return this.tokens;
	  }

	  /**
	   * Lexing
	   */
	  blockTokens(src, tokens = []) {
	    if (this.options.pedantic) {
	      src = src.replace(/\t/g, '    ').replace(/^ +$/gm, '');
	    } else {
	      src = src.replace(/^( *)(\t+)/gm, (_, leading, tabs) => {
	        return leading + '    '.repeat(tabs.length);
	      });
	    }

	    let token, lastToken, cutSrc, lastParagraphClipped;

	    while (src) {
	      if (this.options.extensions
	        && this.options.extensions.block
	        && this.options.extensions.block.some((extTokenizer) => {
	          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
	            src = src.substring(token.raw.length);
	            tokens.push(token);
	            return true;
	          }
	          return false;
	        })) {
	        continue;
	      }

	      // newline
	      if (token = this.tokenizer.space(src)) {
	        src = src.substring(token.raw.length);
	        if (token.raw.length === 1 && tokens.length > 0) {
	          // if there's a single \n as a spacer, it's terminating the last line,
	          // so move it there so that we don't get unecessary paragraph tags
	          tokens[tokens.length - 1].raw += '\n';
	        } else {
	          tokens.push(token);
	        }
	        continue;
	      }

	      // code
	      if (token = this.tokenizer.code(src)) {
	        src = src.substring(token.raw.length);
	        lastToken = tokens[tokens.length - 1];
	        // An indented code block cannot interrupt a paragraph.
	        if (lastToken && (lastToken.type === 'paragraph' || lastToken.type === 'text')) {
	          lastToken.raw += '\n' + token.raw;
	          lastToken.text += '\n' + token.text;
	          this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
	        } else {
	          tokens.push(token);
	        }
	        continue;
	      }

	      // fences
	      if (token = this.tokenizer.fences(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // heading
	      if (token = this.tokenizer.heading(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // hr
	      if (token = this.tokenizer.hr(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // blockquote
	      if (token = this.tokenizer.blockquote(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // list
	      if (token = this.tokenizer.list(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // html
	      if (token = this.tokenizer.html(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // def
	      if (token = this.tokenizer.def(src)) {
	        src = src.substring(token.raw.length);
	        lastToken = tokens[tokens.length - 1];
	        if (lastToken && (lastToken.type === 'paragraph' || lastToken.type === 'text')) {
	          lastToken.raw += '\n' + token.raw;
	          lastToken.text += '\n' + token.raw;
	          this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
	        } else if (!this.tokens.links[token.tag]) {
	          this.tokens.links[token.tag] = {
	            href: token.href,
	            title: token.title
	          };
	        }
	        continue;
	      }

	      // table (gfm)
	      if (token = this.tokenizer.table(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // lheading
	      if (token = this.tokenizer.lheading(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // top-level paragraph
	      // prevent paragraph consuming extensions by clipping 'src' to extension start
	      cutSrc = src;
	      if (this.options.extensions && this.options.extensions.startBlock) {
	        let startIndex = Infinity;
	        const tempSrc = src.slice(1);
	        let tempStart;
	        this.options.extensions.startBlock.forEach(function(getStartIndex) {
	          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
	          if (typeof tempStart === 'number' && tempStart >= 0) { startIndex = Math.min(startIndex, tempStart); }
	        });
	        if (startIndex < Infinity && startIndex >= 0) {
	          cutSrc = src.substring(0, startIndex + 1);
	        }
	      }
	      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
	        lastToken = tokens[tokens.length - 1];
	        if (lastParagraphClipped && lastToken.type === 'paragraph') {
	          lastToken.raw += '\n' + token.raw;
	          lastToken.text += '\n' + token.text;
	          this.inlineQueue.pop();
	          this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
	        } else {
	          tokens.push(token);
	        }
	        lastParagraphClipped = (cutSrc.length !== src.length);
	        src = src.substring(token.raw.length);
	        continue;
	      }

	      // text
	      if (token = this.tokenizer.text(src)) {
	        src = src.substring(token.raw.length);
	        lastToken = tokens[tokens.length - 1];
	        if (lastToken && lastToken.type === 'text') {
	          lastToken.raw += '\n' + token.raw;
	          lastToken.text += '\n' + token.text;
	          this.inlineQueue.pop();
	          this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
	        } else {
	          tokens.push(token);
	        }
	        continue;
	      }

	      if (src) {
	        const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
	        if (this.options.silent) {
	          console.error(errMsg);
	          break;
	        } else {
	          throw new Error(errMsg);
	        }
	      }
	    }

	    this.state.top = true;
	    return tokens;
	  }

	  inline(src, tokens = []) {
	    this.inlineQueue.push({ src, tokens });
	    return tokens;
	  }

	  /**
	   * Lexing/Compiling
	   */
	  inlineTokens(src, tokens = []) {
	    let token, lastToken, cutSrc;

	    // String with links masked to avoid interference with em and strong
	    let maskedSrc = src;
	    let match;
	    let keepPrevChar, prevChar;

	    // Mask out reflinks
	    if (this.tokens.links) {
	      const links = Object.keys(this.tokens.links);
	      if (links.length > 0) {
	        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
	          if (links.includes(match[0].slice(match[0].lastIndexOf('[') + 1, -1))) {
	            maskedSrc = maskedSrc.slice(0, match.index) + '[' + repeatString('a', match[0].length - 2) + ']' + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
	          }
	        }
	      }
	    }
	    // Mask out other blocks
	    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
	      maskedSrc = maskedSrc.slice(0, match.index) + '[' + repeatString('a', match[0].length - 2) + ']' + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
	    }

	    // Mask out escaped em & strong delimiters
	    while ((match = this.tokenizer.rules.inline.escapedEmSt.exec(maskedSrc)) != null) {
	      maskedSrc = maskedSrc.slice(0, match.index + match[0].length - 2) + '++' + maskedSrc.slice(this.tokenizer.rules.inline.escapedEmSt.lastIndex);
	      this.tokenizer.rules.inline.escapedEmSt.lastIndex--;
	    }

	    while (src) {
	      if (!keepPrevChar) {
	        prevChar = '';
	      }
	      keepPrevChar = false;

	      // extensions
	      if (this.options.extensions
	        && this.options.extensions.inline
	        && this.options.extensions.inline.some((extTokenizer) => {
	          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
	            src = src.substring(token.raw.length);
	            tokens.push(token);
	            return true;
	          }
	          return false;
	        })) {
	        continue;
	      }

	      // escape
	      if (token = this.tokenizer.escape(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // tag
	      if (token = this.tokenizer.tag(src)) {
	        src = src.substring(token.raw.length);
	        lastToken = tokens[tokens.length - 1];
	        if (lastToken && token.type === 'text' && lastToken.type === 'text') {
	          lastToken.raw += token.raw;
	          lastToken.text += token.text;
	        } else {
	          tokens.push(token);
	        }
	        continue;
	      }

	      // link
	      if (token = this.tokenizer.link(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // reflink, nolink
	      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
	        src = src.substring(token.raw.length);
	        lastToken = tokens[tokens.length - 1];
	        if (lastToken && token.type === 'text' && lastToken.type === 'text') {
	          lastToken.raw += token.raw;
	          lastToken.text += token.text;
	        } else {
	          tokens.push(token);
	        }
	        continue;
	      }

	      // em & strong
	      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // code
	      if (token = this.tokenizer.codespan(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // br
	      if (token = this.tokenizer.br(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // del (gfm)
	      if (token = this.tokenizer.del(src)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // autolink
	      if (token = this.tokenizer.autolink(src, mangle)) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // url (gfm)
	      if (!this.state.inLink && (token = this.tokenizer.url(src, mangle))) {
	        src = src.substring(token.raw.length);
	        tokens.push(token);
	        continue;
	      }

	      // text
	      // prevent inlineText consuming extensions by clipping 'src' to extension start
	      cutSrc = src;
	      if (this.options.extensions && this.options.extensions.startInline) {
	        let startIndex = Infinity;
	        const tempSrc = src.slice(1);
	        let tempStart;
	        this.options.extensions.startInline.forEach(function(getStartIndex) {
	          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
	          if (typeof tempStart === 'number' && tempStart >= 0) { startIndex = Math.min(startIndex, tempStart); }
	        });
	        if (startIndex < Infinity && startIndex >= 0) {
	          cutSrc = src.substring(0, startIndex + 1);
	        }
	      }
	      if (token = this.tokenizer.inlineText(cutSrc, smartypants)) {
	        src = src.substring(token.raw.length);
	        if (token.raw.slice(-1) !== '_') { // Track prevChar before string of ____ started
	          prevChar = token.raw.slice(-1);
	        }
	        keepPrevChar = true;
	        lastToken = tokens[tokens.length - 1];
	        if (lastToken && lastToken.type === 'text') {
	          lastToken.raw += token.raw;
	          lastToken.text += token.text;
	        } else {
	          tokens.push(token);
	        }
	        continue;
	      }

	      if (src) {
	        const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
	        if (this.options.silent) {
	          console.error(errMsg);
	          break;
	        } else {
	          throw new Error(errMsg);
	        }
	      }
	    }

	    return tokens;
	  }
	}

	/**
	 * Renderer
	 */
	class Renderer {
	  constructor(options) {
	    this.options = options || defaults;
	  }

	  code(code, infostring, escaped) {
	    const lang = (infostring || '').match(/\S*/)[0];
	    if (this.options.highlight) {
	      const out = this.options.highlight(code, lang);
	      if (out != null && out !== code) {
	        escaped = true;
	        code = out;
	      }
	    }

	    code = code.replace(/\n$/, '') + '\n';

	    if (!lang) {
	      return '<pre><code>'
	        + (escaped ? code : escape(code, true))
	        + '</code></pre>\n';
	    }

	    return '<pre><code class="'
	      + this.options.langPrefix
	      + escape(lang)
	      + '">'
	      + (escaped ? code : escape(code, true))
	      + '</code></pre>\n';
	  }

	  /**
	   * @param {string} quote
	   */
	  blockquote(quote) {
	    return `<blockquote>\n${quote}</blockquote>\n`;
	  }

	  html(html) {
	    return html;
	  }

	  /**
	   * @param {string} text
	   * @param {string} level
	   * @param {string} raw
	   * @param {any} slugger
	   */
	  heading(text, level, raw, slugger) {
	    if (this.options.headerIds) {
	      const id = this.options.headerPrefix + slugger.slug(raw);
	      return `<h${level} id="${id}">${text}</h${level}>\n`;
	    }

	    // ignore IDs
	    return `<h${level}>${text}</h${level}>\n`;
	  }

	  hr() {
	    return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
	  }

	  list(body, ordered, start) {
	    const type = ordered ? 'ol' : 'ul',
	      startatt = (ordered && start !== 1) ? (' start="' + start + '"') : '';
	    return '<' + type + startatt + '>\n' + body + '</' + type + '>\n';
	  }

	  /**
	   * @param {string} text
	   */
	  listitem(text) {
	    return `<li>${text}</li>\n`;
	  }

	  checkbox(checked) {
	    return '<input '
	      + (checked ? 'checked="" ' : '')
	      + 'disabled="" type="checkbox"'
	      + (this.options.xhtml ? ' /' : '')
	      + '> ';
	  }

	  /**
	   * @param {string} text
	   */
	  paragraph(text) {
	    return `<p>${text}</p>\n`;
	  }

	  /**
	   * @param {string} header
	   * @param {string} body
	   */
	  table(header, body) {
	    if (body) body = `<tbody>${body}</tbody>`;

	    return '<table>\n'
	      + '<thead>\n'
	      + header
	      + '</thead>\n'
	      + body
	      + '</table>\n';
	  }

	  /**
	   * @param {string} content
	   */
	  tablerow(content) {
	    return `<tr>\n${content}</tr>\n`;
	  }

	  tablecell(content, flags) {
	    const type = flags.header ? 'th' : 'td';
	    const tag = flags.align
	      ? `<${type} align="${flags.align}">`
	      : `<${type}>`;
	    return tag + content + `</${type}>\n`;
	  }

	  /**
	   * span level renderer
	   * @param {string} text
	   */
	  strong(text) {
	    return `<strong>${text}</strong>`;
	  }

	  /**
	   * @param {string} text
	   */
	  em(text) {
	    return `<em>${text}</em>`;
	  }

	  /**
	   * @param {string} text
	   */
	  codespan(text) {
	    return `<code>${text}</code>`;
	  }

	  br() {
	    return this.options.xhtml ? '<br/>' : '<br>';
	  }

	  /**
	   * @param {string} text
	   */
	  del(text) {
	    return `<del>${text}</del>`;
	  }

	  /**
	   * @param {string} href
	   * @param {string} title
	   * @param {string} text
	   */
	  link(href, title, text) {
	    href = cleanUrl(this.options.sanitize, this.options.baseUrl, href);
	    if (href === null) {
	      return text;
	    }
	    let out = '<a href="' + href + '"';
	    if (title) {
	      out += ' title="' + title + '"';
	    }
	    out += '>' + text + '</a>';
	    return out;
	  }

	  /**
	   * @param {string} href
	   * @param {string} title
	   * @param {string} text
	   */
	  image(href, title, text) {
	    href = cleanUrl(this.options.sanitize, this.options.baseUrl, href);
	    if (href === null) {
	      return text;
	    }

	    let out = `<img src="${href}" alt="${text}"`;
	    if (title) {
	      out += ` title="${title}"`;
	    }
	    out += this.options.xhtml ? '/>' : '>';
	    return out;
	  }

	  text(text) {
	    return text;
	  }
	}

	/**
	 * TextRenderer
	 * returns only the textual part of the token
	 */
	class TextRenderer {
	  // no need for block level renderers
	  strong(text) {
	    return text;
	  }

	  em(text) {
	    return text;
	  }

	  codespan(text) {
	    return text;
	  }

	  del(text) {
	    return text;
	  }

	  html(text) {
	    return text;
	  }

	  text(text) {
	    return text;
	  }

	  link(href, title, text) {
	    return '' + text;
	  }

	  image(href, title, text) {
	    return '' + text;
	  }

	  br() {
	    return '';
	  }
	}

	/**
	 * Slugger generates header id
	 */
	class Slugger {
	  constructor() {
	    this.seen = {};
	  }

	  /**
	   * @param {string} value
	   */
	  serialize(value) {
	    return value
	      .toLowerCase()
	      .trim()
	      // remove html tags
	      .replace(/<[!\/a-z].*?>/ig, '')
	      // remove unwanted chars
	      .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
	      .replace(/\s/g, '-');
	  }

	  /**
	   * Finds the next safe (unique) slug to use
	   * @param {string} originalSlug
	   * @param {boolean} isDryRun
	   */
	  getNextSafeSlug(originalSlug, isDryRun) {
	    let slug = originalSlug;
	    let occurenceAccumulator = 0;
	    if (this.seen.hasOwnProperty(slug)) {
	      occurenceAccumulator = this.seen[originalSlug];
	      do {
	        occurenceAccumulator++;
	        slug = originalSlug + '-' + occurenceAccumulator;
	      } while (this.seen.hasOwnProperty(slug));
	    }
	    if (!isDryRun) {
	      this.seen[originalSlug] = occurenceAccumulator;
	      this.seen[slug] = 0;
	    }
	    return slug;
	  }

	  /**
	   * Convert string to unique id
	   * @param {object} [options]
	   * @param {boolean} [options.dryrun] Generates the next unique slug without
	   * updating the internal accumulator.
	   */
	  slug(value, options = {}) {
	    const slug = this.serialize(value);
	    return this.getNextSafeSlug(slug, options.dryrun);
	  }
	}

	/**
	 * Parsing & Compiling
	 */
	class Parser {
	  constructor(options) {
	    this.options = options || defaults;
	    this.options.renderer = this.options.renderer || new Renderer();
	    this.renderer = this.options.renderer;
	    this.renderer.options = this.options;
	    this.textRenderer = new TextRenderer();
	    this.slugger = new Slugger();
	  }

	  /**
	   * Static Parse Method
	   */
	  static parse(tokens, options) {
	    const parser = new Parser(options);
	    return parser.parse(tokens);
	  }

	  /**
	   * Static Parse Inline Method
	   */
	  static parseInline(tokens, options) {
	    const parser = new Parser(options);
	    return parser.parseInline(tokens);
	  }

	  /**
	   * Parse Loop
	   */
	  parse(tokens, top = true) {
	    let out = '',
	      i,
	      j,
	      k,
	      l2,
	      l3,
	      row,
	      cell,
	      header,
	      body,
	      token,
	      ordered,
	      start,
	      loose,
	      itemBody,
	      item,
	      checked,
	      task,
	      checkbox,
	      ret;

	    const l = tokens.length;
	    for (i = 0; i < l; i++) {
	      token = tokens[i];

	      // Run any renderer extensions
	      if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[token.type]) {
	        ret = this.options.extensions.renderers[token.type].call({ parser: this }, token);
	        if (ret !== false || !['space', 'hr', 'heading', 'code', 'table', 'blockquote', 'list', 'html', 'paragraph', 'text'].includes(token.type)) {
	          out += ret || '';
	          continue;
	        }
	      }

	      switch (token.type) {
	        case 'space': {
	          continue;
	        }
	        case 'hr': {
	          out += this.renderer.hr();
	          continue;
	        }
	        case 'heading': {
	          out += this.renderer.heading(
	            this.parseInline(token.tokens),
	            token.depth,
	            unescape(this.parseInline(token.tokens, this.textRenderer)),
	            this.slugger);
	          continue;
	        }
	        case 'code': {
	          out += this.renderer.code(token.text,
	            token.lang,
	            token.escaped);
	          continue;
	        }
	        case 'table': {
	          header = '';

	          // header
	          cell = '';
	          l2 = token.header.length;
	          for (j = 0; j < l2; j++) {
	            cell += this.renderer.tablecell(
	              this.parseInline(token.header[j].tokens),
	              { header: true, align: token.align[j] }
	            );
	          }
	          header += this.renderer.tablerow(cell);

	          body = '';
	          l2 = token.rows.length;
	          for (j = 0; j < l2; j++) {
	            row = token.rows[j];

	            cell = '';
	            l3 = row.length;
	            for (k = 0; k < l3; k++) {
	              cell += this.renderer.tablecell(
	                this.parseInline(row[k].tokens),
	                { header: false, align: token.align[k] }
	              );
	            }

	            body += this.renderer.tablerow(cell);
	          }
	          out += this.renderer.table(header, body);
	          continue;
	        }
	        case 'blockquote': {
	          body = this.parse(token.tokens);
	          out += this.renderer.blockquote(body);
	          continue;
	        }
	        case 'list': {
	          ordered = token.ordered;
	          start = token.start;
	          loose = token.loose;
	          l2 = token.items.length;

	          body = '';
	          for (j = 0; j < l2; j++) {
	            item = token.items[j];
	            checked = item.checked;
	            task = item.task;

	            itemBody = '';
	            if (item.task) {
	              checkbox = this.renderer.checkbox(checked);
	              if (loose) {
	                if (item.tokens.length > 0 && item.tokens[0].type === 'paragraph') {
	                  item.tokens[0].text = checkbox + ' ' + item.tokens[0].text;
	                  if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === 'text') {
	                    item.tokens[0].tokens[0].text = checkbox + ' ' + item.tokens[0].tokens[0].text;
	                  }
	                } else {
	                  item.tokens.unshift({
	                    type: 'text',
	                    text: checkbox
	                  });
	                }
	              } else {
	                itemBody += checkbox;
	              }
	            }

	            itemBody += this.parse(item.tokens, loose);
	            body += this.renderer.listitem(itemBody, task, checked);
	          }

	          out += this.renderer.list(body, ordered, start);
	          continue;
	        }
	        case 'html': {
	          // TODO parse inline content if parameter markdown=1
	          out += this.renderer.html(token.text);
	          continue;
	        }
	        case 'paragraph': {
	          out += this.renderer.paragraph(this.parseInline(token.tokens));
	          continue;
	        }
	        case 'text': {
	          body = token.tokens ? this.parseInline(token.tokens) : token.text;
	          while (i + 1 < l && tokens[i + 1].type === 'text') {
	            token = tokens[++i];
	            body += '\n' + (token.tokens ? this.parseInline(token.tokens) : token.text);
	          }
	          out += top ? this.renderer.paragraph(body) : body;
	          continue;
	        }

	        default: {
	          const errMsg = 'Token with "' + token.type + '" type was not found.';
	          if (this.options.silent) {
	            console.error(errMsg);
	            return;
	          } else {
	            throw new Error(errMsg);
	          }
	        }
	      }
	    }

	    return out;
	  }

	  /**
	   * Parse Inline Tokens
	   */
	  parseInline(tokens, renderer) {
	    renderer = renderer || this.renderer;
	    let out = '',
	      i,
	      token,
	      ret;

	    const l = tokens.length;
	    for (i = 0; i < l; i++) {
	      token = tokens[i];

	      // Run any renderer extensions
	      if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[token.type]) {
	        ret = this.options.extensions.renderers[token.type].call({ parser: this }, token);
	        if (ret !== false || !['escape', 'html', 'link', 'image', 'strong', 'em', 'codespan', 'br', 'del', 'text'].includes(token.type)) {
	          out += ret || '';
	          continue;
	        }
	      }

	      switch (token.type) {
	        case 'escape': {
	          out += renderer.text(token.text);
	          break;
	        }
	        case 'html': {
	          out += renderer.html(token.text);
	          break;
	        }
	        case 'link': {
	          out += renderer.link(token.href, token.title, this.parseInline(token.tokens, renderer));
	          break;
	        }
	        case 'image': {
	          out += renderer.image(token.href, token.title, token.text);
	          break;
	        }
	        case 'strong': {
	          out += renderer.strong(this.parseInline(token.tokens, renderer));
	          break;
	        }
	        case 'em': {
	          out += renderer.em(this.parseInline(token.tokens, renderer));
	          break;
	        }
	        case 'codespan': {
	          out += renderer.codespan(token.text);
	          break;
	        }
	        case 'br': {
	          out += renderer.br();
	          break;
	        }
	        case 'del': {
	          out += renderer.del(this.parseInline(token.tokens, renderer));
	          break;
	        }
	        case 'text': {
	          out += renderer.text(token.text);
	          break;
	        }
	        default: {
	          const errMsg = 'Token with "' + token.type + '" type was not found.';
	          if (this.options.silent) {
	            console.error(errMsg);
	            return;
	          } else {
	            throw new Error(errMsg);
	          }
	        }
	      }
	    }
	    return out;
	  }
	}

	class Hooks {
	  constructor(options) {
	    this.options = options || defaults;
	  }

	  static passThroughHooks = new Set([
	    'preprocess',
	    'postprocess'
	  ]);

	  /**
	   * Process markdown before marked
	   */
	  preprocess(markdown) {
	    return markdown;
	  }

	  /**
	   * Process HTML after marked is finished
	   */
	  postprocess(html) {
	    return html;
	  }
	}

	function onError(silent, async, callback) {
	  return (e) => {
	    e.message += '\nPlease report this to https://github.com/markedjs/marked.';

	    if (silent) {
	      const msg = '<p>An error occurred:</p><pre>'
	        + escape(e.message + '', true)
	        + '</pre>';
	      if (async) {
	        return Promise.resolve(msg);
	      }
	      if (callback) {
	        callback(null, msg);
	        return;
	      }
	      return msg;
	    }

	    if (async) {
	      return Promise.reject(e);
	    }
	    if (callback) {
	      callback(e);
	      return;
	    }
	    throw e;
	  };
	}

	function parseMarkdown(lexer, parser) {
	  return (src, opt, callback) => {
	    if (typeof opt === 'function') {
	      callback = opt;
	      opt = null;
	    }

	    const origOpt = { ...opt };
	    opt = { ...marked.defaults, ...origOpt };
	    const throwError = onError(opt.silent, opt.async, callback);

	    // throw error in case of non string input
	    if (typeof src === 'undefined' || src === null) {
	      return throwError(new Error('marked(): input parameter is undefined or null'));
	    }
	    if (typeof src !== 'string') {
	      return throwError(new Error('marked(): input parameter is of type '
	        + Object.prototype.toString.call(src) + ', string expected'));
	    }

	    checkSanitizeDeprecation(opt);

	    if (opt.hooks) {
	      opt.hooks.options = opt;
	    }

	    if (callback) {
	      const highlight = opt.highlight;
	      let tokens;

	      try {
	        if (opt.hooks) {
	          src = opt.hooks.preprocess(src);
	        }
	        tokens = lexer(src, opt);
	      } catch (e) {
	        return throwError(e);
	      }

	      const done = function(err) {
	        let out;

	        if (!err) {
	          try {
	            if (opt.walkTokens) {
	              marked.walkTokens(tokens, opt.walkTokens);
	            }
	            out = parser(tokens, opt);
	            if (opt.hooks) {
	              out = opt.hooks.postprocess(out);
	            }
	          } catch (e) {
	            err = e;
	          }
	        }

	        opt.highlight = highlight;

	        return err
	          ? throwError(err)
	          : callback(null, out);
	      };

	      if (!highlight || highlight.length < 3) {
	        return done();
	      }

	      delete opt.highlight;

	      if (!tokens.length) return done();

	      let pending = 0;
	      marked.walkTokens(tokens, function(token) {
	        if (token.type === 'code') {
	          pending++;
	          setTimeout(() => {
	            highlight(token.text, token.lang, function(err, code) {
	              if (err) {
	                return done(err);
	              }
	              if (code != null && code !== token.text) {
	                token.text = code;
	                token.escaped = true;
	              }

	              pending--;
	              if (pending === 0) {
	                done();
	              }
	            });
	          }, 0);
	        }
	      });

	      if (pending === 0) {
	        done();
	      }

	      return;
	    }

	    if (opt.async) {
	      return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src)
	        .then(src => lexer(src, opt))
	        .then(tokens => opt.walkTokens ? Promise.all(marked.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens)
	        .then(tokens => parser(tokens, opt))
	        .then(html => opt.hooks ? opt.hooks.postprocess(html) : html)
	        .catch(throwError);
	    }

	    try {
	      if (opt.hooks) {
	        src = opt.hooks.preprocess(src);
	      }
	      const tokens = lexer(src, opt);
	      if (opt.walkTokens) {
	        marked.walkTokens(tokens, opt.walkTokens);
	      }
	      let html = parser(tokens, opt);
	      if (opt.hooks) {
	        html = opt.hooks.postprocess(html);
	      }
	      return html;
	    } catch (e) {
	      return throwError(e);
	    }
	  };
	}

	/**
	 * Marked
	 */
	function marked(src, opt, callback) {
	  return parseMarkdown(Lexer.lex, Parser.parse)(src, opt, callback);
	}

	/**
	 * Options
	 */

	marked.options =
	marked.setOptions = function(opt) {
	  marked.defaults = { ...marked.defaults, ...opt };
	  changeDefaults(marked.defaults);
	  return marked;
	};

	marked.getDefaults = getDefaults;

	marked.defaults = defaults;

	/**
	 * Use Extension
	 */

	marked.use = function(...args) {
	  const extensions = marked.defaults.extensions || { renderers: {}, childTokens: {} };

	  args.forEach((pack) => {
	    // copy options to new object
	    const opts = { ...pack };

	    // set async to true if it was set to true before
	    opts.async = marked.defaults.async || opts.async || false;

	    // ==-- Parse "addon" extensions --== //
	    if (pack.extensions) {
	      pack.extensions.forEach((ext) => {
	        if (!ext.name) {
	          throw new Error('extension name required');
	        }
	        if (ext.renderer) { // Renderer extensions
	          const prevRenderer = extensions.renderers[ext.name];
	          if (prevRenderer) {
	            // Replace extension with func to run new extension but fall back if false
	            extensions.renderers[ext.name] = function(...args) {
	              let ret = ext.renderer.apply(this, args);
	              if (ret === false) {
	                ret = prevRenderer.apply(this, args);
	              }
	              return ret;
	            };
	          } else {
	            extensions.renderers[ext.name] = ext.renderer;
	          }
	        }
	        if (ext.tokenizer) { // Tokenizer Extensions
	          if (!ext.level || (ext.level !== 'block' && ext.level !== 'inline')) {
	            throw new Error("extension level must be 'block' or 'inline'");
	          }
	          if (extensions[ext.level]) {
	            extensions[ext.level].unshift(ext.tokenizer);
	          } else {
	            extensions[ext.level] = [ext.tokenizer];
	          }
	          if (ext.start) { // Function to check for start of token
	            if (ext.level === 'block') {
	              if (extensions.startBlock) {
	                extensions.startBlock.push(ext.start);
	              } else {
	                extensions.startBlock = [ext.start];
	              }
	            } else if (ext.level === 'inline') {
	              if (extensions.startInline) {
	                extensions.startInline.push(ext.start);
	              } else {
	                extensions.startInline = [ext.start];
	              }
	            }
	          }
	        }
	        if (ext.childTokens) { // Child tokens to be visited by walkTokens
	          extensions.childTokens[ext.name] = ext.childTokens;
	        }
	      });
	      opts.extensions = extensions;
	    }

	    // ==-- Parse "overwrite" extensions --== //
	    if (pack.renderer) {
	      const renderer = marked.defaults.renderer || new Renderer();
	      for (const prop in pack.renderer) {
	        const prevRenderer = renderer[prop];
	        // Replace renderer with func to run extension, but fall back if false
	        renderer[prop] = (...args) => {
	          let ret = pack.renderer[prop].apply(renderer, args);
	          if (ret === false) {
	            ret = prevRenderer.apply(renderer, args);
	          }
	          return ret;
	        };
	      }
	      opts.renderer = renderer;
	    }
	    if (pack.tokenizer) {
	      const tokenizer = marked.defaults.tokenizer || new Tokenizer();
	      for (const prop in pack.tokenizer) {
	        const prevTokenizer = tokenizer[prop];
	        // Replace tokenizer with func to run extension, but fall back if false
	        tokenizer[prop] = (...args) => {
	          let ret = pack.tokenizer[prop].apply(tokenizer, args);
	          if (ret === false) {
	            ret = prevTokenizer.apply(tokenizer, args);
	          }
	          return ret;
	        };
	      }
	      opts.tokenizer = tokenizer;
	    }

	    // ==-- Parse Hooks extensions --== //
	    if (pack.hooks) {
	      const hooks = marked.defaults.hooks || new Hooks();
	      for (const prop in pack.hooks) {
	        const prevHook = hooks[prop];
	        if (Hooks.passThroughHooks.has(prop)) {
	          hooks[prop] = (arg) => {
	            if (marked.defaults.async) {
	              return Promise.resolve(pack.hooks[prop].call(hooks, arg)).then(ret => {
	                return prevHook.call(hooks, ret);
	              });
	            }

	            const ret = pack.hooks[prop].call(hooks, arg);
	            return prevHook.call(hooks, ret);
	          };
	        } else {
	          hooks[prop] = (...args) => {
	            let ret = pack.hooks[prop].apply(hooks, args);
	            if (ret === false) {
	              ret = prevHook.apply(hooks, args);
	            }
	            return ret;
	          };
	        }
	      }
	      opts.hooks = hooks;
	    }

	    // ==-- Parse WalkTokens extensions --== //
	    if (pack.walkTokens) {
	      const walkTokens = marked.defaults.walkTokens;
	      opts.walkTokens = function(token) {
	        let values = [];
	        values.push(pack.walkTokens.call(this, token));
	        if (walkTokens) {
	          values = values.concat(walkTokens.call(this, token));
	        }
	        return values;
	      };
	    }

	    marked.setOptions(opts);
	  });
	};

	/**
	 * Run callback for every token
	 */

	marked.walkTokens = function(tokens, callback) {
	  let values = [];
	  for (const token of tokens) {
	    values = values.concat(callback.call(marked, token));
	    switch (token.type) {
	      case 'table': {
	        for (const cell of token.header) {
	          values = values.concat(marked.walkTokens(cell.tokens, callback));
	        }
	        for (const row of token.rows) {
	          for (const cell of row) {
	            values = values.concat(marked.walkTokens(cell.tokens, callback));
	          }
	        }
	        break;
	      }
	      case 'list': {
	        values = values.concat(marked.walkTokens(token.items, callback));
	        break;
	      }
	      default: {
	        if (marked.defaults.extensions && marked.defaults.extensions.childTokens && marked.defaults.extensions.childTokens[token.type]) { // Walk any extensions
	          marked.defaults.extensions.childTokens[token.type].forEach(function(childTokens) {
	            values = values.concat(marked.walkTokens(token[childTokens], callback));
	          });
	        } else if (token.tokens) {
	          values = values.concat(marked.walkTokens(token.tokens, callback));
	        }
	      }
	    }
	  }
	  return values;
	};

	/**
	 * Parse Inline
	 * @param {string} src
	 */
	marked.parseInline = parseMarkdown(Lexer.lexInline, Parser.parseInline);

	/**
	 * Expose
	 */
	marked.Parser = Parser;
	marked.parser = Parser.parse;
	marked.Renderer = Renderer;
	marked.TextRenderer = TextRenderer;
	marked.Lexer = Lexer;
	marked.lexer = Lexer.lex;
	marked.Tokenizer = Tokenizer;
	marked.Slugger = Slugger;
	marked.Hooks = Hooks;
	marked.parse = marked;

	marked.options;
	marked.setOptions;
	marked.use;
	marked.walkTokens;
	marked.parseInline;
	Parser.parse;
	Lexer.lex;

	/* src/components/modals/BlogPostModal.svelte generated by Svelte v4.2.20 */
	const file$e = "src/components/modals/BlogPostModal.svelte";

	// (27:8) {#if updated}
	function create_if_block$6(ctx) {
		let h3;
		let t0;
		let b;
		let t1;

		const block = {
			c: function create() {
				h3 = element("h3");
				t0 = text("Updated: ");
				b = element("b");
				t1 = text(/*updated*/ ctx[3]);
				attr_dev(b, "class", "date-string svelte-zkl2k0");
				add_location(b, file$e, 27, 70, 912);
				attr_dev(h3, "class", "blog-date svelte-zkl2k0");
				set_style(h3, "text-align", "center");
				add_location(h3, file$e, 27, 12, 854);
			},
			m: function mount(target, anchor) {
				insert_dev(target, h3, anchor);
				append_dev(h3, t0);
				append_dev(h3, b);
				append_dev(b, t1);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*updated*/ 8) set_data_dev(t1, /*updated*/ ctx[3]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h3);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$6.name,
			type: "if",
			source: "(27:8) {#if updated}",
			ctx
		});

		return block;
	}

	function create_fragment$e(ctx) {
		let div3;
		let div0;
		let h1;
		let t0;
		let t1;
		let h30;
		let t2;
		let b0;
		let t3;
		let t4;
		let h31;
		let t5;
		let b1;
		let t6;
		let t7;
		let t8;
		let div1;
		let raw_value = marked.parse(/*postContent*/ ctx[4]) + "";
		let t9;
		let div2;
		let h2;
		let b2;
		let t11_value = /*author*/ ctx[1].split(" ")[0] + "";
		let t11;
		let t12;
		let applause_button;
		let if_block = /*updated*/ ctx[3] && create_if_block$6(ctx);

		const block = {
			c: function create() {
				div3 = element("div");
				div0 = element("div");
				h1 = element("h1");
				t0 = text(/*title*/ ctx[0]);
				t1 = space();
				h30 = element("h3");
				t2 = text("Author: ");
				b0 = element("b");
				t3 = text(/*author*/ ctx[1]);
				t4 = space();
				h31 = element("h3");
				t5 = text("Written: ");
				b1 = element("b");
				t6 = text(/*date*/ ctx[2]);
				t7 = space();
				if (if_block) if_block.c();
				t8 = space();
				div1 = element("div");
				t9 = space();
				div2 = element("div");
				h2 = element("h2");
				b2 = element("b");
				b2.textContent = "-";
				t11 = text(t11_value);
				t12 = space();
				applause_button = element("applause-button");
				attr_dev(h1, "class", "blog-title svelte-zkl2k0");
				set_style(h1, "text-align", "center");
				add_location(h1, file$e, 23, 8, 544);
				attr_dev(b0, "class", "author-name svelte-zkl2k0");
				add_location(b0, file$e, 24, 67, 674);
				attr_dev(h30, "class", "blog-author svelte-zkl2k0");
				set_style(h30, "text-align", "center");
				add_location(h30, file$e, 24, 8, 615);
				attr_dev(b1, "class", "date-string svelte-zkl2k0");
				add_location(b1, file$e, 25, 66, 781);
				attr_dev(h31, "class", "blog-date svelte-zkl2k0");
				set_style(h31, "text-align", "center");
				add_location(h31, file$e, 25, 8, 723);
				attr_dev(div0, "class", "blog-header svelte-zkl2k0");
				add_location(div0, file$e, 22, 4, 510);
				attr_dev(div1, "class", "blog-content svelte-zkl2k0");
				add_location(div1, file$e, 30, 4, 983);
				set_style(b2, "font-weight", "300");
				add_location(b2, file$e, 32, 30, 1109);
				attr_dev(h2, "class", "signature svelte-zkl2k0");
				add_location(h2, file$e, 32, 8, 1087);
				set_custom_element_data(applause_button, "url", /*postUrl*/ ctx[5]);
				set_custom_element_data(applause_button, "multiclap", "true");
				set_custom_element_data(applause_button, "color", "var(--main-green)");
				set_custom_element_data(applause_button, "class", "svelte-zkl2k0");
				add_location(applause_button, file$e, 33, 8, 1178);
				attr_dev(div2, "class", "blog-footer svelte-zkl2k0");
				add_location(div2, file$e, 31, 4, 1053);
				attr_dev(div3, "class", "blog-modal svelte-zkl2k0");
				add_location(div3, file$e, 21, 0, 481);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div3, anchor);
				append_dev(div3, div0);
				append_dev(div0, h1);
				append_dev(h1, t0);
				append_dev(div0, t1);
				append_dev(div0, h30);
				append_dev(h30, t2);
				append_dev(h30, b0);
				append_dev(b0, t3);
				append_dev(div0, t4);
				append_dev(div0, h31);
				append_dev(h31, t5);
				append_dev(h31, b1);
				append_dev(b1, t6);
				append_dev(div0, t7);
				if (if_block) if_block.m(div0, null);
				append_dev(div3, t8);
				append_dev(div3, div1);
				div1.innerHTML = raw_value;
				append_dev(div3, t9);
				append_dev(div3, div2);
				append_dev(div2, h2);
				append_dev(h2, b2);
				append_dev(h2, t11);
				append_dev(div2, t12);
				append_dev(div2, applause_button);
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*title*/ 1) set_data_dev(t0, /*title*/ ctx[0]);
				if (dirty & /*author*/ 2) set_data_dev(t3, /*author*/ ctx[1]);
				if (dirty & /*date*/ 4) set_data_dev(t6, /*date*/ ctx[2]);

				if (/*updated*/ ctx[3]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$6(ctx);
						if_block.c();
						if_block.m(div0, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (dirty & /*postContent*/ 16 && raw_value !== (raw_value = marked.parse(/*postContent*/ ctx[4]) + "")) div1.innerHTML = raw_value;			if (dirty & /*author*/ 2 && t11_value !== (t11_value = /*author*/ ctx[1].split(" ")[0] + "")) set_data_dev(t11, t11_value);
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div3);
				}

				if (if_block) if_block.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$e.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$e($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('BlogPostModal', slots, []);
		let { id } = $$props;
		let { title } = $$props;
		let { author } = $$props;
		let { date } = $$props;
		let { updated } = $$props;
		let { content } = $$props;
		const postUrl = `https://maxeisen.me/blog/${id}`; // fake URL for storing claps
		var postContent = "Loading...";

		fetch(`../content/blog/${content}.md`).then(content => content.text()).then(data => {
			$$invalidate(4, postContent = data);
		});

		$$self.$$.on_mount.push(function () {
			if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
				console.warn("<BlogPostModal> was created without expected prop 'id'");
			}

			if (title === undefined && !('title' in $$props || $$self.$$.bound[$$self.$$.props['title']])) {
				console.warn("<BlogPostModal> was created without expected prop 'title'");
			}

			if (author === undefined && !('author' in $$props || $$self.$$.bound[$$self.$$.props['author']])) {
				console.warn("<BlogPostModal> was created without expected prop 'author'");
			}

			if (date === undefined && !('date' in $$props || $$self.$$.bound[$$self.$$.props['date']])) {
				console.warn("<BlogPostModal> was created without expected prop 'date'");
			}

			if (updated === undefined && !('updated' in $$props || $$self.$$.bound[$$self.$$.props['updated']])) {
				console.warn("<BlogPostModal> was created without expected prop 'updated'");
			}

			if (content === undefined && !('content' in $$props || $$self.$$.bound[$$self.$$.props['content']])) {
				console.warn("<BlogPostModal> was created without expected prop 'content'");
			}
		});

		const writable_props = ['id', 'title', 'author', 'date', 'updated', 'content'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<BlogPostModal> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('id' in $$props) $$invalidate(6, id = $$props.id);
			if ('title' in $$props) $$invalidate(0, title = $$props.title);
			if ('author' in $$props) $$invalidate(1, author = $$props.author);
			if ('date' in $$props) $$invalidate(2, date = $$props.date);
			if ('updated' in $$props) $$invalidate(3, updated = $$props.updated);
			if ('content' in $$props) $$invalidate(7, content = $$props.content);
		};

		$$self.$capture_state = () => ({
			marked,
			id,
			title,
			author,
			date,
			updated,
			content,
			postUrl,
			postContent
		});

		$$self.$inject_state = $$props => {
			if ('id' in $$props) $$invalidate(6, id = $$props.id);
			if ('title' in $$props) $$invalidate(0, title = $$props.title);
			if ('author' in $$props) $$invalidate(1, author = $$props.author);
			if ('date' in $$props) $$invalidate(2, date = $$props.date);
			if ('updated' in $$props) $$invalidate(3, updated = $$props.updated);
			if ('content' in $$props) $$invalidate(7, content = $$props.content);
			if ('postContent' in $$props) $$invalidate(4, postContent = $$props.postContent);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [title, author, date, updated, postContent, postUrl, id, content];
	}

	class BlogPostModal extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$e, create_fragment$e, safe_not_equal, {
				id: 6,
				title: 0,
				author: 1,
				date: 2,
				updated: 3,
				content: 7
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "BlogPostModal",
				options,
				id: create_fragment$e.name
			});
		}

		get id() {
			throw new Error("<BlogPostModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<BlogPostModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get title() {
			throw new Error("<BlogPostModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set title(value) {
			throw new Error("<BlogPostModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get author() {
			throw new Error("<BlogPostModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set author(value) {
			throw new Error("<BlogPostModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get date() {
			throw new Error("<BlogPostModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set date(value) {
			throw new Error("<BlogPostModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get updated() {
			throw new Error("<BlogPostModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set updated(value) {
			throw new Error("<BlogPostModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get content() {
			throw new Error("<BlogPostModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set content(value) {
			throw new Error("<BlogPostModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/components/modals/CloseButton.svelte generated by Svelte v4.2.20 */
	const file$d = "src/components/modals/CloseButton.svelte";

	function create_fragment$d(ctx) {
		let button;
		let mounted;
		let dispose;

		const block = {
			c: function create() {
				button = element("button");
				button.textContent = "Custom Close Button";
				add_location(button, file$d, 4, 0, 41);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, button, anchor);

				if (!mounted) {
					dispose = listen_dev(
						button,
						"click",
						function () {
							if (is_function(/*onClose*/ ctx[0])) /*onClose*/ ctx[0].apply(this, arguments);
						},
						false,
						false,
						false,
						false
					);

					mounted = true;
				}
			},
			p: function update(new_ctx, [dirty]) {
				ctx = new_ctx;
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(button);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$d.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$d($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('CloseButton', slots, []);
		let { onClose } = $$props;

		$$self.$$.on_mount.push(function () {
			if (onClose === undefined && !('onClose' in $$props || $$self.$$.bound[$$self.$$.props['onClose']])) {
				console.warn("<CloseButton> was created without expected prop 'onClose'");
			}
		});

		const writable_props = ['onClose'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CloseButton> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('onClose' in $$props) $$invalidate(0, onClose = $$props.onClose);
		};

		$$self.$capture_state = () => ({ onClose });

		$$self.$inject_state = $$props => {
			if ('onClose' in $$props) $$invalidate(0, onClose = $$props.onClose);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [onClose];
	}

	class CloseButton extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$d, create_fragment$d, safe_not_equal, { onClose: 0 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "CloseButton",
				options,
				id: create_fragment$d.name
			});
		}

		get onClose() {
			throw new Error("<CloseButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set onClose(value) {
			throw new Error("<CloseButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const blogPosts = 
	[
	    {
	        published: true,
	        postId: 0,
	        title: "Creating the Blog Component",
	        author: "Max Eisen",
	        date: "March 3, 2021",
	        description: "How I created this blog component on my site from scratch (it was a pain).",
	        content: "creating-the-blog-component"
	    },
	    {
	        published: true,
	        postId: 1,
	        title: "My Sense of Design",
	        author: "Max Eisen",
	        date: "April 14, 2021",
	        updated: "May 14, 2021",
	        description: "Take a peek into the things that have influenced and currently define my sense of design.",
	        content: "sense-of-design"
	    },
	];

	/* src/components/Blog.svelte generated by Svelte v4.2.20 */
	const file$c = "src/components/Blog.svelte";

	function get_each_context$3(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[4] = list[i];
		return child_ctx;
	}

	// (55:8) {#if post.published == true}
	function create_if_block$5(ctx) {
		let div;
		let h20;
		let t1;
		let h21;
		let t3;
		let h22;
		let t5;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[1](/*post*/ ctx[4]);
		}

		const block = {
			c: function create() {
				div = element("div");
				h20 = element("h2");
				h20.textContent = `${/*post*/ ctx[4].title}`;
				t1 = space();
				h21 = element("h2");
				h21.textContent = `${/*post*/ ctx[4].date}`;
				t3 = space();
				h22 = element("h2");
				h22.textContent = `${/*post*/ ctx[4].description}`;
				t5 = space();
				attr_dev(h20, "class", "blog-name svelte-1ejqdqo");
				add_location(h20, file$c, 56, 16, 2167);
				attr_dev(h21, "class", "blog-date svelte-1ejqdqo");
				add_location(h21, file$c, 57, 16, 2223);
				attr_dev(h22, "class", "blog-description svelte-1ejqdqo");
				add_location(h22, file$c, 58, 16, 2278);
				attr_dev(div, "class", "blog-item");
				attr_dev(div, "tabindex", "0");
				add_location(div, file$c, 55, 12, 2006);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, h20);
				append_dev(div, t1);
				append_dev(div, h21);
				append_dev(div, t3);
				append_dev(div, h22);
				append_dev(div, t5);

				if (!mounted) {
					dispose = listen_dev(div, "click", click_handler, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$5.name,
			type: "if",
			source: "(55:8) {#if post.published == true}",
			ctx
		});

		return block;
	}

	// (54:4) {#each blogPosts as post}
	function create_each_block$3(ctx) {
		let if_block_anchor;
		let if_block = /*post*/ ctx[4].published == true && create_if_block$5(ctx);

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
			},
			p: function update(ctx, dirty) {
				if (/*post*/ ctx[4].published == true) if_block.p(ctx, dirty);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$3.name,
			type: "each",
			source: "(54:4) {#each blogPosts as post}",
			ctx
		});

		return block;
	}

	function create_fragment$c(ctx) {
		let h1;
		let t1;
		let div;
		let each_value = ensure_array_like_dev(blogPosts);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
		}

		const block = {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Blog";
				t1 = space();
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(h1, "class", "section-title");
				attr_dev(h1, "id", "blog");
				set_style(h1, "text-align", "left");
				add_location(h1, file$c, 51, 0, 1825);
				attr_dev(div, "class", "blog-subsection");
				add_location(div, file$c, 52, 0, 1897);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, h1, anchor);
				insert_dev(target, t1, anchor);
				insert_dev(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*blogPostModal*/ 1) {
					each_value = ensure_array_like_dev(blogPosts);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$3(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$3(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h1);
					detach_dev(t1);
					detach_dev(div);
				}

				destroy_each(each_blocks, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$c.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$c($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Blog', slots, []);
		const userQuery = qs.parse(window.location.search);

		blogPosts.sort(function (a, b) {
			return b.postId - a.postId;
		});

		const { open } = getContext('simple-modal');

		const blogPostModal = (postId, title, author, date, updated, content) => {
			open(
				BlogPostModal,
				{
					id: postId,
					title,
					author,
					date,
					updated,
					content
				},
				{
					closeButton: CloseButton,
					styleWindow: {
						width: "950px",
						padding: "5px",
						maxHeight: "92.5%"
					}
				},
				{
					onOpen: () => {
						window.history.replaceState({}, title + " | MaxEisen.me", "/?blog=true&postId=" + postId);
						document.title = title + " | MaxEisen.me";
						document.body.style.overflow = "hidden";
					},
					onClose: () => {
						window.history.replaceState({}, "Get to Know Max Eisen | MaxEisen.me", "/");
						document.title = "Get to Know Max Eisen | MaxEisen.me";
						document.body.style.overflowY = "scroll";
					}
				}
			);
		};

		onMount(async () => {
			if (userQuery.blog == 'true') {
				if (userQuery.postId) {
					var blogPost = blogPosts.find(post => {
						return post.postId == userQuery.postId;
					});

					blogPostModal(blogPost.postId, blogPost.title, blogPost.author, blogPost.date, blogPost.updated, blogPost.content);
				}
			}
		});

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Blog> was created with unknown prop '${key}'`);
		});

		const click_handler = post => blogPostModal(post.postId, post.title, post.author, post.date, post.updated, post.content);

		$$self.$capture_state = () => ({
			getContext,
			onMount,
			qs,
			BlogPostModal,
			CloseButton,
			blogPosts,
			userQuery,
			open,
			blogPostModal
		});

		return [blogPostModal, click_handler];
	}

	class Blog extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Blog",
				options,
				id: create_fragment$c.name
			});
		}
	}

	/* src/components/modals/ExperienceModal.svelte generated by Svelte v4.2.20 */
	const file$b = "src/components/modals/ExperienceModal.svelte";

	// (16:8) {:else}
	function create_else_block_1$1(ctx) {
		let t;

		const block = {
			c: function create() {
				t = text(/*company*/ ctx[1]);
			},
			m: function mount(target, anchor) {
				insert_dev(target, t, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*company*/ 2) set_data_dev(t, /*company*/ ctx[1]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block_1$1.name,
			type: "else",
			source: "(16:8) {:else}",
			ctx
		});

		return block;
	}

	// (14:8) {#if companyLink}
	function create_if_block_1$3(ctx) {
		let a;
		let t;

		const block = {
			c: function create() {
				a = element("a");
				t = text(/*company*/ ctx[1]);
				attr_dev(a, "href", /*companyLink*/ ctx[2]);
				attr_dev(a, "rel", "noreferrer");
				attr_dev(a, "target", "_blank");
				attr_dev(a, "class", "svelte-1uko5iu");
				add_location(a, file$b, 14, 12, 375);
			},
			m: function mount(target, anchor) {
				insert_dev(target, a, anchor);
				append_dev(a, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*company*/ 2) set_data_dev(t, /*company*/ ctx[1]);

				if (dirty & /*companyLink*/ 4) {
					attr_dev(a, "href", /*companyLink*/ ctx[2]);
				}
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(a);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$3.name,
			type: "if",
			source: "(14:8) {#if companyLink}",
			ctx
		});

		return block;
	}

	// (23:4) {:else}
	function create_else_block$2(ctx) {
		let h3;
		let t;

		const block = {
			c: function create() {
				h3 = element("h3");
				t = text(/*startDate*/ ctx[3]);
				attr_dev(h3, "class", "modal-description svelte-1uko5iu");
				set_style(h3, "text-align", "center");
				add_location(h3, file$b, 23, 8, 725);
			},
			m: function mount(target, anchor) {
				insert_dev(target, h3, anchor);
				append_dev(h3, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*startDate*/ 8) set_data_dev(t, /*startDate*/ ctx[3]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h3);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$2.name,
			type: "else",
			source: "(23:4) {:else}",
			ctx
		});

		return block;
	}

	// (21:4) {#if endDate}
	function create_if_block$4(ctx) {
		let h3;
		let t0;
		let t1;
		let t2;

		const block = {
			c: function create() {
				h3 = element("h3");
				t0 = text(/*startDate*/ ctx[3]);
				t1 = text("-");
				t2 = text(/*endDate*/ ctx[4]);
				attr_dev(h3, "class", "modal-description svelte-1uko5iu");
				set_style(h3, "text-align", "center");
				add_location(h3, file$b, 21, 8, 621);
			},
			m: function mount(target, anchor) {
				insert_dev(target, h3, anchor);
				append_dev(h3, t0);
				append_dev(h3, t1);
				append_dev(h3, t2);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*startDate*/ 8) set_data_dev(t0, /*startDate*/ ctx[3]);
				if (dirty & /*endDate*/ 16) set_data_dev(t2, /*endDate*/ ctx[4]);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h3);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$4.name,
			type: "if",
			source: "(21:4) {#if endDate}",
			ctx
		});

		return block;
	}

	function create_fragment$b(ctx) {
		let div;
		let h1;
		let t0;
		let t1;
		let h2;
		let t2;
		let b;
		let t4;
		let t5;
		let t6;
		let t7;
		let p;

		function select_block_type(ctx, dirty) {
			if (/*companyLink*/ ctx[2]) return create_if_block_1$3;
			return create_else_block_1$1;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type(ctx);

		function select_block_type_1(ctx, dirty) {
			if (/*endDate*/ ctx[4]) return create_if_block$4;
			return create_else_block$2;
		}

		let current_block_type_1 = select_block_type_1(ctx);
		let if_block1 = current_block_type_1(ctx);

		const block = {
			c: function create() {
				div = element("div");
				h1 = element("h1");
				t0 = text(/*position*/ ctx[0]);
				t1 = space();
				h2 = element("h2");
				if_block0.c();
				t2 = space();
				b = element("b");
				b.textContent = "in";
				t4 = space();
				t5 = text(/*location*/ ctx[5]);
				t6 = space();
				if_block1.c();
				t7 = space();
				p = element("p");
				attr_dev(h1, "class", "modal-position svelte-1uko5iu");
				set_style(h1, "text-align", "center");
				add_location(h1, file$b, 11, 4, 235);
				set_style(b, "color", "var(--paragraph-colour)");
				set_style(b, "font-weight", "300");
				add_location(b, file$b, 18, 8, 507);
				attr_dev(h2, "class", "modal-company svelte-1uko5iu");
				add_location(h2, file$b, 12, 4, 310);
				attr_dev(p, "class", "modal-description svelte-1uko5iu");
				add_location(p, file$b, 25, 4, 813);
				attr_dev(div, "class", "experience-modal svelte-1uko5iu");
				add_location(div, file$b, 10, 0, 200);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, h1);
				append_dev(h1, t0);
				append_dev(div, t1);
				append_dev(div, h2);
				if_block0.m(h2, null);
				append_dev(h2, t2);
				append_dev(h2, b);
				append_dev(h2, t4);
				append_dev(h2, t5);
				append_dev(div, t6);
				if_block1.m(div, null);
				append_dev(div, t7);
				append_dev(div, p);
				p.innerHTML = /*description*/ ctx[6];
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*position*/ 1) set_data_dev(t0, /*position*/ ctx[0]);

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0.d(1);
					if_block0 = current_block_type(ctx);

					if (if_block0) {
						if_block0.c();
						if_block0.m(h2, t2);
					}
				}

				if (dirty & /*location*/ 32) set_data_dev(t5, /*location*/ ctx[5]);

				if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1.d(1);
					if_block1 = current_block_type_1(ctx);

					if (if_block1) {
						if_block1.c();
						if_block1.m(div, t7);
					}
				}

				if (dirty & /*description*/ 64) p.innerHTML = /*description*/ ctx[6];		},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				if_block0.d();
				if_block1.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$b.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$b($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('ExperienceModal', slots, []);
		let { position } = $$props;
		let { company } = $$props;
		let { companyLink } = $$props;
		let { startDate } = $$props;
		let { endDate } = $$props;
		let { location } = $$props;
		let { description } = $$props;

		$$self.$$.on_mount.push(function () {
			if (position === undefined && !('position' in $$props || $$self.$$.bound[$$self.$$.props['position']])) {
				console.warn("<ExperienceModal> was created without expected prop 'position'");
			}

			if (company === undefined && !('company' in $$props || $$self.$$.bound[$$self.$$.props['company']])) {
				console.warn("<ExperienceModal> was created without expected prop 'company'");
			}

			if (companyLink === undefined && !('companyLink' in $$props || $$self.$$.bound[$$self.$$.props['companyLink']])) {
				console.warn("<ExperienceModal> was created without expected prop 'companyLink'");
			}

			if (startDate === undefined && !('startDate' in $$props || $$self.$$.bound[$$self.$$.props['startDate']])) {
				console.warn("<ExperienceModal> was created without expected prop 'startDate'");
			}

			if (endDate === undefined && !('endDate' in $$props || $$self.$$.bound[$$self.$$.props['endDate']])) {
				console.warn("<ExperienceModal> was created without expected prop 'endDate'");
			}

			if (location === undefined && !('location' in $$props || $$self.$$.bound[$$self.$$.props['location']])) {
				console.warn("<ExperienceModal> was created without expected prop 'location'");
			}

			if (description === undefined && !('description' in $$props || $$self.$$.bound[$$self.$$.props['description']])) {
				console.warn("<ExperienceModal> was created without expected prop 'description'");
			}
		});

		const writable_props = [
			'position',
			'company',
			'companyLink',
			'startDate',
			'endDate',
			'location',
			'description'
		];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ExperienceModal> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('position' in $$props) $$invalidate(0, position = $$props.position);
			if ('company' in $$props) $$invalidate(1, company = $$props.company);
			if ('companyLink' in $$props) $$invalidate(2, companyLink = $$props.companyLink);
			if ('startDate' in $$props) $$invalidate(3, startDate = $$props.startDate);
			if ('endDate' in $$props) $$invalidate(4, endDate = $$props.endDate);
			if ('location' in $$props) $$invalidate(5, location = $$props.location);
			if ('description' in $$props) $$invalidate(6, description = $$props.description);
		};

		$$self.$capture_state = () => ({
			position,
			company,
			companyLink,
			startDate,
			endDate,
			location,
			description
		});

		$$self.$inject_state = $$props => {
			if ('position' in $$props) $$invalidate(0, position = $$props.position);
			if ('company' in $$props) $$invalidate(1, company = $$props.company);
			if ('companyLink' in $$props) $$invalidate(2, companyLink = $$props.companyLink);
			if ('startDate' in $$props) $$invalidate(3, startDate = $$props.startDate);
			if ('endDate' in $$props) $$invalidate(4, endDate = $$props.endDate);
			if ('location' in $$props) $$invalidate(5, location = $$props.location);
			if ('description' in $$props) $$invalidate(6, description = $$props.description);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [position, company, companyLink, startDate, endDate, location, description];
	}

	class ExperienceModal extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$b, create_fragment$b, safe_not_equal, {
				position: 0,
				company: 1,
				companyLink: 2,
				startDate: 3,
				endDate: 4,
				location: 5,
				description: 6
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "ExperienceModal",
				options,
				id: create_fragment$b.name
			});
		}

		get position() {
			throw new Error("<ExperienceModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set position(value) {
			throw new Error("<ExperienceModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get company() {
			throw new Error("<ExperienceModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set company(value) {
			throw new Error("<ExperienceModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get companyLink() {
			throw new Error("<ExperienceModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set companyLink(value) {
			throw new Error("<ExperienceModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get startDate() {
			throw new Error("<ExperienceModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set startDate(value) {
			throw new Error("<ExperienceModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get endDate() {
			throw new Error("<ExperienceModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set endDate(value) {
			throw new Error("<ExperienceModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get location() {
			throw new Error("<ExperienceModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set location(value) {
			throw new Error("<ExperienceModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get description() {
			throw new Error("<ExperienceModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set description(value) {
			throw new Error("<ExperienceModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const experience = 
	[
	    {
	        shortPosition: "Software Engineer",
	        position: "Software Developer 2",
	        shortCompany: "Wealthsimple",
	        company: "Wealthsimple",
	        companyLink: "https://wealthsimple.com/",
	        shortDate: "Feb. 2026-Present",
	        startDate: "February 2026",
	        endDate: "Present",
	        location: "Toronto, ON",
	        shortDescription: "Working on the handling of Corporate Actions for one of Canada's unicorns",
	        longDescription:
	        `<ul>
            <li>Working with the Corporate Actions team to build out workflows to handle major listed company changes</li>
            <li>Serving the Operations organization within the company to ensure they have the tools they need</li>
        </ul>`
	    },
	    {
	        shortPosition: "Software Engineer",
	        position: "Software Development Engineer",
	        shortCompany: "Goodreads",
	        company: "Goodreads (An Amazon Company)",
	        companyLink: "https://www.goodreads.com/",
	        shortDate: "Jul. 2025-Feb. 2026",
	        startDate: "July 2025",
	        endDate: "February 2026",
	        location: "Toronto, ON",
	        shortDescription: "Developed community and revenue features for the world's largest community of book readers",
	        longDescription:
	        `<ul>
            <li>Integrated a new payment system into the Goodreads Giveaway feature, allowing authors to promote their books</li>
            <li>Led initiatives around Brand Safety for advertisers reaching over 1 million customers per month</li>
            <li>Improved major parts of the user interface and experience across community features like groups, discussions, and user profiles</li>
        </ul>`
	    },
	    {
	        shortPosition: "Software Engineer",
	        position: "Software Development Engineer",
	        shortCompany: "Amazon (FBA)",
	        company: "Amazon (Fulfillment By Amazon)",
	        companyLink: "https://sell.amazon.com/fulfillment-by-amazon",
	        shortDate: "Jul. 2024-Present",
	        startDate: "July 2024",
	        endDate: "Present",
	        location: "Toronto, ON",
	        shortDescription: "Built out the software behind Fulfillment By Amazon, helping sellers expand their businesses",
	        longDescription:
	        `<ul>
            <li>Developed features for FBA, the service allowing sellers to fulfill their orders using Amazon Prime</li>
            <li>Owned projects that helped sellers successfully and safely inbound their inventory to Amazon</li>
            <li>Contributed to the development of new initiatives to expand FBA to new categories of e-commerce</li>
        </ul>`
	    },
	    {
	        shortPosition: "Software Engineer",
	        position: "Software Development Engineer",
	        shortCompany: "AWS",
	        company: "Amazon Web Services (AWS)",
	        companyLink: "https://aws.amazon.com/",
	        shortDate: "Sep. 2022-Jul. 2024",
	        startDate: "September 2022",
	        endDate: "July 2024",
	        location: "Toronto, ON",
	        shortDescription: "Worked with the world's largest cloud services provider to maintain their low-latency global CDN",
	        longDescription:
	        `<ul>
            <li>Worked on tier-1 service CloudFront, to maintain capacity and operational health of the global, low-latency content delivery network</li>
            <li>Owned features to ensure the successful monitoring, maintenance, and operation of POPs around the world</li>
            <li>Ensured highest possible availability for major clients using our service</li>
        </ul>`
	    },
	    {
	        shortPosition: "Software Engineer",
	        position: "Software Development Engineer",
	        shortCompany: "Publicis Sapient",
	        company: "Publicis Sapient",
	        companyLink: "https://www.publicissapient.com/",
	        shortDate: "Sep. 2021-Sep. 2022",
	        startDate: "September 2021",
	        endDate: "September 2022",
	        location: "Toronto, ON",
	        shortDescription: "Developed software for Goldman Sachs to improve experience for high-value investment tools",
	        longDescription:
	        `<ul>
            <li>Contracted out through digital transformation giant Publicis Sapient, operating in 20 countries across the world</li>
            <li>Worked with client Goldman Sachs, owning and developing major features for advisor web tools</li>
            <li>Collaborated with teams to design, develop, and engineer over 5 different projects for production</li>
            <li>Promoted to L1 engineer after only 1 year, marking a major boost in role and responsibilities</li>
        </ul>`
	    },
	    {
	        shortPosition: "CS Teaching Assistant",
	        position: "Computer Science Teaching Assistant",
	        shortCompany: "Queen's University",
	        company: "Queen's University",
	        shortDate: "Sep. 2019-Jul. 2021",
	        companyLink: "https://cs.queensu.ca/",
	        startDate: "September 2019",
	        endDate: "July 2021",
	        location: "Kingston, ON",
	        shortDescription: "Assisted in the teaching and grading of several intermediate to advanced programming courses",
	        longDescription:
	        `<ul>
            <li>Selected as a teaching assistant for three different programming courses, having previously obtained exceptional grades</li>
            <li>Held weekly office hours to guide students in completing assignments and projects</li>
            <li>Assisted in the teaching of Fundamentals of Software Development (Agile Methodologies) in C++, a 250-student Java course, and a 200-student Python course</li>
        </ul>`
	    },
	];

	/* src/components/Experience.svelte generated by Svelte v4.2.20 */
	const file$a = "src/components/Experience.svelte";

	function get_each_context$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[3] = list[i];
		return child_ctx;
	}

	// (23:12) {:else}
	function create_else_block_1(ctx) {
		let h2;
		let div;

		const block = {
			c: function create() {
				h2 = element("h2");
				div = element("div");
				div.textContent = `${/*exp*/ ctx[3].position}`;
				attr_dev(div, "class", "experience-position svelte-1y5zmi7");
				add_location(div, file$a, 23, 45, 1123);
				attr_dev(h2, "class", "experience-title svelte-1y5zmi7");
				add_location(h2, file$a, 23, 16, 1094);
			},
			m: function mount(target, anchor) {
				insert_dev(target, h2, anchor);
				append_dev(h2, div);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h2);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block_1.name,
			type: "else",
			source: "(23:12) {:else}",
			ctx
		});

		return block;
	}

	// (21:12) {#if exp.shortPosition}
	function create_if_block_1$2(ctx) {
		let h2;
		let div;

		const block = {
			c: function create() {
				h2 = element("h2");
				div = element("div");
				div.textContent = `${/*exp*/ ctx[3].shortPosition}`;
				attr_dev(div, "class", "experience-position svelte-1y5zmi7");
				add_location(div, file$a, 21, 45, 994);
				attr_dev(h2, "class", "experience-title svelte-1y5zmi7");
				add_location(h2, file$a, 21, 16, 965);
			},
			m: function mount(target, anchor) {
				insert_dev(target, h2, anchor);
				append_dev(h2, div);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h2);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$2.name,
			type: "if",
			source: "(21:12) {#if exp.shortPosition}",
			ctx
		});

		return block;
	}

	// (28:12) {:else}
	function create_else_block$1(ctx) {
		let h2;

		const block = {
			c: function create() {
				h2 = element("h2");
				h2.textContent = `${/*exp*/ ctx[3].company}`;
				attr_dev(h2, "class", "experience-company svelte-1y5zmi7");
				add_location(h2, file$a, 28, 16, 1342);
			},
			m: function mount(target, anchor) {
				insert_dev(target, h2, anchor);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h2);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$1.name,
			type: "else",
			source: "(28:12) {:else}",
			ctx
		});

		return block;
	}

	// (26:12) {#if exp.shortCompany}
	function create_if_block$3(ctx) {
		let h2;

		const block = {
			c: function create() {
				h2 = element("h2");
				h2.textContent = `${/*exp*/ ctx[3].shortCompany}`;
				attr_dev(h2, "class", "experience-company svelte-1y5zmi7");
				add_location(h2, file$a, 26, 16, 1251);
			},
			m: function mount(target, anchor) {
				insert_dev(target, h2, anchor);
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h2);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$3.name,
			type: "if",
			source: "(26:12) {#if exp.shortCompany}",
			ctx
		});

		return block;
	}

	// (18:4) {#each experience as exp}
	function create_each_block$2(ctx) {
		let div2;
		let t0;
		let t1;
		let p;
		let t3;
		let h1;
		let div0;
		let div1;
		let t6;
		let mounted;
		let dispose;

		function select_block_type(ctx, dirty) {
			if (/*exp*/ ctx[3].shortPosition) return create_if_block_1$2;
			return create_else_block_1;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type(ctx);

		function select_block_type_1(ctx, dirty) {
			if (/*exp*/ ctx[3].shortCompany) return create_if_block$3;
			return create_else_block$1;
		}

		let current_block_type_1 = select_block_type_1(ctx);
		let if_block1 = current_block_type_1(ctx);

		function click_handler() {
			return /*click_handler*/ ctx[1](/*exp*/ ctx[3]);
		}

		const block = {
			c: function create() {
				div2 = element("div");
				if_block0.c();
				t0 = space();
				if_block1.c();
				t1 = space();
				p = element("p");
				p.textContent = `${/*exp*/ ctx[3].shortDescription}`;
				t3 = space();
				h1 = element("h1");
				div0 = element("div");
				div0.textContent = `${/*exp*/ ctx[3].shortDate}`;
				div1 = element("div");
				div1.textContent = `${/*exp*/ ctx[3].location}`;
				t6 = space();
				add_location(p, file$a, 30, 12, 1422);
				attr_dev(div0, "class", "experience-date svelte-1y5zmi7");
				add_location(div0, file$a, 31, 49, 1501);
				attr_dev(div1, "class", "experience-location svelte-1y5zmi7");
				add_location(div1, file$a, 31, 99, 1551);
				attr_dev(h1, "class", "experience-date-location svelte-1y5zmi7");
				add_location(h1, file$a, 31, 12, 1464);
				attr_dev(div2, "class", "experience-item");
				attr_dev(div2, "tabindex", "0");
				add_location(div2, file$a, 18, 2, 722);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div2, anchor);
				if_block0.m(div2, null);
				append_dev(div2, t0);
				if_block1.m(div2, null);
				append_dev(div2, t1);
				append_dev(div2, p);
				append_dev(div2, t3);
				append_dev(div2, h1);
				append_dev(h1, div0);
				append_dev(h1, div1);
				append_dev(div2, t6);

				if (!mounted) {
					dispose = listen_dev(div2, "click", click_handler, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div2);
				}

				if_block0.d();
				if_block1.d();
				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$2.name,
			type: "each",
			source: "(18:4) {#each experience as exp}",
			ctx
		});

		return block;
	}

	function create_fragment$a(ctx) {
		let h1;
		let t1;
		let div;
		let each_value = ensure_array_like_dev(experience);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
		}

		const block = {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Experience";
				t1 = space();
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(h1, "class", "section-title");
				attr_dev(h1, "id", "experience");
				set_style(h1, "text-align", "left");
				add_location(h1, file$a, 15, 0, 570);
				attr_dev(div, "class", "experience-subsection");
				add_location(div, file$a, 16, 0, 654);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, h1, anchor);
				insert_dev(target, t1, anchor);
				insert_dev(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*experienceModal*/ 1) {
					each_value = ensure_array_like_dev(experience);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$2(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h1);
					detach_dev(t1);
					detach_dev(div);
				}

				destroy_each(each_blocks, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$a.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$a($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Experience', slots, []);
		const { open } = getContext('simple-modal');

		const experienceModal = (position, company, companyLink, startDate, endDate, location, description) => {
			open(ExperienceModal, {
				position,
				company,
				companyLink,
				startDate,
				endDate,
				location,
				description
			});
		};

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Experience> was created with unknown prop '${key}'`);
		});

		const click_handler = exp => experienceModal(exp.position, exp.company, exp.companyLink, exp.startDate, exp.endDate, exp.location, exp.longDescription);

		$$self.$capture_state = () => ({
			getContext,
			ExperienceModal,
			experience,
			open,
			experienceModal
		});

		return [experienceModal, click_handler];
	}

	class Experience extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Experience",
				options,
				id: create_fragment$a.name
			});
		}
	}

	/* node_modules/svelte-icons/io/IoMdOpen.svelte generated by Svelte v4.2.20 */
	const file$9 = "node_modules/svelte-icons/io/IoMdOpen.svelte";

	// (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
	function create_default_slot$2(ctx) {
		let path;

		const block = {
			c: function create() {
				path = svg_element("path");
				attr_dev(path, "d", "M405.34 405.332H106.66V106.668H240V64H106.66C83.191 64 64 83.197 64 106.668v298.664C64 428.803 83.191 448 106.66 448h298.68c23.469 0 42.66-19.197 42.66-42.668V272h-42.66v133.332zM288 64v42.668h87.474L159.999 322.133l29.866 29.866 215.476-215.47V224H448V64H288z");
				add_location(path, file$9, 4, 10, 153);
			},
			m: function mount(target, anchor) {
				insert_dev(target, path, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(path);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$2.name,
			type: "slot",
			source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
			ctx
		});

		return block;
	}

	function create_fragment$9(ctx) {
		let iconbase;
		let current;
		const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

		let iconbase_props = {
			$$slots: { default: [create_default_slot$2] },
			$$scope: { ctx }
		};

		for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
			iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
		}

		iconbase = new IconBase({ props: iconbase_props, $$inline: true });

		const block = {
			c: function create() {
				create_component(iconbase.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(iconbase, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const iconbase_changes = (dirty & /*$$props*/ 1)
				? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
				: {};

				if (dirty & /*$$scope*/ 2) {
					iconbase_changes.$$scope = { dirty, ctx };
				}

				iconbase.$set(iconbase_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(iconbase.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(iconbase.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(iconbase, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$9.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$9($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('IoMdOpen', slots, []);

		$$self.$$set = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
		};

		$$self.$capture_state = () => ({ IconBase });

		$$self.$inject_state = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$props = exclude_internal_props($$props);
		return [$$props];
	}

	class IoMdOpen extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "IoMdOpen",
				options,
				id: create_fragment$9.name
			});
		}
	}

	/* node_modules/svelte-icons/io/IoIosCode.svelte generated by Svelte v4.2.20 */
	const file$8 = "node_modules/svelte-icons/io/IoIosCode.svelte";

	// (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
	function create_default_slot$1(ctx) {
		let path;

		const block = {
			c: function create() {
				path = svg_element("path");
				attr_dev(path, "d", "M332 142.7c-1.2-1.1-2.7-1.7-4.1-1.7s-3 .6-4.1 1.7L310 155.9c-1.2 1.1-1.9 2.7-1.9 4.3 0 1.6.7 3.2 1.9 4.3l95.8 91.5-95.8 91.5c-1.2 1.1-1.9 2.7-1.9 4.3 0 1.6.7 3.2 1.9 4.3l13.8 13.2c1.2 1.1 2.6 1.7 4.1 1.7 1.5 0 3-.6 4.1-1.7l114.2-109c1.2-1.1 1.9-2.7 1.9-4.3 0-1.6-.7-3.2-1.9-4.3L332 142.7zM204 160.2c0-1.6-.7-3.2-1.9-4.3l-13.8-13.2c-1.2-1.1-2.7-1.7-4.1-1.7s-3 .6-4.1 1.7l-114.2 109c-1.2 1.1-1.9 2.7-1.9 4.3 0 1.6.7 3.2 1.9 4.3l114.2 109c1.2 1.1 2.7 1.7 4.1 1.7 1.5 0 3-.6 4.1-1.7l13.8-13.2c1.2-1.1 1.9-2.7 1.9-4.3 0-1.6-.7-3.2-1.9-4.3L106.3 256l95.8-91.5c1.2-1.1 1.9-2.7 1.9-4.3z");
				add_location(path, file$8, 4, 10, 153);
			},
			m: function mount(target, anchor) {
				insert_dev(target, path, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(path);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$1.name,
			type: "slot",
			source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
			ctx
		});

		return block;
	}

	function create_fragment$8(ctx) {
		let iconbase;
		let current;
		const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

		let iconbase_props = {
			$$slots: { default: [create_default_slot$1] },
			$$scope: { ctx }
		};

		for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
			iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
		}

		iconbase = new IconBase({ props: iconbase_props, $$inline: true });

		const block = {
			c: function create() {
				create_component(iconbase.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(iconbase, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const iconbase_changes = (dirty & /*$$props*/ 1)
				? get_spread_update(iconbase_spread_levels, [iconbase_spread_levels[0], get_spread_object(/*$$props*/ ctx[0])])
				: {};

				if (dirty & /*$$scope*/ 2) {
					iconbase_changes.$$scope = { dirty, ctx };
				}

				iconbase.$set(iconbase_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(iconbase.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(iconbase.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(iconbase, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$8.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$8($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('IoIosCode', slots, []);

		$$self.$$set = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
		};

		$$self.$capture_state = () => ({ IconBase });

		$$self.$inject_state = $$new_props => {
			$$invalidate(0, $$props = assign(assign({}, $$props), $$new_props));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$props = exclude_internal_props($$props);
		return [$$props];
	}

	class IoIosCode extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "IoIosCode",
				options,
				id: create_fragment$8.name
			});
		}
	}

	/* src/components/modals/ProjectModal.svelte generated by Svelte v4.2.20 */
	const file$7 = "src/components/modals/ProjectModal.svelte";

	// (18:8) {#if projectLink}
	function create_if_block_1$1(ctx) {
		let a;
		let openlogo;
		let current;
		openlogo = new IoMdOpen({ $$inline: true });

		const block = {
			c: function create() {
				a = element("a");
				create_component(openlogo.$$.fragment);
				attr_dev(a, "class", "project-link svelte-18eo4k3");
				attr_dev(a, "href", /*projectLink*/ ctx[5]);
				attr_dev(a, "rel", "noreferrer");
				attr_dev(a, "target", "_blank");
				add_location(a, file$7, 18, 12, 633);
			},
			m: function mount(target, anchor) {
				insert_dev(target, a, anchor);
				mount_component(openlogo, a, null);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (!current || dirty & /*projectLink*/ 32) {
					attr_dev(a, "href", /*projectLink*/ ctx[5]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(openlogo.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(openlogo.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(a);
				}

				destroy_component(openlogo);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$1.name,
			type: "if",
			source: "(18:8) {#if projectLink}",
			ctx
		});

		return block;
	}

	// (21:8) {#if githubLink}
	function create_if_block$2(ctx) {
		let a;
		let codelogo;
		let current;
		codelogo = new IoIosCode({ $$inline: true });

		const block = {
			c: function create() {
				a = element("a");
				create_component(codelogo.$$.fragment);
				attr_dev(a, "class", "project-link svelte-18eo4k3");
				attr_dev(a, "href", /*githubLink*/ ctx[4]);
				attr_dev(a, "rel", "noreferrer");
				attr_dev(a, "target", "_blank");
				add_location(a, file$7, 21, 12, 777);
			},
			m: function mount(target, anchor) {
				insert_dev(target, a, anchor);
				mount_component(codelogo, a, null);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (!current || dirty & /*githubLink*/ 16) {
					attr_dev(a, "href", /*githubLink*/ ctx[4]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(codelogo.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(codelogo.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(a);
				}

				destroy_component(codelogo);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$2.name,
			type: "if",
			source: "(21:8) {#if githubLink}",
			ctx
		});

		return block;
	}

	function create_fragment$7(ctx) {
		let div1;
		let h1;
		let t0;
		let t1;
		let t2;
		let t3;
		let t4;
		let h3;
		let t5;
		let b;
		let t6;
		let t7;
		let div0;
		let t8;
		let t9;
		let p;
		let t10;
		let picture;
		let source0;
		let source0_srcset_value;
		let t11;
		let source1;
		let source1_srcset_value;
		let t12;
		let img;
		let img_src_value;
		let img_alt_value;
		let current;
		let if_block0 = /*projectLink*/ ctx[5] && create_if_block_1$1(ctx);
		let if_block1 = /*githubLink*/ ctx[4] && create_if_block$2(ctx);

		const block = {
			c: function create() {
				div1 = element("div");
				h1 = element("h1");
				t0 = text(/*name*/ ctx[0]);
				t1 = text(" (");
				t2 = text(/*year*/ ctx[2]);
				t3 = text(")");
				t4 = space();
				h3 = element("h3");
				t5 = text("Developed with: ");
				b = element("b");
				t6 = text(/*technologies*/ ctx[1]);
				t7 = space();
				div0 = element("div");
				if (if_block0) if_block0.c();
				t8 = space();
				if (if_block1) if_block1.c();
				t9 = space();
				p = element("p");
				t10 = space();
				picture = element("picture");
				source0 = element("source");
				t11 = space();
				source1 = element("source");
				t12 = space();
				img = element("img");
				attr_dev(h1, "class", "modal-name svelte-18eo4k3");
				set_style(h1, "text-align", "center");
				add_location(h1, file$7, 14, 4, 355);
				attr_dev(b, "class", "technologies svelte-18eo4k3");
				add_location(b, file$7, 15, 78, 505);
				attr_dev(h3, "class", "modal-description svelte-18eo4k3");
				set_style(h3, "text-align", "center");
				add_location(h3, file$7, 15, 4, 431);
				attr_dev(div0, "class", "project-links-container svelte-18eo4k3");
				add_location(div0, file$7, 16, 4, 557);
				attr_dev(p, "class", "modal-description svelte-18eo4k3");
				add_location(p, file$7, 24, 4, 898);
				if (!srcset_url_equal(source0, source0_srcset_value = "./img/screenshots/" + /*screenshot*/ ctx[6] + ".webp")) attr_dev(source0, "srcset", source0_srcset_value);
				attr_dev(source0, "type", "image/webp");
				add_location(source0, file$7, 26, 8, 973);
				if (!srcset_url_equal(source1, source1_srcset_value = "./img/screenshots/" + /*screenshot*/ ctx[6] + ".jpg")) attr_dev(source1, "srcset", source1_srcset_value);
				attr_dev(source1, "type", "image/jpeg");
				add_location(source1, file$7, 27, 8, 1053);
				attr_dev(img, "class", "screenshot svelte-18eo4k3");
				if (!src_url_equal(img.src, img_src_value = "" + (/*screenshot*/ ctx[6] + ".webp"))) attr_dev(img, "src", img_src_value);
				attr_dev(img, "alt", img_alt_value = "" + (/*name*/ ctx[0] + " screenshot"));
				add_location(img, file$7, 28, 8, 1132);
				add_location(picture, file$7, 25, 4, 955);
				attr_dev(div1, "class", "project-modal svelte-18eo4k3");
				add_location(div1, file$7, 13, 0, 323);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div1, anchor);
				append_dev(div1, h1);
				append_dev(h1, t0);
				append_dev(h1, t1);
				append_dev(h1, t2);
				append_dev(h1, t3);
				append_dev(div1, t4);
				append_dev(div1, h3);
				append_dev(h3, t5);
				append_dev(h3, b);
				append_dev(b, t6);
				append_dev(div1, t7);
				append_dev(div1, div0);
				if (if_block0) if_block0.m(div0, null);
				append_dev(div0, t8);
				if (if_block1) if_block1.m(div0, null);
				append_dev(div1, t9);
				append_dev(div1, p);
				p.innerHTML = /*description*/ ctx[3];
				append_dev(div1, t10);
				append_dev(div1, picture);
				append_dev(picture, source0);
				append_dev(picture, t11);
				append_dev(picture, source1);
				append_dev(picture, t12);
				append_dev(picture, img);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (!current || dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);
				if (!current || dirty & /*year*/ 4) set_data_dev(t2, /*year*/ ctx[2]);
				if (!current || dirty & /*technologies*/ 2) set_data_dev(t6, /*technologies*/ ctx[1]);

				if (/*projectLink*/ ctx[5]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);

						if (dirty & /*projectLink*/ 32) {
							transition_in(if_block0, 1);
						}
					} else {
						if_block0 = create_if_block_1$1(ctx);
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(div0, t8);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				if (/*githubLink*/ ctx[4]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);

						if (dirty & /*githubLink*/ 16) {
							transition_in(if_block1, 1);
						}
					} else {
						if_block1 = create_if_block$2(ctx);
						if_block1.c();
						transition_in(if_block1, 1);
						if_block1.m(div0, null);
					}
				} else if (if_block1) {
					group_outros();

					transition_out(if_block1, 1, 1, () => {
						if_block1 = null;
					});

					check_outros();
				}

				if (!current || dirty & /*description*/ 8) p.innerHTML = /*description*/ ctx[3];
				if (!current || dirty & /*screenshot*/ 64 && source0_srcset_value !== (source0_srcset_value = "./img/screenshots/" + /*screenshot*/ ctx[6] + ".webp")) {
					attr_dev(source0, "srcset", source0_srcset_value);
				}

				if (!current || dirty & /*screenshot*/ 64 && source1_srcset_value !== (source1_srcset_value = "./img/screenshots/" + /*screenshot*/ ctx[6] + ".jpg")) {
					attr_dev(source1, "srcset", source1_srcset_value);
				}

				if (!current || dirty & /*screenshot*/ 64 && !src_url_equal(img.src, img_src_value = "" + (/*screenshot*/ ctx[6] + ".webp"))) {
					attr_dev(img, "src", img_src_value);
				}

				if (!current || dirty & /*name*/ 1 && img_alt_value !== (img_alt_value = "" + (/*name*/ ctx[0] + " screenshot"))) {
					attr_dev(img, "alt", img_alt_value);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(if_block1);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block0);
				transition_out(if_block1);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div1);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$7.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$7($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('ProjectModal', slots, []);
		let { name } = $$props;
		let { technologies } = $$props;
		let { year } = $$props;
		let { description } = $$props;
		let { githubLink } = $$props;
		let { projectLink } = $$props;
		let { screenshot } = $$props;

		$$self.$$.on_mount.push(function () {
			if (name === undefined && !('name' in $$props || $$self.$$.bound[$$self.$$.props['name']])) {
				console.warn("<ProjectModal> was created without expected prop 'name'");
			}

			if (technologies === undefined && !('technologies' in $$props || $$self.$$.bound[$$self.$$.props['technologies']])) {
				console.warn("<ProjectModal> was created without expected prop 'technologies'");
			}

			if (year === undefined && !('year' in $$props || $$self.$$.bound[$$self.$$.props['year']])) {
				console.warn("<ProjectModal> was created without expected prop 'year'");
			}

			if (description === undefined && !('description' in $$props || $$self.$$.bound[$$self.$$.props['description']])) {
				console.warn("<ProjectModal> was created without expected prop 'description'");
			}

			if (githubLink === undefined && !('githubLink' in $$props || $$self.$$.bound[$$self.$$.props['githubLink']])) {
				console.warn("<ProjectModal> was created without expected prop 'githubLink'");
			}

			if (projectLink === undefined && !('projectLink' in $$props || $$self.$$.bound[$$self.$$.props['projectLink']])) {
				console.warn("<ProjectModal> was created without expected prop 'projectLink'");
			}

			if (screenshot === undefined && !('screenshot' in $$props || $$self.$$.bound[$$self.$$.props['screenshot']])) {
				console.warn("<ProjectModal> was created without expected prop 'screenshot'");
			}
		});

		const writable_props = [
			'name',
			'technologies',
			'year',
			'description',
			'githubLink',
			'projectLink',
			'screenshot'
		];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ProjectModal> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('name' in $$props) $$invalidate(0, name = $$props.name);
			if ('technologies' in $$props) $$invalidate(1, technologies = $$props.technologies);
			if ('year' in $$props) $$invalidate(2, year = $$props.year);
			if ('description' in $$props) $$invalidate(3, description = $$props.description);
			if ('githubLink' in $$props) $$invalidate(4, githubLink = $$props.githubLink);
			if ('projectLink' in $$props) $$invalidate(5, projectLink = $$props.projectLink);
			if ('screenshot' in $$props) $$invalidate(6, screenshot = $$props.screenshot);
		};

		$$self.$capture_state = () => ({
			OpenLogo: IoMdOpen,
			CodeLogo: IoIosCode,
			name,
			technologies,
			year,
			description,
			githubLink,
			projectLink,
			screenshot
		});

		$$self.$inject_state = $$props => {
			if ('name' in $$props) $$invalidate(0, name = $$props.name);
			if ('technologies' in $$props) $$invalidate(1, technologies = $$props.technologies);
			if ('year' in $$props) $$invalidate(2, year = $$props.year);
			if ('description' in $$props) $$invalidate(3, description = $$props.description);
			if ('githubLink' in $$props) $$invalidate(4, githubLink = $$props.githubLink);
			if ('projectLink' in $$props) $$invalidate(5, projectLink = $$props.projectLink);
			if ('screenshot' in $$props) $$invalidate(6, screenshot = $$props.screenshot);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [name, technologies, year, description, githubLink, projectLink, screenshot];
	}

	class ProjectModal extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$7, create_fragment$7, safe_not_equal, {
				name: 0,
				technologies: 1,
				year: 2,
				description: 3,
				githubLink: 4,
				projectLink: 5,
				screenshot: 6
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "ProjectModal",
				options,
				id: create_fragment$7.name
			});
		}

		get name() {
			throw new Error("<ProjectModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set name(value) {
			throw new Error("<ProjectModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get technologies() {
			throw new Error("<ProjectModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set technologies(value) {
			throw new Error("<ProjectModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get year() {
			throw new Error("<ProjectModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set year(value) {
			throw new Error("<ProjectModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get description() {
			throw new Error("<ProjectModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set description(value) {
			throw new Error("<ProjectModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get githubLink() {
			throw new Error("<ProjectModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set githubLink(value) {
			throw new Error("<ProjectModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get projectLink() {
			throw new Error("<ProjectModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set projectLink(value) {
			throw new Error("<ProjectModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get screenshot() {
			throw new Error("<ProjectModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set screenshot(value) {
			throw new Error("<ProjectModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const projects = 
	[
	    {
	        name: "MaxEisen.me",
	        emoji: "&#128587;&#8205;&#9794;&#65039;",
	        technologies: "Svelte, Netlify, HTML5, CSS3",
	        year: "2020-Present",
	        shortDescription: "My personal portfolio website (the one you're currently on), developed from scratch",
	        longDescription:
	        `<ul>
            <li>A personal portfolio website built from scratch to showcase my work experience, projects, skills, and more</li>
            <li>Initally a web version of my resume, this became a larger project that constantly allows me to improve my design and development skills</li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/MaxEisen.me",
	        screenshot: "maxeisenme",
	    },
	    {
	        name: "Convoke",
	        emoji: "🤔",
	        technologies: "Next.js, OpenAI GPT-3, Vercel",
	        year: "2022-Present",
	        shortDescription: "A web-based game designed to provoke abstract conversation and deep thought",
	        longDescription:
	        `<ul>
            <li>A game made as an alternative to many classic social games played over a few drinks, to provoke thought and conversation</li>
            <li>Using <a href=\"https://openai.com/blog/openai-api/\" rel=\"noreferrer\" target=\"_blank\">Open-AI's GPT-3 API</a>, thought-provoking questions are generated each round, posed to your group, and a best response is selected</li>
            <li>Scores are kept track of by the web app and a winner is declared after three rounds</li>
            <li>Alternatively a more personal <a href=\"https://convoke.app/daily\" rel=\"noreferrer\" target=\"_blank\">daily question</a> can be answered by an individual user, with responses saved to local storage</li>
            <li>Developed in two weeks after inspiration struck</li>
            <li>Ranked #7 on launch day on <a href=\"https://www.producthunt.com/posts/convoke\" rel=\"noreferrer\" target=\"_blank\">Product Hunt</a></li>
            <li>Currently closed-source as opportunities for expansion and monetization are explored</li>
        </ul>`,
	        projectLink: "https://convoke.app",
	        screenshot: "convoke",
	    },
	    {
	        name: "WhatToTip",
	        emoji: "&#128184;",
	        technologies: "Next.js, OpenAI GPT-3, Python, Vercel",
	        year: "2022-2023",
	        shortDescription: "A web app to helping travellers save money on their next trip",
	        longDescription:
	        `<ul>
            <li>A minimalistic web app that helps travellers by providing short but informative tips for saving in every country across the globe</li>
            <li>Next.js server-side rendering makes for fast and responsive user interactions and loading of static content</li>
            <li>A Python script was developed to leverage OpenAI's GPT-3 engine to generate tips for every country in our list</li>
            <li>Vercel is used to continously deploy the site from the GitHub repository</li>
            <li>Originally developed to inform travellers on how to tip in different countries around the world, hence the name "WhatToTip"</li>
        </ul>`,
	        projectLink: "https://whattotip.in",
	        screenshot: "whattotip",
	    },
	    {
	        name: "NFTokenator",
	        emoji: "&#129689;",
	        technologies: "Python, Pillow, NumPy",
	        year: "2022",
	        shortDescription: "A Python script to programatically generate NFT images from provided assets",
	        longDescription:
	        `<ul>
            <li>An extensible, easy-to-use, customizable CLI-based NFT generator to create collections as large as allowed for by provided assets</li>
            <li>Tens of thousands of NFT images can be generated in just minutes from specified assets and trait rarities</li>
            <li>Pillow is used to stack layers that are selected at random based on provided weights</li>
            <li>A folder is created containing all generated token images, as well as a file specifying actual occurences of different traits, which can be used to find rarities</li>
            <li>Made to be user-friendly and easily forked with custom validation logic, assets, and traits for any NFT project</li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/nftokenator",
	        screenshot: "nftokenator",
	    },
	    {
	        name: "NuHealth",
	        emoji: "&#129659;",
	        technologies: "Next.js, Firebase, Vercel",
	        year: "2022",
	        shortDescription: "A web app to resolve the bottlenecks in Canada's socialized healthcare system",
	        longDescription:
	        `<ul>
            <li>A dual-purpose web app aimed at helping patient's manage access to their health information, and providing EMTs with crucial medical data</li>
            <li>Next.js server-side rendering allows for quick response times when querying the Firestore database to access patient health information</li>
            <li>Firebase is used to store patient health information and to authenticate EMTs</li>
            <li>Patient's also have the ability to specify who should be able to access their health information</li>
            <li>Built in <48 hours by a team of 4, for the <a href=\"https://publicissapient.com/\" rel=\"noreferrer\" target=\"_blank\">Publicis Sapient</a> Aspire SPEED Hackathon <b>(top 10 finalist)</b></li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/nuhealth_public",
	        projectLink: "https://nuhealth.vercel.app",
	        screenshot: "nuhealth",
	    },
	    // {
	    //     name: "PupBot",
	    //     emoji: "&#128054;",
	    //     technologies: "Python, Matplotlib, Selenium, Twitter API, Twilio API, Heroku",
	    //     year: "2021-Present",
	    //     shortDescription: "A Twitter and Twilio bot tweeting hourly price updates of an ETH-based altcoin",
	    //     longDescription:
	    //     `<ul>
	    //         <li>A bot developed from scratch to fetch and post hourly price "pupdates" for Puppy Coin, a community-driven, Ethereum-based altcoin</li>
	    //         <li>Selenium and CryptoCompare API fetch Puppy Coin and Ethereum prices</li>
	    //         <li>Matplotlib generates beautiful 12-hour price charts</li>
	    //         <li>On the hour, Twitter and Twilio APIs tweet updates and send position values to specified Twitter users and phone numbers</li>
	    //         <li>Deployed to Heroku and scheduled to run each hour</li>
	    //     </ul>`,
	    //     githubLink: "https://github.com/maxeisen/pup-bot",
	    //     projectLink: "https://twitter.com/PuppyCoinBot",
	    //     screenshot: "pupbot",
	    // },
	    {
	        name: "Eagle",
	        emoji: "&#129413;",
	        technologies: "React Native, Firebase, Netlify",
	        year: "2020-2021",
	        shortDescription: "A delivery service comparison platform to help food-lovers get the best deal",
	        longDescription:
	        `<ul>
            <li>A mobile application to help users compare pricing, delivery times, and reviews of the same restaurant across four different delivery services</li>
            <li>Ideated, developed, marketed, and pitched by an awesome team of 10 QTMA team members under my guidance as product manager</li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/eagle_public",
	        projectLink: "https://www.qtma.ca/product/Eagle",
	        screenshot: "eagle",
	    },
	    {
	        name: "Studii",
	        emoji: "&#128218;",
	        technologies: "React, Django, MongoDB, HTML5, CSS3",
	        year: "2019-2020",
	        shortDescription: "A collaborative, all-in-one study space made for students, by students",
	        longDescription:
	        `<ul>
            <li>A real-time, affordable, peer and tutor support forum for students who can't find a study method that works for them and/or don't have classmates to study with</li>
            <li>Ideated, developed, marketed, and pitched by a super team of 8 QTMA team members</li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/studii_public",
	        projectLink: "https://www.qtma.ca/product/Studii",
	        screenshot: "studii",
	    },
	    {
	        name: "QHacks",
	        emoji: "&#128187;",
	        technologies: "React, Gatsby, MongoDB, HTML5, CSS3",
	        year: "2019-2020",
	        shortDescription: "The official website for Queen's University's 2020 MLH hackathon",
	        longDescription:
	        `<ul>
            <li>The static website for Queen's University's official 2020 hackathon, developed with React and generated using Gatsby</li>
            <li>Accessed thousands of times during the application phase (700+ applicants), as well as leading up to the event</li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/qhacks-website/tree/dev-2020",
	        projectLink: "https://qhacks.io",
	        screenshot: "qhacks",
	    },
	    {
	        name: "Spotilizer",
	        emoji: "&#127925;",
	        technologies: "Python, Tkinter, Spotify Web API",
	        year: "2019",
	        shortDescription: "A customizable, data-centric Spotify music visualizer built in Python",
	        longDescription:
	        `<ul>
            <li>A visualizer that links to a user's Spotify account and uses hundreds of data points from <a href=\"https://developer.spotify.com/documentation/web-api/\" rel=\"noreferrer\" target=\"_blank\">Spotify's Web API</a> to generate visuals according to rhythm, energy, 'danceability', and many other factors</li>
            <li>Developed by a team of 4 in 10 hours, winning 2nd place at Queen's University during MLH's 2019 Local Hack Day</li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/spotilizer",
	        screenshot: "spotilizer",
	    },
	    {
	        name: "Glitch",
	        emoji: "&#127918;",
	        technologies: "Unity Game Engine, C#",
	        year: "2018-2019",
	        shortDescription: "A unique, monochromatic platformer game for observant minimalists",
	        longDescription:
	        `<ul>
            <li>A monochromatic platformer game, with a novel mechanic that allows the player to use two different states - glitched and default - at the press of a button to help them win</li>
            <li>Developed by a group of 3 as a final course project for CISC 226 (Game Design) at Queen's University</li>
        </ul>`,
	        githubLink: "https://github.com/maxeisen/Glitch",
	        projectLink: "https://tamirarnesty.github.io/glitchGame/",
	        screenshot: "glitch",
	    },
	    // {
	    //     name: "TicTacToe",
	    //     emoji: "&#10060;",
	    //     technologies: "Python",
	    //     year: "2017",
	    //     shortDescription: "A basic, text-based, Pythonic version of tic-tac-toe made in under an hour",
	    //     longDescription:
	    //     `<ul>
	    //         <li>An extremely basic, text-based version of tic-tac-toe</li>
	    //         <li>One of my earliest coding projects, developed in about an hour on a flight without access to any online resources</li>
	    //         <li>Initially written in Python 2 and ported to Python 3</li>
	    //     </ul>`,
	    //     githubLink: "https://github.com/maxeisen/TicTacToe",
	    //     screenshot: "tictactoe",
	    // }
	];

	/* src/components/Projects.svelte generated by Svelte v4.2.20 */
	const file$6 = "src/components/Projects.svelte";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[3] = list[i];
		return child_ctx;
	}

	// (18:4) {#each projects as proj}
	function create_each_block$1(ctx) {
		let div;
		let h20;
		let t0_value = /*proj*/ ctx[3].name + "";
		let t0;
		let t1;
		let html_tag;
		let raw_value = /*proj*/ ctx[3].emoji + "";
		let t2;
		let h21;
		let t4;
		let h22;
		let t6;
		let p;
		let t8;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[1](/*proj*/ ctx[3]);
		}

		const block = {
			c: function create() {
				div = element("div");
				h20 = element("h2");
				t0 = text(t0_value);
				t1 = space();
				html_tag = new HtmlTag(false);
				t2 = space();
				h21 = element("h2");
				h21.textContent = `${/*proj*/ ctx[3].year}`;
				t4 = space();
				h22 = element("h2");
				h22.textContent = `${/*proj*/ ctx[3].technologies}`;
				t6 = space();
				p = element("p");
				p.textContent = `${/*proj*/ ctx[3].shortDescription}`;
				t8 = space();
				html_tag.a = null;
				attr_dev(h20, "class", "project-name svelte-1145ne2");
				add_location(h20, file$6, 20, 12, 990);
				attr_dev(h21, "class", "project-year svelte-1145ne2");
				add_location(h21, file$6, 21, 12, 1063);
				attr_dev(h22, "class", "project-tech svelte-1145ne2");
				add_location(h22, file$6, 22, 12, 1117);
				add_location(p, file$6, 23, 12, 1179);
				attr_dev(div, "class", "project-item");
				attr_dev(div, "tabindex", "0");
				set_style(div, "background-image", "url('./img/screenshots/" + /*proj*/ ctx[3].screenshot + ".webp')");
				add_location(div, file$6, 18, 8, 711);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, h20);
				append_dev(h20, t0);
				append_dev(h20, t1);
				html_tag.m(raw_value, h20);
				append_dev(div, t2);
				append_dev(div, h21);
				append_dev(div, t4);
				append_dev(div, h22);
				append_dev(div, t6);
				append_dev(div, p);
				append_dev(div, t8);

				if (!mounted) {
					dispose = listen_dev(div, "click", click_handler, false, false, false, false);
					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$1.name,
			type: "each",
			source: "(18:4) {#each projects as proj}",
			ctx
		});

		return block;
	}

	function create_fragment$6(ctx) {
		let h1;
		let t1;
		let div;
		let each_value = ensure_array_like_dev(projects);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		const block = {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Projects";
				t1 = space();
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(h1, "class", "section-title");
				attr_dev(h1, "id", "projects");
				set_style(h1, "text-align", "left");
				add_location(h1, file$6, 15, 0, 561);
				attr_dev(div, "class", "project-subsection");
				add_location(div, file$6, 16, 0, 641);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, h1, anchor);
				insert_dev(target, t1, anchor);
				insert_dev(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*projectModal*/ 1) {
					each_value = ensure_array_like_dev(projects);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h1);
					detach_dev(t1);
					detach_dev(div);
				}

				destroy_each(each_blocks, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$6.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$6($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Projects', slots, []);
		const { open } = getContext('simple-modal');

		const projectModal = (name, technologies, year, description, githubLink, projectLink, screenshot) => {
			open(ProjectModal, {
				name,
				technologies,
				year,
				description,
				githubLink,
				projectLink,
				screenshot
			});
		};

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Projects> was created with unknown prop '${key}'`);
		});

		const click_handler = proj => projectModal(proj.name, proj.technologies, proj.year, proj.longDescription, proj.githubLink, proj.projectLink, proj.screenshot);

		$$self.$capture_state = () => ({
			getContext,
			ProjectModal,
			projects,
			open,
			projectModal
		});

		return [projectModal, click_handler];
	}

	class Projects extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Projects",
				options,
				id: create_fragment$6.name
			});
		}
	}

	/* src/components/modals/EducationModal.svelte generated by Svelte v4.2.20 */
	const file$5 = "src/components/modals/EducationModal.svelte";

	function create_fragment$5(ctx) {
		let div;
		let h1;
		let t0;
		let t1;
		let t2;
		let t3;
		let t4;
		let h2;
		let t5;
		let h30;
		let t6;
		let h31;
		let t7;
		let t8;
		let p0;
		let b0;
		let t10;
		let t11;
		let p1;
		let b1;
		let t13;
		let t14;
		let p2;

		const block = {
			c: function create() {
				div = element("div");
				h1 = element("h1");
				t0 = text(/*school*/ ctx[0]);
				t1 = text(" (");
				t2 = text(/*location*/ ctx[1]);
				t3 = text(")");
				t4 = space();
				h2 = element("h2");
				t5 = space();
				h30 = element("h3");
				t6 = space();
				h31 = element("h3");
				t7 = text(/*years*/ ctx[4]);
				t8 = space();
				p0 = element("p");
				b0 = element("b");
				b0.textContent = "Relevant Courses: ";
				t10 = text(/*courses*/ ctx[5]);
				t11 = space();
				p1 = element("p");
				b1 = element("b");
				b1.textContent = "Committees: ";
				t13 = text(/*committees*/ ctx[6]);
				t14 = space();
				p2 = element("p");
				p2.textContent = "*Acted as a Teaching Assistant (courses) or Executive (committees)";
				attr_dev(h1, "class", "modal-school svelte-14ryp3n");
				set_style(h1, "text-align", "center");
				add_location(h1, file$5, 11, 4, 220);
				attr_dev(h2, "class", "modal-degree svelte-14ryp3n");
				set_style(h2, "text-align", "center");
				add_location(h2, file$5, 12, 4, 304);
				attr_dev(h30, "class", "modal-major svelte-14ryp3n");
				set_style(h30, "text-align", "center");
				add_location(h30, file$5, 13, 4, 381);
				attr_dev(h31, "class", "modal-years svelte-14ryp3n");
				set_style(h31, "text-align", "center");
				add_location(h31, file$5, 14, 4, 456);
				add_location(b0, file$5, 15, 32, 553);
				attr_dev(p0, "class", "modal-committees svelte-14ryp3n");
				add_location(p0, file$5, 15, 4, 525);
				add_location(b1, file$5, 16, 32, 624);
				attr_dev(p1, "class", "modal-committees svelte-14ryp3n");
				add_location(p1, file$5, 16, 4, 596);
				attr_dev(p2, "class", "ta-note svelte-14ryp3n");
				add_location(p2, file$5, 17, 4, 664);
				attr_dev(div, "class", "education-modal svelte-14ryp3n");
				add_location(div, file$5, 10, 0, 186);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, h1);
				append_dev(h1, t0);
				append_dev(h1, t1);
				append_dev(h1, t2);
				append_dev(h1, t3);
				append_dev(div, t4);
				append_dev(div, h2);
				h2.innerHTML = /*degree*/ ctx[2];
				append_dev(div, t5);
				append_dev(div, h30);
				h30.innerHTML = /*major*/ ctx[3];
				append_dev(div, t6);
				append_dev(div, h31);
				append_dev(h31, t7);
				append_dev(div, t8);
				append_dev(div, p0);
				append_dev(p0, b0);
				append_dev(p0, t10);
				append_dev(div, t11);
				append_dev(div, p1);
				append_dev(p1, b1);
				append_dev(p1, t13);
				append_dev(div, t14);
				append_dev(div, p2);
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*school*/ 1) set_data_dev(t0, /*school*/ ctx[0]);
				if (dirty & /*location*/ 2) set_data_dev(t2, /*location*/ ctx[1]);
				if (dirty & /*degree*/ 4) h2.innerHTML = /*degree*/ ctx[2];			if (dirty & /*major*/ 8) h30.innerHTML = /*major*/ ctx[3];			if (dirty & /*years*/ 16) set_data_dev(t7, /*years*/ ctx[4]);
				if (dirty & /*courses*/ 32) set_data_dev(t10, /*courses*/ ctx[5]);
				if (dirty & /*committees*/ 64) set_data_dev(t13, /*committees*/ ctx[6]);
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$5.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$5($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('EducationModal', slots, []);
		let { school } = $$props;
		let { location } = $$props;
		let { degree } = $$props;
		let { major } = $$props;
		let { years } = $$props;
		let { courses } = $$props;
		let { committees } = $$props;

		$$self.$$.on_mount.push(function () {
			if (school === undefined && !('school' in $$props || $$self.$$.bound[$$self.$$.props['school']])) {
				console.warn("<EducationModal> was created without expected prop 'school'");
			}

			if (location === undefined && !('location' in $$props || $$self.$$.bound[$$self.$$.props['location']])) {
				console.warn("<EducationModal> was created without expected prop 'location'");
			}

			if (degree === undefined && !('degree' in $$props || $$self.$$.bound[$$self.$$.props['degree']])) {
				console.warn("<EducationModal> was created without expected prop 'degree'");
			}

			if (major === undefined && !('major' in $$props || $$self.$$.bound[$$self.$$.props['major']])) {
				console.warn("<EducationModal> was created without expected prop 'major'");
			}

			if (years === undefined && !('years' in $$props || $$self.$$.bound[$$self.$$.props['years']])) {
				console.warn("<EducationModal> was created without expected prop 'years'");
			}

			if (courses === undefined && !('courses' in $$props || $$self.$$.bound[$$self.$$.props['courses']])) {
				console.warn("<EducationModal> was created without expected prop 'courses'");
			}

			if (committees === undefined && !('committees' in $$props || $$self.$$.bound[$$self.$$.props['committees']])) {
				console.warn("<EducationModal> was created without expected prop 'committees'");
			}
		});

		const writable_props = ['school', 'location', 'degree', 'major', 'years', 'courses', 'committees'];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<EducationModal> was created with unknown prop '${key}'`);
		});

		$$self.$$set = $$props => {
			if ('school' in $$props) $$invalidate(0, school = $$props.school);
			if ('location' in $$props) $$invalidate(1, location = $$props.location);
			if ('degree' in $$props) $$invalidate(2, degree = $$props.degree);
			if ('major' in $$props) $$invalidate(3, major = $$props.major);
			if ('years' in $$props) $$invalidate(4, years = $$props.years);
			if ('courses' in $$props) $$invalidate(5, courses = $$props.courses);
			if ('committees' in $$props) $$invalidate(6, committees = $$props.committees);
		};

		$$self.$capture_state = () => ({
			school,
			location,
			degree,
			major,
			years,
			courses,
			committees
		});

		$$self.$inject_state = $$props => {
			if ('school' in $$props) $$invalidate(0, school = $$props.school);
			if ('location' in $$props) $$invalidate(1, location = $$props.location);
			if ('degree' in $$props) $$invalidate(2, degree = $$props.degree);
			if ('major' in $$props) $$invalidate(3, major = $$props.major);
			if ('years' in $$props) $$invalidate(4, years = $$props.years);
			if ('courses' in $$props) $$invalidate(5, courses = $$props.courses);
			if ('committees' in $$props) $$invalidate(6, committees = $$props.committees);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [school, location, degree, major, years, courses, committees];
	}

	class EducationModal extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$5, create_fragment$5, safe_not_equal, {
				school: 0,
				location: 1,
				degree: 2,
				major: 3,
				years: 4,
				courses: 5,
				committees: 6
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "EducationModal",
				options,
				id: create_fragment$5.name
			});
		}

		get school() {
			throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set school(value) {
			throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get location() {
			throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set location(value) {
			throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get degree() {
			throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set degree(value) {
			throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get major() {
			throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set major(value) {
			throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get years() {
			throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set years(value) {
			throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get courses() {
			throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set courses(value) {
			throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get committees() {
			throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set committees(value) {
			throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const education = 
	[
	    {
	        school: "Queen's University",
	        location: "Kingston, ON",
	        degreeShort: "Bachelor of Computing, Honours",
	        degreeLong: "Bachelor of Computing, Honours (<a href=\"https://www.queensu.ca/admission/programs/computing\" rel=\"noreferrer\" target=\"_blank\">BCmpH</a>)",
	        majorShort: "Computer Science",
	        majorLong: "Computer Science (<a href=\"http://www.cips.ca/\" rel=\"noreferrer\" target=\"_blank\">CIPS</a> Accredited)",
	        years: "2017 - 2021",
	        courses: "Elements of Computing I* and II*, Linear Algebra, Fundamentals of Software Development (Agile)*, Software Architecture, Algorithms, Data Structures, Database Management Systems, Formal Methods in Software Engineering",
	        committees: "QTMA*, QHacks*, TEDxQueensU*, QWEB, Residence Society, Computing DSC, Math DSC, Residence Life Council"
	    }
	];

	/* src/components/Education.svelte generated by Svelte v4.2.20 */
	const file$4 = "src/components/Education.svelte";

	function create_fragment$4(ctx) {
		let h1;
		let t1;
		let div1;
		let div0;
		let h20;
		let t3;
		let h21;
		let t5;
		let h22;
		let t7;
		let h23;
		let mounted;
		let dispose;

		const block = {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Education";
				t1 = space();
				div1 = element("div");
				div0 = element("div");
				h20 = element("h2");
				h20.textContent = `${education[0].school}`;
				t3 = space();
				h21 = element("h2");
				h21.textContent = `${education[0].degreeShort}`;
				t5 = space();
				h22 = element("h2");
				h22.textContent = `${education[0].majorShort}`;
				t7 = space();
				h23 = element("h2");
				h23.textContent = `${education[0].years}`;
				attr_dev(h1, "class", "section-title");
				attr_dev(h1, "id", "education");
				set_style(h1, "text-align", "left");
				add_location(h1, file$4, 14, 0, 521);
				attr_dev(h20, "class", "school-name svelte-ouixgn");
				add_location(h20, file$4, 18, 8, 888);
				attr_dev(h21, "class", "degree-info svelte-ouixgn");
				add_location(h21, file$4, 19, 8, 947);
				attr_dev(h22, "class", "major-info svelte-ouixgn");
				add_location(h22, file$4, 20, 8, 1011);
				attr_dev(h23, "class", "degree-years svelte-ouixgn");
				add_location(h23, file$4, 21, 8, 1073);
				attr_dev(div0, "class", "education-item");
				attr_dev(div0, "tabindex", "0");
				add_location(div0, file$4, 16, 4, 642);
				attr_dev(div1, "class", "education-subsection");
				add_location(div1, file$4, 15, 0, 603);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, h1, anchor);
				insert_dev(target, t1, anchor);
				insert_dev(target, div1, anchor);
				append_dev(div1, div0);
				append_dev(div0, h20);
				append_dev(div0, t3);
				append_dev(div0, h21);
				append_dev(div0, t5);
				append_dev(div0, h22);
				append_dev(div0, t7);
				append_dev(div0, h23);

				if (!mounted) {
					dispose = listen_dev(div0, "click", /*click_handler*/ ctx[1], false, false, false, false);
					mounted = true;
				}
			},
			p: noop,
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h1);
					detach_dev(t1);
					detach_dev(div1);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$4.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$4($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Education', slots, []);
		const { open } = getContext('simple-modal');

		const educationModal = (school, location, degree, major, years, courses, committees) => {
			open(EducationModal, {
				school,
				location,
				degree,
				major,
				years,
				courses,
				committees
			});
		};

		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Education> was created with unknown prop '${key}'`);
		});

		const click_handler = () => educationModal(education[0].school, education[0].location, education[0].degreeLong, education[0].majorLong, education[0].years, education[0].courses, education[0].committees);

		$$self.$capture_state = () => ({
			getContext,
			EducationModal,
			education,
			open,
			educationModal
		});

		return [educationModal, click_handler];
	}

	class Education extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Education",
				options,
				id: create_fragment$4.name
			});
		}
	}

	const skills = [
	  'AWS',
	  'JavaScript',
	  'Python',
	  'Java',
	  'HTML5',
	  'CSS3',
	  'Git',
	  'SQL',
	  'C++',
	  'React',
	  'Next.js',
	  'React Native',
	  'Svelte',
	  'Node.js',
	  'Spring',
	  'Azure'
	];

	/* src/components/Skills.svelte generated by Svelte v4.2.20 */
	const file$3 = "src/components/Skills.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[0] = list[i];
		return child_ctx;
	}

	// (8:8) {#each skills as skill}
	function create_each_block(ctx) {
		let li;

		const block = {
			c: function create() {
				li = element("li");
				li.textContent = `${/*skill*/ ctx[0]}`;
				attr_dev(li, "class", "svelte-1vlexz");
				add_location(li, file$3, 8, 12, 242);
			},
			m: function mount(target, anchor) {
				insert_dev(target, li, anchor);
			},
			p: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(li);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block.name,
			type: "each",
			source: "(8:8) {#each skills as skill}",
			ctx
		});

		return block;
	}

	function create_fragment$3(ctx) {
		let h1;
		let t1;
		let div;
		let ul;
		let each_value = ensure_array_like_dev(skills);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		const block = {
			c: function create() {
				h1 = element("h1");
				h1.textContent = "Skills";
				t1 = space();
				div = element("div");
				ul = element("ul");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(h1, "class", "section-title");
				attr_dev(h1, "id", "skills");
				set_style(h1, "text-align", "left");
				add_location(h1, file$3, 4, 0, 81);
				attr_dev(ul, "class", "svelte-1vlexz");
				add_location(ul, file$3, 6, 4, 193);
				attr_dev(div, "class", "skills-subsection");
				add_location(div, file$3, 5, 0, 157);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, h1, anchor);
				insert_dev(target, t1, anchor);
				insert_dev(target, div, anchor);
				append_dev(div, ul);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(ul, null);
					}
				}
			},
			p: noop,
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h1);
					detach_dev(t1);
					detach_dev(div);
				}

				destroy_each(each_blocks, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$3.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$3($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Skills', slots, []);
		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Skills> was created with unknown prop '${key}'`);
		});

		$$self.$capture_state = () => ({ skills });
		return [];
	}

	class Skills extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Skills",
				options,
				id: create_fragment$3.name
			});
		}
	}

	/* src/components/Footer.svelte generated by Svelte v4.2.20 */
	const file$2 = "src/components/Footer.svelte";

	function create_fragment$2(ctx) {
		let h2;
		let a;
		let t0;
		let b;

		const block = {
			c: function create() {
				h2 = element("h2");
				a = element("a");
				t0 = text("Made at 🏠 by Max Eisen ");
				b = element("b");
				b.textContent = `©${new Date().getFullYear()}`;
				set_style(b, "font-size", "14px");
				set_style(b, "color", "var(--header-colour)");
				add_location(b, file$2, 0, 133, 133);
				attr_dev(a, "href", "https://github.com/maxeisen/MaxEisen.me/");
				attr_dev(a, "rel", "noreferrer");
				attr_dev(a, "class", "footer");
				add_location(a, file$2, 0, 19, 19);
				attr_dev(h2, "class", "footer");
				add_location(h2, file$2, 0, 0, 0);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, h2, anchor);
				append_dev(h2, a);
				append_dev(a, t0);
				append_dev(a, b);
			},
			p: noop,
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(h2);
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$2.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$2($$self, $$props) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Footer', slots, []);
		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
		});

		return [];
	}

	class Footer extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Footer",
				options,
				id: create_fragment$2.name
			});
		}
	}

	/**
	 * Animates the opacity of an element from 0 to the current opacity for `in` transitions and from the current opacity to 0 for `out` transitions.
	 *
	 * https://svelte.dev/docs/svelte-transition#fade
	 * @param {Element} node
	 * @param {import('./public').FadeParams} [params]
	 * @returns {import('./public').TransitionConfig}
	 */
	function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
		const o = +getComputedStyle(node).opacity;
		return {
			delay,
			duration,
			easing,
			css: (t) => `opacity: ${t * o}`
		};
	}

	/* node_modules/svelte-simple-modal/src/Modal.svelte generated by Svelte v4.2.20 */

	const { Object: Object_1, window: window_1 } = globals;
	const file$1 = "node_modules/svelte-simple-modal/src/Modal.svelte";

	// (469:0) {#if Component}
	function create_if_block$1(ctx) {
		let div3;
		let div2;
		let div1;
		let t;
		let div0;
		let switch_instance;
		let div0_class_value;
		let div1_class_value;
		let div1_aria_label_value;
		let div1_aria_labelledby_value;
		let div1_transition;
		let div2_class_value;
		let div3_id_value;
		let div3_class_value;
		let div3_transition;
		let current;
		let mounted;
		let dispose;
		let if_block = /*state*/ ctx[1].closeButton && create_if_block_1(ctx);
		var switch_value = /*Component*/ ctx[2];

		function switch_props(ctx, dirty) {
			return { $$inline: true };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component_dev(switch_value, switch_props());
		}

		const block = {
			c: function create() {
				div3 = element("div");
				div2 = element("div");
				div1 = element("div");
				if (if_block) if_block.c();
				t = space();
				div0 = element("div");
				if (switch_instance) create_component(switch_instance.$$.fragment);
				attr_dev(div0, "class", div0_class_value = "" + (null_to_empty(/*state*/ ctx[1].classContent) + " svelte-n7cvum"));
				attr_dev(div0, "style", /*cssContent*/ ctx[9]);
				toggle_class(div0, "content", !/*unstyled*/ ctx[0]);
				add_location(div0, file$1, 515, 8, 14233);
				attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindow) + " svelte-n7cvum"));
				attr_dev(div1, "role", "dialog");
				attr_dev(div1, "aria-modal", "true");

				attr_dev(div1, "aria-label", div1_aria_label_value = /*state*/ ctx[1].ariaLabelledBy
				? null
				: /*state*/ ctx[1].ariaLabel || null);

				attr_dev(div1, "aria-labelledby", div1_aria_labelledby_value = /*state*/ ctx[1].ariaLabelledBy || null);
				attr_dev(div1, "style", /*cssWindow*/ ctx[8]);
				toggle_class(div1, "window", !/*unstyled*/ ctx[0]);
				add_location(div1, file$1, 486, 6, 13258);
				attr_dev(div2, "class", div2_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindowWrap) + " svelte-n7cvum"));
				attr_dev(div2, "style", /*cssWindowWrap*/ ctx[7]);
				toggle_class(div2, "wrap", !/*unstyled*/ ctx[0]);
				add_location(div2, file$1, 480, 4, 13125);
				attr_dev(div3, "aria-hidden", "true");
				attr_dev(div3, "id", div3_id_value = /*state*/ ctx[1].id);
				attr_dev(div3, "class", div3_class_value = "" + (null_to_empty(/*state*/ ctx[1].classBg) + " svelte-n7cvum"));
				attr_dev(div3, "style", /*cssBg*/ ctx[6]);
				toggle_class(div3, "bg", !/*unstyled*/ ctx[0]);
				add_location(div3, file$1, 469, 2, 12838);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div3, anchor);
				append_dev(div3, div2);
				append_dev(div2, div1);
				if (if_block) if_block.m(div1, null);
				append_dev(div1, t);
				append_dev(div1, div0);
				if (switch_instance) mount_component(switch_instance, div0, null);
				/*div1_binding*/ ctx[50](div1);
				/*div2_binding*/ ctx[51](div2);
				/*div3_binding*/ ctx[52](div3);
				current = true;

				if (!mounted) {
					dispose = [
						listen_dev(
							div1,
							"introstart",
							function () {
								if (is_function(/*onOpen*/ ctx[13])) /*onOpen*/ ctx[13].apply(this, arguments);
							},
							false,
							false,
							false,
							false
						),
						listen_dev(
							div1,
							"outrostart",
							function () {
								if (is_function(/*onClose*/ ctx[14])) /*onClose*/ ctx[14].apply(this, arguments);
							},
							false,
							false,
							false,
							false
						),
						listen_dev(
							div1,
							"introend",
							function () {
								if (is_function(/*onOpened*/ ctx[15])) /*onOpened*/ ctx[15].apply(this, arguments);
							},
							false,
							false,
							false,
							false
						),
						listen_dev(
							div1,
							"outroend",
							function () {
								if (is_function(/*onClosed*/ ctx[16])) /*onClosed*/ ctx[16].apply(this, arguments);
							},
							false,
							false,
							false,
							false
						),
						listen_dev(div3, "mousedown", /*handleOuterMousedown*/ ctx[20], false, false, false, false),
						listen_dev(div3, "mouseup", /*handleOuterMouseup*/ ctx[21], false, false, false, false)
					];

					mounted = true;
				}
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;

				if (/*state*/ ctx[1].closeButton) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty[0] & /*state*/ 2) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block_1(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(div1, t);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}

				if (dirty[0] & /*Component*/ 4 && switch_value !== (switch_value = /*Component*/ ctx[2])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component_dev(switch_value, switch_props());
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, div0, null);
					} else {
						switch_instance = null;
					}
				}

				if (!current || dirty[0] & /*state*/ 2 && div0_class_value !== (div0_class_value = "" + (null_to_empty(/*state*/ ctx[1].classContent) + " svelte-n7cvum"))) {
					attr_dev(div0, "class", div0_class_value);
				}

				if (!current || dirty[0] & /*cssContent*/ 512) {
					attr_dev(div0, "style", /*cssContent*/ ctx[9]);
				}

				if (!current || dirty[0] & /*state, unstyled*/ 3) {
					toggle_class(div0, "content", !/*unstyled*/ ctx[0]);
				}

				if (!current || dirty[0] & /*state*/ 2 && div1_class_value !== (div1_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindow) + " svelte-n7cvum"))) {
					attr_dev(div1, "class", div1_class_value);
				}

				if (!current || dirty[0] & /*state*/ 2 && div1_aria_label_value !== (div1_aria_label_value = /*state*/ ctx[1].ariaLabelledBy
				? null
				: /*state*/ ctx[1].ariaLabel || null)) {
					attr_dev(div1, "aria-label", div1_aria_label_value);
				}

				if (!current || dirty[0] & /*state*/ 2 && div1_aria_labelledby_value !== (div1_aria_labelledby_value = /*state*/ ctx[1].ariaLabelledBy || null)) {
					attr_dev(div1, "aria-labelledby", div1_aria_labelledby_value);
				}

				if (!current || dirty[0] & /*cssWindow*/ 256) {
					attr_dev(div1, "style", /*cssWindow*/ ctx[8]);
				}

				if (!current || dirty[0] & /*state, unstyled*/ 3) {
					toggle_class(div1, "window", !/*unstyled*/ ctx[0]);
				}

				if (!current || dirty[0] & /*state*/ 2 && div2_class_value !== (div2_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindowWrap) + " svelte-n7cvum"))) {
					attr_dev(div2, "class", div2_class_value);
				}

				if (!current || dirty[0] & /*cssWindowWrap*/ 128) {
					attr_dev(div2, "style", /*cssWindowWrap*/ ctx[7]);
				}

				if (!current || dirty[0] & /*state, unstyled*/ 3) {
					toggle_class(div2, "wrap", !/*unstyled*/ ctx[0]);
				}

				if (!current || dirty[0] & /*state*/ 2 && div3_id_value !== (div3_id_value = /*state*/ ctx[1].id)) {
					attr_dev(div3, "id", div3_id_value);
				}

				if (!current || dirty[0] & /*state*/ 2 && div3_class_value !== (div3_class_value = "" + (null_to_empty(/*state*/ ctx[1].classBg) + " svelte-n7cvum"))) {
					attr_dev(div3, "class", div3_class_value);
				}

				if (!current || dirty[0] & /*cssBg*/ 64) {
					attr_dev(div3, "style", /*cssBg*/ ctx[6]);
				}

				if (!current || dirty[0] & /*state, unstyled*/ 3) {
					toggle_class(div3, "bg", !/*unstyled*/ ctx[0]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);

				if (local) {
					add_render_callback(() => {
						if (!current) return;
						if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[12], /*state*/ ctx[1].transitionWindowProps, true);
						div1_transition.run(1);
					});
				}

				if (local) {
					add_render_callback(() => {
						if (!current) return;
						if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[11], /*state*/ ctx[1].transitionBgProps, true);
						div3_transition.run(1);
					});
				}

				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);

				if (local) {
					if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[12], /*state*/ ctx[1].transitionWindowProps, false);
					div1_transition.run(0);
				}

				if (local) {
					if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[11], /*state*/ ctx[1].transitionBgProps, false);
					div3_transition.run(0);
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(div3);
				}

				if (if_block) if_block.d();
				if (switch_instance) destroy_component(switch_instance);
				/*div1_binding*/ ctx[50](null);
				if (detaching && div1_transition) div1_transition.end();
				/*div2_binding*/ ctx[51](null);
				/*div3_binding*/ ctx[52](null);
				if (detaching && div3_transition) div3_transition.end();
				mounted = false;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$1.name,
			type: "if",
			source: "(469:0) {#if Component}",
			ctx
		});

		return block;
	}

	// (502:8) {#if state.closeButton}
	function create_if_block_1(ctx) {
		let show_if;
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block_2, create_else_block];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (dirty[0] & /*state*/ 2) show_if = null;
			if (show_if == null) show_if = !!/*isFunction*/ ctx[17](/*state*/ ctx[1].closeButton);
			if (show_if) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx, [-1, -1, -1]);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},
			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx, dirty);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1.name,
			type: "if",
			source: "(502:8) {#if state.closeButton}",
			ctx
		});

		return block;
	}

	// (505:10) {:else}
	function create_else_block(ctx) {
		let button;
		let button_class_value;
		let mounted;
		let dispose;

		const block = {
			c: function create() {
				button = element("button");
				attr_dev(button, "class", button_class_value = "" + (null_to_empty(/*state*/ ctx[1].classCloseButton) + " svelte-n7cvum"));
				attr_dev(button, "aria-label", "Close modal");
				attr_dev(button, "style", /*cssCloseButton*/ ctx[10]);
				attr_dev(button, "type", "button");
				toggle_class(button, "close", !/*unstyled*/ ctx[0]);
				add_location(button, file$1, 505, 12, 13954);
			},
			m: function mount(target, anchor) {
				insert_dev(target, button, anchor);

				if (!mounted) {
					dispose = listen_dev(button, "click", /*close*/ ctx[18], false, false, false, false);
					mounted = true;
				}
			},
			p: function update(ctx, dirty) {
				if (dirty[0] & /*state*/ 2 && button_class_value !== (button_class_value = "" + (null_to_empty(/*state*/ ctx[1].classCloseButton) + " svelte-n7cvum"))) {
					attr_dev(button, "class", button_class_value);
				}

				if (dirty[0] & /*cssCloseButton*/ 1024) {
					attr_dev(button, "style", /*cssCloseButton*/ ctx[10]);
				}

				if (dirty[0] & /*state, unstyled*/ 3) {
					toggle_class(button, "close", !/*unstyled*/ ctx[0]);
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(button);
				}

				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block.name,
			type: "else",
			source: "(505:10) {:else}",
			ctx
		});

		return block;
	}

	// (503:10) {#if isFunction(state.closeButton)}
	function create_if_block_2(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;
		var switch_value = /*state*/ ctx[1].closeButton;

		function switch_props(ctx, dirty) {
			return {
				props: { onClose: /*close*/ ctx[18] },
				$$inline: true
			};
		}

		if (switch_value) {
			switch_instance = construct_svelte_component_dev(switch_value, switch_props(ctx));
		}

		const block = {
			c: function create() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m: function mount(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert_dev(target, switch_instance_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (dirty[0] & /*state*/ 2 && switch_value !== (switch_value = /*state*/ ctx[1].closeButton)) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component_dev(switch_value, switch_props(ctx));
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(switch_instance_anchor);
				}

				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_2.name,
			type: "if",
			source: "(503:10) {#if isFunction(state.closeButton)}",
			ctx
		});

		return block;
	}

	function create_fragment$1(ctx) {
		let t;
		let current;
		let mounted;
		let dispose;
		let if_block = /*Component*/ ctx[2] && create_if_block$1(ctx);
		const default_slot_template = /*#slots*/ ctx[49].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[48], null);

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				t = space();
				if (default_slot) default_slot.c();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, t, anchor);

				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;

				if (!mounted) {
					dispose = listen_dev(window_1, "keydown", /*handleKeydown*/ ctx[19], false, false, false, false);
					mounted = true;
				}
			},
			p: function update(ctx, dirty) {
				if (/*Component*/ ctx[2]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty[0] & /*Component*/ 4) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block$1(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(t.parentNode, t);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}

				if (default_slot) {
					if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 131072)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[48],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[48])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[48], dirty, null),
							null
						);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t);
				}

				if (if_block) if_block.d(detaching);
				if (default_slot) default_slot.d(detaching);
				mounted = false;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$1.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function bind(Component, props = {}) {
		return function ModalComponent(options) {
			return new Component({
					...options,
					props: { ...props, ...options.props }
				});
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('Modal', slots, ['default']);
		const dispatch = createEventDispatcher();
		const baseSetContext = setContext;

		/**
	 * A basic function that checks if a node is tabbale
	 */
		const baseIsTabbable = node => node.tabIndex >= 0 && !node.hidden && !node.disabled && node.style.display !== 'none' && node.type !== 'hidden' && Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length);

		let { isTabbable = baseIsTabbable } = $$props;
		let { show = null } = $$props;
		let { id = null } = $$props;
		let { key = 'simple-modal' } = $$props;
		let { ariaLabel = null } = $$props;
		let { ariaLabelledBy = null } = $$props;
		let { closeButton = true } = $$props;
		let { closeOnEsc = true } = $$props;
		let { closeOnOuterClick = true } = $$props;
		let { styleBg = {} } = $$props;
		let { styleWindowWrap = {} } = $$props;
		let { styleWindow = {} } = $$props;
		let { styleContent = {} } = $$props;
		let { styleCloseButton = {} } = $$props;
		let { classBg = null } = $$props;
		let { classWindowWrap = null } = $$props;
		let { classWindow = null } = $$props;
		let { classContent = null } = $$props;
		let { classCloseButton = null } = $$props;
		let { unstyled = false } = $$props;
		let { setContext: setContext$1 = baseSetContext } = $$props;
		let { transitionBg = fade } = $$props;
		let { transitionBgProps = { duration: 250 } } = $$props;
		let { transitionWindow = transitionBg } = $$props;
		let { transitionWindowProps = transitionBgProps } = $$props;
		let { disableFocusTrap = false } = $$props;

		const defaultState = {
			id,
			ariaLabel,
			ariaLabelledBy,
			closeButton,
			closeOnEsc,
			closeOnOuterClick,
			styleBg,
			styleWindowWrap,
			styleWindow,
			styleContent,
			styleCloseButton,
			classBg,
			classWindowWrap,
			classWindow,
			classContent,
			classCloseButton,
			transitionBg,
			transitionBgProps,
			transitionWindow,
			transitionWindowProps,
			disableFocusTrap,
			isTabbable,
			unstyled
		};

		let state = { ...defaultState };
		let Component = null;
		let background;
		let wrap;
		let modalWindow;
		let scrollY;
		let cssBg;
		let cssWindowWrap;
		let cssWindow;
		let cssContent;
		let cssCloseButton;
		let currentTransitionBg;
		let currentTransitionWindow;
		let prevBodyPosition;
		let prevBodyOverflow;
		let prevBodyWidth;
		let outerClickTarget;
		const camelCaseToDash = str => str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();

		const toCssString = props => props
		? Object.keys(props).reduce((str, key) => `${str}; ${camelCaseToDash(key)}: ${props[key]}`, '')
		: '';

		const isFunction = f => !!(f && f.constructor && f.call && f.apply);

		const updateStyleTransition = () => {
			$$invalidate(6, cssBg = toCssString(Object.assign(
				{},
				{
					width: window.innerWidth,
					height: window.innerHeight
				},
				state.styleBg
			)));

			$$invalidate(7, cssWindowWrap = toCssString(state.styleWindowWrap));
			$$invalidate(8, cssWindow = toCssString(state.styleWindow));
			$$invalidate(9, cssContent = toCssString(state.styleContent));
			$$invalidate(10, cssCloseButton = toCssString(state.styleCloseButton));
			$$invalidate(11, currentTransitionBg = state.transitionBg);
			$$invalidate(12, currentTransitionWindow = state.transitionWindow);
		};

		const toVoid = () => {
			
		};

		let onOpen = toVoid;
		let onClose = toVoid;
		let onOpened = toVoid;
		let onClosed = toVoid;

		/**
	 * Open a modal.
	 * @description Calling this method will close the modal. Additionally, it
	 * allows to specify onClose and onClosed event handlers.`
	 * @type {Open}
	 */
		const open = (NewComponent, newProps = {}, options = {}, callbacks = {}) => {
			$$invalidate(2, Component = bind(NewComponent, newProps));
			$$invalidate(1, state = { ...defaultState, ...options });
			updateStyleTransition();
			disableScroll();

			$$invalidate(13, onOpen = event => {
				if (callbacks.onOpen) callbacks.onOpen(event);

				/**
	 * The open event is fired right before the modal opens
	 * @event {void} open
	 */
				dispatch('open');

				/**
	 * The opening event is fired right before the modal opens
	 * @event {void} opening
	 * @deprecated Listen to the `open` event instead
	 */
				dispatch('opening'); // Deprecated. Do not use!
			});

			$$invalidate(14, onClose = event => {
				if (callbacks.onClose) callbacks.onClose(event);

				/**
	 * The close event is fired right before the modal closes
	 * @event {void} close
	 */
				dispatch('close');

				/**
	 * The closing event is fired right before the modal closes
	 * @event {void} closing
	 * @deprecated Listen to the `close` event instead
	 */
				dispatch('closing'); // Deprecated. Do not use!
			});

			$$invalidate(15, onOpened = event => {
				if (callbacks.onOpened) callbacks.onOpened(event);

				/**
	 * The opened event is fired after the modal's opening transition
	 * @event {void} opened
	 */
				dispatch('opened');
			});

			$$invalidate(16, onClosed = event => {
				if (callbacks.onClosed) callbacks.onClosed(event);

				/**
	 * The closed event is fired after the modal's closing transition
	 * @event {void} closed
	 */
				dispatch('closed');
			});
		};

		/**
	 * Close the modal.
	 * @description Calling this method will close the modal. Additionally, it
	 * allows to specify onClose and onClosed event handlers.`
	 * @type {Close}
	 */
		const close = (callbacks = {}) => {
			if (!Component) return;
			$$invalidate(14, onClose = callbacks.onClose || onClose);
			$$invalidate(16, onClosed = callbacks.onClosed || onClosed);
			$$invalidate(2, Component = null);
			enableScroll();
		};

		const handleKeydown = event => {
			if (state.closeOnEsc && Component && event.key === 'Escape') {
				event.preventDefault();
				close();
			}

			if (Component && event.key === 'Tab' && !state.disableFocusTrap) {
				// trap focus
				const nodes = modalWindow.querySelectorAll('*');

				const tabbable = Array.from(nodes).filter(state.isTabbable).sort((a, b) => a.tabIndex - b.tabIndex);
				let index = tabbable.indexOf(document.activeElement);
				if (index === -1 && event.shiftKey) index = 0;
				index += tabbable.length + (event.shiftKey ? -1 : 1);
				index %= tabbable.length;
				tabbable[index].focus();
				event.preventDefault();
			}
		};

		const handleOuterMousedown = event => {
			if (state.closeOnOuterClick && (event.target === background || event.target === wrap)) outerClickTarget = event.target;
		};

		const handleOuterMouseup = event => {
			if (state.closeOnOuterClick && event.target === outerClickTarget) {
				event.preventDefault();
				close();
			}
		};

		const disableScroll = () => {
			scrollY = window.scrollY;
			prevBodyPosition = document.body.style.position;
			prevBodyOverflow = document.body.style.overflow;
			prevBodyWidth = document.body.style.width;
			document.body.style.position = 'fixed';
			document.body.style.top = `-${scrollY}px`;
			document.body.style.overflow = 'hidden';
			document.body.style.width = '100%';
		};

		const enableScroll = () => {
			document.body.style.position = prevBodyPosition || '';
			document.body.style.top = '';
			document.body.style.overflow = prevBodyOverflow || '';
			document.body.style.width = prevBodyWidth || '';

			window.scrollTo({
				top: scrollY,
				left: 0,
				behavior: 'instant'
			});
		};

		/**
	 * The exposed context methods: open() and close()
	 * @type {Context}
	 */
		const context = { open, close };

		setContext$1(key, context);
		let isMounted = false;

		onDestroy(() => {
			if (isMounted) close();
		});

		onMount(() => {
			$$invalidate(47, isMounted = true);
		});

		const writable_props = [
			'isTabbable',
			'show',
			'id',
			'key',
			'ariaLabel',
			'ariaLabelledBy',
			'closeButton',
			'closeOnEsc',
			'closeOnOuterClick',
			'styleBg',
			'styleWindowWrap',
			'styleWindow',
			'styleContent',
			'styleCloseButton',
			'classBg',
			'classWindowWrap',
			'classWindow',
			'classContent',
			'classCloseButton',
			'unstyled',
			'setContext',
			'transitionBg',
			'transitionBgProps',
			'transitionWindow',
			'transitionWindowProps',
			'disableFocusTrap'
		];

		Object_1.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
		});

		function div1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				modalWindow = $$value;
				$$invalidate(5, modalWindow);
			});
		}

		function div2_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				wrap = $$value;
				$$invalidate(4, wrap);
			});
		}

		function div3_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				background = $$value;
				$$invalidate(3, background);
			});
		}

		$$self.$$set = $$props => {
			if ('isTabbable' in $$props) $$invalidate(22, isTabbable = $$props.isTabbable);
			if ('show' in $$props) $$invalidate(23, show = $$props.show);
			if ('id' in $$props) $$invalidate(24, id = $$props.id);
			if ('key' in $$props) $$invalidate(25, key = $$props.key);
			if ('ariaLabel' in $$props) $$invalidate(26, ariaLabel = $$props.ariaLabel);
			if ('ariaLabelledBy' in $$props) $$invalidate(27, ariaLabelledBy = $$props.ariaLabelledBy);
			if ('closeButton' in $$props) $$invalidate(28, closeButton = $$props.closeButton);
			if ('closeOnEsc' in $$props) $$invalidate(29, closeOnEsc = $$props.closeOnEsc);
			if ('closeOnOuterClick' in $$props) $$invalidate(30, closeOnOuterClick = $$props.closeOnOuterClick);
			if ('styleBg' in $$props) $$invalidate(31, styleBg = $$props.styleBg);
			if ('styleWindowWrap' in $$props) $$invalidate(32, styleWindowWrap = $$props.styleWindowWrap);
			if ('styleWindow' in $$props) $$invalidate(33, styleWindow = $$props.styleWindow);
			if ('styleContent' in $$props) $$invalidate(34, styleContent = $$props.styleContent);
			if ('styleCloseButton' in $$props) $$invalidate(35, styleCloseButton = $$props.styleCloseButton);
			if ('classBg' in $$props) $$invalidate(36, classBg = $$props.classBg);
			if ('classWindowWrap' in $$props) $$invalidate(37, classWindowWrap = $$props.classWindowWrap);
			if ('classWindow' in $$props) $$invalidate(38, classWindow = $$props.classWindow);
			if ('classContent' in $$props) $$invalidate(39, classContent = $$props.classContent);
			if ('classCloseButton' in $$props) $$invalidate(40, classCloseButton = $$props.classCloseButton);
			if ('unstyled' in $$props) $$invalidate(0, unstyled = $$props.unstyled);
			if ('setContext' in $$props) $$invalidate(41, setContext$1 = $$props.setContext);
			if ('transitionBg' in $$props) $$invalidate(42, transitionBg = $$props.transitionBg);
			if ('transitionBgProps' in $$props) $$invalidate(43, transitionBgProps = $$props.transitionBgProps);
			if ('transitionWindow' in $$props) $$invalidate(44, transitionWindow = $$props.transitionWindow);
			if ('transitionWindowProps' in $$props) $$invalidate(45, transitionWindowProps = $$props.transitionWindowProps);
			if ('disableFocusTrap' in $$props) $$invalidate(46, disableFocusTrap = $$props.disableFocusTrap);
			if ('$$scope' in $$props) $$invalidate(48, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => ({
			bind,
			svelte,
			fade,
			createEventDispatcher,
			dispatch,
			baseSetContext,
			baseIsTabbable,
			isTabbable,
			show,
			id,
			key,
			ariaLabel,
			ariaLabelledBy,
			closeButton,
			closeOnEsc,
			closeOnOuterClick,
			styleBg,
			styleWindowWrap,
			styleWindow,
			styleContent,
			styleCloseButton,
			classBg,
			classWindowWrap,
			classWindow,
			classContent,
			classCloseButton,
			unstyled,
			setContext: setContext$1,
			transitionBg,
			transitionBgProps,
			transitionWindow,
			transitionWindowProps,
			disableFocusTrap,
			defaultState,
			state,
			Component,
			background,
			wrap,
			modalWindow,
			scrollY,
			cssBg,
			cssWindowWrap,
			cssWindow,
			cssContent,
			cssCloseButton,
			currentTransitionBg,
			currentTransitionWindow,
			prevBodyPosition,
			prevBodyOverflow,
			prevBodyWidth,
			outerClickTarget,
			camelCaseToDash,
			toCssString,
			isFunction,
			updateStyleTransition,
			toVoid,
			onOpen,
			onClose,
			onOpened,
			onClosed,
			open,
			close,
			handleKeydown,
			handleOuterMousedown,
			handleOuterMouseup,
			disableScroll,
			enableScroll,
			context,
			isMounted
		});

		$$self.$inject_state = $$props => {
			if ('isTabbable' in $$props) $$invalidate(22, isTabbable = $$props.isTabbable);
			if ('show' in $$props) $$invalidate(23, show = $$props.show);
			if ('id' in $$props) $$invalidate(24, id = $$props.id);
			if ('key' in $$props) $$invalidate(25, key = $$props.key);
			if ('ariaLabel' in $$props) $$invalidate(26, ariaLabel = $$props.ariaLabel);
			if ('ariaLabelledBy' in $$props) $$invalidate(27, ariaLabelledBy = $$props.ariaLabelledBy);
			if ('closeButton' in $$props) $$invalidate(28, closeButton = $$props.closeButton);
			if ('closeOnEsc' in $$props) $$invalidate(29, closeOnEsc = $$props.closeOnEsc);
			if ('closeOnOuterClick' in $$props) $$invalidate(30, closeOnOuterClick = $$props.closeOnOuterClick);
			if ('styleBg' in $$props) $$invalidate(31, styleBg = $$props.styleBg);
			if ('styleWindowWrap' in $$props) $$invalidate(32, styleWindowWrap = $$props.styleWindowWrap);
			if ('styleWindow' in $$props) $$invalidate(33, styleWindow = $$props.styleWindow);
			if ('styleContent' in $$props) $$invalidate(34, styleContent = $$props.styleContent);
			if ('styleCloseButton' in $$props) $$invalidate(35, styleCloseButton = $$props.styleCloseButton);
			if ('classBg' in $$props) $$invalidate(36, classBg = $$props.classBg);
			if ('classWindowWrap' in $$props) $$invalidate(37, classWindowWrap = $$props.classWindowWrap);
			if ('classWindow' in $$props) $$invalidate(38, classWindow = $$props.classWindow);
			if ('classContent' in $$props) $$invalidate(39, classContent = $$props.classContent);
			if ('classCloseButton' in $$props) $$invalidate(40, classCloseButton = $$props.classCloseButton);
			if ('unstyled' in $$props) $$invalidate(0, unstyled = $$props.unstyled);
			if ('setContext' in $$props) $$invalidate(41, setContext$1 = $$props.setContext);
			if ('transitionBg' in $$props) $$invalidate(42, transitionBg = $$props.transitionBg);
			if ('transitionBgProps' in $$props) $$invalidate(43, transitionBgProps = $$props.transitionBgProps);
			if ('transitionWindow' in $$props) $$invalidate(44, transitionWindow = $$props.transitionWindow);
			if ('transitionWindowProps' in $$props) $$invalidate(45, transitionWindowProps = $$props.transitionWindowProps);
			if ('disableFocusTrap' in $$props) $$invalidate(46, disableFocusTrap = $$props.disableFocusTrap);
			if ('state' in $$props) $$invalidate(1, state = $$props.state);
			if ('Component' in $$props) $$invalidate(2, Component = $$props.Component);
			if ('background' in $$props) $$invalidate(3, background = $$props.background);
			if ('wrap' in $$props) $$invalidate(4, wrap = $$props.wrap);
			if ('modalWindow' in $$props) $$invalidate(5, modalWindow = $$props.modalWindow);
			if ('scrollY' in $$props) scrollY = $$props.scrollY;
			if ('cssBg' in $$props) $$invalidate(6, cssBg = $$props.cssBg);
			if ('cssWindowWrap' in $$props) $$invalidate(7, cssWindowWrap = $$props.cssWindowWrap);
			if ('cssWindow' in $$props) $$invalidate(8, cssWindow = $$props.cssWindow);
			if ('cssContent' in $$props) $$invalidate(9, cssContent = $$props.cssContent);
			if ('cssCloseButton' in $$props) $$invalidate(10, cssCloseButton = $$props.cssCloseButton);
			if ('currentTransitionBg' in $$props) $$invalidate(11, currentTransitionBg = $$props.currentTransitionBg);
			if ('currentTransitionWindow' in $$props) $$invalidate(12, currentTransitionWindow = $$props.currentTransitionWindow);
			if ('prevBodyPosition' in $$props) prevBodyPosition = $$props.prevBodyPosition;
			if ('prevBodyOverflow' in $$props) prevBodyOverflow = $$props.prevBodyOverflow;
			if ('prevBodyWidth' in $$props) prevBodyWidth = $$props.prevBodyWidth;
			if ('outerClickTarget' in $$props) outerClickTarget = $$props.outerClickTarget;
			if ('onOpen' in $$props) $$invalidate(13, onOpen = $$props.onOpen);
			if ('onClose' in $$props) $$invalidate(14, onClose = $$props.onClose);
			if ('onOpened' in $$props) $$invalidate(15, onOpened = $$props.onOpened);
			if ('onClosed' in $$props) $$invalidate(16, onClosed = $$props.onClosed);
			if ('isMounted' in $$props) $$invalidate(47, isMounted = $$props.isMounted);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*show*/ 8388608 | $$self.$$.dirty[1] & /*isMounted*/ 65536) {
				{
					if (isMounted) {
						if (isFunction(show)) {
							open(show);
						} else {
							close();
						}
					}
				}
			}
		};

		return [
			unstyled,
			state,
			Component,
			background,
			wrap,
			modalWindow,
			cssBg,
			cssWindowWrap,
			cssWindow,
			cssContent,
			cssCloseButton,
			currentTransitionBg,
			currentTransitionWindow,
			onOpen,
			onClose,
			onOpened,
			onClosed,
			isFunction,
			close,
			handleKeydown,
			handleOuterMousedown,
			handleOuterMouseup,
			isTabbable,
			show,
			id,
			key,
			ariaLabel,
			ariaLabelledBy,
			closeButton,
			closeOnEsc,
			closeOnOuterClick,
			styleBg,
			styleWindowWrap,
			styleWindow,
			styleContent,
			styleCloseButton,
			classBg,
			classWindowWrap,
			classWindow,
			classContent,
			classCloseButton,
			setContext$1,
			transitionBg,
			transitionBgProps,
			transitionWindow,
			transitionWindowProps,
			disableFocusTrap,
			isMounted,
			$$scope,
			slots,
			div1_binding,
			div2_binding,
			div3_binding
		];
	}

	class Modal extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(
				this,
				options,
				instance$1,
				create_fragment$1,
				safe_not_equal,
				{
					isTabbable: 22,
					show: 23,
					id: 24,
					key: 25,
					ariaLabel: 26,
					ariaLabelledBy: 27,
					closeButton: 28,
					closeOnEsc: 29,
					closeOnOuterClick: 30,
					styleBg: 31,
					styleWindowWrap: 32,
					styleWindow: 33,
					styleContent: 34,
					styleCloseButton: 35,
					classBg: 36,
					classWindowWrap: 37,
					classWindow: 38,
					classContent: 39,
					classCloseButton: 40,
					unstyled: 0,
					setContext: 41,
					transitionBg: 42,
					transitionBgProps: 43,
					transitionWindow: 44,
					transitionWindowProps: 45,
					disableFocusTrap: 46
				},
				null,
				[-1, -1, -1]
			);

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Modal",
				options,
				id: create_fragment$1.name
			});
		}

		get isTabbable() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set isTabbable(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get show() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set show(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get id() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get key() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set key(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get ariaLabel() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set ariaLabel(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get ariaLabelledBy() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set ariaLabelledBy(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get closeButton() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set closeButton(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get closeOnEsc() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set closeOnEsc(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get closeOnOuterClick() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set closeOnOuterClick(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get styleBg() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set styleBg(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get styleWindowWrap() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set styleWindowWrap(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get styleWindow() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set styleWindow(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get styleContent() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set styleContent(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get styleCloseButton() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set styleCloseButton(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get classBg() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set classBg(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get classWindowWrap() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set classWindowWrap(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get classWindow() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set classWindow(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get classContent() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set classContent(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get classCloseButton() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set classCloseButton(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get unstyled() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set unstyled(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get setContext() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set setContext(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get transitionBg() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set transitionBg(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get transitionBgProps() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set transitionBgProps(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get transitionWindow() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set transitionWindow(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get transitionWindowProps() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set transitionWindowProps(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get disableFocusTrap() {
			throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set disableFocusTrap(value) {
			throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/App.svelte generated by Svelte v4.2.20 */
	const file = "src/App.svelte";

	// (19:4) {#if (screenSize.matches)}
	function create_if_block(ctx) {
		let menubar;
		let current;
		menubar = new MenuBar({ $$inline: true });

		const block = {
			c: function create() {
				create_component(menubar.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(menubar, target, anchor);
				current = true;
			},
			i: function intro(local) {
				if (current) return;
				transition_in(menubar.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(menubar.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(menubar, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block.name,
			type: "if",
			source: "(19:4) {#if (screenSize.matches)}",
			ctx
		});

		return block;
	}

	// (17:0) <Modal>
	function create_default_slot(ctx) {
		let t0;
		let div3;
		let div0;
		let profile;
		let t1;
		let div2;
		let div1;
		let intro;
		let t2;
		let experience;
		let t3;
		let projects;
		let t4;
		let blog;
		let t5;
		let education;
		let t6;
		let skills;
		let t7;
		let footer;
		let current;
		let if_block = /*screenSize*/ ctx[0].matches && create_if_block(ctx);
		profile = new Profile({ $$inline: true });
		intro = new Intro({ $$inline: true });
		experience = new Experience({ $$inline: true });
		projects = new Projects({ $$inline: true });
		blog = new Blog({ $$inline: true });
		education = new Education({ $$inline: true });
		skills = new Skills({ $$inline: true });
		footer = new Footer({ $$inline: true });

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				t0 = space();
				div3 = element("div");
				div0 = element("div");
				create_component(profile.$$.fragment);
				t1 = space();
				div2 = element("div");
				div1 = element("div");
				create_component(intro.$$.fragment);
				t2 = space();
				create_component(experience.$$.fragment);
				t3 = space();
				create_component(projects.$$.fragment);
				t4 = space();
				create_component(blog.$$.fragment);
				t5 = space();
				create_component(education.$$.fragment);
				t6 = space();
				create_component(skills.$$.fragment);
				t7 = space();
				create_component(footer.$$.fragment);
				attr_dev(div0, "class", "profile-section");
				add_location(div0, file, 22, 8, 850);
				attr_dev(div1, "class", "info-section-inner");
				add_location(div1, file, 26, 12, 970);
				attr_dev(div2, "class", "info-section-main");
				add_location(div2, file, 25, 8, 926);
				attr_dev(div3, "class", "grid-container");
				add_location(div3, file, 21, 4, 813);
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, t0, anchor);
				insert_dev(target, div3, anchor);
				append_dev(div3, div0);
				mount_component(profile, div0, null);
				append_dev(div3, t1);
				append_dev(div3, div2);
				append_dev(div2, div1);
				mount_component(intro, div1, null);
				append_dev(div1, t2);
				mount_component(experience, div1, null);
				append_dev(div1, t3);
				mount_component(projects, div1, null);
				append_dev(div1, t4);
				mount_component(blog, div1, null);
				append_dev(div1, t5);
				mount_component(education, div1, null);
				append_dev(div1, t6);
				mount_component(skills, div1, null);
				append_dev(div2, t7);
				mount_component(footer, div2, null);
				current = true;
			},
			p: noop,
			i: function intro$1(local) {
				if (current) return;
				transition_in(if_block);
				transition_in(profile.$$.fragment, local);
				transition_in(intro.$$.fragment, local);
				transition_in(experience.$$.fragment, local);
				transition_in(projects.$$.fragment, local);
				transition_in(blog.$$.fragment, local);
				transition_in(education.$$.fragment, local);
				transition_in(skills.$$.fragment, local);
				transition_in(footer.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				transition_out(profile.$$.fragment, local);
				transition_out(intro.$$.fragment, local);
				transition_out(experience.$$.fragment, local);
				transition_out(projects.$$.fragment, local);
				transition_out(blog.$$.fragment, local);
				transition_out(education.$$.fragment, local);
				transition_out(skills.$$.fragment, local);
				transition_out(footer.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) {
					detach_dev(t0);
					detach_dev(div3);
				}

				if (if_block) if_block.d(detaching);
				destroy_component(profile);
				destroy_component(intro);
				destroy_component(experience);
				destroy_component(projects);
				destroy_component(blog);
				destroy_component(education);
				destroy_component(skills);
				destroy_component(footer);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot.name,
			type: "slot",
			source: "(17:0) <Modal>",
			ctx
		});

		return block;
	}

	function create_fragment(ctx) {
		let modal;
		let current;

		modal = new Modal({
				props: {
					$$slots: { default: [create_default_slot] },
					$$scope: { ctx }
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(modal.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(modal, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const modal_changes = {};

				if (dirty & /*$$scope*/ 2) {
					modal_changes.$$scope = { dirty, ctx };
				}

				modal.$set(modal_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(modal.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(modal.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(modal, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots('App', slots, []);
		var screenSize = window.matchMedia("(min-width: 860px)");
		const writable_props = [];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
		});

		$$self.$capture_state = () => ({
			MenuBar,
			Profile,
			Intro,
			Blog,
			Experience,
			Projects,
			Education,
			Skills,
			Footer,
			Modal,
			screenSize
		});

		$$self.$inject_state = $$props => {
			if ('screenSize' in $$props) $$invalidate(0, screenSize = $$props.screenSize);
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [screenSize];
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "App",
				options,
				id: create_fragment.name
			});
		}
	}

	const app = new App({
		target: document.body
	});

	return app;

})();
