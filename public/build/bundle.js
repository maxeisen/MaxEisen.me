
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
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
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(html, anchor = null) {
            this.e = element('div');
            this.a = anchor;
            this.u(html);
        }
        m(target, anchor = null) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(target, this.n[i], anchor);
            }
            this.t = target;
        }
        u(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        p(html) {
            this.d();
            this.u(html);
            this.m(this.t, this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
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
        flushing = false;
        seen_callbacks.clear();
    }
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
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
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
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
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

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
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
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
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.21.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* node_modules/svelte-icons/components/IconBase.svelte generated by Svelte v3.21.0 */

    const file = "node_modules/svelte-icons/components/IconBase.svelte";

    // (18:2) {#if title}
    function create_if_block(ctx) {
    	let title_1;
    	let t;

    	const block = {
    		c: function create() {
    			title_1 = svg_element("title");
    			t = text(/*title*/ ctx[0]);
    			add_location(title_1, file, 18, 4, 298);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, title_1, anchor);
    			append_dev(title_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*title*/ 1) set_data_dev(t, /*title*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(title_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(18:2) {#if title}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let svg;
    	let if_block_anchor;
    	let current;
    	let if_block = /*title*/ ctx[0] && create_if_block(ctx);
    	const default_slot_template = /*$$slots*/ ctx[3].default;
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
    			add_location(svg, file, 16, 0, 229);
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
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(svg, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 4) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[2], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null));
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
    			if (detaching) detach_dev(svg);
    			if (if_block) if_block.d();
    			if (default_slot) default_slot.d(detaching);
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
    	let { title = null } = $$props;
    	let { viewBox } = $$props;
    	const writable_props = ["title", "viewBox"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<IconBase> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IconBase", $$slots, ['default']);

    	$$self.$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("viewBox" in $$props) $$invalidate(1, viewBox = $$props.viewBox);
    		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ title, viewBox });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("viewBox" in $$props) $$invalidate(1, viewBox = $$props.viewBox);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, viewBox, $$scope, $$slots];
    }

    class IconBase extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { title: 0, viewBox: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IconBase",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*viewBox*/ ctx[1] === undefined && !("viewBox" in props)) {
    			console.warn("<IconBase> was created without expected prop 'viewBox'");
    		}
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

    /* node_modules/svelte-icons/io/IoLogoLinkedin.svelte generated by Svelte v3.21.0 */
    const file$1 = "node_modules/svelte-icons/io/IoLogoLinkedin.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M417.2 64H96.8C79.3 64 64 76.6 64 93.9V415c0 17.4 15.3 32.9 32.8 32.9h320.3c17.6 0 30.8-15.6 30.8-32.9V93.9C448 76.6 434.7 64 417.2 64zM183 384h-55V213h55v171zm-25.6-197h-.4c-17.6 0-29-13.1-29-29.5 0-16.7 11.7-29.5 29.7-29.5s29 12.7 29.4 29.5c0 16.4-11.4 29.5-29.7 29.5zM384 384h-55v-93.5c0-22.4-8-37.7-27.9-37.7-15.2 0-24.2 10.3-28.2 20.3-1.5 3.6-1.9 8.5-1.9 13.5V384h-55V213h55v23.8c8-11.4 20.5-27.8 49.6-27.8 36.1 0 63.4 23.8 63.4 75.1V384z");
    			add_location(path, file$1, 4, 10, 153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
    		iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
    	}

    	const iconbase = new IconBase({ props: iconbase_props, $$inline: true });

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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoLogoLinkedin", $$slots, []);

    	$$self.$set = $$new_props => {
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoLogoLinkedin",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoLogoGithub.svelte generated by Svelte v3.21.0 */
    const file$2 = "node_modules/svelte-icons/io/IoLogoGithub.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$1(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M256 32C132.3 32 32 134.9 32 261.7c0 101.5 64.2 187.5 153.2 217.9 1.4.3 2.6.4 3.8.4 8.3 0 11.5-6.1 11.5-11.4 0-5.5-.2-19.9-.3-39.1-8.4 1.9-15.9 2.7-22.6 2.7-43.1 0-52.9-33.5-52.9-33.5-10.2-26.5-24.9-33.6-24.9-33.6-19.5-13.7-.1-14.1 1.4-14.1h.1c22.5 2 34.3 23.8 34.3 23.8 11.2 19.6 26.2 25.1 39.6 25.1 10.5 0 20-3.4 25.6-6 2-14.8 7.8-24.9 14.2-30.7-49.7-5.8-102-25.5-102-113.5 0-25.1 8.7-45.6 23-61.6-2.3-5.8-10-29.2 2.2-60.8 0 0 1.6-.5 5-.5 8.1 0 26.4 3.1 56.6 24.1 17.9-5.1 37-7.6 56.1-7.7 19 .1 38.2 2.6 56.1 7.7 30.2-21 48.5-24.1 56.6-24.1 3.4 0 5 .5 5 .5 12.2 31.6 4.5 55 2.2 60.8 14.3 16.1 23 36.6 23 61.6 0 88.2-52.4 107.6-102.3 113.3 8 7.1 15.2 21.1 15.2 42.5 0 30.7-.3 55.5-.3 63 0 5.4 3.1 11.5 11.4 11.5 1.2 0 2.6-.1 4-.4C415.9 449.2 480 363.1 480 261.7 480 134.9 379.7 32 256 32z");
    			add_location(path, file$2, 4, 10, 153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
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

    function create_fragment$2(ctx) {
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
    		iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
    	}

    	const iconbase = new IconBase({ props: iconbase_props, $$inline: true });

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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoLogoGithub", $$slots, []);

    	$$self.$set = $$new_props => {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoLogoGithub",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoLogoTwitter.svelte generated by Svelte v3.21.0 */
    const file$3 = "node_modules/svelte-icons/io/IoLogoTwitter.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$2(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M492 109.5c-17.4 7.7-36 12.9-55.6 15.3 20-12 35.4-31 42.6-53.6-18.7 11.1-39.4 19.2-61.5 23.5C399.8 75.8 374.6 64 346.8 64c-53.5 0-96.8 43.4-96.8 96.9 0 7.6.8 15 2.5 22.1-80.5-4-151.9-42.6-199.6-101.3-8.3 14.3-13.1 31-13.1 48.7 0 33.6 17.2 63.3 43.2 80.7-16-.4-31-4.8-44-12.1v1.2c0 47 33.4 86.1 77.7 95-8.1 2.2-16.7 3.4-25.5 3.4-6.2 0-12.3-.6-18.2-1.8 12.3 38.5 48.1 66.5 90.5 67.3-33.1 26-74.9 41.5-120.3 41.5-7.8 0-15.5-.5-23.1-1.4C62.8 432 113.7 448 168.3 448 346.6 448 444 300.3 444 172.2c0-4.2-.1-8.4-.3-12.5C462.6 146 479 129 492 109.5z");
    			add_location(path, file$3, 4, 10, 153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
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

    function create_fragment$3(ctx) {
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot$2] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
    		iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
    	}

    	const iconbase = new IconBase({ props: iconbase_props, $$inline: true });

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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoLogoTwitter", $$slots, []);

    	$$self.$set = $$new_props => {
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoLogoTwitter",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoIosMail.svelte generated by Svelte v3.21.0 */
    const file$4 = "node_modules/svelte-icons/io/IoIosMail.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$3(ctx) {
    	let path0;
    	let t;
    	let path1;

    	const block = {
    		c: function create() {
    			path0 = svg_element("path");
    			t = space();
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M460.6 147.3L353 256.9c-.8.8-.8 2 0 2.8l75.3 80.2c5.1 5.1 5.1 13.3 0 18.4-2.5 2.5-5.9 3.8-9.2 3.8s-6.7-1.3-9.2-3.8l-75-79.9c-.8-.8-2.1-.8-2.9 0L313.7 297c-15.3 15.5-35.6 24.1-57.4 24.2-22.1.1-43.1-9.2-58.6-24.9l-17.6-17.9c-.8-.8-2.1-.8-2.9 0l-75 79.9c-2.5 2.5-5.9 3.8-9.2 3.8s-6.7-1.3-9.2-3.8c-5.1-5.1-5.1-13.3 0-18.4l75.3-80.2c.7-.8.7-2 0-2.8L51.4 147.3c-1.3-1.3-3.4-.4-3.4 1.4V368c0 17.6 14.4 32 32 32h352c17.6 0 32-14.4 32-32V148.7c0-1.8-2.2-2.6-3.4-1.4z");
    			add_location(path0, file$4, 4, 10, 153);
    			attr_dev(path1, "d", "M256 295.1c14.8 0 28.7-5.8 39.1-16.4L452 119c-5.5-4.4-12.3-7-19.8-7H79.9c-7.5 0-14.4 2.6-19.8 7L217 278.7c10.3 10.5 24.2 16.4 39 16.4z");
    			add_location(path1, file$4, 5, 0, 624);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path0, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, path1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path0);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(path1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot$3] },
    		$$scope: { ctx }
    	};

    	for (let i = 0; i < iconbase_spread_levels.length; i += 1) {
    		iconbase_props = assign(iconbase_props, iconbase_spread_levels[i]);
    	}

    	const iconbase = new IconBase({ props: iconbase_props, $$inline: true });

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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoIosMail", $$slots, []);

    	$$self.$set = $$new_props => {
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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoIosMail",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    const t="http://www.w3.org/2000/svg";class e{constructor(t){this.seed=t;}next(){return this.seed?(2**31-1&(this.seed=Math.imul(48271,this.seed)))/2**31:Math.random()}}function s(t,e,s,i,n){return {type:"path",ops:c(t,e,s,i,n)}}function i(t,e){return function(t,e,i){const n=(t||[]).length;if(n>2){const s=[];for(let e=0;e<n-1;e++)s.push(...c(t[e][0],t[e][1],t[e+1][0],t[e+1][1],i));return e&&s.push(...c(t[n-1][0],t[n-1][1],t[0][0],t[0][1],i)),{type:"path",ops:s}}return 2===n?s(t[0][0],t[0][1],t[1][0],t[1][1],i):{type:"path",ops:[]}}(t,!0,e)}function n(t,e,s,n,o){return i([[t,e],[t+s,e],[t+s,e+n],[t,e+n]],o)}function o(t,e,s,i,n){return function(t,e,s,i){const[n,o]=f(i.increment,t,e,i.rx,i.ry,1,i.increment*h(.1,h(.4,1,s),s),s);let r=l(n,null,s);if(!s.disableMultiStroke){const[n]=f(i.increment,t,e,i.rx,i.ry,1.5,0,s),o=l(n,null,s);r=r.concat(o);}return {estimatedPoints:o,opset:{type:"path",ops:r}}}(t,e,n,function(t,e,s){const i=Math.sqrt(2*Math.PI*Math.sqrt((Math.pow(t/2,2)+Math.pow(e/2,2))/2)),n=Math.max(s.curveStepCount,s.curveStepCount/Math.sqrt(200)*i),o=2*Math.PI/n;let r=Math.abs(t/2),h=Math.abs(e/2);const c=1-s.curveFitting;return r+=a(r*c,s),h+=a(h*c,s),{increment:o,rx:r,ry:h}}(s,i,n)).opset}function r(t){return t.randomizer||(t.randomizer=new e(t.seed||0)),t.randomizer.next()}function h(t,e,s,i=1){return s.roughness*i*(r(s)*(e-t)+t)}function a(t,e,s=1){return h(-t,t,e,s)}function c(t,e,s,i,n,o=!1){const r=o?n.disableMultiStrokeFill:n.disableMultiStroke,h=u(t,e,s,i,n,!0,!1);if(r)return h;const a=u(t,e,s,i,n,!0,!0);return h.concat(a)}function u(t,e,s,i,n,o,h){const c=Math.pow(t-s,2)+Math.pow(e-i,2),u=Math.sqrt(c);let l=1;l=u<200?1:u>500?.4:-.0016668*u+1.233334;let f=n.maxRandomnessOffset||0;f*f*100>c&&(f=u/10);const g=f/2,d=.2+.2*r(n);let p=n.bowing*n.maxRandomnessOffset*(i-e)/200,_=n.bowing*n.maxRandomnessOffset*(t-s)/200;p=a(p,n,l),_=a(_,n,l);const m=[],w=()=>a(g,n,l),v=()=>a(f,n,l);return o&&(h?m.push({op:"move",data:[t+w(),e+w()]}):m.push({op:"move",data:[t+a(f,n,l),e+a(f,n,l)]})),h?m.push({op:"bcurveTo",data:[p+t+(s-t)*d+w(),_+e+(i-e)*d+w(),p+t+2*(s-t)*d+w(),_+e+2*(i-e)*d+w(),s+w(),i+w()]}):m.push({op:"bcurveTo",data:[p+t+(s-t)*d+v(),_+e+(i-e)*d+v(),p+t+2*(s-t)*d+v(),_+e+2*(i-e)*d+v(),s+v(),i+v()]}),m}function l(t,e,s){const i=t.length,n=[];if(i>3){const o=[],r=1-s.curveTightness;n.push({op:"move",data:[t[1][0],t[1][1]]});for(let e=1;e+2<i;e++){const s=t[e];o[0]=[s[0],s[1]],o[1]=[s[0]+(r*t[e+1][0]-r*t[e-1][0])/6,s[1]+(r*t[e+1][1]-r*t[e-1][1])/6],o[2]=[t[e+1][0]+(r*t[e][0]-r*t[e+2][0])/6,t[e+1][1]+(r*t[e][1]-r*t[e+2][1])/6],o[3]=[t[e+1][0],t[e+1][1]],n.push({op:"bcurveTo",data:[o[1][0],o[1][1],o[2][0],o[2][1],o[3][0],o[3][1]]});}if(e&&2===e.length){const t=s.maxRandomnessOffset;n.push({op:"lineTo",data:[e[0]+a(t,s),e[1]+a(t,s)]});}}else 3===i?(n.push({op:"move",data:[t[1][0],t[1][1]]}),n.push({op:"bcurveTo",data:[t[1][0],t[1][1],t[2][0],t[2][1],t[2][0],t[2][1]]})):2===i&&n.push(...c(t[0][0],t[0][1],t[1][0],t[1][1],s));return n}function f(t,e,s,i,n,o,r,h){const c=[],u=[],l=a(.5,h)-Math.PI/2;u.push([a(o,h)+e+.9*i*Math.cos(l-t),a(o,h)+s+.9*n*Math.sin(l-t)]);for(let r=l;r<2*Math.PI+l-.01;r+=t){const t=[a(o,h)+e+i*Math.cos(r),a(o,h)+s+n*Math.sin(r)];c.push(t),u.push(t);}return u.push([a(o,h)+e+i*Math.cos(l+2*Math.PI+.5*r),a(o,h)+s+n*Math.sin(l+2*Math.PI+.5*r)]),u.push([a(o,h)+e+.98*i*Math.cos(l+r),a(o,h)+s+.98*n*Math.sin(l+r)]),u.push([a(o,h)+e+.9*i*Math.cos(l+.5*r),a(o,h)+s+.9*n*Math.sin(l+.5*r)]),[u,c]}const g={maxRandomnessOffset:2,roughness:1.5,bowing:1,stroke:"#000",strokeWidth:1.5,curveTightness:0,curveFitting:.95,curveStepCount:9,fillStyle:"hachure",fillWeight:-1,hachureAngle:-41,hachureGap:-1,dashOffset:-1,dashGap:-1,zigzagOffset:-1,seed:0,combineNestedSvgPaths:!1,disableMultiStroke:!1,disableMultiStrokeFill:!1};function d(t,e){const s=JSON.parse(JSON.stringify(g));switch(t){case"highlight":s.roughness=3,s.disableMultiStroke=!0;break;case"single":s.disableMultiStroke=!0;}return s.seed=e,s}function p(e,i,r,h,a){const c=[];let u=r.strokeWidth||2;const l=function(t){const e=t.padding;if(e||0===e){if("number"==typeof e)return [e,e,e,e];if(Array.isArray(e)){const t=e;if(t.length)switch(t.length){case 4:return [...t];case 1:return [t[0],t[0],t[0],t[0]];case 2:return [...t,...t];case 3:return [...t,t[1]];default:return [t[0],t[1],t[2],t[3]]}}}return [5,5,5,5]}(r),f=void 0===r.animate||!!r.animate,g=r.iterations||2;switch(r.type){case"underline":{const t=d("single",a),e=i.y+i.h+l[2];for(let n=0;n<g;n++)n%2?c.push(s(i.x+i.w,e,i.x,e,t)):c.push(s(i.x,e,i.x+i.w,e,t));break}case"strike-through":{const t=d("single",a),e=i.y+i.h/2;for(let n=0;n<g;n++)n%2?c.push(s(i.x+i.w,e,i.x,e,t)):c.push(s(i.x,e,i.x+i.w,e,t));break}case"box":{const t=d("single",a),e=i.x-l[3],s=i.y-l[0],o=i.w+(l[1]+l[3]),r=i.h+(l[0]+l[2]);for(let i=0;i<g;i++)c.push(n(e,s,o,r,t));break}case"crossed-off":{const t=d("single",a),e=i.x,n=i.y,o=e+i.w,r=n+i.h;for(let i=0;i<g;i++)i%2?c.push(s(o,r,e,n,t)):c.push(s(e,n,o,r,t));for(let i=0;i<g;i++)i%2?c.push(s(e,r,o,n,t)):c.push(s(o,n,e,r,t));break}case"circle":{const t=d("single",a),e=d("double",a),s=i.w+(l[1]+l[3]),n=i.h+(l[0]+l[2]),r=i.x-l[3]+s/2,h=i.y-l[0]+n/2,u=Math.floor(g/2),f=g-2*u;for(let t=0;t<u;t++)c.push(o(r,h,s,n,e));for(let e=0;e<f;e++)c.push(o(r,h,s,n,t));break}case"highlight":{const t=d("highlight",a);u=.95*i.h;const e=i.y+i.h/2;for(let n=0;n<g;n++)n%2?c.push(s(i.x+i.w,e,i.x,e,t)):c.push(s(i.x,e,i.x+i.w,e,t));break}}if(c.length){const s=function(t){const e=[];for(const s of t){let t="";for(const i of s.ops){const s=i.data;switch(i.op){case"move":t.trim()&&e.push(t.trim()),t=`M${s[0]} ${s[1]} `;break;case"bcurveTo":t+=`C${s[0]} ${s[1]}, ${s[2]} ${s[3]}, ${s[4]} ${s[5]} `;break;case"lineTo":t+=`L${s[0]} ${s[1]} `;}}t.trim()&&e.push(t.trim());}return e}(c),i=[],n=[];let o=0;const a=0===r.animationDuration?0:r.animationDuration||800,l=(0===r.animationDelay?0:r.animationDelay||0)+(h||0);for(const h of s){const s=document.createElementNS(t,"path");if(s.setAttribute("d",h),s.setAttribute("fill","none"),s.setAttribute("stroke",r.color||"currentColor"),s.setAttribute("stroke-width",""+u),f){const t=s.getTotalLength();i.push(t),o+=t;}e.appendChild(s),n.push(s);}if(f){let t=0;for(let e=0;e<n.length;e++){const s=n[e],r=i[e],h=o?a*(r/o):0,c=l+t,u=s.style;u.strokeDashoffset=""+r,u.strokeDasharray=""+r,u.animation=`rough-notation-dash ${h}ms ease-out ${c}ms forwards`,t+=h;}}}}class _{constructor(t,e){this._state="unattached",this._resizing=!1,this._seed=Math.floor(Math.random()*2**31),this._animationGroupDelay=0,this._resizeListener=()=>{this._resizing||(this._resizing=!0,setTimeout(()=>{if(this._resizing=!1,"showing"===this._state){const t=this.size();t&&this.hasRectChanged(t)&&this.show();}},400));},this._e=t,this._config=JSON.parse(JSON.stringify(e)),this.attach();}get animate(){return this._config.animate}set animate(t){this._config.animate=t;}get animationDuration(){return this._config.animationDuration}set animationDuration(t){this._config.animationDuration=t;}get animationDelay(){return this._config.animationDelay}set animationDelay(t){this._config.animationDelay=t;}get iterations(){return this._config.iterations}set iterations(t){this._config.iterations=t;}get color(){return this._config.color}set color(t){this._config.color!==t&&(this._config.color=t,this.refresh());}get strokeWidth(){return this._config.strokeWidth}set strokeWidth(t){this._config.strokeWidth!==t&&(this._config.strokeWidth=t,this.refresh());}get padding(){return this._config.padding}set padding(t){this._config.padding!==t&&(this._config.padding=t,this.refresh());}attach(){if("unattached"===this._state&&this._e.parentElement){!function(){if(!window.__rno_kf_s){const t=window.__rno_kf_s=document.createElement("style");t.textContent="@keyframes rough-notation-dash { to { stroke-dashoffset: 0; } }",document.head.appendChild(t);}}();const e=this._svg=document.createElementNS(t,"svg");e.setAttribute("class","rough-annotation");const s=e.style;s.position="absolute",s.top="0",s.left="0",s.overflow="visible",s.pointerEvents="none",s.width="100px",s.height="100px";const i="highlight"===this._config.type;if(this._e.insertAdjacentElement(i?"beforebegin":"afterend",e),this._state="not-showing",i){const t=window.getComputedStyle(this._e).position;(!t||"static"===t)&&(this._e.style.position="relative");}this.attachListeners();}}detachListeners(){window.removeEventListener("resize",this._resizeListener),this._ro&&this._ro.unobserve(this._e);}attachListeners(){this.detachListeners(),window.addEventListener("resize",this._resizeListener,{passive:!0}),!this._ro&&"ResizeObserver"in window&&(this._ro=new window.ResizeObserver(t=>{for(const e of t){let t=!0;if(e.contentRect){const s=this.sizeFor(e.contentRect);s&&!this.hasRectChanged(s)&&(t=!1);}t&&this._resizeListener();}})),this._ro&&this._ro.observe(this._e);}sameInteger(t,e){return Math.round(t)===Math.round(e)}hasRectChanged(t){return !this._lastSize||!t||!(this.sameInteger(t.x,this._lastSize.x)&&this.sameInteger(t.y,this._lastSize.y)&&this.sameInteger(t.w,this._lastSize.w)&&this.sameInteger(t.h,this._lastSize.h))}isShowing(){return "not-showing"!==this._state}refresh(){this.isShowing()&&!this.pendingRefresh&&(this.pendingRefresh=Promise.resolve().then(()=>{this.isShowing()&&this.show(),delete this.pendingRefresh;}));}show(){switch(this._state){case"unattached":break;case"showing":this.hide(),this._svg&&this.render(this._svg,!0);break;case"not-showing":this.attach(),this._svg&&this.render(this._svg,!1);}}hide(){if(this._svg)for(;this._svg.lastChild;)this._svg.removeChild(this._svg.lastChild);this._state="not-showing";}remove(){this._svg&&this._svg.parentElement&&this._svg.parentElement.removeChild(this._svg),this._svg=void 0,this._state="unattached",this.detachListeners();}render(t,e){const s=this.size();if(s){let i=this._config;e&&(i=JSON.parse(JSON.stringify(this._config)),i.animate=!1),p(t,s,i,this._animationGroupDelay,this._seed),this._lastSize=s,this._state="showing";}}size(){return this.sizeFor(this._e.getBoundingClientRect())}sizeFor(t){if(this._svg){const e=this._svg.getBoundingClientRect(),s=t;return {x:(s.x||s.left)-(e.x||e.left),y:(s.y||s.top)-(e.y||e.top),w:s.width,h:s.height}}return null}}function m(t,e){return new _(t,e)}function w(t){let e=0;for(const s of t){const t=s;t._animationGroupDelay=e;e+=0===t.animationDuration?0:t.animationDuration||800;}const s=[...t];return {show(){for(const t of s)t.show();},hide(){for(const t of s)t.hide();}}}

    /* node_modules/svelte-rough-notation/src/RoughNotation.svelte generated by Svelte v3.21.0 */
    const file$5 = "node_modules/svelte-rough-notation/src/RoughNotation.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_style(div, "display", "inline");
    			add_location(div, file$5, 82, 0, 2123);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			/*div_binding*/ ctx[17](div);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 32768) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
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
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			/*div_binding*/ ctx[17](null);
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
    	const omit_props_names = [
    		"visible","animate","animationDuration","animationDelay","color","strokeWidth","padding","iterations","_animationGroupDelay","show","hide","isShowing","annotation"
    	];

    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let container;
    	let { visible = false } = $$props;
    	let { animate = undefined } = $$props;
    	let { animationDuration = undefined } = $$props;
    	let { animationDelay = undefined } = $$props;
    	let { color = undefined } = $$props;
    	let { strokeWidth = undefined } = $$props;
    	let { padding = undefined } = $$props;
    	let { iterations = undefined } = $$props;
    	let { _animationGroupDelay = undefined } = $$props;
    	const show = () => $$invalidate(1, visible = true);
    	const hide = () => $$invalidate(1, visible = false);
    	const isShowing = () => visible;
    	let { annotation = undefined } = $$props;

    	onMount(() => {
    		$$invalidate(2, annotation = m(container, {
    			animate,
    			animationDuration,
    			animationDelay,
    			color,
    			strokeWidth,
    			padding,
    			iterations,
    			// Graceful fallback for if new props are added
    			...$$restProps
    		}));

    		return () => annotation.remove();
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("RoughNotation", $$slots, ['default']);

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(0, container = $$value);
    		});
    	}

    	$$self.$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(14, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("visible" in $$new_props) $$invalidate(1, visible = $$new_props.visible);
    		if ("animate" in $$new_props) $$invalidate(3, animate = $$new_props.animate);
    		if ("animationDuration" in $$new_props) $$invalidate(4, animationDuration = $$new_props.animationDuration);
    		if ("animationDelay" in $$new_props) $$invalidate(5, animationDelay = $$new_props.animationDelay);
    		if ("color" in $$new_props) $$invalidate(6, color = $$new_props.color);
    		if ("strokeWidth" in $$new_props) $$invalidate(7, strokeWidth = $$new_props.strokeWidth);
    		if ("padding" in $$new_props) $$invalidate(8, padding = $$new_props.padding);
    		if ("iterations" in $$new_props) $$invalidate(9, iterations = $$new_props.iterations);
    		if ("_animationGroupDelay" in $$new_props) $$invalidate(10, _animationGroupDelay = $$new_props._animationGroupDelay);
    		if ("annotation" in $$new_props) $$invalidate(2, annotation = $$new_props.annotation);
    		if ("$$scope" in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		annotate: m,
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
    		_animationGroupDelay,
    		show,
    		hide,
    		isShowing,
    		annotation
    	});

    	$$self.$inject_state = $$new_props => {
    		if ("container" in $$props) $$invalidate(0, container = $$new_props.container);
    		if ("visible" in $$props) $$invalidate(1, visible = $$new_props.visible);
    		if ("animate" in $$props) $$invalidate(3, animate = $$new_props.animate);
    		if ("animationDuration" in $$props) $$invalidate(4, animationDuration = $$new_props.animationDuration);
    		if ("animationDelay" in $$props) $$invalidate(5, animationDelay = $$new_props.animationDelay);
    		if ("color" in $$props) $$invalidate(6, color = $$new_props.color);
    		if ("strokeWidth" in $$props) $$invalidate(7, strokeWidth = $$new_props.strokeWidth);
    		if ("padding" in $$props) $$invalidate(8, padding = $$new_props.padding);
    		if ("iterations" in $$props) $$invalidate(9, iterations = $$new_props.iterations);
    		if ("_animationGroupDelay" in $$props) $$invalidate(10, _animationGroupDelay = $$new_props._animationGroupDelay);
    		if ("annotation" in $$props) $$invalidate(2, annotation = $$new_props.annotation);
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

    		if ($$self.$$.dirty & /*annotation, _animationGroupDelay*/ 1028) {
    			 if (annotation && _animationGroupDelay !== undefined) {
    				$$invalidate(2, annotation._animationGroupDelay = _animationGroupDelay, annotation);
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
    		_animationGroupDelay,
    		show,
    		hide,
    		isShowing,
    		$$restProps,
    		$$scope,
    		$$slots,
    		div_binding
    	];
    }

    class RoughNotation extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			visible: 1,
    			animate: 3,
    			animationDuration: 4,
    			animationDelay: 5,
    			color: 6,
    			strokeWidth: 7,
    			padding: 8,
    			iterations: 9,
    			_animationGroupDelay: 10,
    			show: 11,
    			hide: 12,
    			isShowing: 13,
    			annotation: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RoughNotation",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get visible() {
    		return this.$$.ctx[1];
    	}

    	set visible(visible) {
    		this.$set({ visible });
    		flush();
    	}

    	get animate() {
    		return this.$$.ctx[3];
    	}

    	set animate(animate) {
    		this.$set({ animate });
    		flush();
    	}

    	get animationDuration() {
    		return this.$$.ctx[4];
    	}

    	set animationDuration(animationDuration) {
    		this.$set({ animationDuration });
    		flush();
    	}

    	get animationDelay() {
    		return this.$$.ctx[5];
    	}

    	set animationDelay(animationDelay) {
    		this.$set({ animationDelay });
    		flush();
    	}

    	get color() {
    		return this.$$.ctx[6];
    	}

    	set color(color) {
    		this.$set({ color });
    		flush();
    	}

    	get strokeWidth() {
    		return this.$$.ctx[7];
    	}

    	set strokeWidth(strokeWidth) {
    		this.$set({ strokeWidth });
    		flush();
    	}

    	get padding() {
    		return this.$$.ctx[8];
    	}

    	set padding(padding) {
    		this.$set({ padding });
    		flush();
    	}

    	get iterations() {
    		return this.$$.ctx[9];
    	}

    	set iterations(iterations) {
    		this.$set({ iterations });
    		flush();
    	}

    	get _animationGroupDelay() {
    		return this.$$.ctx[10];
    	}

    	set _animationGroupDelay(_animationGroupDelay) {
    		this.$set({ _animationGroupDelay });
    		flush();
    	}

    	get show() {
    		return this.$$.ctx[11];
    	}

    	set show(value) {
    		throw new Error("<RoughNotation>: Cannot set read-only property 'show'");
    	}

    	get hide() {
    		return this.$$.ctx[12];
    	}

    	set hide(value) {
    		throw new Error("<RoughNotation>: Cannot set read-only property 'hide'");
    	}

    	get isShowing() {
    		return this.$$.ctx[13];
    	}

    	set isShowing(value) {
    		throw new Error("<RoughNotation>: Cannot set read-only property 'isShowing'");
    	}

    	get annotation() {
    		return this.$$.ctx[2];
    	}

    	set annotation(annotation) {
    		this.$set({ annotation });
    		flush();
    	}
    }

    /* src/components/Sidebar.svelte generated by Svelte v3.21.0 */
    const file$6 = "src/components/Sidebar.svelte";

    // (20:4) <Annotation bind:visible type="highlight" color="rgba(0, 187, 162, 0.1)">
    function create_default_slot$4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Maxwell Eisen");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(20:4) <Annotation bind:visible type=\\\"highlight\\\" color=\\\"rgba(0, 187, 162, 0.1)\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let h1;
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
    	let t7;
    	let a1;
    	let t8;
    	let a2;
    	let t9;
    	let a3;
    	let t10;
    	let div1;
    	let img;
    	let img_src_value;
    	let img_onmouseover_value;
    	let img_onmouseout_value;
    	let current;

    	function annotation_visible_binding(value) {
    		/*annotation_visible_binding*/ ctx[3].call(null, value);
    	}

    	let annotation_props = {
    		type: "highlight",
    		color: "rgba(0, 187, 162, 0.1)",
    		$$slots: { default: [create_default_slot$4] },
    		$$scope: { ctx }
    	};

    	if (/*visible*/ ctx[0] !== void 0) {
    		annotation_props.visible = /*visible*/ ctx[0];
    	}

    	const annotation = new RoughNotation({ props: annotation_props, $$inline: true });
    	binding_callbacks.push(() => bind(annotation, "visible", annotation_visible_binding));
    	const linkedinlogo = new IoLogoLinkedin({ $$inline: true });
    	const githublogo = new IoLogoGithub({ $$inline: true });
    	const twitterlogo = new IoLogoTwitter({ $$inline: true });
    	const mailicon = new IoIosMail({ $$inline: true });

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			create_component(annotation.$$.fragment);
    			t0 = space();
    			h20 = element("h2");
    			t1 = text("CS ");
    			b = element("b");
    			b.textContent = "@";
    			t3 = text(" Queen's University");
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
    			img = element("img");
    			add_location(h1, file$6, 19, 0, 629);
    			set_style(b, "color", "#ababab");
    			set_style(b, "font-weight", "300");
    			add_location(b, file$6, 20, 22, 760);
    			attr_dev(h20, "class", "status svelte-1ah570u");
    			add_location(h20, file$6, 20, 0, 738);
    			attr_dev(h21, "class", "location svelte-1ah570u");
    			add_location(h21, file$6, 21, 0, 834);
    			attr_dev(a0, "class", "social-links svelte-1ah570u");
    			attr_dev(a0, "href", "https://linkedin.com/in/maxeisen/");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file$6, 23, 4, 913);
    			attr_dev(a1, "class", "social-links svelte-1ah570u");
    			attr_dev(a1, "href", "https://github.com/maxeisen/");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file$6, 24, 4, 1019);
    			attr_dev(a2, "class", "social-links svelte-1ah570u");
    			attr_dev(a2, "href", "https://twitter.com/maxeisen/");
    			attr_dev(a2, "target", "_blank");
    			add_location(a2, file$6, 25, 4, 1118);
    			attr_dev(a3, "class", "social-links svelte-1ah570u");
    			attr_dev(a3, "href", "mailto:max.eisen@queensu.ca");
    			attr_dev(a3, "target", "_blank");
    			add_location(a3, file$6, 26, 4, 1219);
    			attr_dev(div0, "class", "social-links-container svelte-1ah570u");
    			add_location(div0, file$6, 22, 0, 872);
    			attr_dev(img, "class", "headshot svelte-1ah570u");
    			if (img.src !== (img_src_value = /*statusHeadshot*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Current headshot");
    			attr_dev(img, "onmouseover", img_onmouseover_value = "attributeChange(this, 'src', '" + /*cleanHeadshot*/ ctx[2] + "');");
    			attr_dev(img, "onmouseout", img_onmouseout_value = "attributeChange(this, 'src', '" + /*statusHeadshot*/ ctx[1] + "');");
    			add_location(img, file$6, 30, 4, 1346);
    			attr_dev(div1, "class", "headshot svelte-1ah570u");
    			add_location(div1, file$6, 29, 0, 1319);
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
    			append_dev(div1, img);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const annotation_changes = {};

    			if (dirty & /*$$scope*/ 16) {
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
    			if (detaching) detach_dev(h1);
    			destroy_component(annotation);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(h20);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(h21);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div0);
    			destroy_component(linkedinlogo);
    			destroy_component(githublogo);
    			destroy_component(twitterlogo);
    			destroy_component(mailicon);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div1);
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
    	let statusHeadshot = "./img/headshots/status_headshot.png";
    	let cleanHeadshot = "./img/headshots/clean_headshot.png";
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
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Sidebar", $$slots, []);

    	function annotation_visible_binding(value) {
    		visible = value;
    		$$invalidate(0, visible);
    	}

    	$$self.$capture_state = () => ({
    		statusHeadshot,
    		cleanHeadshot,
    		LinkedInLogo: IoLogoLinkedin,
    		GitHubLogo: IoLogoGithub,
    		TwitterLogo: IoLogoTwitter,
    		MailIcon: IoIosMail,
    		Annotation: RoughNotation,
    		onMount,
    		visible
    	});

    	$$self.$inject_state = $$props => {
    		if ("statusHeadshot" in $$props) $$invalidate(1, statusHeadshot = $$props.statusHeadshot);
    		if ("cleanHeadshot" in $$props) $$invalidate(2, cleanHeadshot = $$props.cleanHeadshot);
    		if ("visible" in $$props) $$invalidate(0, visible = $$props.visible);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [visible, statusHeadshot, cleanHeadshot, annotation_visible_binding];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/Intro.svelte generated by Svelte v3.21.0 */
    const file$7 = "src/components/Intro.svelte";

    // (17:42) <Annotation bind:this={introDescriptors[0]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">
    function create_default_slot_4(ctx) {
    	let descriptor;

    	const block = {
    		c: function create() {
    			descriptor = element("descriptor");
    			descriptor.textContent = "Computer Science";
    			attr_dev(descriptor, "class", "svelte-1p47cs2");
    			add_location(descriptor, file$7, 16, 158, 595);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, descriptor, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(descriptor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(17:42) <Annotation bind:this={introDescriptors[0]} type=\\\"box\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"0.8\\\">",
    		ctx
    	});

    	return block;
    }

    // (20:31) <Annotation bind:this={introDescriptors[1]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">
    function create_default_slot_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("computational thinker");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(20:31) <Annotation bind:this={introDescriptors[1]} type=\\\"box\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"0.8\\\">",
    		ctx
    	});

    	return block;
    }

    // (24:84) <Annotation bind:this={introDescriptors[2]} type="circle" padding={5} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">
    function create_default_slot_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("sociable person");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(24:84) <Annotation bind:this={introDescriptors[2]} type=\\\"circle\\\" padding={5} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"0.8\\\">",
    		ctx
    	});

    	return block;
    }

    // (26:4) <Annotation bind:this={introDescriptors[3]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("effectively");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(26:4) <Annotation bind:this={introDescriptors[3]} type=\\\"underline\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"1\\\">",
    		ctx
    	});

    	return block;
    }

    // (27:4) <Annotation bind:this={introDescriptors[4]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">
    function create_default_slot$5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("confidently");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(27:4) <Annotation bind:this={introDescriptors[4]} type=\\\"underline\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"1\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let h1;
    	let t1;
    	let div;
    	let p0;
    	let t2;
    	let t3;
    	let a0;
    	let t5;
    	let t6;
    	let p1;
    	let t7;
    	let descriptor0;
    	let t8;
    	let t9;
    	let p2;
    	let t10;
    	let descriptor1;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let p3;
    	let t15;
    	let a1;
    	let t17;
    	let current;

    	let annotation0_props = {
    		type: "box",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "0.8",
    		$$slots: { default: [create_default_slot_4] },
    		$$scope: { ctx }
    	};

    	const annotation0 = new RoughNotation({ props: annotation0_props, $$inline: true });
    	/*annotation0_binding*/ ctx[1](annotation0);

    	let annotation1_props = {
    		type: "box",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "0.8",
    		$$slots: { default: [create_default_slot_3] },
    		$$scope: { ctx }
    	};

    	const annotation1 = new RoughNotation({ props: annotation1_props, $$inline: true });
    	/*annotation1_binding*/ ctx[2](annotation1);

    	let annotation2_props = {
    		type: "circle",
    		padding: 5,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "0.8",
    		$$slots: { default: [create_default_slot_2] },
    		$$scope: { ctx }
    	};

    	const annotation2 = new RoughNotation({ props: annotation2_props, $$inline: true });
    	/*annotation2_binding*/ ctx[3](annotation2);

    	let annotation3_props = {
    		type: "underline",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "1",
    		$$slots: { default: [create_default_slot_1] },
    		$$scope: { ctx }
    	};

    	const annotation3 = new RoughNotation({ props: annotation3_props, $$inline: true });
    	/*annotation3_binding*/ ctx[4](annotation3);

    	let annotation4_props = {
    		type: "underline",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "1",
    		$$slots: { default: [create_default_slot$5] },
    		$$scope: { ctx }
    	};

    	const annotation4 = new RoughNotation({ props: annotation4_props, $$inline: true });
    	/*annotation4_binding*/ ctx[5](annotation4);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "My Name is Max Eisen...";
    			t1 = space();
    			div = element("div");
    			p0 = element("p");
    			t2 = text("and I am a ");
    			create_component(annotation0.$$.fragment);
    			t3 = text("\n    student at ");
    			a0 = element("a");
    			a0.textContent = "Queen's University";
    			t5 = text(" with a fascination for technology.");
    			t6 = space();
    			p1 = element("p");
    			t7 = text("I am also a ");
    			descriptor0 = element("descriptor");
    			create_component(annotation1.$$.fragment);
    			t8 = text("\n    who enjoys programming, software and web development, leading teams, beta testing, automation, and UI/UX design.\n    In my free time, you can find me skiing, hiking, travelling, playing guitar, and trying new tech.");
    			t9 = space();
    			p2 = element("p");
    			t10 = text("I spend a fair amount of time in front of a computer, but I am a ");
    			descriptor1 = element("descriptor");
    			create_component(annotation2.$$.fragment);
    			t11 = text("\n    who prefers to work with, and be around others. Whether with a project team, a customer, a supervisor, or friends, I strive to communicate\n    ");
    			create_component(annotation3.$$.fragment);
    			t12 = text(" and\n    ");
    			create_component(annotation4.$$.fragment);
    			t13 = text(".");
    			t14 = space();
    			p3 = element("p");
    			t15 = text("Feel free to explore my website, click on things for more information, and ");
    			a1 = element("a");
    			a1.textContent = "email me";
    			t17 = text(" if you have any questions or comments.");
    			attr_dev(h1, "class", "section-title-intro svelte-1p47cs2");
    			add_location(h1, file$7, 14, 0, 346);
    			attr_dev(a0, "class", "intro-link svelte-1p47cs2");
    			attr_dev(a0, "href", "https://www.queensu.ca/");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file$7, 17, 15, 665);
    			attr_dev(p0, "class", "title-extension svelte-1p47cs2");
    			add_location(p0, file$7, 16, 4, 441);
    			attr_dev(descriptor0, "class", "svelte-1p47cs2");
    			add_location(descriptor0, file$7, 19, 19, 816);
    			add_location(p1, file$7, 19, 4, 801);
    			attr_dev(descriptor1, "class", "svelte-1p47cs2");
    			add_location(descriptor1, file$7, 23, 72, 1288);
    			add_location(p2, file$7, 23, 4, 1220);
    			attr_dev(a1, "class", "intro-link svelte-1p47cs2");
    			attr_dev(a1, "href", "mailto:max.eisen@queensu.ca");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file$7, 28, 82, 1998);
    			add_location(p3, file$7, 28, 4, 1920);
    			attr_dev(div, "class", "intro-paragraph svelte-1p47cs2");
    			add_location(div, file$7, 15, 0, 407);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, p0);
    			append_dev(p0, t2);
    			mount_component(annotation0, p0, null);
    			append_dev(p0, t3);
    			append_dev(p0, a0);
    			append_dev(p0, t5);
    			append_dev(div, t6);
    			append_dev(div, p1);
    			append_dev(p1, t7);
    			append_dev(p1, descriptor0);
    			mount_component(annotation1, descriptor0, null);
    			append_dev(p1, t8);
    			append_dev(div, t9);
    			append_dev(div, p2);
    			append_dev(p2, t10);
    			append_dev(p2, descriptor1);
    			mount_component(annotation2, descriptor1, null);
    			append_dev(p2, t11);
    			mount_component(annotation3, p2, null);
    			append_dev(p2, t12);
    			mount_component(annotation4, p2, null);
    			append_dev(p2, t13);
    			append_dev(div, t14);
    			append_dev(div, p3);
    			append_dev(p3, t15);
    			append_dev(p3, a1);
    			append_dev(p3, t17);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const annotation0_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				annotation0_changes.$$scope = { dirty, ctx };
    			}

    			annotation0.$set(annotation0_changes);
    			const annotation1_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				annotation1_changes.$$scope = { dirty, ctx };
    			}

    			annotation1.$set(annotation1_changes);
    			const annotation2_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				annotation2_changes.$$scope = { dirty, ctx };
    			}

    			annotation2.$set(annotation2_changes);
    			const annotation3_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				annotation3_changes.$$scope = { dirty, ctx };
    			}

    			annotation3.$set(annotation3_changes);
    			const annotation4_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				annotation4_changes.$$scope = { dirty, ctx };
    			}

    			annotation4.$set(annotation4_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(annotation0.$$.fragment, local);
    			transition_in(annotation1.$$.fragment, local);
    			transition_in(annotation2.$$.fragment, local);
    			transition_in(annotation3.$$.fragment, local);
    			transition_in(annotation4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(annotation0.$$.fragment, local);
    			transition_out(annotation1.$$.fragment, local);
    			transition_out(annotation2.$$.fragment, local);
    			transition_out(annotation3.$$.fragment, local);
    			transition_out(annotation4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			/*annotation0_binding*/ ctx[1](null);
    			destroy_component(annotation0);
    			/*annotation1_binding*/ ctx[2](null);
    			destroy_component(annotation1);
    			/*annotation2_binding*/ ctx[3](null);
    			destroy_component(annotation2);
    			/*annotation3_binding*/ ctx[4](null);
    			destroy_component(annotation3);
    			/*annotation4_binding*/ ctx[5](null);
    			destroy_component(annotation4);
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
    	let introDescriptors = [];

    	onMount(() => {
    		let ids = w(introDescriptors);

    		setTimeout(
    			() => {
    				ids.show();
    			},
    			4000
    		);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Intro> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Intro", $$slots, []);

    	function annotation0_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			introDescriptors[0] = $$value;
    			$$invalidate(0, introDescriptors);
    		});
    	}

    	function annotation1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			introDescriptors[1] = $$value;
    			$$invalidate(0, introDescriptors);
    		});
    	}

    	function annotation2_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			introDescriptors[2] = $$value;
    			$$invalidate(0, introDescriptors);
    		});
    	}

    	function annotation3_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			introDescriptors[3] = $$value;
    			$$invalidate(0, introDescriptors);
    		});
    	}

    	function annotation4_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			introDescriptors[4] = $$value;
    			$$invalidate(0, introDescriptors);
    		});
    	}

    	$$self.$capture_state = () => ({
    		Annotation: RoughNotation,
    		annotationGroup: w,
    		onMount,
    		introDescriptors
    	});

    	$$self.$inject_state = $$props => {
    		if ("introDescriptors" in $$props) $$invalidate(0, introDescriptors = $$props.introDescriptors);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		introDescriptors,
    		annotation0_binding,
    		annotation1_binding,
    		annotation2_binding,
    		annotation3_binding,
    		annotation4_binding
    	];
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Intro",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/components/ExperienceModal.svelte generated by Svelte v3.21.0 */

    const file$8 = "src/components/ExperienceModal.svelte";

    function create_fragment$8(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1;
    	let h2;
    	let a;
    	let t2;
    	let t3;
    	let h30;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let h31;
    	let t8;
    	let t9;
    	let p;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text(/*position*/ ctx[0]);
    			t1 = space();
    			h2 = element("h2");
    			a = element("a");
    			t2 = text(/*company*/ ctx[1]);
    			t3 = space();
    			h30 = element("h3");
    			t4 = text(/*startDate*/ ctx[3]);
    			t5 = text("-");
    			t6 = text(/*endDate*/ ctx[4]);
    			t7 = space();
    			h31 = element("h3");
    			t8 = text(/*location*/ ctx[5]);
    			t9 = space();
    			p = element("p");
    			attr_dev(h1, "class", "modal-position svelte-dyj6m4");
    			add_location(h1, file$8, 11, 4, 235);
    			attr_dev(a, "href", /*companyLink*/ ctx[2]);
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$8, 12, 30, 308);
    			attr_dev(h2, "class", "modal-company svelte-dyj6m4");
    			add_location(h2, file$8, 12, 4, 282);
    			attr_dev(h30, "class", "modal-description svelte-dyj6m4");
    			set_style(h30, "text-align", "center");
    			add_location(h30, file$8, 13, 4, 369);
    			attr_dev(h31, "class", "modal-description svelte-dyj6m4");
    			set_style(h31, "text-align", "center");
    			set_style(h31, "color", "#333333");
    			add_location(h31, file$8, 14, 4, 457);
    			attr_dev(p, "class", "modal-description svelte-dyj6m4");
    			add_location(p, file$8, 15, 4, 550);
    			attr_dev(div, "class", "experience-modal svelte-dyj6m4");
    			add_location(div, file$8, 10, 0, 200);
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
    			append_dev(h2, a);
    			append_dev(a, t2);
    			append_dev(div, t3);
    			append_dev(div, h30);
    			append_dev(h30, t4);
    			append_dev(h30, t5);
    			append_dev(h30, t6);
    			append_dev(div, t7);
    			append_dev(div, h31);
    			append_dev(h31, t8);
    			append_dev(div, t9);
    			append_dev(div, p);
    			p.innerHTML = /*description*/ ctx[6];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*position*/ 1) set_data_dev(t0, /*position*/ ctx[0]);
    			if (dirty & /*company*/ 2) set_data_dev(t2, /*company*/ ctx[1]);

    			if (dirty & /*companyLink*/ 4) {
    				attr_dev(a, "href", /*companyLink*/ ctx[2]);
    			}

    			if (dirty & /*startDate*/ 8) set_data_dev(t4, /*startDate*/ ctx[3]);
    			if (dirty & /*endDate*/ 16) set_data_dev(t6, /*endDate*/ ctx[4]);
    			if (dirty & /*location*/ 32) set_data_dev(t8, /*location*/ ctx[5]);
    			if (dirty & /*description*/ 64) p.innerHTML = /*description*/ ctx[6];		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	let { position } = $$props;
    	let { company } = $$props;
    	let { companyLink } = $$props;
    	let { startDate } = $$props;
    	let { endDate } = $$props;
    	let { location } = $$props;
    	let { description } = $$props;

    	const writable_props = [
    		"position",
    		"company",
    		"companyLink",
    		"startDate",
    		"endDate",
    		"location",
    		"description"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ExperienceModal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ExperienceModal", $$slots, []);

    	$$self.$set = $$props => {
    		if ("position" in $$props) $$invalidate(0, position = $$props.position);
    		if ("company" in $$props) $$invalidate(1, company = $$props.company);
    		if ("companyLink" in $$props) $$invalidate(2, companyLink = $$props.companyLink);
    		if ("startDate" in $$props) $$invalidate(3, startDate = $$props.startDate);
    		if ("endDate" in $$props) $$invalidate(4, endDate = $$props.endDate);
    		if ("location" in $$props) $$invalidate(5, location = $$props.location);
    		if ("description" in $$props) $$invalidate(6, description = $$props.description);
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
    		if ("position" in $$props) $$invalidate(0, position = $$props.position);
    		if ("company" in $$props) $$invalidate(1, company = $$props.company);
    		if ("companyLink" in $$props) $$invalidate(2, companyLink = $$props.companyLink);
    		if ("startDate" in $$props) $$invalidate(3, startDate = $$props.startDate);
    		if ("endDate" in $$props) $$invalidate(4, endDate = $$props.endDate);
    		if ("location" in $$props) $$invalidate(5, location = $$props.location);
    		if ("description" in $$props) $$invalidate(6, description = $$props.description);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [position, company, companyLink, startDate, endDate, location, description];
    }

    class ExperienceModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
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
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*position*/ ctx[0] === undefined && !("position" in props)) {
    			console.warn("<ExperienceModal> was created without expected prop 'position'");
    		}

    		if (/*company*/ ctx[1] === undefined && !("company" in props)) {
    			console.warn("<ExperienceModal> was created without expected prop 'company'");
    		}

    		if (/*companyLink*/ ctx[2] === undefined && !("companyLink" in props)) {
    			console.warn("<ExperienceModal> was created without expected prop 'companyLink'");
    		}

    		if (/*startDate*/ ctx[3] === undefined && !("startDate" in props)) {
    			console.warn("<ExperienceModal> was created without expected prop 'startDate'");
    		}

    		if (/*endDate*/ ctx[4] === undefined && !("endDate" in props)) {
    			console.warn("<ExperienceModal> was created without expected prop 'endDate'");
    		}

    		if (/*location*/ ctx[5] === undefined && !("location" in props)) {
    			console.warn("<ExperienceModal> was created without expected prop 'location'");
    		}

    		if (/*description*/ ctx[6] === undefined && !("description" in props)) {
    			console.warn("<ExperienceModal> was created without expected prop 'description'");
    		}
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

    /* src/components/Experience.svelte generated by Svelte v3.21.0 */
    const file$9 = "src/components/Experience.svelte";

    function create_fragment$9(ctx) {
    	let h10;
    	let t1;
    	let div24;
    	let div3;
    	let h20;
    	let div0;
    	let t3;
    	let h21;
    	let t5;
    	let p0;
    	let t7;
    	let h11;
    	let div1;
    	let div2;
    	let t12;
    	let div7;
    	let h22;
    	let div4;
    	let t14;
    	let h23;
    	let t16;
    	let p1;
    	let t18;
    	let h12;
    	let div5;
    	let div6;
    	let t23;
    	let div11;
    	let h24;
    	let div8;
    	let t25;
    	let h25;
    	let t27;
    	let p2;
    	let t29;
    	let h13;
    	let div9;
    	let div10;
    	let t34;
    	let div15;
    	let h26;
    	let div12;
    	let t36;
    	let h27;
    	let t38;
    	let p3;
    	let t40;
    	let h14;
    	let div13;
    	let t43;
    	let div14;
    	let t45;
    	let div19;
    	let h28;
    	let div16;
    	let t47;
    	let h29;
    	let t49;
    	let p4;
    	let t51;
    	let h15;
    	let div17;
    	let div18;
    	let t54;
    	let div23;
    	let h210;
    	let div20;
    	let t56;
    	let h211;
    	let t58;
    	let p5;
    	let t60;
    	let h16;
    	let div21;
    	let div22;
    	let dispose;

    	const block = {
    		c: function create() {
    			h10 = element("h1");
    			h10.textContent = "Experience";
    			t1 = space();
    			div24 = element("div");
    			div3 = element("div");
    			h20 = element("h2");
    			div0 = element("div");
    			div0.textContent = `${/*exp1*/ ctx[0].position}`;
    			t3 = space();
    			h21 = element("h2");
    			h21.textContent = `${/*exp1*/ ctx[0].company}`;
    			t5 = space();
    			p0 = element("p");
    			p0.textContent = `${/*exp1*/ ctx[0].shortDescription}`;
    			t7 = space();
    			h11 = element("h1");
    			div1 = element("div");
    			div1.textContent = `${/*exp1*/ ctx[0].startDate}-${/*exp1*/ ctx[0].endDate}`;
    			div2 = element("div");
    			div2.textContent = `${/*exp1*/ ctx[0].location}`;
    			t12 = space();
    			div7 = element("div");
    			h22 = element("h2");
    			div4 = element("div");
    			div4.textContent = `${/*exp2*/ ctx[1].position}`;
    			t14 = space();
    			h23 = element("h2");
    			h23.textContent = "QTMA";
    			t16 = space();
    			p1 = element("p");
    			p1.textContent = `${/*exp2*/ ctx[1].shortDescription}`;
    			t18 = space();
    			h12 = element("h1");
    			div5 = element("div");
    			div5.textContent = `${/*exp2*/ ctx[1].startDate}-${/*exp2*/ ctx[1].endDate}`;
    			div6 = element("div");
    			div6.textContent = `${/*exp2*/ ctx[1].location}`;
    			t23 = space();
    			div11 = element("div");
    			h24 = element("h2");
    			div8 = element("div");
    			div8.textContent = `${/*exp3*/ ctx[2].position}`;
    			t25 = space();
    			h25 = element("h2");
    			h25.textContent = `${/*exp3*/ ctx[2].company}`;
    			t27 = space();
    			p2 = element("p");
    			p2.textContent = `${/*exp3*/ ctx[2].shortDescription}`;
    			t29 = space();
    			h13 = element("h1");
    			div9 = element("div");
    			div9.textContent = `${/*exp3*/ ctx[2].startDate}-${/*exp3*/ ctx[2].endDate}`;
    			div10 = element("div");
    			div10.textContent = `${/*exp3*/ ctx[2].location}`;
    			t34 = space();
    			div15 = element("div");
    			h26 = element("h2");
    			div12 = element("div");
    			div12.textContent = "CS Teaching Assistant";
    			t36 = space();
    			h27 = element("h2");
    			h27.textContent = `${/*exp4*/ ctx[3].company}`;
    			t38 = space();
    			p3 = element("p");
    			p3.textContent = `${/*exp4*/ ctx[3].shortDescription}`;
    			t40 = space();
    			h14 = element("h1");
    			div13 = element("div");
    			div13.textContent = `Sept. 2019-${/*exp4*/ ctx[3].endDate}`;
    			t43 = space();
    			div14 = element("div");
    			div14.textContent = `${/*exp4*/ ctx[3].location}`;
    			t45 = space();
    			div19 = element("div");
    			h28 = element("h2");
    			div16 = element("div");
    			div16.textContent = `${/*exp5*/ ctx[4].position}`;
    			t47 = space();
    			h29 = element("h2");
    			h29.textContent = `${/*exp5*/ ctx[4].company}`;
    			t49 = space();
    			p4 = element("p");
    			p4.textContent = `${/*exp5*/ ctx[4].shortDescription}`;
    			t51 = space();
    			h15 = element("h1");
    			div17 = element("div");
    			div17.textContent = "Sept. 2019-Feb. 2020";
    			div18 = element("div");
    			div18.textContent = `${/*exp5*/ ctx[4].location}`;
    			t54 = space();
    			div23 = element("div");
    			h210 = element("h2");
    			div20 = element("div");
    			div20.textContent = `${/*exp6*/ ctx[5].position}`;
    			t56 = space();
    			h211 = element("h2");
    			h211.textContent = `${/*exp6*/ ctx[5].company}`;
    			t58 = space();
    			p5 = element("p");
    			p5.textContent = `${/*exp6*/ ctx[5].shortDescription}`;
    			t60 = space();
    			h16 = element("h1");
    			div21 = element("div");
    			div21.textContent = `${/*exp6*/ ctx[5].startDate}-${/*exp6*/ ctx[5].endDate}`;
    			div22 = element("div");
    			div22.textContent = `${/*exp6*/ ctx[5].location}`;
    			attr_dev(h10, "class", "section-title");
    			attr_dev(h10, "id", "experience");
    			add_location(h10, file$9, 99, 0, 6235);
    			attr_dev(div0, "class", "experience-position svelte-bar5y9");
    			add_location(div0, file$9, 102, 37, 6418);
    			attr_dev(h20, "class", "experience-title svelte-bar5y9");
    			add_location(h20, file$9, 102, 8, 6389);
    			attr_dev(h21, "class", "experience-company svelte-bar5y9");
    			add_location(h21, file$9, 103, 8, 6486);
    			add_location(p0, file$9, 104, 8, 6545);
    			attr_dev(div1, "class", "experience-date svelte-bar5y9");
    			add_location(div1, file$9, 105, 45, 6621);
    			attr_dev(div2, "class", "experience-location svelte-bar5y9");
    			add_location(div2, file$9, 105, 111, 6687);
    			attr_dev(h11, "class", "experience-date-location svelte-bar5y9");
    			add_location(h11, file$9, 105, 8, 6584);
    			attr_dev(div3, "class", "experience-item");
    			add_location(div3, file$9, 101, 4, 6333);
    			attr_dev(div4, "class", "experience-position svelte-bar5y9");
    			add_location(div4, file$9, 108, 37, 6847);
    			attr_dev(h22, "class", "experience-title svelte-bar5y9");
    			add_location(h22, file$9, 108, 8, 6818);
    			attr_dev(h23, "class", "experience-company svelte-bar5y9");
    			add_location(h23, file$9, 109, 8, 6915);
    			add_location(p1, file$9, 110, 8, 6964);
    			attr_dev(div5, "class", "experience-date svelte-bar5y9");
    			add_location(div5, file$9, 111, 45, 7040);
    			attr_dev(div6, "class", "experience-location svelte-bar5y9");
    			add_location(div6, file$9, 111, 111, 7106);
    			attr_dev(h12, "class", "experience-date-location svelte-bar5y9");
    			add_location(h12, file$9, 111, 8, 7003);
    			attr_dev(div7, "class", "experience-item");
    			add_location(div7, file$9, 107, 4, 6762);
    			attr_dev(div8, "class", "experience-position svelte-bar5y9");
    			add_location(div8, file$9, 114, 37, 7266);
    			attr_dev(h24, "class", "experience-title svelte-bar5y9");
    			add_location(h24, file$9, 114, 8, 7237);
    			attr_dev(h25, "class", "experience-company svelte-bar5y9");
    			add_location(h25, file$9, 115, 8, 7334);
    			add_location(p2, file$9, 116, 8, 7393);
    			attr_dev(div9, "class", "experience-date svelte-bar5y9");
    			add_location(div9, file$9, 117, 45, 7469);
    			attr_dev(div10, "class", "experience-location svelte-bar5y9");
    			add_location(div10, file$9, 117, 111, 7535);
    			attr_dev(h13, "class", "experience-date-location svelte-bar5y9");
    			add_location(h13, file$9, 117, 8, 7432);
    			attr_dev(div11, "class", "experience-item");
    			add_location(div11, file$9, 113, 4, 7181);
    			attr_dev(div12, "class", "experience-position svelte-bar5y9");
    			add_location(div12, file$9, 120, 37, 7695);
    			attr_dev(h26, "class", "experience-title svelte-bar5y9");
    			add_location(h26, file$9, 120, 8, 7666);
    			attr_dev(h27, "class", "experience-company svelte-bar5y9");
    			add_location(h27, file$9, 121, 8, 7769);
    			add_location(p3, file$9, 122, 8, 7828);
    			attr_dev(div13, "class", "experience-date svelte-bar5y9");
    			add_location(div13, file$9, 123, 45, 7904);
    			attr_dev(div14, "class", "experience-location svelte-bar5y9");
    			add_location(div14, file$9, 124, 8, 7973);
    			attr_dev(h14, "class", "experience-date-location svelte-bar5y9");
    			add_location(h14, file$9, 123, 8, 7867);
    			attr_dev(div15, "class", "experience-item");
    			add_location(div15, file$9, 119, 4, 7610);
    			attr_dev(div16, "class", "experience-position svelte-bar5y9");
    			add_location(div16, file$9, 127, 37, 8133);
    			attr_dev(h28, "class", "experience-title svelte-bar5y9");
    			add_location(h28, file$9, 127, 8, 8104);
    			attr_dev(h29, "class", "experience-company svelte-bar5y9");
    			add_location(h29, file$9, 128, 8, 8201);
    			add_location(p4, file$9, 129, 8, 8260);
    			attr_dev(div17, "class", "experience-date svelte-bar5y9");
    			add_location(div17, file$9, 130, 45, 8336);
    			attr_dev(div18, "class", "experience-location svelte-bar5y9");
    			add_location(div18, file$9, 130, 100, 8391);
    			attr_dev(h15, "class", "experience-date-location svelte-bar5y9");
    			add_location(h15, file$9, 130, 8, 8299);
    			attr_dev(div19, "class", "experience-item");
    			add_location(div19, file$9, 126, 4, 8048);
    			attr_dev(div20, "class", "experience-position svelte-bar5y9");
    			add_location(div20, file$9, 133, 37, 8551);
    			attr_dev(h210, "class", "experience-title svelte-bar5y9");
    			add_location(h210, file$9, 133, 8, 8522);
    			attr_dev(h211, "class", "experience-company svelte-bar5y9");
    			add_location(h211, file$9, 134, 8, 8619);
    			add_location(p5, file$9, 135, 8, 8678);
    			attr_dev(div21, "class", "experience-date svelte-bar5y9");
    			add_location(div21, file$9, 136, 45, 8754);
    			attr_dev(div22, "class", "experience-location svelte-bar5y9");
    			add_location(div22, file$9, 136, 111, 8820);
    			attr_dev(h16, "class", "experience-date-location svelte-bar5y9");
    			add_location(h16, file$9, 136, 8, 8717);
    			attr_dev(div23, "class", "experience-item");
    			add_location(div23, file$9, 132, 4, 8466);
    			attr_dev(div24, "class", "experience-subsection");
    			add_location(div24, file$9, 100, 0, 6293);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, h10, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div24, anchor);
    			append_dev(div24, div3);
    			append_dev(div3, h20);
    			append_dev(h20, div0);
    			append_dev(div3, t3);
    			append_dev(div3, h21);
    			append_dev(div3, t5);
    			append_dev(div3, p0);
    			append_dev(div3, t7);
    			append_dev(div3, h11);
    			append_dev(h11, div1);
    			append_dev(h11, div2);
    			append_dev(div24, t12);
    			append_dev(div24, div7);
    			append_dev(div7, h22);
    			append_dev(h22, div4);
    			append_dev(div7, t14);
    			append_dev(div7, h23);
    			append_dev(div7, t16);
    			append_dev(div7, p1);
    			append_dev(div7, t18);
    			append_dev(div7, h12);
    			append_dev(h12, div5);
    			append_dev(h12, div6);
    			append_dev(div24, t23);
    			append_dev(div24, div11);
    			append_dev(div11, h24);
    			append_dev(h24, div8);
    			append_dev(div11, t25);
    			append_dev(div11, h25);
    			append_dev(div11, t27);
    			append_dev(div11, p2);
    			append_dev(div11, t29);
    			append_dev(div11, h13);
    			append_dev(h13, div9);
    			append_dev(h13, div10);
    			append_dev(div24, t34);
    			append_dev(div24, div15);
    			append_dev(div15, h26);
    			append_dev(h26, div12);
    			append_dev(div15, t36);
    			append_dev(div15, h27);
    			append_dev(div15, t38);
    			append_dev(div15, p3);
    			append_dev(div15, t40);
    			append_dev(div15, h14);
    			append_dev(h14, div13);
    			append_dev(h14, t43);
    			append_dev(h14, div14);
    			append_dev(div24, t45);
    			append_dev(div24, div19);
    			append_dev(div19, h28);
    			append_dev(h28, div16);
    			append_dev(div19, t47);
    			append_dev(div19, h29);
    			append_dev(div19, t49);
    			append_dev(div19, p4);
    			append_dev(div19, t51);
    			append_dev(div19, h15);
    			append_dev(h15, div17);
    			append_dev(h15, div18);
    			append_dev(div24, t54);
    			append_dev(div24, div23);
    			append_dev(div23, h210);
    			append_dev(h210, div20);
    			append_dev(div23, t56);
    			append_dev(div23, h211);
    			append_dev(div23, t58);
    			append_dev(div23, p5);
    			append_dev(div23, t60);
    			append_dev(div23, h16);
    			append_dev(h16, div21);
    			append_dev(h16, div22);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(div3, "click", /*modal1*/ ctx[6], false, false, false),
    				listen_dev(div7, "click", /*modal2*/ ctx[7], false, false, false),
    				listen_dev(div11, "click", /*modal3*/ ctx[8], false, false, false),
    				listen_dev(div15, "click", /*modal4*/ ctx[9], false, false, false),
    				listen_dev(div19, "click", /*modal5*/ ctx[10], false, false, false),
    				listen_dev(div23, "click", /*modal6*/ ctx[11], false, false, false)
    			];
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h10);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div24);
    			run_all(dispose);
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
    	const exp1 = {
    		position: "Technical Developer",
    		company: "Jonah Group",
    		companyLink: "https://www.jonahgroup.com/",
    		startDate: "May 2020",
    		endDate: "Present",
    		location: "Toronto, ON",
    		shortDescription: "Working with a fantastic team of developers to create large-scale software products for companies",
    		longDescription: `<ul><li>Using a wide variety of technologies and languages in my summer internship to build custom, high-performance software for companies</li><li>Part of a team of several skilled developers and engineers to work on a decision engine to be implemented for client companies</li></ul>`
    	};

    	const exp2 = {
    		position: "Product Manager",
    		company: "Queen's Technology and Media Association",
    		companyLink: "https://qtma.ca/",
    		startDate: "April 2020",
    		endDate: "Present",
    		location: "Kingston, ON",
    		shortDescription: "Managing a talented team of Queen's students to ideate, develop, and market a software product",
    		longDescription: `<ul><li>Managing a team of talented developers and business analysts to ideate, build, and market a software product</li><li>Leading team presentations and product pitches to students, professors, and potential investors throughout the school year</li></ul>`
    	};

    	const exp3 = {
    		position: "Director of Technology",
    		company: "TechTrainers",
    		companyLink: "https://techtrainers.ca/",
    		startDate: "May 2019",
    		endDate: "Present",
    		location: "Toronto, ON",
    		shortDescription: "Creating a network of in-person and online quality tech help and tutoring around the GTA",
    		longDescription: `<ul><li>Co-founded technology help company, providing tech tutoring and support to 20+ customers in the first 3 months of operation across Toronto</li><li>Overseeing all technical aspects of operations, including web development, database management, and session scheduling</li><li>Company was able to turn a profit in first month of operations</li></ul>`
    	};

    	const exp4 = {
    		position: "Computer Science Teaching Assistant",
    		company: "Queen's University",
    		companyLink: "https://cs.queensu.ca/",
    		startDate: "September 2019",
    		endDate: "April 2020",
    		location: "Kingston, ON",
    		shortDescription: "Worked as a teaching assistant for a Python programming course of over 250 students",
    		longDescription: `<ul><li>Selected as one of 8 TAs for the specific Python programming course, having previously obtained an exceptional grade in the course</li><li>Assisted in the teaching and grading of the class with over 250 students</li><li>Held weekly office hours to guide students in completing assignments and reviewing for exams</li></ul>`
    	};

    	const exp5 = {
    		position: "Software Developer",
    		company: "QHacks",
    		companyLink: "https://qhacks.io/",
    		startDate: "September 2019",
    		endDate: "February 2020",
    		location: "Kingston, ON",
    		shortDescription: "Developed the website and other software for Queen's University's official MLH hackathon",
    		longDescription: `<ul><li>Developed and deployed the official website for the 2020 MLH-affiliated hackathon using React and Gatsby (accessed by over 10,000 individuals)</li><li>Worked on digital dashboard for use by 700+ applicants in time leading up to, and during event</li><li>Oversaw technology operations during the hackathon, helping teams in completing their projects, and keeping all information up-to-date</li></ul>`
    	};

    	const exp6 = {
    		position: "Technical Instructor",
    		company: "UnderTheGUI Inc.",
    		companyLink: "https://underthegui.com/",
    		startDate: "May",
    		endDate: "August 2019",
    		location: "Vancouver, BC",
    		shortDescription: "Taught and created course content for programming and engineering courses tailored to teens and young adults",
    		longDescription: `<ul><li>Instructed and evaluated 50 individual students through 6-week summer program revolving around early introduction to engineering and programming concepts</li><li>Courses include: Python Game Development, Fundamentals of Engineering, and Arduino C++ Programming</li><li>Created custom course content for organization for use in future years</li></ul>`
    	};

    	const { open } = getContext("simple-modal");

    	const modal1 = () => {
    		open(ExperienceModal, {
    			position: exp1.position,
    			company: exp1.company,
    			companyLink: exp1.companyLink,
    			startDate: exp1.startDate,
    			endDate: exp1.endDate,
    			location: exp1.location,
    			description: exp1.longDescription
    		});
    	};

    	const modal2 = () => {
    		open(ExperienceModal, {
    			position: exp2.position,
    			company: exp2.company,
    			companyLink: exp2.companyLink,
    			startDate: exp2.startDate,
    			endDate: exp2.endDate,
    			location: exp2.location,
    			description: exp2.longDescription
    		});
    	};

    	const modal3 = () => {
    		open(ExperienceModal, {
    			position: exp3.position,
    			company: exp3.company,
    			companyLink: exp3.companyLink,
    			startDate: exp3.startDate,
    			endDate: exp3.endDate,
    			location: exp3.location,
    			description: exp3.longDescription
    		});
    	};

    	const modal4 = () => {
    		open(ExperienceModal, {
    			position: exp4.position,
    			company: exp4.company,
    			companyLink: exp4.companyLink,
    			startDate: exp4.startDate,
    			endDate: exp4.endDate,
    			location: exp4.location,
    			description: exp4.longDescription
    		});
    	};

    	const modal5 = () => {
    		open(ExperienceModal, {
    			position: exp5.position,
    			company: exp5.company,
    			companyLink: exp5.companyLink,
    			startDate: exp5.startDate,
    			endDate: exp5.endDate,
    			location: exp5.location,
    			description: exp5.longDescription
    		});
    	};

    	const modal6 = () => {
    		open(ExperienceModal, {
    			position: exp6.position,
    			company: exp6.company,
    			companyLink: exp6.companyLink,
    			startDate: exp6.startDate,
    			endDate: exp6.endDate,
    			location: exp6.location,
    			description: exp6.longDescription
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Experience> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Experience", $$slots, []);

    	$$self.$capture_state = () => ({
    		getContext,
    		ExperienceModal,
    		exp1,
    		exp2,
    		exp3,
    		exp4,
    		exp5,
    		exp6,
    		open,
    		modal1,
    		modal2,
    		modal3,
    		modal4,
    		modal5,
    		modal6
    	});

    	return [
    		exp1,
    		exp2,
    		exp3,
    		exp4,
    		exp5,
    		exp6,
    		modal1,
    		modal2,
    		modal3,
    		modal4,
    		modal5,
    		modal6
    	];
    }

    class Experience extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Experience",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/components/ProjectModal.svelte generated by Svelte v3.21.0 */

    const file$a = "src/components/ProjectModal.svelte";

    function create_fragment$a(ctx) {
    	let div;
    	let h1;
    	let a0;
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
    	let p;
    	let t8;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t9;
    	let a1;
    	let h2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			a0 = element("a");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = text(" (");
    			t2 = text(/*year*/ ctx[2]);
    			t3 = text(")");
    			t4 = space();
    			h3 = element("h3");
    			t5 = text("Technologies: ");
    			b = element("b");
    			t6 = text(/*technologies*/ ctx[1]);
    			t7 = space();
    			p = element("p");
    			t8 = space();
    			img = element("img");
    			t9 = space();
    			a1 = element("a");
    			h2 = element("h2");
    			h2.textContent = "View Code";
    			attr_dev(a0, "href", /*projectLink*/ ctx[5]);
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file$a, 11, 27, 256);
    			attr_dev(h1, "class", "modal-name svelte-16gw8ar");
    			add_location(h1, file$a, 11, 4, 233);
    			attr_dev(b, "class", "technologies svelte-16gw8ar");
    			add_location(b, file$a, 12, 75, 394);
    			attr_dev(h3, "class", "modal-description svelte-16gw8ar");
    			set_style(h3, "text-align", "center");
    			add_location(h3, file$a, 12, 4, 323);
    			attr_dev(p, "class", "modal-description svelte-16gw8ar");
    			add_location(p, file$a, 13, 4, 446);
    			attr_dev(img, "class", "screenshot svelte-16gw8ar");
    			if (img.src !== (img_src_value = /*screenshot*/ ctx[6])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = "" + (/*name*/ ctx[0] + " screenshot 1"));
    			add_location(img, file$a, 14, 4, 503);
    			attr_dev(h2, "class", "github-link svelte-16gw8ar");
    			add_location(h2, file$a, 15, 41, 612);
    			attr_dev(a1, "href", /*githubLink*/ ctx[4]);
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file$a, 15, 4, 575);
    			attr_dev(div, "class", "project-modal svelte-16gw8ar");
    			add_location(div, file$a, 10, 0, 201);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, a0);
    			append_dev(a0, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(h1, t3);
    			append_dev(div, t4);
    			append_dev(div, h3);
    			append_dev(h3, t5);
    			append_dev(h3, b);
    			append_dev(b, t6);
    			append_dev(div, t7);
    			append_dev(div, p);
    			p.innerHTML = /*description*/ ctx[3];
    			append_dev(div, t8);
    			append_dev(div, img);
    			append_dev(div, t9);
    			append_dev(div, a1);
    			append_dev(a1, h2);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (dirty & /*projectLink*/ 32) {
    				attr_dev(a0, "href", /*projectLink*/ ctx[5]);
    			}

    			if (dirty & /*year*/ 4) set_data_dev(t2, /*year*/ ctx[2]);
    			if (dirty & /*technologies*/ 2) set_data_dev(t6, /*technologies*/ ctx[1]);
    			if (dirty & /*description*/ 8) p.innerHTML = /*description*/ ctx[3];
    			if (dirty & /*screenshot*/ 64 && img.src !== (img_src_value = /*screenshot*/ ctx[6])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*name*/ 1 && img_alt_value !== (img_alt_value = "" + (/*name*/ ctx[0] + " screenshot 1"))) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*githubLink*/ 16) {
    				attr_dev(a1, "href", /*githubLink*/ ctx[4]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	let { name } = $$props;
    	let { technologies } = $$props;
    	let { year } = $$props;
    	let { description } = $$props;
    	let { githubLink } = $$props;
    	let { projectLink } = $$props;
    	let { screenshot } = $$props;

    	const writable_props = [
    		"name",
    		"technologies",
    		"year",
    		"description",
    		"githubLink",
    		"projectLink",
    		"screenshot"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ProjectModal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ProjectModal", $$slots, []);

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("technologies" in $$props) $$invalidate(1, technologies = $$props.technologies);
    		if ("year" in $$props) $$invalidate(2, year = $$props.year);
    		if ("description" in $$props) $$invalidate(3, description = $$props.description);
    		if ("githubLink" in $$props) $$invalidate(4, githubLink = $$props.githubLink);
    		if ("projectLink" in $$props) $$invalidate(5, projectLink = $$props.projectLink);
    		if ("screenshot" in $$props) $$invalidate(6, screenshot = $$props.screenshot);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		technologies,
    		year,
    		description,
    		githubLink,
    		projectLink,
    		screenshot
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("technologies" in $$props) $$invalidate(1, technologies = $$props.technologies);
    		if ("year" in $$props) $$invalidate(2, year = $$props.year);
    		if ("description" in $$props) $$invalidate(3, description = $$props.description);
    		if ("githubLink" in $$props) $$invalidate(4, githubLink = $$props.githubLink);
    		if ("projectLink" in $$props) $$invalidate(5, projectLink = $$props.projectLink);
    		if ("screenshot" in $$props) $$invalidate(6, screenshot = $$props.screenshot);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, technologies, year, description, githubLink, projectLink, screenshot];
    }

    class ProjectModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
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
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
    			console.warn("<ProjectModal> was created without expected prop 'name'");
    		}

    		if (/*technologies*/ ctx[1] === undefined && !("technologies" in props)) {
    			console.warn("<ProjectModal> was created without expected prop 'technologies'");
    		}

    		if (/*year*/ ctx[2] === undefined && !("year" in props)) {
    			console.warn("<ProjectModal> was created without expected prop 'year'");
    		}

    		if (/*description*/ ctx[3] === undefined && !("description" in props)) {
    			console.warn("<ProjectModal> was created without expected prop 'description'");
    		}

    		if (/*githubLink*/ ctx[4] === undefined && !("githubLink" in props)) {
    			console.warn("<ProjectModal> was created without expected prop 'githubLink'");
    		}

    		if (/*projectLink*/ ctx[5] === undefined && !("projectLink" in props)) {
    			console.warn("<ProjectModal> was created without expected prop 'projectLink'");
    		}

    		if (/*screenshot*/ ctx[6] === undefined && !("screenshot" in props)) {
    			console.warn("<ProjectModal> was created without expected prop 'screenshot'");
    		}
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

    /* src/components/Projects.svelte generated by Svelte v3.21.0 */
    const file$b = "src/components/Projects.svelte";

    function create_fragment$b(ctx) {
    	let h1;
    	let t1;
    	let div4;
    	let div0;
    	let h20;
    	let t2_value = /*proj1*/ ctx[0].name + "";
    	let t2;
    	let t3;
    	let html_tag;
    	let raw0_value = /*proj1*/ ctx[0].emoji + "";
    	let t4;
    	let h21;
    	let t6;
    	let h22;
    	let t8;
    	let p0;
    	let t10;
    	let div1;
    	let h23;
    	let t11_value = /*proj2*/ ctx[1].name + "";
    	let t11;
    	let t12;
    	let html_tag_1;
    	let raw1_value = /*proj2*/ ctx[1].emoji + "";
    	let t13;
    	let h24;
    	let t15;
    	let h25;
    	let t17;
    	let p1;
    	let t19;
    	let div2;
    	let h26;
    	let t20_value = /*proj3*/ ctx[2].name + "";
    	let t20;
    	let t21;
    	let html_tag_2;
    	let raw2_value = /*proj3*/ ctx[2].emoji + "";
    	let t22;
    	let h27;
    	let t24;
    	let h28;
    	let t26;
    	let p2;
    	let t28;
    	let div3;
    	let h29;
    	let t29_value = /*proj4*/ ctx[3].name + "";
    	let t29;
    	let t30;
    	let html_tag_3;
    	let raw3_value = /*proj4*/ ctx[3].emoji + "";
    	let t31;
    	let h210;
    	let t33;
    	let h211;
    	let t35;
    	let p3;
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Projects";
    			t1 = space();
    			div4 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			t2 = text(t2_value);
    			t3 = space();
    			t4 = space();
    			h21 = element("h2");
    			h21.textContent = `${/*proj1*/ ctx[0].year}`;
    			t6 = space();
    			h22 = element("h2");
    			h22.textContent = `${/*proj1*/ ctx[0].technologies}`;
    			t8 = space();
    			p0 = element("p");
    			p0.textContent = `${/*proj1*/ ctx[0].shortDescription}`;
    			t10 = space();
    			div1 = element("div");
    			h23 = element("h2");
    			t11 = text(t11_value);
    			t12 = space();
    			t13 = space();
    			h24 = element("h2");
    			h24.textContent = `${/*proj2*/ ctx[1].year}`;
    			t15 = space();
    			h25 = element("h2");
    			h25.textContent = `${/*proj2*/ ctx[1].technologies}`;
    			t17 = space();
    			p1 = element("p");
    			p1.textContent = `${/*proj2*/ ctx[1].shortDescription}`;
    			t19 = space();
    			div2 = element("div");
    			h26 = element("h2");
    			t20 = text(t20_value);
    			t21 = space();
    			t22 = space();
    			h27 = element("h2");
    			h27.textContent = `${/*proj3*/ ctx[2].year}`;
    			t24 = space();
    			h28 = element("h2");
    			h28.textContent = `${/*proj3*/ ctx[2].technologies}`;
    			t26 = space();
    			p2 = element("p");
    			p2.textContent = `${/*proj3*/ ctx[2].shortDescription}`;
    			t28 = space();
    			div3 = element("div");
    			h29 = element("h2");
    			t29 = text(t29_value);
    			t30 = space();
    			t31 = space();
    			h210 = element("h2");
    			h210.textContent = `${/*proj4*/ ctx[3].year}`;
    			t33 = space();
    			h211 = element("h2");
    			h211.textContent = `${/*proj4*/ ctx[3].technologies}`;
    			t35 = space();
    			p3 = element("p");
    			p3.textContent = `${/*proj4*/ ctx[3].shortDescription}`;
    			attr_dev(h1, "class", "section-title");
    			attr_dev(h1, "id", "projects");
    			add_location(h1, file$b, 73, 0, 4572);
    			html_tag = new HtmlTag(raw0_value, null);
    			attr_dev(h20, "class", "project-name svelte-1b316dq");
    			add_location(h20, file$b, 76, 8, 4716);
    			attr_dev(h21, "class", "project-year svelte-1b316dq");
    			add_location(h21, file$b, 77, 8, 4787);
    			attr_dev(h22, "class", "project-tech svelte-1b316dq");
    			add_location(h22, file$b, 78, 8, 4838);
    			add_location(p0, file$b, 79, 8, 4897);
    			attr_dev(div0, "class", "project-item");
    			add_location(div0, file$b, 75, 4, 4663);
    			html_tag_1 = new HtmlTag(raw1_value, null);
    			attr_dev(h23, "class", "project-name svelte-1b316dq");
    			add_location(h23, file$b, 82, 8, 4997);
    			attr_dev(h24, "class", "project-year svelte-1b316dq");
    			add_location(h24, file$b, 83, 8, 5068);
    			attr_dev(h25, "class", "project-tech svelte-1b316dq");
    			add_location(h25, file$b, 84, 8, 5119);
    			add_location(p1, file$b, 85, 8, 5178);
    			attr_dev(div1, "class", "project-item");
    			add_location(div1, file$b, 81, 4, 4944);
    			html_tag_2 = new HtmlTag(raw2_value, null);
    			attr_dev(h26, "class", "project-name svelte-1b316dq");
    			add_location(h26, file$b, 88, 8, 5278);
    			attr_dev(h27, "class", "project-year svelte-1b316dq");
    			add_location(h27, file$b, 89, 8, 5349);
    			attr_dev(h28, "class", "project-tech svelte-1b316dq");
    			add_location(h28, file$b, 90, 8, 5400);
    			add_location(p2, file$b, 91, 8, 5459);
    			attr_dev(div2, "class", "project-item");
    			add_location(div2, file$b, 87, 4, 5225);
    			html_tag_3 = new HtmlTag(raw3_value, null);
    			attr_dev(h29, "class", "project-name svelte-1b316dq");
    			add_location(h29, file$b, 94, 8, 5559);
    			attr_dev(h210, "class", "project-year svelte-1b316dq");
    			add_location(h210, file$b, 95, 8, 5630);
    			attr_dev(h211, "class", "project-tech svelte-1b316dq");
    			add_location(h211, file$b, 96, 8, 5681);
    			add_location(p3, file$b, 97, 8, 5740);
    			attr_dev(div3, "class", "project-item");
    			add_location(div3, file$b, 93, 4, 5506);
    			attr_dev(div4, "class", "project-subsection");
    			add_location(div4, file$b, 74, 0, 4626);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div0, h20);
    			append_dev(h20, t2);
    			append_dev(h20, t3);
    			html_tag.m(h20);
    			append_dev(div0, t4);
    			append_dev(div0, h21);
    			append_dev(div0, t6);
    			append_dev(div0, h22);
    			append_dev(div0, t8);
    			append_dev(div0, p0);
    			append_dev(div4, t10);
    			append_dev(div4, div1);
    			append_dev(div1, h23);
    			append_dev(h23, t11);
    			append_dev(h23, t12);
    			html_tag_1.m(h23);
    			append_dev(div1, t13);
    			append_dev(div1, h24);
    			append_dev(div1, t15);
    			append_dev(div1, h25);
    			append_dev(div1, t17);
    			append_dev(div1, p1);
    			append_dev(div4, t19);
    			append_dev(div4, div2);
    			append_dev(div2, h26);
    			append_dev(h26, t20);
    			append_dev(h26, t21);
    			html_tag_2.m(h26);
    			append_dev(div2, t22);
    			append_dev(div2, h27);
    			append_dev(div2, t24);
    			append_dev(div2, h28);
    			append_dev(div2, t26);
    			append_dev(div2, p2);
    			append_dev(div4, t28);
    			append_dev(div4, div3);
    			append_dev(div3, h29);
    			append_dev(h29, t29);
    			append_dev(h29, t30);
    			html_tag_3.m(h29);
    			append_dev(div3, t31);
    			append_dev(div3, h210);
    			append_dev(div3, t33);
    			append_dev(div3, h211);
    			append_dev(div3, t35);
    			append_dev(div3, p3);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(div0, "click", /*modal1*/ ctx[4], false, false, false),
    				listen_dev(div1, "click", /*modal2*/ ctx[5], false, false, false),
    				listen_dev(div2, "click", /*modal3*/ ctx[6], false, false, false),
    				listen_dev(div3, "click", /*modal4*/ ctx[7], false, false, false)
    			];
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div4);
    			run_all(dispose);
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
    	const proj1 = {
    		name: "Studii",
    		emoji: "&#128218;",
    		technologies: "React, Django, MongoDB",
    		year: "2019/2020",
    		shortDescription: "A collaborative study space for students, by students",
    		longDescription: "<ul><li>For students who can't find a study method that works for them and/or don't have classmates to study with, Studii offers real-time, affordable, peer and tutor support through a tailored forum</li><li>Ideated, developed, marketed, and pitched by myself and my 7 other QTMA team members</li></ul>",
    		githubLink: "https://github.com/maxeisen/studii_public",
    		projectLink: "https://qtma.ca/studii.html",
    		screenshot: "./img/screenshots/studii.png"
    	};

    	const proj2 = {
    		name: "QHacks Website",
    		emoji: "&#128187;",
    		technologies: "React, Gatsby, MongoDB",
    		year: "2019/2020",
    		shortDescription: "The official website for Queen's University's 2020 MLH hackathon",
    		longDescription: "<ul><li>The static website for the 2020 hackathon, developed with React and generated using Gatsby, as well as the dashboard with a MongoDB backend</li><li>Accessed thousands of times during the application phase (700+ applicants), as well as leading up to the event</li></ul>",
    		githubLink: "https://github.com/maxeisen/qhacks-website/tree/dev-2020",
    		projectLink: "https://qhacks.io",
    		screenshot: "./img/screenshots/qhacks.png"
    	};

    	const proj3 = {
    		name: "Spotilizer",
    		emoji: "&#127925;",
    		technologies: "Python, Tkinter, Spotify Web API",
    		year: "2019",
    		shortDescription: "A customizable, data-centric Spotify visualizer built in Python",
    		longDescription: "<ul><li>Spotilizer is a visualizer that links to a user's Spotify account and uses hundreds of data points from <a href=\"https://developer.spotify.com/documentation/web-api/\">Spotify's Web API</a> to generate visuals according to rhythm, energy, 'danceability', and many other factors</li><li>Developed by a team of 4 in 10 hours at Queen's University during MLH's 2019 Local Hack Day</li></ul>",
    		githubLink: "https://github.com/maxeisen/spotilizer",
    		projectLink: "https://github.com/maxeisen/spotilizer",
    		screenshot: "./img/screenshots/spotilizer.png"
    	};

    	const proj4 = {
    		name: "Glitch",
    		emoji: "&#127918;",
    		technologies: "Unity Game Engine, C#",
    		year: "2018/2019",
    		shortDescription: "A unique, monochromatic platformer game for observant minimalists",
    		longDescription: "<ul><li>Glitch is a monochromatic platformer game, with a novel mechanic that allows the player to use two different states - glitched and default - at the press of a button to help them win</li><li>The player will have to use this mechanic in order to complete the game's levels, allowing them to switch between the level’s two states and see certain elements that were not previously visible</li><li>Developed as a group project for CISC 226 - Game Design at Queen's University</li></ul>",
    		githubLink: "https://github.com/maxeisen/Glitch",
    		projectLink: "https://tamirarnesty.github.io/glitchGame/",
    		screenshot: "./img/screenshots/glitch.png"
    	};

    	const { open } = getContext("simple-modal");

    	const modal1 = () => {
    		open(ProjectModal, {
    			name: proj1.name,
    			technologies: proj1.technologies,
    			year: proj1.year,
    			description: proj1.longDescription,
    			githubLink: proj1.githubLink,
    			projectLink: proj1.projectLink,
    			screenshot: proj1.screenshot
    		});
    	};

    	const modal2 = () => {
    		open(ProjectModal, {
    			name: proj2.name,
    			technologies: proj2.technologies,
    			year: proj2.year,
    			description: proj2.longDescription,
    			githubLink: proj2.githubLink,
    			projectLink: proj2.projectLink,
    			screenshot: proj2.screenshot
    		});
    	};

    	const modal3 = () => {
    		open(ProjectModal, {
    			name: proj3.name,
    			technologies: proj3.technologies,
    			year: proj3.year,
    			description: proj3.longDescription,
    			githubLink: proj3.githubLink,
    			projectLink: proj3.projectLink,
    			screenshot: proj3.screenshot
    		});
    	};

    	const modal4 = () => {
    		open(ProjectModal, {
    			name: proj4.name,
    			technologies: proj4.technologies,
    			year: proj4.year,
    			description: proj4.longDescription,
    			githubLink: proj4.githubLink,
    			projectLink: proj4.projectLink,
    			screenshot: proj4.screenshot
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Projects> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Projects", $$slots, []);

    	$$self.$capture_state = () => ({
    		getContext,
    		ProjectModal,
    		proj1,
    		proj2,
    		proj3,
    		proj4,
    		open,
    		modal1,
    		modal2,
    		modal3,
    		modal4
    	});

    	return [proj1, proj2, proj3, proj4, modal1, modal2, modal3, modal4];
    }

    class Projects extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Projects",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* src/components/EducationModal.svelte generated by Svelte v3.21.0 */

    const file$c = "src/components/EducationModal.svelte";

    function create_fragment$c(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1;
    	let h2;
    	let t2;
    	let h30;
    	let t3;
    	let h31;
    	let t4;
    	let t5;
    	let p;
    	let b;
    	let t7;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text(/*school*/ ctx[0]);
    			t1 = space();
    			h2 = element("h2");
    			t2 = space();
    			h30 = element("h3");
    			t3 = space();
    			h31 = element("h3");
    			t4 = text(/*years*/ ctx[3]);
    			t5 = space();
    			p = element("p");
    			b = element("b");
    			b.textContent = "Committees: ";
    			t7 = text(/*committees*/ ctx[4]);
    			attr_dev(h1, "class", "modal-school svelte-sqpdh");
    			add_location(h1, file$c, 9, 4, 171);
    			attr_dev(h2, "class", "modal-degree svelte-sqpdh");
    			add_location(h2, file$c, 10, 4, 214);
    			attr_dev(h30, "class", "modal-major svelte-sqpdh");
    			set_style(h30, "text-align", "center");
    			add_location(h30, file$c, 11, 4, 263);
    			attr_dev(h31, "class", "modal-years svelte-sqpdh");
    			set_style(h31, "text-align", "center");
    			set_style(h31, "color", "#333333");
    			add_location(h31, file$c, 12, 4, 337);
    			add_location(b, file$c, 13, 32, 449);
    			attr_dev(p, "class", "modal-committees svelte-sqpdh");
    			add_location(p, file$c, 13, 4, 421);
    			attr_dev(div, "class", "education-modal svelte-sqpdh");
    			add_location(div, file$c, 8, 0, 137);
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
    			h2.innerHTML = /*degree*/ ctx[1];
    			append_dev(div, t2);
    			append_dev(div, h30);
    			h30.innerHTML = /*major*/ ctx[2];
    			append_dev(div, t3);
    			append_dev(div, h31);
    			append_dev(h31, t4);
    			append_dev(div, t5);
    			append_dev(div, p);
    			append_dev(p, b);
    			append_dev(p, t7);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*school*/ 1) set_data_dev(t0, /*school*/ ctx[0]);
    			if (dirty & /*degree*/ 2) h2.innerHTML = /*degree*/ ctx[1];			if (dirty & /*major*/ 4) h30.innerHTML = /*major*/ ctx[2];			if (dirty & /*years*/ 8) set_data_dev(t4, /*years*/ ctx[3]);
    			if (dirty & /*committees*/ 16) set_data_dev(t7, /*committees*/ ctx[4]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	let { school } = $$props;
    	let { degree } = $$props;
    	let { major } = $$props;
    	let { years } = $$props;
    	let { committees } = $$props;
    	const writable_props = ["school", "degree", "major", "years", "committees"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<EducationModal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("EducationModal", $$slots, []);

    	$$self.$set = $$props => {
    		if ("school" in $$props) $$invalidate(0, school = $$props.school);
    		if ("degree" in $$props) $$invalidate(1, degree = $$props.degree);
    		if ("major" in $$props) $$invalidate(2, major = $$props.major);
    		if ("years" in $$props) $$invalidate(3, years = $$props.years);
    		if ("committees" in $$props) $$invalidate(4, committees = $$props.committees);
    	};

    	$$self.$capture_state = () => ({ school, degree, major, years, committees });

    	$$self.$inject_state = $$props => {
    		if ("school" in $$props) $$invalidate(0, school = $$props.school);
    		if ("degree" in $$props) $$invalidate(1, degree = $$props.degree);
    		if ("major" in $$props) $$invalidate(2, major = $$props.major);
    		if ("years" in $$props) $$invalidate(3, years = $$props.years);
    		if ("committees" in $$props) $$invalidate(4, committees = $$props.committees);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [school, degree, major, years, committees];
    }

    class EducationModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			school: 0,
    			degree: 1,
    			major: 2,
    			years: 3,
    			committees: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EducationModal",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*school*/ ctx[0] === undefined && !("school" in props)) {
    			console.warn("<EducationModal> was created without expected prop 'school'");
    		}

    		if (/*degree*/ ctx[1] === undefined && !("degree" in props)) {
    			console.warn("<EducationModal> was created without expected prop 'degree'");
    		}

    		if (/*major*/ ctx[2] === undefined && !("major" in props)) {
    			console.warn("<EducationModal> was created without expected prop 'major'");
    		}

    		if (/*years*/ ctx[3] === undefined && !("years" in props)) {
    			console.warn("<EducationModal> was created without expected prop 'years'");
    		}

    		if (/*committees*/ ctx[4] === undefined && !("committees" in props)) {
    			console.warn("<EducationModal> was created without expected prop 'committees'");
    		}
    	}

    	get school() {
    		throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set school(value) {
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

    	get committees() {
    		throw new Error("<EducationModal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set committees(value) {
    		throw new Error("<EducationModal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Education.svelte generated by Svelte v3.21.0 */
    const file$d = "src/components/Education.svelte";

    function create_fragment$d(ctx) {
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
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Education";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			h20.textContent = `${/*education*/ ctx[0].school}`;
    			t3 = space();
    			h21 = element("h2");
    			h21.textContent = "Bachelor of Computing (Honours)";
    			t5 = space();
    			h22 = element("h2");
    			h22.textContent = "Computer Science";
    			t7 = space();
    			h23 = element("h2");
    			h23.textContent = `${/*education*/ ctx[0].years}`;
    			attr_dev(h1, "class", "section-title");
    			attr_dev(h1, "id", "education");
    			add_location(h1, file$d, 22, 0, 864);
    			attr_dev(h20, "class", "school-name svelte-5xq66k");
    			add_location(h20, file$d, 25, 12, 1034);
    			attr_dev(h21, "class", "degree-info svelte-5xq66k");
    			add_location(h21, file$d, 26, 12, 1094);
    			attr_dev(h22, "class", "major-info svelte-5xq66k");
    			add_location(h22, file$d, 27, 12, 1167);
    			attr_dev(h23, "class", "degree-years svelte-5xq66k");
    			add_location(h23, file$d, 28, 12, 1224);
    			attr_dev(div0, "class", "education-item");
    			add_location(div0, file$d, 24, 8, 967);
    			attr_dev(div1, "class", "education-subsection");
    			add_location(div1, file$d, 23, 4, 924);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
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
    			if (remount) dispose();
    			dispose = listen_dev(div0, "click", /*educationModal*/ ctx[1], false, false, false);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
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
    	const education = {
    		school: "Queen's University",
    		degree: "Bachelor of Computing (<a href=\"https://www.queensu.ca/admission/programs/computing\" target=\"_blank\">BCmpH</a>)",
    		major: "Computer Science (<a href=\"http://www.cips.ca/\" target=\"_blank\">CIPS</a> Accredited)",
    		years: "2017 - 2021",
    		committees: "QTMA, QHacks, TEDxQueensU, QWEB, Residence Society, Computing DSC, Math DSC, Residence Life Council"
    	};

    	const { open } = getContext("simple-modal");

    	const educationModal = () => {
    		open(EducationModal, {
    			school: education.school,
    			degree: education.degree,
    			major: education.major,
    			years: education.years,
    			committees: education.committees
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Education> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Education", $$slots, []);

    	$$self.$capture_state = () => ({
    		getContext,
    		EducationModal,
    		education,
    		open,
    		educationModal
    	});

    	return [education, educationModal];
    }

    class Education extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Education",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src/components/Skills.svelte generated by Svelte v3.21.0 */

    const file$e = "src/components/Skills.svelte";

    function create_fragment$e(ctx) {
    	let h1;
    	let t1;
    	let div;
    	let ul;
    	let li0;
    	let t3;
    	let li1;
    	let t5;
    	let li2;
    	let t7;
    	let li3;
    	let t9;
    	let li4;
    	let t11;
    	let li5;
    	let t13;
    	let li6;
    	let t15;
    	let li7;
    	let t17;
    	let li8;
    	let t19;
    	let li9;
    	let t21;
    	let li10;
    	let t23;
    	let li11;
    	let t25;
    	let li12;
    	let t27;
    	let li13;
    	let t29;
    	let li14;
    	let t31;
    	let li15;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Skills";
    			t1 = space();
    			div = element("div");
    			ul = element("ul");
    			li0 = element("li");
    			li0.textContent = "Python";
    			t3 = space();
    			li1 = element("li");
    			li1.textContent = "HTML5";
    			t5 = space();
    			li2 = element("li");
    			li2.textContent = "CSS3";
    			t7 = space();
    			li3 = element("li");
    			li3.textContent = "JavaScript";
    			t9 = space();
    			li4 = element("li");
    			li4.textContent = "Java";
    			t11 = space();
    			li5 = element("li");
    			li5.textContent = "SQL";
    			t13 = space();
    			li6 = element("li");
    			li6.textContent = "C++";
    			t15 = space();
    			li7 = element("li");
    			li7.textContent = "C#";
    			t17 = space();
    			li8 = element("li");
    			li8.textContent = "C";
    			t19 = space();
    			li9 = element("li");
    			li9.textContent = "PHP";
    			t21 = space();
    			li10 = element("li");
    			li10.textContent = "React";
    			t23 = space();
    			li11 = element("li");
    			li11.textContent = "Spring";
    			t25 = space();
    			li12 = element("li");
    			li12.textContent = "Gatsby";
    			t27 = space();
    			li13 = element("li");
    			li13.textContent = "Spring";
    			t29 = space();
    			li14 = element("li");
    			li14.textContent = "Svelte";
    			t31 = space();
    			li15 = element("li");
    			li15.textContent = "Git";
    			attr_dev(h1, "class", "section-title");
    			attr_dev(h1, "id", "skills");
    			add_location(h1, file$e, 0, 0, 0);
    			attr_dev(li0, "class", "svelte-19idqw3");
    			add_location(li0, file$e, 3, 8, 99);
    			attr_dev(li1, "class", "svelte-19idqw3");
    			add_location(li1, file$e, 4, 8, 123);
    			attr_dev(li2, "class", "svelte-19idqw3");
    			add_location(li2, file$e, 5, 8, 146);
    			attr_dev(li3, "class", "svelte-19idqw3");
    			add_location(li3, file$e, 6, 8, 168);
    			attr_dev(li4, "class", "svelte-19idqw3");
    			add_location(li4, file$e, 7, 8, 196);
    			attr_dev(li5, "class", "svelte-19idqw3");
    			add_location(li5, file$e, 8, 8, 218);
    			attr_dev(li6, "class", "svelte-19idqw3");
    			add_location(li6, file$e, 9, 8, 239);
    			attr_dev(li7, "class", "svelte-19idqw3");
    			add_location(li7, file$e, 10, 8, 260);
    			attr_dev(li8, "class", "svelte-19idqw3");
    			add_location(li8, file$e, 11, 8, 280);
    			attr_dev(li9, "class", "svelte-19idqw3");
    			add_location(li9, file$e, 12, 8, 299);
    			attr_dev(li10, "class", "svelte-19idqw3");
    			add_location(li10, file$e, 13, 8, 320);
    			attr_dev(li11, "class", "svelte-19idqw3");
    			add_location(li11, file$e, 14, 8, 343);
    			attr_dev(li12, "class", "svelte-19idqw3");
    			add_location(li12, file$e, 15, 8, 367);
    			attr_dev(li13, "class", "svelte-19idqw3");
    			add_location(li13, file$e, 16, 8, 391);
    			attr_dev(li14, "class", "svelte-19idqw3");
    			add_location(li14, file$e, 17, 8, 415);
    			attr_dev(li15, "class", "svelte-19idqw3");
    			add_location(li15, file$e, 18, 8, 439);
    			attr_dev(ul, "class", "svelte-19idqw3");
    			add_location(ul, file$e, 2, 4, 86);
    			attr_dev(div, "class", "skills-subsection");
    			add_location(div, file$e, 1, 0, 50);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t3);
    			append_dev(ul, li1);
    			append_dev(ul, t5);
    			append_dev(ul, li2);
    			append_dev(ul, t7);
    			append_dev(ul, li3);
    			append_dev(ul, t9);
    			append_dev(ul, li4);
    			append_dev(ul, t11);
    			append_dev(ul, li5);
    			append_dev(ul, t13);
    			append_dev(ul, li6);
    			append_dev(ul, t15);
    			append_dev(ul, li7);
    			append_dev(ul, t17);
    			append_dev(ul, li8);
    			append_dev(ul, t19);
    			append_dev(ul, li9);
    			append_dev(ul, t21);
    			append_dev(ul, li10);
    			append_dev(ul, t23);
    			append_dev(ul, li11);
    			append_dev(ul, t25);
    			append_dev(ul, li12);
    			append_dev(ul, t27);
    			append_dev(ul, li13);
    			append_dev(ul, t29);
    			append_dev(ul, li14);
    			append_dev(ul, t31);
    			append_dev(ul, li15);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
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

    function instance$e($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Skills> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Skills", $$slots, []);
    	return [];
    }

    class Skills extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Skills",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* node_modules/svelte-simple-modal/src/Modal.svelte generated by Svelte v3.21.0 */

    const { Object: Object_1 } = globals;
    const file$f = "node_modules/svelte-simple-modal/src/Modal.svelte";

    // (214:2) {#if Component}
    function create_if_block$1(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let t;
    	let div0;
    	let div1_transition;
    	let div3_transition;
    	let current;
    	let dispose;
    	let if_block = /*state*/ ctx[0].closeButton && create_if_block_1(ctx);
    	const switch_instance_spread_levels = [/*props*/ ctx[2]];
    	var switch_value = /*Component*/ ctx[1];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
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
    			attr_dev(div0, "class", "content svelte-fnsfcv");
    			attr_dev(div0, "style", /*cssContent*/ ctx[11]);
    			add_location(div0, file$f, 234, 10, 5425);
    			attr_dev(div1, "class", "window svelte-fnsfcv");
    			attr_dev(div1, "style", /*cssWindow*/ ctx[10]);
    			add_location(div1, file$f, 222, 8, 5028);
    			attr_dev(div2, "class", "window-wrap svelte-fnsfcv");
    			add_location(div2, file$f, 221, 6, 4977);
    			attr_dev(div3, "class", "bg svelte-fnsfcv");
    			attr_dev(div3, "style", /*cssBg*/ ctx[9]);
    			add_location(div3, file$f, 214, 4, 4797);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div1, t);
    			append_dev(div1, div0);

    			if (switch_instance) {
    				mount_component(switch_instance, div0, null);
    			}

    			/*div2_binding*/ ctx[36](div2);
    			/*div3_binding*/ ctx[37](div3);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(
    					div1,
    					"introstart",
    					function () {
    						if (is_function(/*onOpen*/ ctx[5])) /*onOpen*/ ctx[5].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				),
    				listen_dev(
    					div1,
    					"outrostart",
    					function () {
    						if (is_function(/*onClose*/ ctx[6])) /*onClose*/ ctx[6].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				),
    				listen_dev(
    					div1,
    					"introend",
    					function () {
    						if (is_function(/*onOpened*/ ctx[7])) /*onOpened*/ ctx[7].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				),
    				listen_dev(
    					div1,
    					"outroend",
    					function () {
    						if (is_function(/*onClosed*/ ctx[8])) /*onClosed*/ ctx[8].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				),
    				listen_dev(div3, "click", /*handleOuterClick*/ ctx[16], false, false, false)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*state*/ ctx[0].closeButton) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(div1, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			const switch_instance_changes = (dirty[0] & /*props*/ 4)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
    			: {};

    			if (switch_value !== (switch_value = /*Component*/ ctx[1])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, div0, null);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}

    			if (!current || dirty[0] & /*cssContent*/ 2048) {
    				attr_dev(div0, "style", /*cssContent*/ ctx[11]);
    			}

    			if (!current || dirty[0] & /*cssWindow*/ 1024) {
    				attr_dev(div1, "style", /*cssWindow*/ ctx[10]);
    			}

    			if (!current || dirty[0] & /*cssBg*/ 512) {
    				attr_dev(div3, "style", /*cssBg*/ ctx[9]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[13], /*state*/ ctx[0].transitionWindowProps, true);
    				div1_transition.run(1);
    			});

    			add_render_callback(() => {
    				if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[12], /*state*/ ctx[0].transitionBgProps, true);
    				div3_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[13], /*state*/ ctx[0].transitionWindowProps, false);
    			div1_transition.run(0);
    			if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[12], /*state*/ ctx[0].transitionBgProps, false);
    			div3_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    			if (switch_instance) destroy_component(switch_instance);
    			if (detaching && div1_transition) div1_transition.end();
    			/*div2_binding*/ ctx[36](null);
    			/*div3_binding*/ ctx[37](null);
    			if (detaching && div3_transition) div3_transition.end();
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(214:2) {#if Component}",
    		ctx
    	});

    	return block;
    }

    // (232:10) {#if state.closeButton}
    function create_if_block_1(ctx) {
    	let button;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			attr_dev(button, "class", "close svelte-fnsfcv");
    			add_location(button, file$f, 232, 12, 5350);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button, anchor);
    			if (remount) dispose();
    			dispose = listen_dev(button, "click", /*close*/ ctx[14], false, false, false);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(232:10) {#if state.closeButton}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$f(ctx) {
    	let div;
    	let t;
    	let current;
    	let dispose;
    	let if_block = /*Component*/ ctx[1] && create_if_block$1(ctx);
    	const default_slot_template = /*$$slots*/ ctx[35].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[34], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "svelte-fnsfcv");
    			add_location(div, file$f, 212, 0, 4769);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			append_dev(div, t);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(window, "keyup", /*handleKeyup*/ ctx[15], false, false, false);
    		},
    		p: function update(ctx, dirty) {
    			if (/*Component*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*Component*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty[1] & /*$$scope*/ 8) {
    					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[34], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[34], dirty, null));
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
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			if (default_slot) default_slot.d(detaching);
    			dispose();
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
    	let { key = "simple-modal" } = $$props;
    	let { closeButton = true } = $$props;
    	let { closeOnEsc = true } = $$props;
    	let { closeOnOuterClick = true } = $$props;
    	let { styleBg = { top: 0, left: 0 } } = $$props;
    	let { styleWindow = {} } = $$props;
    	let { styleContent = {} } = $$props;
    	let { setContext: setContext$1 = setContext } = $$props;
    	let { transitionBg = fade } = $$props;
    	let { transitionBgProps = { duration: 250 } } = $$props;
    	let { transitionWindow = transitionBg } = $$props;
    	let { transitionWindowProps = transitionBgProps } = $$props;

    	const defaultState = {
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindow,
    		styleContent,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps
    	};

    	let state = { ...defaultState };
    	let Component = null;
    	let props = null;
    	let background;
    	let wrap;
    	const camelCaseToDash = str => str.replace(/([a-zA-Z])(?=[A-Z])/g, "$1-").toLowerCase();
    	const toCssString = props => Object.keys(props).reduce((str, key) => `${str}; ${camelCaseToDash(key)}: ${props[key]}`, "");

    	const toVoid = () => {
    		
    	};

    	let onOpen = toVoid;
    	let onClose = toVoid;
    	let onOpened = toVoid;
    	let onClosed = toVoid;

    	const open = (NewComponent, newProps = {}, options = {}, callback = {}) => {
    		$$invalidate(1, Component = NewComponent);
    		$$invalidate(2, props = newProps);
    		$$invalidate(0, state = { ...defaultState, ...options });
    		$$invalidate(5, onOpen = callback.onOpen || toVoid);
    		$$invalidate(6, onClose = callback.onClose || toVoid);
    		$$invalidate(7, onOpened = callback.onOpened || toVoid);
    		$$invalidate(8, onClosed = callback.onClosed || toVoid);
    	};

    	const close = (callback = {}) => {
    		$$invalidate(6, onClose = callback.onClose || onClose);
    		$$invalidate(8, onClosed = callback.onClosed || onClosed);
    		$$invalidate(1, Component = null);
    		$$invalidate(2, props = null);
    	};

    	const handleKeyup = ({ key }) => {
    		if (state.closeOnEsc && Component && key === "Escape") {
    			event.preventDefault();
    			close();
    		}
    	};

    	const handleOuterClick = event => {
    		if (state.closeOnOuterClick && (event.target === background || event.target === wrap)) {
    			event.preventDefault();
    			close();
    		}
    	};

    	setContext$1(key, { open, close });

    	const writable_props = [
    		"key",
    		"closeButton",
    		"closeOnEsc",
    		"closeOnOuterClick",
    		"styleBg",
    		"styleWindow",
    		"styleContent",
    		"setContext",
    		"transitionBg",
    		"transitionBgProps",
    		"transitionWindow",
    		"transitionWindowProps"
    	];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Modal", $$slots, ['default']);

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(4, wrap = $$value);
    		});
    	}

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(3, background = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ("key" in $$props) $$invalidate(17, key = $$props.key);
    		if ("closeButton" in $$props) $$invalidate(18, closeButton = $$props.closeButton);
    		if ("closeOnEsc" in $$props) $$invalidate(19, closeOnEsc = $$props.closeOnEsc);
    		if ("closeOnOuterClick" in $$props) $$invalidate(20, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ("styleBg" in $$props) $$invalidate(21, styleBg = $$props.styleBg);
    		if ("styleWindow" in $$props) $$invalidate(22, styleWindow = $$props.styleWindow);
    		if ("styleContent" in $$props) $$invalidate(23, styleContent = $$props.styleContent);
    		if ("setContext" in $$props) $$invalidate(24, setContext$1 = $$props.setContext);
    		if ("transitionBg" in $$props) $$invalidate(25, transitionBg = $$props.transitionBg);
    		if ("transitionBgProps" in $$props) $$invalidate(26, transitionBgProps = $$props.transitionBgProps);
    		if ("transitionWindow" in $$props) $$invalidate(27, transitionWindow = $$props.transitionWindow);
    		if ("transitionWindowProps" in $$props) $$invalidate(28, transitionWindowProps = $$props.transitionWindowProps);
    		if ("$$scope" in $$props) $$invalidate(34, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		baseSetContext: setContext,
    		fade,
    		key,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindow,
    		styleContent,
    		setContext: setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		defaultState,
    		state,
    		Component,
    		props,
    		background,
    		wrap,
    		camelCaseToDash,
    		toCssString,
    		toVoid,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		open,
    		close,
    		handleKeyup,
    		handleOuterClick,
    		cssBg,
    		cssWindow,
    		cssContent,
    		currentTransitionBg,
    		currentTransitionWindow
    	});

    	$$self.$inject_state = $$props => {
    		if ("key" in $$props) $$invalidate(17, key = $$props.key);
    		if ("closeButton" in $$props) $$invalidate(18, closeButton = $$props.closeButton);
    		if ("closeOnEsc" in $$props) $$invalidate(19, closeOnEsc = $$props.closeOnEsc);
    		if ("closeOnOuterClick" in $$props) $$invalidate(20, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ("styleBg" in $$props) $$invalidate(21, styleBg = $$props.styleBg);
    		if ("styleWindow" in $$props) $$invalidate(22, styleWindow = $$props.styleWindow);
    		if ("styleContent" in $$props) $$invalidate(23, styleContent = $$props.styleContent);
    		if ("setContext" in $$props) $$invalidate(24, setContext$1 = $$props.setContext);
    		if ("transitionBg" in $$props) $$invalidate(25, transitionBg = $$props.transitionBg);
    		if ("transitionBgProps" in $$props) $$invalidate(26, transitionBgProps = $$props.transitionBgProps);
    		if ("transitionWindow" in $$props) $$invalidate(27, transitionWindow = $$props.transitionWindow);
    		if ("transitionWindowProps" in $$props) $$invalidate(28, transitionWindowProps = $$props.transitionWindowProps);
    		if ("state" in $$props) $$invalidate(0, state = $$props.state);
    		if ("Component" in $$props) $$invalidate(1, Component = $$props.Component);
    		if ("props" in $$props) $$invalidate(2, props = $$props.props);
    		if ("background" in $$props) $$invalidate(3, background = $$props.background);
    		if ("wrap" in $$props) $$invalidate(4, wrap = $$props.wrap);
    		if ("onOpen" in $$props) $$invalidate(5, onOpen = $$props.onOpen);
    		if ("onClose" in $$props) $$invalidate(6, onClose = $$props.onClose);
    		if ("onOpened" in $$props) $$invalidate(7, onOpened = $$props.onOpened);
    		if ("onClosed" in $$props) $$invalidate(8, onClosed = $$props.onClosed);
    		if ("cssBg" in $$props) $$invalidate(9, cssBg = $$props.cssBg);
    		if ("cssWindow" in $$props) $$invalidate(10, cssWindow = $$props.cssWindow);
    		if ("cssContent" in $$props) $$invalidate(11, cssContent = $$props.cssContent);
    		if ("currentTransitionBg" in $$props) $$invalidate(12, currentTransitionBg = $$props.currentTransitionBg);
    		if ("currentTransitionWindow" in $$props) $$invalidate(13, currentTransitionWindow = $$props.currentTransitionWindow);
    	};

    	let cssBg;
    	let cssWindow;
    	let cssContent;
    	let currentTransitionBg;
    	let currentTransitionWindow;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			 $$invalidate(9, cssBg = toCssString(state.styleBg));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			 $$invalidate(10, cssWindow = toCssString(state.styleWindow));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			 $$invalidate(11, cssContent = toCssString(state.styleContent));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			 $$invalidate(12, currentTransitionBg = state.transitionBg);
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			 $$invalidate(13, currentTransitionWindow = state.transitionWindow);
    		}
    	};

    	return [
    		state,
    		Component,
    		props,
    		background,
    		wrap,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		cssBg,
    		cssWindow,
    		cssContent,
    		currentTransitionBg,
    		currentTransitionWindow,
    		close,
    		handleKeyup,
    		handleOuterClick,
    		key,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindow,
    		styleContent,
    		setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		defaultState,
    		camelCaseToDash,
    		toCssString,
    		toVoid,
    		open,
    		$$scope,
    		$$slots,
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
    			instance$f,
    			create_fragment$f,
    			safe_not_equal,
    			{
    				key: 17,
    				closeButton: 18,
    				closeOnEsc: 19,
    				closeOnOuterClick: 20,
    				styleBg: 21,
    				styleWindow: 22,
    				styleContent: 23,
    				setContext: 24,
    				transitionBg: 25,
    				transitionBgProps: 26,
    				transitionWindow: 27,
    				transitionWindowProps: 28
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get key() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
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
    }

    /* src/App.svelte generated by Svelte v3.21.0 */
    const file$g = "src/App.svelte";

    // (13:0) <Modal>
    function create_default_slot$6(ctx) {
    	let header;
    	let div0;
    	let a0;
    	let img;
    	let img_src_value;
    	let img_onmouseover_value;
    	let img_onmouseout_value;
    	let t0;
    	let div1;
    	let nav;
    	let ul;
    	let li0;
    	let a1;
    	let t2;
    	let li1;
    	let a2;
    	let t4;
    	let li2;
    	let a3;
    	let t6;
    	let li3;
    	let a4;
    	let t8;
    	let li4;
    	let a5;
    	let b0;
    	let t10;
    	let div5;
    	let div2;
    	let t11;
    	let div4;
    	let div3;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let t16;
    	let a6;
    	let h2;
    	let t17;
    	let b1;
    	let current;
    	const sidebar = new Sidebar({ $$inline: true });
    	const intro = new Intro({ $$inline: true });
    	const experience = new Experience({ $$inline: true });
    	const projects = new Projects({ $$inline: true });
    	const education = new Education({ $$inline: true });
    	const skills = new Skills({ $$inline: true });

    	const block = {
    		c: function create() {
    			header = element("header");
    			div0 = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			nav = element("nav");
    			ul = element("ul");
    			li0 = element("li");
    			a1 = element("a");
    			a1.textContent = "Experience";
    			t2 = space();
    			li1 = element("li");
    			a2 = element("a");
    			a2.textContent = "Projects";
    			t4 = space();
    			li2 = element("li");
    			a3 = element("a");
    			a3.textContent = "Education";
    			t6 = space();
    			li3 = element("li");
    			a4 = element("a");
    			a4.textContent = "Skills";
    			t8 = space();
    			li4 = element("li");
    			a5 = element("a");
    			b0 = element("b");
    			b0.textContent = "Resume";
    			t10 = space();
    			div5 = element("div");
    			div2 = element("div");
    			create_component(sidebar.$$.fragment);
    			t11 = space();
    			div4 = element("div");
    			div3 = element("div");
    			create_component(intro.$$.fragment);
    			t12 = space();
    			create_component(experience.$$.fragment);
    			t13 = space();
    			create_component(projects.$$.fragment);
    			t14 = space();
    			create_component(education.$$.fragment);
    			t15 = space();
    			create_component(skills.$$.fragment);
    			t16 = space();
    			a6 = element("a");
    			h2 = element("h2");
    			t17 = text("Made at 🏠 by Max Eisen ");
    			b1 = element("b");
    			b1.textContent = "©2020";
    			attr_dev(img, "class", "home-icon");
    			attr_dev(img, "type", "image/gif");
    			if (img.src !== (img_src_value = /*memoji*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Animated gif of Max memoji");
    			attr_dev(img, "onmouseover", img_onmouseover_value = "attributeChange(this, 'src', '" + /*memojiStill*/ ctx[1] + "');");
    			attr_dev(img, "onmouseout", img_onmouseout_value = "attributeChange(this, 'src', '" + /*memoji*/ ctx[0] + "');");
    			add_location(img, file$g, 15, 25, 583);
    			attr_dev(a0, "href", "/#");
    			add_location(a0, file$g, 15, 12, 570);
    			add_location(div0, file$g, 14, 8, 552);
    			attr_dev(a1, "href", "#experience");
    			add_location(a1, file$g, 20, 24, 899);
    			add_location(li0, file$g, 20, 20, 895);
    			attr_dev(a2, "href", "#projects");
    			add_location(a2, file$g, 21, 24, 965);
    			add_location(li1, file$g, 21, 20, 961);
    			attr_dev(a3, "href", "#education");
    			add_location(a3, file$g, 22, 24, 1027);
    			add_location(li2, file$g, 22, 20, 1023);
    			attr_dev(a4, "href", "#skills");
    			add_location(a4, file$g, 23, 24, 1091);
    			add_location(li3, file$g, 23, 20, 1087);
    			add_location(b0, file$g, 24, 42, 1167);
    			attr_dev(a5, "href", "/resume");
    			add_location(a5, file$g, 24, 24, 1149);
    			add_location(li4, file$g, 24, 20, 1145);
    			add_location(ul, file$g, 19, 16, 870);
    			add_location(nav, file$g, 18, 12, 848);
    			attr_dev(div1, "class", "nav-bar");
    			add_location(div1, file$g, 17, 8, 814);
    			add_location(header, file$g, 13, 4, 535);
    			attr_dev(div2, "class", "sidebar-section");
    			add_location(div2, file$g, 30, 8, 1301);
    			attr_dev(div3, "class", "info-section-inner");
    			add_location(div3, file$g, 34, 12, 1421);
    			set_style(b1, "font-size", "14px");
    			set_style(b1, "color", "#ababab");
    			add_location(b1, file$g, 41, 113, 1724);
    			attr_dev(h2, "class", "footer");
    			add_location(h2, file$g, 41, 63, 1674);
    			attr_dev(a6, "href", "https://github.com/maxeisen/MaxEisen.me/");
    			add_location(a6, file$g, 41, 12, 1623);
    			attr_dev(div4, "class", "info-section-main");
    			add_location(div4, file$g, 33, 8, 1377);
    			attr_dev(div5, "class", "grid-container");
    			add_location(div5, file$g, 29, 4, 1264);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div0);
    			append_dev(div0, a0);
    			append_dev(a0, img);
    			append_dev(header, t0);
    			append_dev(header, div1);
    			append_dev(div1, nav);
    			append_dev(nav, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a1);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(li1, a2);
    			append_dev(ul, t4);
    			append_dev(ul, li2);
    			append_dev(li2, a3);
    			append_dev(ul, t6);
    			append_dev(ul, li3);
    			append_dev(li3, a4);
    			append_dev(ul, t8);
    			append_dev(ul, li4);
    			append_dev(li4, a5);
    			append_dev(a5, b0);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div2);
    			mount_component(sidebar, div2, null);
    			append_dev(div5, t11);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			mount_component(intro, div3, null);
    			append_dev(div3, t12);
    			mount_component(experience, div3, null);
    			append_dev(div3, t13);
    			mount_component(projects, div3, null);
    			append_dev(div3, t14);
    			mount_component(education, div3, null);
    			append_dev(div3, t15);
    			mount_component(skills, div3, null);
    			append_dev(div4, t16);
    			append_dev(div4, a6);
    			append_dev(a6, h2);
    			append_dev(h2, t17);
    			append_dev(h2, b1);
    			current = true;
    		},
    		p: noop,
    		i: function intro$1(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);
    			transition_in(intro.$$.fragment, local);
    			transition_in(experience.$$.fragment, local);
    			transition_in(projects.$$.fragment, local);
    			transition_in(education.$$.fragment, local);
    			transition_in(skills.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(intro.$$.fragment, local);
    			transition_out(experience.$$.fragment, local);
    			transition_out(projects.$$.fragment, local);
    			transition_out(education.$$.fragment, local);
    			transition_out(skills.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div5);
    			destroy_component(sidebar);
    			destroy_component(intro);
    			destroy_component(experience);
    			destroy_component(projects);
    			destroy_component(education);
    			destroy_component(skills);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$6.name,
    		type: "slot",
    		source: "(13:0) <Modal>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$g(ctx) {
    	let current;

    	const modal = new Modal({
    			props: {
    				$$slots: { default: [create_default_slot$6] },
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

    			if (dirty & /*$$scope*/ 4) {
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
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let memoji = "./img/additional/memoji_cycle_large.gif";
    	let memojiStill = "./img/additional/memoji_thumbs_up.png";
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		Sidebar,
    		Intro,
    		Experience,
    		Projects,
    		Education,
    		Skills,
    		Modal,
    		memoji,
    		memojiStill
    	});

    	$$self.$inject_state = $$props => {
    		if ("memoji" in $$props) $$invalidate(0, memoji = $$props.memoji);
    		if ("memojiStill" in $$props) $$invalidate(1, memojiStill = $$props.memojiStill);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [memoji, memojiStill];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$g.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
