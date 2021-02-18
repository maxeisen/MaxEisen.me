
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
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
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
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
        constructor(anchor = null) {
            this.a = anchor;
            this.e = this.n = null;
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.h(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
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
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
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
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.24.1' }, detail)));
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
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
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

    /* src/components/MenuBar.svelte generated by Svelte v3.24.1 */

    const file = "src/components/MenuBar.svelte";

    function create_fragment(ctx) {
    	let div2;
    	let header;
    	let div0;
    	let a0;
    	let video;
    	let source0;
    	let source0_src_value;
    	let source1;
    	let source1_src_value;
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
    	let b;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			header = element("header");
    			div0 = element("div");
    			a0 = element("a");
    			video = element("video");
    			source0 = element("source");
    			source1 = element("source");
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
    			b = element("b");
    			b.textContent = "Resume";
    			attr_dev(source0, "id", "icon-video-webm");
    			if (source0.src !== (source0_src_value = "./img/additional/memoji_cycle.webm")) attr_dev(source0, "src", source0_src_value);
    			attr_dev(source0, "type", "video/webm");
    			add_location(source0, file, 22, 20, 995);
    			attr_dev(source1, "id", "icon-video-mp4");
    			if (source1.src !== (source1_src_value = "./img/additional/memoji_cycle.mp4")) attr_dev(source1, "src", source1_src_value);
    			attr_dev(source1, "type", "video/mp4");
    			add_location(source1, file, 23, 20, 1105);
    			attr_dev(video, "class", "home-icon");
    			attr_dev(video, "poster", "./img/additional/memoji_cycle_small.gif");
    			video.autoplay = true;
    			video.loop = true;
    			video.muted = true;
    			video.playsInline = true;
    			add_location(video, file, 21, 16, 865);
    			attr_dev(a0, "href", "/#");
    			attr_dev(a0, "aria-label", "Home");
    			add_location(a0, file, 20, 12, 816);
    			add_location(div0, file, 19, 8, 797);
    			attr_dev(a1, "href", "#experience");
    			add_location(a1, file, 30, 42, 1418);
    			attr_dev(li0, "id", "nav-bar-item");
    			add_location(li0, file, 30, 20, 1396);
    			attr_dev(a2, "href", "#projects");
    			add_location(a2, file, 31, 42, 1503);
    			attr_dev(li1, "id", "nav-bar-item");
    			add_location(li1, file, 31, 20, 1481);
    			attr_dev(a3, "href", "#education");
    			add_location(a3, file, 32, 42, 1584);
    			attr_dev(li2, "id", "nav-bar-item");
    			add_location(li2, file, 32, 20, 1562);
    			attr_dev(a4, "href", "#skills");
    			add_location(a4, file, 33, 42, 1667);
    			attr_dev(li3, "id", "nav-bar-item");
    			add_location(li3, file, 33, 20, 1645);
    			add_location(b, file, 34, 60, 1762);
    			attr_dev(a5, "href", "/resume");
    			add_location(a5, file, 34, 42, 1744);
    			attr_dev(li4, "id", "nav-bar-item");
    			add_location(li4, file, 34, 20, 1722);
    			attr_dev(ul, "class", "nav-bar-list");
    			attr_dev(ul, "id", "nav-bar-list");
    			add_location(ul, file, 29, 16, 1331);
    			add_location(nav, file, 28, 12, 1308);
    			attr_dev(div1, "class", "nav-bar");
    			attr_dev(div1, "id", "nav-bar");
    			add_location(div1, file, 27, 8, 1260);
    			attr_dev(header, "id", "header");
    			add_location(header, file, 18, 4, 767);
    			attr_dev(div2, "class", "header-container");
    			add_location(div2, file, 17, 0, 731);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, header);
    			append_dev(header, div0);
    			append_dev(div0, a0);
    			append_dev(a0, video);
    			append_dev(video, source0);
    			append_dev(video, source1);
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
    			append_dev(a5, b);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
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
    	var screenSize = window.matchMedia("(min-width: 860px)");

    	window.onscroll = function () {
    		scrollFunction();
    	};

    	function scrollFunction() {
    		if (screenSize.matches) {
    			if (document.body.scrollTop > 70 || document.documentElement.scrollTop > 70) {
    				document.getElementById("nav-bar").style.fontSize = "20px";
    				document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0.9)";
    			} else {
    				document.getElementById("nav-bar").style.fontSize = "30px";
    				document.getElementById("nav-bar-list").style.backgroundColor = "rgba(18, 18, 18, 0)";
    			}
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MenuBar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MenuBar", $$slots, []);
    	$$self.$capture_state = () => ({ screenSize, scrollFunction });

    	$$self.$inject_state = $$props => {
    		if ("screenSize" in $$props) screenSize = $$props.screenSize;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [];
    }

    class MenuBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MenuBar",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* node_modules/svelte-icons/components/IconBase.svelte generated by Svelte v3.24.1 */

    const file$1 = "node_modules/svelte-icons/components/IconBase.svelte";

    // (18:2) {#if title}
    function create_if_block(ctx) {
    	let title_1;
    	let t;

    	const block = {
    		c: function create() {
    			title_1 = svg_element("title");
    			t = text(/*title*/ ctx[0]);
    			add_location(title_1, file$1, 18, 4, 298);
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

    function create_fragment$1(ctx) {
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
    			add_location(svg, file$1, 16, 0, 229);
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
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { title = null } = $$props;
    	let { viewBox } = $$props;
    	const writable_props = ["title", "viewBox"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<IconBase> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IconBase", $$slots, ['default']);

    	$$self.$$set = $$props => {
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { title: 0, viewBox: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IconBase",
    			options,
    			id: create_fragment$1.name
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

    /* node_modules/svelte-icons/io/IoLogoLinkedin.svelte generated by Svelte v3.24.1 */
    const file$2 = "node_modules/svelte-icons/io/IoLogoLinkedin.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M417.2 64H96.8C79.3 64 64 76.6 64 93.9V415c0 17.4 15.3 32.9 32.8 32.9h320.3c17.6 0 30.8-15.6 30.8-32.9V93.9C448 76.6 434.7 64 417.2 64zM183 384h-55V213h55v171zm-25.6-197h-.4c-17.6 0-29-13.1-29-29.5 0-16.7 11.7-29.5 29.7-29.5s29 12.7 29.4 29.5c0 16.4-11.4 29.5-29.7 29.5zM384 384h-55v-93.5c0-22.4-8-37.7-27.9-37.7-15.2 0-24.2 10.3-28.2 20.3-1.5 3.6-1.9 8.5-1.9 13.5V384h-55V213h55v23.8c8-11.4 20.5-27.8 49.6-27.8 36.1 0 63.4 23.8 63.4 75.1V384z");
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
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let iconbase;
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot] },
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoLogoLinkedin", $$slots, []);

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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoLogoLinkedin",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoLogoGithub.svelte generated by Svelte v3.24.1 */
    const file$3 = "node_modules/svelte-icons/io/IoLogoGithub.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$1(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M256 32C132.3 32 32 134.9 32 261.7c0 101.5 64.2 187.5 153.2 217.9 1.4.3 2.6.4 3.8.4 8.3 0 11.5-6.1 11.5-11.4 0-5.5-.2-19.9-.3-39.1-8.4 1.9-15.9 2.7-22.6 2.7-43.1 0-52.9-33.5-52.9-33.5-10.2-26.5-24.9-33.6-24.9-33.6-19.5-13.7-.1-14.1 1.4-14.1h.1c22.5 2 34.3 23.8 34.3 23.8 11.2 19.6 26.2 25.1 39.6 25.1 10.5 0 20-3.4 25.6-6 2-14.8 7.8-24.9 14.2-30.7-49.7-5.8-102-25.5-102-113.5 0-25.1 8.7-45.6 23-61.6-2.3-5.8-10-29.2 2.2-60.8 0 0 1.6-.5 5-.5 8.1 0 26.4 3.1 56.6 24.1 17.9-5.1 37-7.6 56.1-7.7 19 .1 38.2 2.6 56.1 7.7 30.2-21 48.5-24.1 56.6-24.1 3.4 0 5 .5 5 .5 12.2 31.6 4.5 55 2.2 60.8 14.3 16.1 23 36.6 23 61.6 0 88.2-52.4 107.6-102.3 113.3 8 7.1 15.2 21.1 15.2 42.5 0 30.7-.3 55.5-.3 63 0 5.4 3.1 11.5 11.4 11.5 1.2 0 2.6-.1 4-.4C415.9 449.2 480 363.1 480 261.7 480 134.9 379.7 32 256 32z");
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
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoLogoGithub", $$slots, []);

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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoLogoGithub",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoLogoTwitter.svelte generated by Svelte v3.24.1 */
    const file$4 = "node_modules/svelte-icons/io/IoLogoTwitter.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$2(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M492 109.5c-17.4 7.7-36 12.9-55.6 15.3 20-12 35.4-31 42.6-53.6-18.7 11.1-39.4 19.2-61.5 23.5C399.8 75.8 374.6 64 346.8 64c-53.5 0-96.8 43.4-96.8 96.9 0 7.6.8 15 2.5 22.1-80.5-4-151.9-42.6-199.6-101.3-8.3 14.3-13.1 31-13.1 48.7 0 33.6 17.2 63.3 43.2 80.7-16-.4-31-4.8-44-12.1v1.2c0 47 33.4 86.1 77.7 95-8.1 2.2-16.7 3.4-25.5 3.4-6.2 0-12.3-.6-18.2-1.8 12.3 38.5 48.1 66.5 90.5 67.3-33.1 26-74.9 41.5-120.3 41.5-7.8 0-15.5-.5-23.1-1.4C62.8 432 113.7 448 168.3 448 346.6 448 444 300.3 444 172.2c0-4.2-.1-8.4-.3-12.5C462.6 146 479 129 492 109.5z");
    			add_location(path, file$4, 4, 10, 153);
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

    function create_fragment$4(ctx) {
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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoLogoTwitter", $$slots, []);

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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoLogoTwitter",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoIosMail.svelte generated by Svelte v3.24.1 */
    const file$5 = "node_modules/svelte-icons/io/IoIosMail.svelte";

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
    			add_location(path0, file$5, 4, 10, 153);
    			attr_dev(path1, "d", "M256 295.1c14.8 0 28.7-5.8 39.1-16.4L452 119c-5.5-4.4-12.3-7-19.8-7H79.9c-7.5 0-14.4 2.6-19.8 7L217 278.7c10.3 10.5 24.2 16.4 39 16.4z");
    			add_location(path1, file$5, 5, 0, 624);
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

    function create_fragment$5(ctx) {
    	let iconbase;
    	let current;
    	const iconbase_spread_levels = [{ viewBox: "0 0 512 512" }, /*$$props*/ ctx[0]];

    	let iconbase_props = {
    		$$slots: { default: [create_default_slot$3] },
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoIosMail", $$slots, []);

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
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoIosMail",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const t="http://www.w3.org/2000/svg";class e{constructor(t){this.seed=t;}next(){return this.seed?(2**31-1&(this.seed=Math.imul(48271,this.seed)))/2**31:Math.random()}}function s(t,e,s,i,n){return {type:"path",ops:c(t,e,s,i,n)}}function i(t,e,i){const n=(t||[]).length;if(n>2){const s=[];for(let e=0;e<n-1;e++)s.push(...c(t[e][0],t[e][1],t[e+1][0],t[e+1][1],i));return e&&s.push(...c(t[n-1][0],t[n-1][1],t[0][0],t[0][1],i)),{type:"path",ops:s}}return 2===n?s(t[0][0],t[0][1],t[1][0],t[1][1],i):{type:"path",ops:[]}}function n(t,e,s,n,o){return function(t,e){return i(t,!0,e)}([[t,e],[t+s,e],[t+s,e+n],[t,e+n]],o)}function o(t,e,s,i,n){return function(t,e,s,i){const[n,o]=l(i.increment,t,e,i.rx,i.ry,1,i.increment*h(.1,h(.4,1,s),s),s);let r=f(n,null,s);if(!s.disableMultiStroke){const[n]=l(i.increment,t,e,i.rx,i.ry,1.5,0,s),o=f(n,null,s);r=r.concat(o);}return {estimatedPoints:o,opset:{type:"path",ops:r}}}(t,e,n,function(t,e,s){const i=Math.sqrt(2*Math.PI*Math.sqrt((Math.pow(t/2,2)+Math.pow(e/2,2))/2)),n=Math.max(s.curveStepCount,s.curveStepCount/Math.sqrt(200)*i),o=2*Math.PI/n;let r=Math.abs(t/2),h=Math.abs(e/2);const c=1-s.curveFitting;return r+=a(r*c,s),h+=a(h*c,s),{increment:o,rx:r,ry:h}}(s,i,n)).opset}function r(t){return t.randomizer||(t.randomizer=new e(t.seed||0)),t.randomizer.next()}function h(t,e,s,i=1){return s.roughness*i*(r(s)*(e-t)+t)}function a(t,e,s=1){return h(-t,t,e,s)}function c(t,e,s,i,n,o=!1){const r=o?n.disableMultiStrokeFill:n.disableMultiStroke,h=u(t,e,s,i,n,!0,!1);if(r)return h;const a=u(t,e,s,i,n,!0,!0);return h.concat(a)}function u(t,e,s,i,n,o,h){const c=Math.pow(t-s,2)+Math.pow(e-i,2),u=Math.sqrt(c);let f=1;f=u<200?1:u>500?.4:-.0016668*u+1.233334;let l=n.maxRandomnessOffset||0;l*l*100>c&&(l=u/10);const g=l/2,d=.2+.2*r(n);let p=n.bowing*n.maxRandomnessOffset*(i-e)/200,_=n.bowing*n.maxRandomnessOffset*(t-s)/200;p=a(p,n,f),_=a(_,n,f);const m=[],w=()=>a(g,n,f),v=()=>a(l,n,f);return o&&(h?m.push({op:"move",data:[t+w(),e+w()]}):m.push({op:"move",data:[t+a(l,n,f),e+a(l,n,f)]})),h?m.push({op:"bcurveTo",data:[p+t+(s-t)*d+w(),_+e+(i-e)*d+w(),p+t+2*(s-t)*d+w(),_+e+2*(i-e)*d+w(),s+w(),i+w()]}):m.push({op:"bcurveTo",data:[p+t+(s-t)*d+v(),_+e+(i-e)*d+v(),p+t+2*(s-t)*d+v(),_+e+2*(i-e)*d+v(),s+v(),i+v()]}),m}function f(t,e,s){const i=t.length,n=[];if(i>3){const o=[],r=1-s.curveTightness;n.push({op:"move",data:[t[1][0],t[1][1]]});for(let e=1;e+2<i;e++){const s=t[e];o[0]=[s[0],s[1]],o[1]=[s[0]+(r*t[e+1][0]-r*t[e-1][0])/6,s[1]+(r*t[e+1][1]-r*t[e-1][1])/6],o[2]=[t[e+1][0]+(r*t[e][0]-r*t[e+2][0])/6,t[e+1][1]+(r*t[e][1]-r*t[e+2][1])/6],o[3]=[t[e+1][0],t[e+1][1]],n.push({op:"bcurveTo",data:[o[1][0],o[1][1],o[2][0],o[2][1],o[3][0],o[3][1]]});}if(e&&2===e.length){const t=s.maxRandomnessOffset;n.push({op:"lineTo",data:[e[0]+a(t,s),e[1]+a(t,s)]});}}else 3===i?(n.push({op:"move",data:[t[1][0],t[1][1]]}),n.push({op:"bcurveTo",data:[t[1][0],t[1][1],t[2][0],t[2][1],t[2][0],t[2][1]]})):2===i&&n.push(...c(t[0][0],t[0][1],t[1][0],t[1][1],s));return n}function l(t,e,s,i,n,o,r,h){const c=[],u=[],f=a(.5,h)-Math.PI/2;u.push([a(o,h)+e+.9*i*Math.cos(f-t),a(o,h)+s+.9*n*Math.sin(f-t)]);for(let r=f;r<2*Math.PI+f-.01;r+=t){const t=[a(o,h)+e+i*Math.cos(r),a(o,h)+s+n*Math.sin(r)];c.push(t),u.push(t);}return u.push([a(o,h)+e+i*Math.cos(f+2*Math.PI+.5*r),a(o,h)+s+n*Math.sin(f+2*Math.PI+.5*r)]),u.push([a(o,h)+e+.98*i*Math.cos(f+r),a(o,h)+s+.98*n*Math.sin(f+r)]),u.push([a(o,h)+e+.9*i*Math.cos(f+.5*r),a(o,h)+s+.9*n*Math.sin(f+.5*r)]),[u,c]}function g(t,e){return {maxRandomnessOffset:2,roughness:"highlight"===t?3:1.5,bowing:1,stroke:"#000",strokeWidth:1.5,curveTightness:0,curveFitting:.95,curveStepCount:9,fillStyle:"hachure",fillWeight:-1,hachureAngle:-41,hachureGap:-1,dashOffset:-1,dashGap:-1,zigzagOffset:-1,combineNestedSvgPaths:!1,disableMultiStroke:"double"!==t,disableMultiStrokeFill:!1,seed:e}}function d(e,r,h,a,c,u){const f=[];let l=h.strokeWidth||2;const d=function(t){const e=t.padding;if(e||0===e){if("number"==typeof e)return [e,e,e,e];if(Array.isArray(e)){const t=e;if(t.length)switch(t.length){case 4:return [...t];case 1:return [t[0],t[0],t[0],t[0]];case 2:return [...t,...t];case 3:return [...t,t[1]];default:return [t[0],t[1],t[2],t[3]]}}}return [5,5,5,5]}(h),p=void 0===h.animate||!!h.animate,_=h.iterations||2,m=g("single",u);switch(h.type){case"underline":{const t=r.y+r.h+d[2];for(let e=0;e<_;e++)e%2?f.push(s(r.x+r.w,t,r.x,t,m)):f.push(s(r.x,t,r.x+r.w,t,m));break}case"strike-through":{const t=r.y+r.h/2;for(let e=0;e<_;e++)e%2?f.push(s(r.x+r.w,t,r.x,t,m)):f.push(s(r.x,t,r.x+r.w,t,m));break}case"box":{const t=r.x-d[3],e=r.y-d[0],s=r.w+(d[1]+d[3]),i=r.h+(d[0]+d[2]);for(let o=0;o<_;o++)f.push(n(t,e,s,i,m));break}case"bracket":{const t=Array.isArray(h.brackets)?h.brackets:h.brackets?[h.brackets]:["right"],e=r.x-2*d[3],s=r.x+r.w+2*d[1],n=r.y-2*d[0],o=r.y+r.h+2*d[2];for(const h of t){let t;switch(h){case"bottom":t=[[e,r.y+r.h],[e,o],[s,o],[s,r.y+r.h]];break;case"top":t=[[e,r.y],[e,n],[s,n],[s,r.y]];break;case"left":t=[[r.x,n],[e,n],[e,o],[r.x,o]];break;case"right":t=[[r.x+r.w,n],[s,n],[s,o],[r.x+r.w,o]];}t&&f.push(i(t,!1,m));}break}case"crossed-off":{const t=r.x,e=r.y,i=t+r.w,n=e+r.h;for(let o=0;o<_;o++)o%2?f.push(s(i,n,t,e,m)):f.push(s(t,e,i,n,m));for(let o=0;o<_;o++)o%2?f.push(s(t,n,i,e,m)):f.push(s(i,e,t,n,m));break}case"circle":{const t=g("double",u),e=r.w+(d[1]+d[3]),s=r.h+(d[0]+d[2]),i=r.x-d[3]+e/2,n=r.y-d[0]+s/2,h=Math.floor(_/2),a=_-2*h;for(let r=0;r<h;r++)f.push(o(i,n,e,s,t));for(let t=0;t<a;t++)f.push(o(i,n,e,s,m));break}case"highlight":{const t=g("highlight",u);l=.95*r.h;const e=r.y+r.h/2;for(let i=0;i<_;i++)i%2?f.push(s(r.x+r.w,e,r.x,e,t)):f.push(s(r.x,e,r.x+r.w,e,t));break}}if(f.length){const s=function(t){const e=[];for(const s of t){let t="";for(const i of s.ops){const s=i.data;switch(i.op){case"move":t.trim()&&e.push(t.trim()),t=`M${s[0]} ${s[1]} `;break;case"bcurveTo":t+=`C${s[0]} ${s[1]}, ${s[2]} ${s[3]}, ${s[4]} ${s[5]} `;break;case"lineTo":t+=`L${s[0]} ${s[1]} `;}}t.trim()&&e.push(t.trim());}return e}(f),i=[],n=[];let o=0;const r=(t,e,s)=>t.setAttribute(e,s);for(const a of s){const s=document.createElementNS(t,"path");if(r(s,"d",a),r(s,"fill","none"),r(s,"stroke",h.color||"currentColor"),r(s,"stroke-width",""+l),p){const t=s.getTotalLength();i.push(t),o+=t;}e.appendChild(s),n.push(s);}if(p){let t=0;for(let e=0;e<n.length;e++){const s=n[e],r=i[e],h=o?c*(r/o):0,u=a+t,f=s.style;f.strokeDashoffset=""+r,f.strokeDasharray=""+r,f.animation=`rough-notation-dash ${h}ms ease-out ${u}ms forwards`,t+=h;}}}}class p{constructor(t,e){this._state="unattached",this._resizing=!1,this._seed=Math.floor(Math.random()*2**31),this._lastSizes=[],this._animationDelay=0,this._resizeListener=()=>{this._resizing||(this._resizing=!0,setTimeout(()=>{this._resizing=!1,"showing"===this._state&&this.haveRectsChanged()&&this.show();},400));},this._e=t,this._config=JSON.parse(JSON.stringify(e)),this.attach();}get animate(){return this._config.animate}set animate(t){this._config.animate=t;}get animationDuration(){return this._config.animationDuration}set animationDuration(t){this._config.animationDuration=t;}get iterations(){return this._config.iterations}set iterations(t){this._config.iterations=t;}get color(){return this._config.color}set color(t){this._config.color!==t&&(this._config.color=t,this.refresh());}get strokeWidth(){return this._config.strokeWidth}set strokeWidth(t){this._config.strokeWidth!==t&&(this._config.strokeWidth=t,this.refresh());}get padding(){return this._config.padding}set padding(t){this._config.padding!==t&&(this._config.padding=t,this.refresh());}attach(){if("unattached"===this._state&&this._e.parentElement){!function(){if(!window.__rno_kf_s){const t=window.__rno_kf_s=document.createElement("style");t.textContent="@keyframes rough-notation-dash { to { stroke-dashoffset: 0; } }",document.head.appendChild(t);}}();const e=this._svg=document.createElementNS(t,"svg");e.setAttribute("class","rough-annotation");const s=e.style;s.position="absolute",s.top="0",s.left="0",s.overflow="visible",s.pointerEvents="none",s.width="100px",s.height="100px";const i="highlight"===this._config.type;if(this._e.insertAdjacentElement(i?"beforebegin":"afterend",e),this._state="not-showing",i){const t=window.getComputedStyle(this._e).position;(!t||"static"===t)&&(this._e.style.position="relative");}this.attachListeners();}}detachListeners(){window.removeEventListener("resize",this._resizeListener),this._ro&&this._ro.unobserve(this._e);}attachListeners(){this.detachListeners(),window.addEventListener("resize",this._resizeListener,{passive:!0}),!this._ro&&"ResizeObserver"in window&&(this._ro=new window.ResizeObserver(t=>{for(const e of t)e.contentRect&&this._resizeListener();})),this._ro&&this._ro.observe(this._e);}haveRectsChanged(){if(this._lastSizes.length){const t=this.rects();if(t.length!==this._lastSizes.length)return !0;for(let e=0;e<t.length;e++)if(!this.isSameRect(t[e],this._lastSizes[e]))return !0}return !1}isSameRect(t,e){const s=(t,e)=>Math.round(t)===Math.round(e);return s(t.x,e.x)&&s(t.y,e.y)&&s(t.w,e.w)&&s(t.h,e.h)}isShowing(){return "not-showing"!==this._state}refresh(){this.isShowing()&&!this.pendingRefresh&&(this.pendingRefresh=Promise.resolve().then(()=>{this.isShowing()&&this.show(),delete this.pendingRefresh;}));}show(){switch(this._state){case"unattached":break;case"showing":this.hide(),this._svg&&this.render(this._svg,!0);break;case"not-showing":this.attach(),this._svg&&this.render(this._svg,!1);}}hide(){if(this._svg)for(;this._svg.lastChild;)this._svg.removeChild(this._svg.lastChild);this._state="not-showing";}remove(){this._svg&&this._svg.parentElement&&this._svg.parentElement.removeChild(this._svg),this._svg=void 0,this._state="unattached",this.detachListeners();}render(t,e){let s=this._config;e&&(s=JSON.parse(JSON.stringify(this._config)),s.animate=!1);const i=this.rects();let n=0;i.forEach(t=>n+=t.w);const o=s.animationDuration||800;let r=0;for(let e=0;e<i.length;e++){const h=o*(i[e].w/n);d(t,i[e],s,r+this._animationDelay,h,this._seed),r+=h;}this._lastSizes=i,this._state="showing";}rects(){const t=[];if(this._svg)if(this._config.multiline){const e=this._e.getClientRects();for(let s=0;s<e.length;s++)t.push(this.svgRect(this._svg,e[s]));}else t.push(this.svgRect(this._svg,this._e.getBoundingClientRect()));return t}svgRect(t,e){const s=t.getBoundingClientRect(),i=e;return {x:(i.x||i.left)-(s.x||s.left),y:(i.y||i.top)-(s.y||s.top),w:i.width,h:i.height}}}function _(t,e){return new p(t,e)}function m(t){let e=0;for(const s of t){const t=s;t._animationDelay=e;e+=0===t.animationDuration?0:t.animationDuration||800;}const s=[...t];return {show(){for(const t of s)t.show();},hide(){for(const t of s)t.hide();}}}

    /* node_modules/svelte-rough-notation/src/RoughNotation.svelte generated by Svelte v3.24.1 */
    const file$6 = "node_modules/svelte-rough-notation/src/RoughNotation.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*$$slots*/ ctx[18].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[17], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			set_style(div, "display", "inline");
    			add_location(div, file$6, 98, 0, 2579);
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
    				if (default_slot.p && dirty & /*$$scope*/ 131072) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[17], dirty, null, null);
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
    			/*div_binding*/ ctx[19](null);
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
    	const omit_props_names = [
    		"visible","animate","animationDuration","animationDelay","color","strokeWidth","padding","iterations","multiline","brackets","_animationGroupDelay","_animationDelay","show","hide","isShowing","annotation"
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

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("RoughNotation", $$slots, ['default']);

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			container = $$value;
    			$$invalidate(0, container);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(20, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("visible" in $$new_props) $$invalidate(1, visible = $$new_props.visible);
    		if ("animate" in $$new_props) $$invalidate(3, animate = $$new_props.animate);
    		if ("animationDuration" in $$new_props) $$invalidate(4, animationDuration = $$new_props.animationDuration);
    		if ("animationDelay" in $$new_props) $$invalidate(5, animationDelay = $$new_props.animationDelay);
    		if ("color" in $$new_props) $$invalidate(6, color = $$new_props.color);
    		if ("strokeWidth" in $$new_props) $$invalidate(7, strokeWidth = $$new_props.strokeWidth);
    		if ("padding" in $$new_props) $$invalidate(8, padding = $$new_props.padding);
    		if ("iterations" in $$new_props) $$invalidate(9, iterations = $$new_props.iterations);
    		if ("multiline" in $$new_props) $$invalidate(10, multiline = $$new_props.multiline);
    		if ("brackets" in $$new_props) $$invalidate(11, brackets = $$new_props.brackets);
    		if ("_animationGroupDelay" in $$new_props) $$invalidate(12, _animationGroupDelay = $$new_props._animationGroupDelay);
    		if ("_animationDelay" in $$new_props) $$invalidate(13, _animationDelay = $$new_props._animationDelay);
    		if ("annotation" in $$new_props) $$invalidate(2, annotation = $$new_props.annotation);
    		if ("$$scope" in $$new_props) $$invalidate(17, $$scope = $$new_props.$$scope);
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
    		if ("container" in $$props) $$invalidate(0, container = $$new_props.container);
    		if ("visible" in $$props) $$invalidate(1, visible = $$new_props.visible);
    		if ("animate" in $$props) $$invalidate(3, animate = $$new_props.animate);
    		if ("animationDuration" in $$props) $$invalidate(4, animationDuration = $$new_props.animationDuration);
    		if ("animationDelay" in $$props) $$invalidate(5, animationDelay = $$new_props.animationDelay);
    		if ("color" in $$props) $$invalidate(6, color = $$new_props.color);
    		if ("strokeWidth" in $$props) $$invalidate(7, strokeWidth = $$new_props.strokeWidth);
    		if ("padding" in $$props) $$invalidate(8, padding = $$new_props.padding);
    		if ("iterations" in $$props) $$invalidate(9, iterations = $$new_props.iterations);
    		if ("multiline" in $$props) $$invalidate(10, multiline = $$new_props.multiline);
    		if ("brackets" in $$props) $$invalidate(11, brackets = $$new_props.brackets);
    		if ("_animationGroupDelay" in $$props) $$invalidate(12, _animationGroupDelay = $$new_props._animationGroupDelay);
    		if ("_animationDelay" in $$props) $$invalidate(13, _animationDelay = $$new_props._animationDelay);
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
    		$$slots,
    		div_binding
    	];
    }

    class RoughNotation extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
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
    			id: create_fragment$6.name
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

    	get multiline() {
    		return this.$$.ctx[10];
    	}

    	set multiline(multiline) {
    		this.$set({ multiline });
    		flush();
    	}

    	get brackets() {
    		return this.$$.ctx[11];
    	}

    	set brackets(brackets) {
    		this.$set({ brackets });
    		flush();
    	}

    	get _animationGroupDelay() {
    		return this.$$.ctx[12];
    	}

    	set _animationGroupDelay(_animationGroupDelay) {
    		this.$set({ _animationGroupDelay });
    		flush();
    	}

    	get _animationDelay() {
    		return this.$$.ctx[13];
    	}

    	set _animationDelay(_animationDelay) {
    		this.$set({ _animationDelay });
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
    		this.$set({ annotation });
    		flush();
    	}
    }

    /* src/components/Sidebar.svelte generated by Svelte v3.24.1 */
    const file$7 = "src/components/Sidebar.svelte";

    // (20:4) <Annotation bind:visible type="highlight" color="rgba(0, 187, 162, 0.23)">
    function create_default_slot$4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Max Eisen");
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
    		source: "(20:4) <Annotation bind:visible type=\\\"highlight\\\" color=\\\"rgba(0, 187, 162, 0.23)\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
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
    	let t11;
    	let source1;
    	let t12;
    	let img;
    	let img_src_value;
    	let current;

    	function annotation_visible_binding(value) {
    		/*annotation_visible_binding*/ ctx[3].call(null, value);
    	}

    	let annotation_props = {
    		type: "highlight",
    		color: "rgba(0, 187, 162, 0.23)",
    		$$slots: { default: [create_default_slot$4] },
    		$$scope: { ctx }
    	};

    	if (/*visible*/ ctx[0] !== void 0) {
    		annotation_props.visible = /*visible*/ ctx[0];
    	}

    	annotation = new RoughNotation({ props: annotation_props, $$inline: true });
    	binding_callbacks.push(() => bind(annotation, "visible", annotation_visible_binding));
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
    			picture = element("picture");
    			source0 = element("source");
    			t11 = space();
    			source1 = element("source");
    			t12 = space();
    			img = element("img");
    			add_location(h1, file$7, 19, 0, 630);
    			set_style(b, "color", "#ababab");
    			set_style(b, "font-weight", "300");
    			add_location(b, file$7, 20, 22, 758);
    			attr_dev(h20, "class", "status svelte-izw1xr");
    			add_location(h20, file$7, 20, 0, 736);
    			attr_dev(h21, "class", "location svelte-izw1xr");
    			add_location(h21, file$7, 21, 0, 832);
    			attr_dev(a0, "class", "social-link linkedin-link svelte-izw1xr");
    			attr_dev(a0, "aria-label", "LinkedIn");
    			attr_dev(a0, "href", "https://linkedin.com/in/maxeisen/");
    			attr_dev(a0, "rel", "noreferrer");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file$7, 23, 4, 911);
    			attr_dev(a1, "class", "social-link github-link svelte-izw1xr");
    			attr_dev(a1, "aria-label", "GitHub");
    			attr_dev(a1, "href", "https://github.com/maxeisen/");
    			attr_dev(a1, "rel", "noreferrer");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file$7, 24, 4, 1069);
    			attr_dev(a2, "class", "social-link twitter-link svelte-izw1xr");
    			attr_dev(a2, "aria-label", "Twitter");
    			attr_dev(a2, "href", "https://twitter.com/maxeisen/");
    			attr_dev(a2, "rel", "noreferrer");
    			attr_dev(a2, "target", "_blank");
    			add_location(a2, file$7, 25, 4, 1216);
    			attr_dev(a3, "class", "social-link svelte-izw1xr");
    			attr_dev(a3, "aria-label", "Email");
    			attr_dev(a3, "href", "mailto:max.eisen@queensu.ca");
    			attr_dev(a3, "rel", "noreferrer");
    			attr_dev(a3, "target", "_blank");
    			add_location(a3, file$7, 26, 4, 1367);
    			attr_dev(div0, "class", "social-links-container svelte-izw1xr");
    			add_location(div0, file$7, 22, 0, 870);
    			attr_dev(source0, "class", "headshot svelte-izw1xr");
    			attr_dev(source0, "srcset", /*cleanHeadshotW*/ ctx[1]);
    			attr_dev(source0, "type", "image/webp");
    			add_location(source0, file$7, 31, 8, 1547);
    			attr_dev(source1, "class", "headshot svelte-izw1xr");
    			attr_dev(source1, "srcset", /*cleanHeadshotP*/ ctx[2]);
    			attr_dev(source1, "type", "image/png");
    			add_location(source1, file$7, 32, 8, 1623);
    			attr_dev(img, "class", "headshot svelte-izw1xr");
    			attr_dev(img, "width", "200px");
    			attr_dev(img, "height", "200px");
    			if (img.src !== (img_src_value = /*cleanHeadshotW*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Current headshot");
    			add_location(img, file$7, 33, 8, 1698);
    			add_location(picture, file$7, 30, 4, 1529);
    			attr_dev(div1, "class", "headshot svelte-izw1xr");
    			add_location(div1, file$7, 29, 0, 1502);
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
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let cleanHeadshotW = "./img/headshots/clean_headshot.webp";
    	let cleanHeadshotP = "./img/headshots/clean_headshot.png";
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
    		cleanHeadshotW,
    		cleanHeadshotP,
    		LinkedInLogo: IoLogoLinkedin,
    		GitHubLogo: IoLogoGithub,
    		TwitterLogo: IoLogoTwitter,
    		MailIcon: IoIosMail,
    		Annotation: RoughNotation,
    		onMount,
    		visible
    	});

    	$$self.$inject_state = $$props => {
    		if ("cleanHeadshotW" in $$props) $$invalidate(1, cleanHeadshotW = $$props.cleanHeadshotW);
    		if ("cleanHeadshotP" in $$props) $$invalidate(2, cleanHeadshotP = $$props.cleanHeadshotP);
    		if ("visible" in $$props) $$invalidate(0, visible = $$props.visible);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [visible, cleanHeadshotW, cleanHeadshotP, annotation_visible_binding];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/components/modals/ActivityModal.svelte generated by Svelte v3.24.1 */

    const file$8 = "src/components/modals/ActivityModal.svelte";

    // (9:4) {#if image}
    function create_if_block_2(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "activity-image svelte-1n68ntu");
    			if (img.src !== (img_src_value = /*image*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*description*/ ctx[3]);
    			add_location(img, file$8, 9, 8, 167);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*image*/ 1 && img.src !== (img_src_value = /*image*/ ctx[0])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*description*/ 8) {
    				attr_dev(img, "alt", /*description*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(9:4) {#if image}",
    		ctx
    	});

    	return block;
    }

    // (12:4) {#if audio}
    function create_if_block_1(ctx) {
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
    			if (source.src !== (source_src_value = /*audio*/ ctx[1])) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "audio/mpeg");
    			add_location(source, file$8, 13, 12, 314);
    			attr_dev(track, "kind", "captions");
    			add_location(track, file$8, 14, 12, 365);
    			attr_dev(audio_1, "class", "activity-audio svelte-1n68ntu");
    			audio_1.controls = true;
    			add_location(audio_1, file$8, 12, 8, 262);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, audio_1, anchor);
    			append_dev(audio_1, source);
    			append_dev(audio_1, track);
    			append_dev(audio_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*audio*/ 2 && source.src !== (source_src_value = /*audio*/ ctx[1])) {
    				attr_dev(source, "src", source_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(audio_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(12:4) {#if audio}",
    		ctx
    	});

    	return block;
    }

    // (19:4) {#if video}
    function create_if_block$1(ctx) {
    	let video_1;
    	let source0;
    	let source0_src_value;
    	let source1;
    	let source1_src_value;
    	let track;
    	let t;

    	const block = {
    		c: function create() {
    			video_1 = element("video");
    			source0 = element("source");
    			source1 = element("source");
    			track = element("track");
    			t = text("\n            Your browser does not support the video element.");
    			if (source0.src !== (source0_src_value = "" + (/*video*/ ctx[2] + ".webm"))) attr_dev(source0, "src", source0_src_value);
    			attr_dev(source0, "type", "video/webm");
    			add_location(source0, file$8, 20, 12, 553);
    			if (source1.src !== (source1_src_value = "" + (/*video*/ ctx[2] + ".mp4"))) attr_dev(source1, "src", source1_src_value);
    			attr_dev(source1, "type", "video/mp4");
    			add_location(source1, file$8, 21, 12, 611);
    			attr_dev(track, "kind", "captions");
    			add_location(track, file$8, 22, 12, 667);
    			attr_dev(video_1, "class", "activity-video svelte-1n68ntu");
    			video_1.controls = true;
    			add_location(video_1, file$8, 19, 8, 501);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, video_1, anchor);
    			append_dev(video_1, source0);
    			append_dev(video_1, source1);
    			append_dev(video_1, track);
    			append_dev(video_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*video*/ 4 && source0.src !== (source0_src_value = "" + (/*video*/ ctx[2] + ".webm"))) {
    				attr_dev(source0, "src", source0_src_value);
    			}

    			if (dirty & /*video*/ 4 && source1.src !== (source1_src_value = "" + (/*video*/ ctx[2] + ".mp4"))) {
    				attr_dev(source1, "src", source1_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(video_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(19:4) {#if video}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;
    	let h3;
    	let if_block0 = /*image*/ ctx[0] && create_if_block_2(ctx);
    	let if_block1 = /*audio*/ ctx[1] && create_if_block_1(ctx);
    	let if_block2 = /*video*/ ctx[2] && create_if_block$1(ctx);

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
    			attr_dev(h3, "class", "activity-description svelte-1n68ntu");
    			set_style(h3, "text-align", "center");
    			add_location(h3, file$8, 26, 8, 787);
    			attr_dev(div, "class", "activity-modal svelte-1n68ntu");
    			add_location(div, file$8, 7, 0, 114);
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
    					if_block0 = create_if_block_2(ctx);
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
    					if_block1 = create_if_block_1(ctx);
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
    					if_block2 = create_if_block$1(ctx);
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
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
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
    	let { image } = $$props;
    	let { audio } = $$props;
    	let { video } = $$props;
    	let { description } = $$props;
    	const writable_props = ["image", "audio", "video", "description"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ActivityModal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ActivityModal", $$slots, []);

    	$$self.$$set = $$props => {
    		if ("image" in $$props) $$invalidate(0, image = $$props.image);
    		if ("audio" in $$props) $$invalidate(1, audio = $$props.audio);
    		if ("video" in $$props) $$invalidate(2, video = $$props.video);
    		if ("description" in $$props) $$invalidate(3, description = $$props.description);
    	};

    	$$self.$capture_state = () => ({ image, audio, video, description });

    	$$self.$inject_state = $$props => {
    		if ("image" in $$props) $$invalidate(0, image = $$props.image);
    		if ("audio" in $$props) $$invalidate(1, audio = $$props.audio);
    		if ("video" in $$props) $$invalidate(2, video = $$props.video);
    		if ("description" in $$props) $$invalidate(3, description = $$props.description);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [image, audio, video, description];
    }

    class ActivityModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			image: 0,
    			audio: 1,
    			video: 2,
    			description: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ActivityModal",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*image*/ ctx[0] === undefined && !("image" in props)) {
    			console.warn("<ActivityModal> was created without expected prop 'image'");
    		}

    		if (/*audio*/ ctx[1] === undefined && !("audio" in props)) {
    			console.warn("<ActivityModal> was created without expected prop 'audio'");
    		}

    		if (/*video*/ ctx[2] === undefined && !("video" in props)) {
    			console.warn("<ActivityModal> was created without expected prop 'video'");
    		}

    		if (/*description*/ ctx[3] === undefined && !("description" in props)) {
    			console.warn("<ActivityModal> was created without expected prop 'description'");
    		}
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

    /* src/components/Intro.svelte generated by Svelte v3.24.1 */
    const file$9 = "src/components/Intro.svelte";

    // (86:15) <Annotation bind:this={introDescriptors[0]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">
    function create_default_slot_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("creative");
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
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(86:15) <Annotation bind:this={introDescriptors[0]} type=\\\"underline\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"1\\\">",
    		ctx
    	});

    	return block;
    }

    // (87:8) <Annotation bind:this={introDescriptors[1]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">
    function create_default_slot_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("curious");
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
    		source: "(87:8) <Annotation bind:this={introDescriptors[1]} type=\\\"underline\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"1\\\">",
    		ctx
    	});

    	return block;
    }

    // (90:30) <Annotation bind:this={introDescriptors[2]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">
    function create_default_slot_2(ctx) {
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
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(90:30) <Annotation bind:this={introDescriptors[2]} type=\\\"box\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"0.8\\\">",
    		ctx
    	});

    	return block;
    }

    // (92:25) <Annotation bind:this={introDescriptors[3]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("sociable professional");
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
    		source: "(92:25) <Annotation bind:this={introDescriptors[3]} type=\\\"underline\\\" padding={2} color=\\\"rgba(0, 187, 162, 0.5)\\\" strokeWidth=\\\"0.8\\\">",
    		ctx
    	});

    	return block;
    }

    // (100:22) <Annotation bind:this={introDescriptors[4]} type="highlight" color="rgba(0, 187, 162, 0.15)">
    function create_default_slot$5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("recruiting");
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
    		source: "(100:22) <Annotation bind:this={introDescriptors[4]} type=\\\"highlight\\\" color=\\\"rgba(0, 187, 162, 0.15)\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div1;
    	let h1;
    	let t1;
    	let div0;
    	let p0;
    	let t2;
    	let a0;
    	let t4;
    	let annotation0;
    	let t5;
    	let annotation1;
    	let t6;
    	let t7;
    	let p1;
    	let t8;
    	let descriptor0;
    	let annotation2;
    	let t9;
    	let activity0;
    	let t11;
    	let descriptor1;
    	let annotation3;
    	let t12;
    	let t13;
    	let p2;
    	let t14;
    	let activity1;
    	let t16;
    	let activity2;
    	let t18;
    	let activity3;
    	let t20;
    	let activity4;
    	let t22;
    	let activity5;
    	let t24;
    	let t25;
    	let p3;
    	let t26;
    	let a1;
    	let t28;
    	let t29;
    	let p4;
    	let t30;
    	let annotation4;
    	let t31;
    	let a2;
    	let t33;
    	let current;
    	let mounted;
    	let dispose;

    	let annotation0_props = {
    		type: "underline",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "1",
    		$$slots: { default: [create_default_slot_4] },
    		$$scope: { ctx }
    	};

    	annotation0 = new RoughNotation({ props: annotation0_props, $$inline: true });
    	/*annotation0_binding*/ ctx[7](annotation0);

    	let annotation1_props = {
    		type: "underline",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "1",
    		$$slots: { default: [create_default_slot_3] },
    		$$scope: { ctx }
    	};

    	annotation1 = new RoughNotation({ props: annotation1_props, $$inline: true });
    	/*annotation1_binding*/ ctx[8](annotation1);

    	let annotation2_props = {
    		type: "box",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "0.8",
    		$$slots: { default: [create_default_slot_2] },
    		$$scope: { ctx }
    	};

    	annotation2 = new RoughNotation({ props: annotation2_props, $$inline: true });
    	/*annotation2_binding*/ ctx[9](annotation2);

    	let annotation3_props = {
    		type: "underline",
    		padding: 2,
    		color: "rgba(0, 187, 162, 0.5)",
    		strokeWidth: "0.8",
    		$$slots: { default: [create_default_slot_1] },
    		$$scope: { ctx }
    	};

    	annotation3 = new RoughNotation({ props: annotation3_props, $$inline: true });
    	/*annotation3_binding*/ ctx[10](annotation3);

    	let annotation4_props = {
    		type: "highlight",
    		color: "rgba(0, 187, 162, 0.15)",
    		$$slots: { default: [create_default_slot$5] },
    		$$scope: { ctx }
    	};

    	annotation4 = new RoughNotation({ props: annotation4_props, $$inline: true });
    	/*annotation4_binding*/ ctx[11](annotation4);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Who is Max?";
    			t1 = space();
    			div0 = element("div");
    			p0 = element("p");
    			t2 = text("I am a Computer Science student at ");
    			a0 = element("a");
    			a0.textContent = "Queen's University";
    			t4 = text("\n        with a ");
    			create_component(annotation0.$$.fragment);
    			t5 = text(" and\n        ");
    			create_component(annotation1.$$.fragment);
    			t6 = text(" mind,\n        and a fascination for all technology.");
    			t7 = space();
    			p1 = element("p");
    			t8 = text("Also a ");
    			descriptor0 = element("descriptor");
    			create_component(annotation2.$$.fragment);
    			t9 = text(",\n        I am experienced in software and web development, hardware repair, agile methodologies, UI/UX design, and ");
    			activity0 = element("activity");
    			activity0.textContent = "iOS app reviewing";
    			t11 = text(".\n        As a ");
    			descriptor1 = element("descriptor");
    			create_component(annotation3.$$.fragment);
    			t12 = text(",\n        I enjoy working with teams and being around like-minded people. No matter the role, I strive to communicate effectively and confidently.");
    			t13 = space();
    			p2 = element("p");
    			t14 = text("In my free time, I love to listen to and ");
    			activity1 = element("activity");
    			activity1.textContent = "record music";
    			t16 = text(", ");
    			activity2 = element("activity");
    			activity2.textContent = "ski";
    			t18 = text(",\n        ");
    			activity3 = element("activity");
    			activity3.textContent = "hike";
    			t20 = text(", ");
    			activity4 = element("activity");
    			activity4.textContent = "travel";
    			t22 = text(", and ");
    			activity5 = element("activity");
    			activity5.textContent = "work with cool technology";
    			t24 = text(".");
    			t25 = space();
    			p3 = element("p");
    			t26 = text("Please explore and enjoy my portfolio website, click on things for more information, and ");
    			a1 = element("a");
    			a1.textContent = "email me";
    			t28 = text(" if you have any questions or comments.");
    			t29 = space();
    			p4 = element("p");
    			t30 = text("If you are ");
    			create_component(annotation4.$$.fragment);
    			t31 = text(", please view and download (print to PDF) my ");
    			a2 = element("a");
    			a2.textContent = "resume";
    			t33 = text(".");
    			attr_dev(h1, "class", "section-title-intro svelte-lk7iui");
    			add_location(h1, file$9, 82, 4, 2776);
    			attr_dev(a0, "class", "intro-link svelte-lk7iui");
    			attr_dev(a0, "href", "https://www.queensu.ca/");
    			attr_dev(a0, "rel", "noreferrer");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file$9, 84, 70, 2929);
    			attr_dev(p0, "class", "title-extension svelte-lk7iui");
    			add_location(p0, file$9, 84, 8, 2867);
    			attr_dev(descriptor0, "class", "svelte-lk7iui");
    			add_location(descriptor0, file$9, 89, 18, 3423);
    			attr_dev(activity0, "tabindex", "0");
    			attr_dev(activity0, "class", "svelte-lk7iui");
    			add_location(activity0, file$9, 90, 114, 3714);
    			attr_dev(descriptor1, "class", "svelte-lk7iui");
    			add_location(descriptor1, file$9, 91, 13, 3814);
    			add_location(p1, file$9, 89, 8, 3413);
    			attr_dev(activity1, "tabindex", "0");
    			attr_dev(activity1, "class", "svelte-lk7iui");
    			add_location(activity1, file$9, 94, 52, 4207);
    			attr_dev(activity2, "tabindex", "0");
    			attr_dev(activity2, "class", "svelte-lk7iui");
    			add_location(activity2, file$9, 94, 122, 4277);
    			attr_dev(activity3, "tabindex", "0");
    			attr_dev(activity3, "class", "svelte-lk7iui");
    			add_location(activity3, file$9, 95, 8, 4347);
    			attr_dev(activity4, "tabindex", "0");
    			attr_dev(activity4, "class", "svelte-lk7iui");
    			add_location(activity4, file$9, 95, 71, 4410);
    			attr_dev(activity5, "tabindex", "0");
    			attr_dev(activity5, "class", "svelte-lk7iui");
    			add_location(activity5, file$9, 95, 144, 4483);
    			add_location(p2, file$9, 94, 8, 4163);
    			attr_dev(a1, "class", "intro-link svelte-lk7iui");
    			attr_dev(a1, "href", "mailto:max.eisen@queensu.ca");
    			attr_dev(a1, "rel", "noreferrer");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file$9, 97, 100, 4678);
    			add_location(p3, file$9, 97, 8, 4586);
    			attr_dev(a2, "class", "intro-link svelte-lk7iui");
    			attr_dev(a2, "href", "/resume");
    			add_location(a2, file$9, 99, 183, 5016);
    			add_location(p4, file$9, 99, 8, 4841);
    			attr_dev(div0, "class", "intro-paragraph svelte-lk7iui");
    			add_location(div0, file$9, 83, 4, 2829);
    			attr_dev(div1, "class", "intro-container svelte-lk7iui");
    			add_location(div1, file$9, 81, 0, 2742);
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
    			mount_component(annotation0, p0, null);
    			append_dev(p0, t5);
    			mount_component(annotation1, p0, null);
    			append_dev(p0, t6);
    			append_dev(div0, t7);
    			append_dev(div0, p1);
    			append_dev(p1, t8);
    			append_dev(p1, descriptor0);
    			mount_component(annotation2, descriptor0, null);
    			append_dev(p1, t9);
    			append_dev(p1, activity0);
    			append_dev(p1, t11);
    			append_dev(p1, descriptor1);
    			mount_component(annotation3, descriptor1, null);
    			append_dev(p1, t12);
    			append_dev(div0, t13);
    			append_dev(div0, p2);
    			append_dev(p2, t14);
    			append_dev(p2, activity1);
    			append_dev(p2, t16);
    			append_dev(p2, activity2);
    			append_dev(p2, t18);
    			append_dev(p2, activity3);
    			append_dev(p2, t20);
    			append_dev(p2, activity4);
    			append_dev(p2, t22);
    			append_dev(p2, activity5);
    			append_dev(p2, t24);
    			append_dev(div0, t25);
    			append_dev(div0, p3);
    			append_dev(p3, t26);
    			append_dev(p3, a1);
    			append_dev(p3, t28);
    			append_dev(div0, t29);
    			append_dev(div0, p4);
    			append_dev(p4, t30);
    			mount_component(annotation4, p4, null);
    			append_dev(p4, t31);
    			append_dev(p4, a2);
    			append_dev(p4, t33);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(activity0, "click", /*appstorereviewersModal*/ ctx[1], false, false, false),
    					listen_dev(activity1, "click", /*musicModal*/ ctx[5], false, false, false),
    					listen_dev(activity2, "click", /*skiingModal*/ ctx[2], false, false, false),
    					listen_dev(activity3, "click", /*hikingModal*/ ctx[3], false, false, false),
    					listen_dev(activity4, "click", /*travellingModal*/ ctx[4], false, false, false),
    					listen_dev(activity5, "click", /*techModal*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const annotation0_changes = {};

    			if (dirty & /*$$scope*/ 1048576) {
    				annotation0_changes.$$scope = { dirty, ctx };
    			}

    			annotation0.$set(annotation0_changes);
    			const annotation1_changes = {};

    			if (dirty & /*$$scope*/ 1048576) {
    				annotation1_changes.$$scope = { dirty, ctx };
    			}

    			annotation1.$set(annotation1_changes);
    			const annotation2_changes = {};

    			if (dirty & /*$$scope*/ 1048576) {
    				annotation2_changes.$$scope = { dirty, ctx };
    			}

    			annotation2.$set(annotation2_changes);
    			const annotation3_changes = {};

    			if (dirty & /*$$scope*/ 1048576) {
    				annotation3_changes.$$scope = { dirty, ctx };
    			}

    			annotation3.$set(annotation3_changes);
    			const annotation4_changes = {};

    			if (dirty & /*$$scope*/ 1048576) {
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
    			if (detaching) detach_dev(div1);
    			/*annotation0_binding*/ ctx[7](null);
    			destroy_component(annotation0);
    			/*annotation1_binding*/ ctx[8](null);
    			destroy_component(annotation1);
    			/*annotation2_binding*/ ctx[9](null);
    			destroy_component(annotation2);
    			/*annotation3_binding*/ ctx[10](null);
    			destroy_component(annotation3);
    			/*annotation4_binding*/ ctx[11](null);
    			destroy_component(annotation4);
    			mounted = false;
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
    	let visible = false;

    	onMount(() => {
    		setTimeout(
    			() => {
    				visible = true;
    			},
    			1000
    		);
    	});

    	let introDescriptors = [];

    	onMount(() => {
    		let ids = m(introDescriptors);

    		setTimeout(
    			() => {
    				ids.show();
    			},
    			1500
    		);
    	});

    	const { open } = getContext("simple-modal");

    	const appstorereviewers = {
    		video: "./media/video/appstorereviewers_compilation",
    		description: "My old YouTube channel, <a href=\"https://www.youtube.com/user/AppStoreReviewers/videos\" rel=\"noreferrer\" target=\"_blank\">AppStoreReviewers</a> - reviewing iOS apps before iOS was called iOS (78,000 viewers strong)"
    	};

    	const skiing = {
    		image: "./img/activities/skiing.webp",
    		description: "Skiing in Whistler, BC"
    	};

    	const hiking = {
    		image: "./img/activities/hiking.webp",
    		description: "Hiking in Lake Country, BC"
    	};

    	const travelling = {
    		image: "./img/activities/travelling.webp",
    		description: "Travelling in Cartagena, Colombia"
    	};

    	const music = {
    		image: "./img/activities/guitar.webp",
    		audio: "./media/audio/helplessly_hoping-max_eisen.mp3",
    		description: "Recording a cover of <a href=\"https://www.youtube.com/watch?v=kyquqw6GeXk\" rel=\"noreferrer\" target=\"_blank\">'Helplessly Hoping' by CSN</a>"
    	};

    	const tech = {
    		image: "./img/activities/frc.webp",
    		description: "Leading my high school robotics team at the 2016 FIRST Robotics Competition"
    	};

    	const appstorereviewersModal = () => {
    		open(ActivityModal, {
    			video: appstorereviewers.video,
    			description: appstorereviewers.description
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

    	const musicModal = () => {
    		open(ActivityModal, {
    			image: music.image,
    			audio: music.audio,
    			description: music.description
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
    		annotationGroup: m,
    		onMount,
    		getContext,
    		ActivityModal,
    		visible,
    		introDescriptors,
    		open,
    		appstorereviewers,
    		skiing,
    		hiking,
    		travelling,
    		music,
    		tech,
    		appstorereviewersModal,
    		skiingModal,
    		hikingModal,
    		travellingModal,
    		musicModal,
    		techModal
    	});

    	$$self.$inject_state = $$props => {
    		if ("visible" in $$props) visible = $$props.visible;
    		if ("introDescriptors" in $$props) $$invalidate(0, introDescriptors = $$props.introDescriptors);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		introDescriptors,
    		appstorereviewersModal,
    		skiingModal,
    		hikingModal,
    		travellingModal,
    		musicModal,
    		techModal,
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
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Intro",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/components/modals/ExperienceModal.svelte generated by Svelte v3.24.1 */

    const file$a = "src/components/modals/ExperienceModal.svelte";

    // (16:4) {:else}
    function create_else_block(ctx) {
    	let h3;
    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(/*startDate*/ ctx[3]);
    			attr_dev(h3, "class", "modal-description svelte-dyj6m4");
    			set_style(h3, "text-align", "center");
    			add_location(h3, file$a, 16, 8, 512);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*startDate*/ 8) set_data_dev(t, /*startDate*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(16:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (14:4) {#if endDate}
    function create_if_block$2(ctx) {
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
    			attr_dev(h3, "class", "modal-description svelte-dyj6m4");
    			set_style(h3, "text-align", "center");
    			add_location(h3, file$a, 14, 8, 408);
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
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(14:4) {#if endDate}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div;
    	let h1;
    	let t0;
    	let t1;
    	let h2;
    	let a;
    	let t2;
    	let t3;
    	let t4;
    	let h3;
    	let t5;
    	let t6;
    	let p;

    	function select_block_type(ctx, dirty) {
    		if (/*endDate*/ ctx[4]) return create_if_block$2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

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
    			if_block.c();
    			t4 = space();
    			h3 = element("h3");
    			t5 = text(/*location*/ ctx[5]);
    			t6 = space();
    			p = element("p");
    			attr_dev(h1, "class", "modal-position svelte-dyj6m4");
    			add_location(h1, file$a, 11, 4, 235);
    			attr_dev(a, "href", /*companyLink*/ ctx[2]);
    			attr_dev(a, "rel", "noreferrer");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$a, 12, 30, 308);
    			attr_dev(h2, "class", "modal-company svelte-dyj6m4");
    			add_location(h2, file$a, 12, 4, 282);
    			attr_dev(h3, "class", "modal-description svelte-dyj6m4");
    			set_style(h3, "text-align", "center");
    			set_style(h3, "color", "#333333");
    			add_location(h3, file$a, 18, 4, 600);
    			attr_dev(p, "class", "modal-description svelte-dyj6m4");
    			add_location(p, file$a, 19, 4, 693);
    			attr_dev(div, "class", "experience-modal svelte-dyj6m4");
    			add_location(div, file$a, 10, 0, 200);
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
    			if_block.m(div, null);
    			append_dev(div, t4);
    			append_dev(div, h3);
    			append_dev(h3, t5);
    			append_dev(div, t6);
    			append_dev(div, p);
    			p.innerHTML = /*description*/ ctx[6];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*position*/ 1) set_data_dev(t0, /*position*/ ctx[0]);
    			if (dirty & /*company*/ 2) set_data_dev(t2, /*company*/ ctx[1]);

    			if (dirty & /*companyLink*/ 4) {
    				attr_dev(a, "href", /*companyLink*/ ctx[2]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t4);
    				}
    			}

    			if (dirty & /*location*/ 32) set_data_dev(t5, /*location*/ ctx[5]);
    			if (dirty & /*description*/ 64) p.innerHTML = /*description*/ ctx[6];		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
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

    	$$self.$$set = $$props => {
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

    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
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
    			id: create_fragment$a.name
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

    /* src/components/Experience.svelte generated by Svelte v3.24.1 */
    const file$b = "src/components/Experience.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (164:12) {:else}
    function create_else_block_1(ctx) {
    	let h2;
    	let div;
    	let t_value = /*exp*/ ctx[14].position + "";
    	let t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "experience-position svelte-bar5y9");
    			add_location(div, file$b, 164, 45, 8126);
    			attr_dev(h2, "class", "experience-title svelte-bar5y9");
    			add_location(h2, file$b, 164, 16, 8097);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, div);
    			append_dev(div, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(164:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (162:12) {#if exp.shortPosition}
    function create_if_block_1$1(ctx) {
    	let h2;
    	let div;
    	let t_value = /*exp*/ ctx[14].shortPosition + "";
    	let t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "experience-position svelte-bar5y9");
    			add_location(div, file$b, 162, 45, 7997);
    			attr_dev(h2, "class", "experience-title svelte-bar5y9");
    			add_location(h2, file$b, 162, 16, 7968);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, div);
    			append_dev(div, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(162:12) {#if exp.shortPosition}",
    		ctx
    	});

    	return block;
    }

    // (169:12) {:else}
    function create_else_block$1(ctx) {
    	let h2;
    	let t_value = /*exp*/ ctx[14].company + "";
    	let t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t = text(t_value);
    			attr_dev(h2, "class", "experience-company svelte-bar5y9");
    			add_location(h2, file$b, 169, 16, 8345);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(169:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (167:12) {#if exp.shortCompany}
    function create_if_block$3(ctx) {
    	let h2;
    	let t_value = /*exp*/ ctx[14].shortCompany + "";
    	let t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t = text(t_value);
    			attr_dev(h2, "class", "experience-company svelte-bar5y9");
    			add_location(h2, file$b, 167, 16, 8254);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(167:12) {#if exp.shortCompany}",
    		ctx
    	});

    	return block;
    }

    // (160:4) {#each experiences as exp}
    function create_each_block(ctx) {
    	let div2;
    	let t0;
    	let t1;
    	let p;
    	let t2_value = /*exp*/ ctx[14].shortDescription + "";
    	let t2;
    	let t3;
    	let h1;
    	let div0;
    	let t4_value = /*exp*/ ctx[14].shortDate + "";
    	let t4;
    	let div1;
    	let t5_value = /*exp*/ ctx[14].location + "";
    	let t5;
    	let t6;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*exp*/ ctx[14].shortPosition) return create_if_block_1$1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*exp*/ ctx[14].shortCompany) return create_if_block$3;
    		return create_else_block$1;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			if_block0.c();
    			t0 = space();
    			if_block1.c();
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			h1 = element("h1");
    			div0 = element("div");
    			t4 = text(t4_value);
    			div1 = element("div");
    			t5 = text(t5_value);
    			t6 = space();
    			add_location(p, file$b, 171, 12, 8425);
    			attr_dev(div0, "class", "experience-date svelte-bar5y9");
    			add_location(div0, file$b, 172, 49, 8504);
    			attr_dev(div1, "class", "experience-location svelte-bar5y9");
    			add_location(div1, file$b, 172, 99, 8554);
    			attr_dev(h1, "class", "experience-date-location svelte-bar5y9");
    			add_location(h1, file$b, 172, 12, 8467);
    			attr_dev(div2, "class", "experience-item");
    			attr_dev(div2, "tabindex", "0");
    			add_location(div2, file$b, 160, 2, 7844);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			if_block0.m(div2, null);
    			append_dev(div2, t0);
    			if_block1.m(div2, null);
    			append_dev(div2, t1);
    			append_dev(div2, p);
    			append_dev(p, t2);
    			append_dev(div2, t3);
    			append_dev(div2, h1);
    			append_dev(h1, div0);
    			append_dev(div0, t4);
    			append_dev(h1, div1);
    			append_dev(div1, t5);
    			append_dev(div2, t6);

    			if (!mounted) {
    				dispose = listen_dev(div2, "click", /*exp*/ ctx[14].modalFunction, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if_block0.p(ctx, dirty);
    			if_block1.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_block0.d();
    			if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(160:4) {#each experiences as exp}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let h1;
    	let t1;
    	let div;
    	let each_value = /*experiences*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
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
    			add_location(h1, file$b, 157, 0, 7717);
    			attr_dev(div, "class", "experience-subsection");
    			add_location(div, file$b, 158, 0, 7775);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*experiences*/ 1) {
    				each_value = /*experiences*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
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
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
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

    	const exp1 = {
    		modalFunction: modal1,
    		shortPosition: "Software Engineer",
    		position: "Software Development Engineer",
    		shortCompany: "Publicis Sapient",
    		company: "Publicis Sapient",
    		companyLink: "https://www.publicissapient.com/",
    		shortDate: "June 2021",
    		startDate: "Starting June 2021",
    		location: "Toronto, ON",
    		shortDescription: "Working as a software consultant and engineer to create digital experiences for companies around the globe",
    		longDescription: `<ul>
            <li>Consulting with client companies to determine requirements for large-scale digital transformation projects</li>
            <li>Collaborating with a team to design, develop, and engineer these projects for launch</li>
            <li>Publicis Sapient operates in 20 different countries around the world, giving me the opportunity to work with clients from across the globe</li>
        </ul>`
    	};

    	const exp2 = {
    		modalFunction: modal2,
    		position: "Product Manager",
    		shortCompany: "QTMA",
    		company: "Queen's Technology and Media Association",
    		companyLink: "https://qtma.ca/",
    		shortDate: "April 2020-Present",
    		startDate: "April 2020",
    		endDate: "Present",
    		location: "Kingston, ON",
    		shortDescription: "Managing a talented team of Queen's students to ideate, develop, and market a software product",
    		longDescription: `<ul>
            <li>Managing a team of talented developers and business analysts to ideate, build, and market a software product</li>
            <li>Leading team presentations and product pitches to students, professors, and potential investors throughout the school year</li>
        </ul>`
    	};

    	const exp3 = {
    		modalFunction: modal3,
    		shortPosition: "CS Teaching Assistant",
    		position: "Computer Science Teaching Assistant",
    		shortCompany: "Queen's University",
    		company: "Queen's University",
    		shortDate: "Sept. 2019-Present",
    		companyLink: "https://cs.queensu.ca/",
    		startDate: "September 2019",
    		endDate: "Present",
    		location: "Kingston, ON",
    		shortDescription: "Assisting in the teaching and grading of several intermediate to advanced programming courses",
    		longDescription: `<ul>
            <li>Selected as one of 3 TAs to assist in teaching and grading of CMPE 212 - Object-Oriented Programming in Java, having previously obtained an exceptional grade in the course</li>
            <li>Holding weekly office hours to guide students in completing assignments and projects</li>
            <li>Previously assisted in the teaching of Fundamentals of Software Development (Agile Methodologies) in C++, and a 250-student Python course</li>
        </ul>`
    	};

    	const exp4 = {
    		modalFunction: modal4,
    		shortPosition: "Technical Developer",
    		position: "Technical Developer Co-op",
    		shortCompany: "Jonah Group",
    		company: "Jonah Group",
    		companyLink: "https://www.jonahgroup.com/",
    		shortDate: "May-Sept. 2020",
    		startDate: "May",
    		endDate: "September 2020",
    		location: "Toronto, ON",
    		shortDescription: "Worked with a fantastic team of developers to create large-scale software products for companies",
    		longDescription: `<ul>
            <li>Used React, Spring Boot, and Postgres in my summer internship to build custom, high-performance software for companies</li>
            <li>Full stack developer on an agile team, developing a decision engine to be implemented for client companies</li>
        </ul>`
    	};

    	const exp5 = {
    		modalFunction: modal5,
    		shortPosition: "Director of Technology",
    		position: "Founder, Director of Technology",
    		shortCompany: "TechTrainers",
    		company: "TechTrainers",
    		companyLink: "https://techtrainers.ca/",
    		shortDate: "May 2019-Jan. 2021",
    		startDate: "May 2019",
    		endDate: "January 2021",
    		location: "Toronto, ON",
    		shortDescription: "Creating a network of in-person and online quality tech help and tutoring around the GTA",
    		longDescription: `<ul>
            <li>Co-founded technology help company, providing tech tutoring and support to 20+ customers in the first 3 months of operation across Toronto</li>
            <li>Overseeing all technical aspects of operations, including web development, database management, and session scheduling</li>
            <li>Company was able to turn a profit in first month of operations</li>
        </ul>`
    	};

    	const exp6 = {
    		modalFunction: modal6,
    		shortPosition: "Software Developer",
    		position: "Software Developer, Technical Coordinator",
    		company: "QHacks",
    		companyLink: "https://qhacks.io/",
    		shortDate: "Sept. 2019-Feb. 2020",
    		startDate: "September 2019",
    		endDate: "February 2020",
    		location: "Kingston, ON",
    		shortDescription: "Developed the website and other software for Queen's University's official MLH hackathon",
    		longDescription: `<ul>
            <li>Developed and deployed the official website for the 2020 MLH-affiliated hackathon using React and Gatsby (accessed by over 10,000 individuals)</li>
            <li>Worked on digital dashboard for use by 700+ applicants in time leading up to, and during event</li>
            <li>Oversaw technology operations during the hackathon, helping teams in completing their projects, and keeping all information up-to-date</li>
        </ul>`
    	};

    	var experiences = [];
    	experiences.push(exp1);
    	experiences.push(exp2);
    	experiences.push(exp3);
    	experiences.push(exp4);
    	experiences.push(exp5);
    	experiences.push(exp6);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Experience> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Experience", $$slots, []);

    	$$self.$capture_state = () => ({
    		getContext,
    		ExperienceModal,
    		open,
    		modal1,
    		modal2,
    		modal3,
    		modal4,
    		modal5,
    		modal6,
    		exp1,
    		exp2,
    		exp3,
    		exp4,
    		exp5,
    		exp6,
    		experiences
    	});

    	$$self.$inject_state = $$props => {
    		if ("experiences" in $$props) $$invalidate(0, experiences = $$props.experiences);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [experiences];
    }

    class Experience extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Experience",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoMdOpen.svelte generated by Svelte v3.24.1 */
    const file$c = "node_modules/svelte-icons/io/IoMdOpen.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$6(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M405.34 405.332H106.66V106.668H240V64H106.66C83.191 64 64 83.197 64 106.668v298.664C64 428.803 83.191 448 106.66 448h298.68c23.469 0 42.66-19.197 42.66-42.668V272h-42.66v133.332zM288 64v42.668h87.474L159.999 322.133l29.866 29.866 215.476-215.47V224H448V64H288z");
    			add_location(path, file$c, 4, 10, 153);
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
    		id: create_default_slot$6.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
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
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoMdOpen", $$slots, []);

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
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoMdOpen",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    /* node_modules/svelte-icons/io/IoIosCode.svelte generated by Svelte v3.24.1 */
    const file$d = "node_modules/svelte-icons/io/IoIosCode.svelte";

    // (4:8) <IconBase viewBox="0 0 512 512" {...$$props}>
    function create_default_slot$7(ctx) {
    	let path;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", "M332 142.7c-1.2-1.1-2.7-1.7-4.1-1.7s-3 .6-4.1 1.7L310 155.9c-1.2 1.1-1.9 2.7-1.9 4.3 0 1.6.7 3.2 1.9 4.3l95.8 91.5-95.8 91.5c-1.2 1.1-1.9 2.7-1.9 4.3 0 1.6.7 3.2 1.9 4.3l13.8 13.2c1.2 1.1 2.6 1.7 4.1 1.7 1.5 0 3-.6 4.1-1.7l114.2-109c1.2-1.1 1.9-2.7 1.9-4.3 0-1.6-.7-3.2-1.9-4.3L332 142.7zM204 160.2c0-1.6-.7-3.2-1.9-4.3l-13.8-13.2c-1.2-1.1-2.7-1.7-4.1-1.7s-3 .6-4.1 1.7l-114.2 109c-1.2 1.1-1.9 2.7-1.9 4.3 0 1.6.7 3.2 1.9 4.3l114.2 109c1.2 1.1 2.7 1.7 4.1 1.7 1.5 0 3-.6 4.1-1.7l13.8-13.2c1.2-1.1 1.9-2.7 1.9-4.3 0-1.6-.7-3.2-1.9-4.3L106.3 256l95.8-91.5c1.2-1.1 1.9-2.7 1.9-4.3z");
    			add_location(path, file$d, 4, 10, 153);
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
    		id: create_default_slot$7.name,
    		type: "slot",
    		source: "(4:8) <IconBase viewBox=\\\"0 0 512 512\\\" {...$$props}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
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
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("IoIosCode", $$slots, []);

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
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IoIosCode",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src/components/modals/ProjectModal.svelte generated by Svelte v3.24.1 */
    const file$e = "src/components/modals/ProjectModal.svelte";

    // (18:8) {#if projectLink}
    function create_if_block$4(ctx) {
    	let a;
    	let openlogo;
    	let current;
    	openlogo = new IoMdOpen({ $$inline: true });

    	const block = {
    		c: function create() {
    			a = element("a");
    			create_component(openlogo.$$.fragment);
    			attr_dev(a, "class", "project-link svelte-tdibzl");
    			attr_dev(a, "href", /*projectLink*/ ctx[5]);
    			attr_dev(a, "rel", "noreferrer");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$e, 18, 12, 602);
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
    			if (detaching) detach_dev(a);
    			destroy_component(openlogo);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(18:8) {#if projectLink}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
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
    	let a;
    	let codelogo;
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
    	let if_block = /*projectLink*/ ctx[5] && create_if_block$4(ctx);
    	codelogo = new IoIosCode({ $$inline: true });

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
    			if (if_block) if_block.c();
    			t8 = space();
    			a = element("a");
    			create_component(codelogo.$$.fragment);
    			t9 = space();
    			p = element("p");
    			t10 = space();
    			picture = element("picture");
    			source0 = element("source");
    			t11 = space();
    			source1 = element("source");
    			t12 = space();
    			img = element("img");
    			attr_dev(h1, "class", "modal-name svelte-tdibzl");
    			add_location(h1, file$e, 14, 4, 353);
    			attr_dev(b, "class", "technologies svelte-tdibzl");
    			add_location(b, file$e, 15, 77, 474);
    			attr_dev(h3, "class", "modal-description svelte-tdibzl");
    			set_style(h3, "text-align", "center");
    			add_location(h3, file$e, 15, 4, 401);
    			attr_dev(a, "class", "project-link svelte-tdibzl");
    			attr_dev(a, "href", /*githubLink*/ ctx[4]);
    			attr_dev(a, "rel", "noreferrer");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$e, 20, 8, 717);
    			attr_dev(div0, "class", "project-links-container svelte-tdibzl");
    			add_location(div0, file$e, 16, 4, 526);
    			attr_dev(p, "class", "modal-description svelte-tdibzl");
    			add_location(p, file$e, 22, 4, 824);
    			attr_dev(source0, "srcset", source0_srcset_value = "" + (/*screenshot*/ ctx[6] + ".webp"));
    			attr_dev(source0, "type", "image/webp");
    			add_location(source0, file$e, 24, 8, 899);
    			attr_dev(source1, "srcset", source1_srcset_value = "" + (/*screenshot*/ ctx[6] + ".jpg"));
    			attr_dev(source1, "type", "image/jpeg");
    			add_location(source1, file$e, 25, 8, 961);
    			attr_dev(img, "class", "screenshot svelte-tdibzl");
    			if (img.src !== (img_src_value = "" + (/*screenshot*/ ctx[6] + ".webp"))) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = "" + (/*name*/ ctx[0] + " screenshot"));
    			add_location(img, file$e, 26, 8, 1022);
    			add_location(picture, file$e, 23, 4, 881);
    			attr_dev(div1, "class", "project-modal svelte-tdibzl");
    			add_location(div1, file$e, 13, 0, 321);
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
    			if (if_block) if_block.m(div0, null);
    			append_dev(div0, t8);
    			append_dev(div0, a);
    			mount_component(codelogo, a, null);
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
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*projectLink*/ 32) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div0, t8);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*githubLink*/ 16) {
    				attr_dev(a, "href", /*githubLink*/ ctx[4]);
    			}

    			if (!current || dirty & /*description*/ 8) p.innerHTML = /*description*/ ctx[3];
    			if (!current || dirty & /*screenshot*/ 64 && source0_srcset_value !== (source0_srcset_value = "" + (/*screenshot*/ ctx[6] + ".webp"))) {
    				attr_dev(source0, "srcset", source0_srcset_value);
    			}

    			if (!current || dirty & /*screenshot*/ 64 && source1_srcset_value !== (source1_srcset_value = "" + (/*screenshot*/ ctx[6] + ".jpg"))) {
    				attr_dev(source1, "srcset", source1_srcset_value);
    			}

    			if (!current || dirty & /*screenshot*/ 64 && img.src !== (img_src_value = "" + (/*screenshot*/ ctx[6] + ".webp"))) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*name*/ 1 && img_alt_value !== (img_alt_value = "" + (/*name*/ ctx[0] + " screenshot"))) {
    				attr_dev(img, "alt", img_alt_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(codelogo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(codelogo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			destroy_component(codelogo);
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

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("technologies" in $$props) $$invalidate(1, technologies = $$props.technologies);
    		if ("year" in $$props) $$invalidate(2, year = $$props.year);
    		if ("description" in $$props) $$invalidate(3, description = $$props.description);
    		if ("githubLink" in $$props) $$invalidate(4, githubLink = $$props.githubLink);
    		if ("projectLink" in $$props) $$invalidate(5, projectLink = $$props.projectLink);
    		if ("screenshot" in $$props) $$invalidate(6, screenshot = $$props.screenshot);
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

    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {
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
    			id: create_fragment$e.name
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

    /* src/components/Projects.svelte generated by Svelte v3.24.1 */
    const file$f = "src/components/Projects.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (145:4) {#each projects as proj}
    function create_each_block$1(ctx) {
    	let div;
    	let h20;
    	let t0_value = /*proj*/ ctx[14].name + "";
    	let t0;
    	let t1;
    	let html_tag;
    	let raw_value = /*proj*/ ctx[14].emoji + "";
    	let t2;
    	let h21;
    	let t3_value = /*proj*/ ctx[14].year + "";
    	let t3;
    	let t4;
    	let h22;
    	let t5_value = /*proj*/ ctx[14].technologies + "";
    	let t5;
    	let t6;
    	let p;
    	let t7_value = /*proj*/ ctx[14].shortDescription + "";
    	let t7;
    	let t8;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h20 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = space();
    			h21 = element("h2");
    			t3 = text(t3_value);
    			t4 = space();
    			h22 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			p = element("p");
    			t7 = text(t7_value);
    			t8 = space();
    			html_tag = new HtmlTag(null);
    			attr_dev(h20, "class", "project-name svelte-1b316dq");
    			add_location(h20, file$f, 146, 12, 7191);
    			attr_dev(h21, "class", "project-year svelte-1b316dq");
    			add_location(h21, file$f, 147, 12, 7264);
    			attr_dev(h22, "class", "project-tech svelte-1b316dq");
    			add_location(h22, file$f, 148, 12, 7318);
    			add_location(p, file$f, 149, 12, 7380);
    			attr_dev(div, "class", "project-item");
    			attr_dev(div, "tabindex", "0");
    			set_style(div, "background-image", "url('" + /*proj*/ ctx[14].screenshot + ".webp')");
    			add_location(div, file$f, 145, 8, 7053);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h20);
    			append_dev(h20, t0);
    			append_dev(h20, t1);
    			html_tag.m(raw_value, h20);
    			append_dev(div, t2);
    			append_dev(div, h21);
    			append_dev(h21, t3);
    			append_dev(div, t4);
    			append_dev(div, h22);
    			append_dev(h22, t5);
    			append_dev(div, t6);
    			append_dev(div, p);
    			append_dev(p, t7);
    			append_dev(div, t8);

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*proj*/ ctx[14].modalFunction, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(145:4) {#each projects as proj}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$f(ctx) {
    	let h1;
    	let t1;
    	let div;
    	let each_value = /*projects*/ ctx[0];
    	validate_each_argument(each_value);
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
    			add_location(h1, file$f, 142, 0, 6929);
    			attr_dev(div, "class", "project-subsection");
    			add_location(div, file$f, 143, 0, 6983);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*projects*/ 1) {
    				each_value = /*projects*/ ctx[0];
    				validate_each_argument(each_value);
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
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
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

    	const modal5 = () => {
    		open(ProjectModal, {
    			name: proj5.name,
    			technologies: proj5.technologies,
    			year: proj5.year,
    			description: proj5.longDescription,
    			githubLink: proj5.githubLink,
    			projectLink: proj5.projectLink,
    			screenshot: proj5.screenshot
    		});
    	};

    	const modal6 = () => {
    		open(ProjectModal, {
    			name: proj6.name,
    			technologies: proj6.technologies,
    			year: proj6.year,
    			description: proj6.longDescription,
    			githubLink: proj6.githubLink,
    			projectLink: proj6.projectLink,
    			screenshot: proj6.screenshot
    		});
    	};

    	const proj1 = {
    		modalFunction: modal1,
    		name: "MaxEisen.me",
    		emoji: "&#128587;",
    		technologies: "Svelte, Netlify, HTML5, CSS3",
    		year: "2020",
    		shortDescription: "My personal portfolio website (the one you're currently on) built from scratch",
    		longDescription: `<ul>
            <li>A personal portfolio website built from scratch to showcase my work experience, projects, skills, and more</li>
            <li>Initally a web version of my resume, this became a larger project that constantly allows me to improve my design and development skills</li>
        </ul>`,
    		githubLink: "https://github.com/maxeisen/MaxEisen.me",
    		screenshot: "./img/screenshots/maxeisenme"
    	};

    	const proj2 = {
    		modalFunction: modal2,
    		name: "Studii",
    		emoji: "&#128218;",
    		technologies: "React, Django, MongoDB, HTML5, CSS3",
    		year: "2019/2020",
    		shortDescription: "A collaborative, all-in-one study space made for students, by students",
    		longDescription: `<ul>
            <li>For students who can't find a study method that works for them and/or don't have classmates to study with, Studii offers real-time, affordable, peer and tutor support through a tailored forum</li>
            <li>Ideated, developed, marketed, and pitched by a super team of 8 QTMA team members</li>
        </ul>`,
    		githubLink: "https://github.com/maxeisen/studii_public",
    		projectLink: "https://qtma.ca/studii.html",
    		screenshot: "./img/screenshots/studii"
    	};

    	const proj3 = {
    		modalFunction: modal3,
    		name: "QHacks",
    		emoji: "&#128187;",
    		technologies: "React, Gatsby, MongoDB, HTML5, CSS3",
    		year: "2019/2020",
    		shortDescription: "The official website for Queen's University's 2020 MLH hackathon",
    		longDescription: `<ul>
            <li>The static website for Queen's University's official 2020 hackathon, developed with React and generated using Gatsby</li>
            <li>Accessed thousands of times during the application phase (700+ applicants), as well as leading up to the event</li>
        </ul>`,
    		githubLink: "https://github.com/maxeisen/qhacks-website/tree/dev-2020",
    		projectLink: "https://2020.qhacks.io",
    		screenshot: "./img/screenshots/qhacks"
    	};

    	const proj4 = {
    		modalFunction: modal4,
    		name: "Spotilizer",
    		emoji: "&#127925;",
    		technologies: "Python, Tkinter, Spotify Web API",
    		year: "2019",
    		shortDescription: "A customizable, data-centric Spotify music visualizer built in Python",
    		longDescription: `<ul>
            <li>Spotilizer is a visualizer that links to a user's Spotify account and uses hundreds of data points from <a href=\"https://developer.spotify.com/documentation/web-api/\" rel=\"noreferrer\" target=\"_blank\">Spotify's Web API</a> to generate visuals according to rhythm, energy, 'danceability', and many other factors</li>
            <li>Developed by a team of 4 in 10 hours, winning 2nd place at Queen's University during MLH's 2019 Local Hack Day</li>
        </ul>`,
    		githubLink: "https://github.com/maxeisen/spotilizer",
    		screenshot: "./img/screenshots/spotilizer"
    	};

    	const proj5 = {
    		modalFunction: modal5,
    		name: "Glitch",
    		emoji: "&#127918;",
    		technologies: "Unity Game Engine, C#",
    		year: "2018/2019",
    		shortDescription: "A unique, monochromatic platformer game for observant minimalists",
    		longDescription: `<ul>
            <li>Glitch is a monochromatic platformer game, with a novel mechanic that allows the player to use two different states - glitched and default - at the press of a button to help them win</li>
            <li>Developed by a group of 3 as a final course project for CISC 226 (Game Design) at Queen's University</li>
        </ul>`,
    		githubLink: "https://github.com/maxeisen/Glitch",
    		projectLink: "https://tamirarnesty.github.io/glitchGame/",
    		screenshot: "./img/screenshots/glitch"
    	};

    	const proj6 = {
    		modalFunction: modal6,
    		name: "TicTacToe",
    		emoji: "&#10060;",
    		technologies: "Python",
    		year: "2017",
    		shortDescription: "A basic, text-based, Pythonic version of tic-tac-toe made in under an hour",
    		longDescription: `<ul>
            <li>An extremely basic, text-based version of tic-tac-toe made out of boredom on a flight</li>
            <li>Developed in under an hour on a long flight, without access to any online resources</li>
            <li>Initially written in Python 2 and ported to Python 3</li>
        </ul>`,
    		githubLink: "https://github.com/maxeisen/TicTacToe",
    		screenshot: "./img/screenshots/tictactoe"
    	};

    	var projects = [];
    	projects.push(proj1);
    	projects.push(proj2);
    	projects.push(proj3);
    	projects.push(proj4);
    	projects.push(proj5);
    	projects.push(proj6);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Projects> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Projects", $$slots, []);

    	$$self.$capture_state = () => ({
    		getContext,
    		ProjectModal,
    		open,
    		modal1,
    		modal2,
    		modal3,
    		modal4,
    		modal5,
    		modal6,
    		proj1,
    		proj2,
    		proj3,
    		proj4,
    		proj5,
    		proj6,
    		projects
    	});

    	$$self.$inject_state = $$props => {
    		if ("projects" in $$props) $$invalidate(0, projects = $$props.projects);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [projects];
    }

    class Projects extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Projects",
    			options,
    			id: create_fragment$f.name
    		});
    	}
    }

    /* src/components/modals/EducationModal.svelte generated by Svelte v3.24.1 */

    const file$g = "src/components/modals/EducationModal.svelte";

    function create_fragment$g(ctx) {
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
    			add_location(h1, file$g, 9, 4, 171);
    			attr_dev(h2, "class", "modal-degree svelte-sqpdh");
    			add_location(h2, file$g, 10, 4, 214);
    			attr_dev(h30, "class", "modal-major svelte-sqpdh");
    			set_style(h30, "text-align", "center");
    			add_location(h30, file$g, 11, 4, 263);
    			attr_dev(h31, "class", "modal-years svelte-sqpdh");
    			set_style(h31, "text-align", "center");
    			set_style(h31, "color", "#333333");
    			add_location(h31, file$g, 12, 4, 337);
    			add_location(b, file$g, 13, 32, 449);
    			attr_dev(p, "class", "modal-committees svelte-sqpdh");
    			add_location(p, file$g, 13, 4, 421);
    			attr_dev(div, "class", "education-modal svelte-sqpdh");
    			add_location(div, file$g, 8, 0, 137);
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
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
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

    	$$self.$$set = $$props => {
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

    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {
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
    			id: create_fragment$g.name
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

    /* src/components/Education.svelte generated by Svelte v3.24.1 */
    const file$h = "src/components/Education.svelte";

    function create_fragment$h(ctx) {
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
    			add_location(h1, file$h, 21, 0, 909);
    			attr_dev(h20, "class", "school-name svelte-5xq66k");
    			add_location(h20, file$h, 24, 12, 1092);
    			attr_dev(h21, "class", "degree-info svelte-5xq66k");
    			add_location(h21, file$h, 25, 12, 1152);
    			attr_dev(h22, "class", "major-info svelte-5xq66k");
    			add_location(h22, file$h, 26, 12, 1225);
    			attr_dev(h23, "class", "degree-years svelte-5xq66k");
    			add_location(h23, file$h, 27, 12, 1282);
    			attr_dev(div0, "class", "education-item");
    			attr_dev(div0, "tabindex", "0");
    			add_location(div0, file$h, 23, 8, 1012);
    			attr_dev(div1, "class", "education-subsection");
    			add_location(div1, file$h, 22, 4, 969);
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
    				dispose = listen_dev(div0, "click", /*educationModal*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
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
    	const education = {
    		school: "Queen's University",
    		degree: "Bachelor of Computing (<a href=\"https://www.queensu.ca/admission/programs/computing\" rel=\"noreferrer\" target=\"_blank\">BCmpH</a>)",
    		major: "Computer Science (<a href=\"http://www.cips.ca/\" rel=\"noreferrer\" target=\"_blank\">CIPS</a> Accredited)",
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
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Education",
    			options,
    			id: create_fragment$h.name
    		});
    	}
    }

    /* src/components/Skills.svelte generated by Svelte v3.24.1 */

    const file$i = "src/components/Skills.svelte";

    function create_fragment$i(ctx) {
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
    			li1.textContent = "Java";
    			t5 = space();
    			li2 = element("li");
    			li2.textContent = "JavaScript";
    			t7 = space();
    			li3 = element("li");
    			li3.textContent = "HTML5";
    			t9 = space();
    			li4 = element("li");
    			li4.textContent = "CSS3";
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
    			li8.textContent = "React";
    			t19 = space();
    			li9 = element("li");
    			li9.textContent = "Svelte";
    			t21 = space();
    			li10 = element("li");
    			li10.textContent = "Gatsby";
    			t23 = space();
    			li11 = element("li");
    			li11.textContent = "Spring";
    			t25 = space();
    			li12 = element("li");
    			li12.textContent = "Node";
    			t27 = space();
    			li13 = element("li");
    			li13.textContent = "Git";
    			t29 = space();
    			li14 = element("li");
    			li14.textContent = "AWS";
    			t31 = space();
    			li15 = element("li");
    			li15.textContent = "Unity";
    			attr_dev(h1, "class", "section-title");
    			attr_dev(h1, "id", "skills");
    			add_location(h1, file$i, 0, 0, 0);
    			attr_dev(li0, "class", "svelte-19idqw3");
    			add_location(li0, file$i, 3, 8, 99);
    			attr_dev(li1, "class", "svelte-19idqw3");
    			add_location(li1, file$i, 4, 8, 123);
    			attr_dev(li2, "class", "svelte-19idqw3");
    			add_location(li2, file$i, 5, 8, 145);
    			attr_dev(li3, "class", "svelte-19idqw3");
    			add_location(li3, file$i, 6, 8, 173);
    			attr_dev(li4, "class", "svelte-19idqw3");
    			add_location(li4, file$i, 7, 8, 196);
    			attr_dev(li5, "class", "svelte-19idqw3");
    			add_location(li5, file$i, 8, 8, 218);
    			attr_dev(li6, "class", "svelte-19idqw3");
    			add_location(li6, file$i, 9, 8, 239);
    			attr_dev(li7, "class", "svelte-19idqw3");
    			add_location(li7, file$i, 10, 8, 260);
    			attr_dev(li8, "class", "svelte-19idqw3");
    			add_location(li8, file$i, 11, 8, 280);
    			attr_dev(li9, "class", "svelte-19idqw3");
    			add_location(li9, file$i, 12, 8, 303);
    			attr_dev(li10, "class", "svelte-19idqw3");
    			add_location(li10, file$i, 13, 8, 327);
    			attr_dev(li11, "class", "svelte-19idqw3");
    			add_location(li11, file$i, 14, 8, 351);
    			attr_dev(li12, "class", "svelte-19idqw3");
    			add_location(li12, file$i, 15, 8, 375);
    			attr_dev(li13, "class", "svelte-19idqw3");
    			add_location(li13, file$i, 16, 8, 397);
    			attr_dev(li14, "class", "svelte-19idqw3");
    			add_location(li14, file$i, 17, 8, 418);
    			attr_dev(li15, "class", "svelte-19idqw3");
    			add_location(li15, file$i, 18, 8, 439);
    			attr_dev(ul, "class", "svelte-19idqw3");
    			add_location(ul, file$i, 2, 4, 86);
    			attr_dev(div, "class", "skills-subsection");
    			add_location(div, file$i, 1, 0, 50);
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
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props) {
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
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Skills",
    			options,
    			id: create_fragment$i.name
    		});
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.24.1 */

    const file$j = "src/components/Footer.svelte";

    function create_fragment$j(ctx) {
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
    			b.textContent = "©2021";
    			set_style(b, "font-size", "14px");
    			set_style(b, "color", "#ababab");
    			add_location(b, file$j, 0, 133, 133);
    			attr_dev(a, "href", "https://github.com/maxeisen/MaxEisen.me/");
    			attr_dev(a, "rel", "noreferrer");
    			attr_dev(a, "class", "footer");
    			add_location(a, file$j, 0, 19, 19);
    			attr_dev(h2, "class", "footer");
    			add_location(h2, file$j, 0, 0, 0);
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
    			if (detaching) detach_dev(h2);
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

    function instance$j($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Footer", $$slots, []);
    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$j.name
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

    /* node_modules/svelte-simple-modal/src/Modal.svelte generated by Svelte v3.24.1 */

    const { Object: Object_1 } = globals;
    const file$k = "node_modules/svelte-simple-modal/src/Modal.svelte";

    // (213:0) {#if Component}
    function create_if_block$5(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let t;
    	let div0;
    	let switch_instance;
    	let div1_transition;
    	let div3_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*state*/ ctx[0].closeButton && create_if_block_1$2(ctx);
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
    		switch_instance = new switch_value(switch_props());
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
    			add_location(div0, file$k, 233, 8, 5379);
    			attr_dev(div1, "class", "window svelte-fnsfcv");
    			attr_dev(div1, "style", /*cssWindow*/ ctx[10]);
    			add_location(div1, file$k, 221, 6, 5006);
    			attr_dev(div2, "class", "window-wrap svelte-fnsfcv");
    			add_location(div2, file$k, 220, 4, 4957);
    			attr_dev(div3, "class", "bg svelte-fnsfcv");
    			attr_dev(div3, "style", /*cssBg*/ ctx[9]);
    			add_location(div3, file$k, 213, 2, 4791);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div1, t);
    			append_dev(div1, div0);

    			if (switch_instance) {
    				mount_component(switch_instance, div0, null);
    			}

    			/*div2_binding*/ ctx[31](div2);
    			/*div3_binding*/ ctx[32](div3);
    			current = true;

    			if (!mounted) {
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

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*state*/ ctx[0].closeButton) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$2(ctx);
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
    			/*div2_binding*/ ctx[31](null);
    			/*div3_binding*/ ctx[32](null);
    			if (detaching && div3_transition) div3_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(213:0) {#if Component}",
    		ctx
    	});

    	return block;
    }

    // (231:8) {#if state.closeButton}
    function create_if_block_1$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			attr_dev(button, "class", "close svelte-fnsfcv");
    			add_location(button, file$k, 231, 10, 5308);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*close*/ ctx[14], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(231:8) {#if state.closeButton}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$k(ctx) {
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*Component*/ ctx[1] && create_if_block$5(ctx);
    	const default_slot_template = /*$$slots*/ ctx[30].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[29], null);

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
    				dispose = listen_dev(window, "keyup", /*handleKeyup*/ ctx[15], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*Component*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*Component*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$5(ctx);
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
    				if (default_slot.p && dirty[0] & /*$$scope*/ 536870912) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[29], dirty, null, null);
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
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
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

    	const handleKeyup = event => {
    		if (state.closeOnEsc && Component && event.key === "Escape") {
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
    			wrap = $$value;
    			$$invalidate(4, wrap);
    		});
    	}

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			background = $$value;
    			$$invalidate(3, background);
    		});
    	}

    	$$self.$$set = $$props => {
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
    		if ("$$scope" in $$props) $$invalidate(29, $$scope = $$props.$$scope);
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
    			instance$k,
    			create_fragment$k,
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
    			id: create_fragment$k.name
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

    /* src/App.svelte generated by Svelte v3.24.1 */
    const file$l = "src/App.svelte";

    // (13:0) <Modal>
    function create_default_slot$8(ctx) {
    	let menubar;
    	let t0;
    	let div3;
    	let div0;
    	let sidebar;
    	let t1;
    	let div2;
    	let div1;
    	let intro;
    	let t2;
    	let experience;
    	let t3;
    	let projects;
    	let t4;
    	let education;
    	let t5;
    	let skills;
    	let t6;
    	let footer;
    	let current;
    	menubar = new MenuBar({ $$inline: true });
    	sidebar = new Sidebar({ $$inline: true });
    	intro = new Intro({ $$inline: true });
    	experience = new Experience({ $$inline: true });
    	projects = new Projects({ $$inline: true });
    	education = new Education({ $$inline: true });
    	skills = new Skills({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(menubar.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			div0 = element("div");
    			create_component(sidebar.$$.fragment);
    			t1 = space();
    			div2 = element("div");
    			div1 = element("div");
    			create_component(intro.$$.fragment);
    			t2 = space();
    			create_component(experience.$$.fragment);
    			t3 = space();
    			create_component(projects.$$.fragment);
    			t4 = space();
    			create_component(education.$$.fragment);
    			t5 = space();
    			create_component(skills.$$.fragment);
    			t6 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(div0, "class", "sidebar-section");
    			add_location(div0, file$l, 15, 8, 573);
    			attr_dev(div1, "class", "info-section-inner");
    			add_location(div1, file$l, 19, 12, 693);
    			attr_dev(div2, "class", "info-section-main");
    			add_location(div2, file$l, 18, 8, 649);
    			attr_dev(div3, "class", "grid-container");
    			add_location(div3, file$l, 14, 4, 536);
    		},
    		m: function mount(target, anchor) {
    			mount_component(menubar, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			mount_component(sidebar, div0, null);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			mount_component(intro, div1, null);
    			append_dev(div1, t2);
    			mount_component(experience, div1, null);
    			append_dev(div1, t3);
    			mount_component(projects, div1, null);
    			append_dev(div1, t4);
    			mount_component(education, div1, null);
    			append_dev(div1, t5);
    			mount_component(skills, div1, null);
    			append_dev(div2, t6);
    			mount_component(footer, div2, null);
    			current = true;
    		},
    		i: function intro$1(local) {
    			if (current) return;
    			transition_in(menubar.$$.fragment, local);
    			transition_in(sidebar.$$.fragment, local);
    			transition_in(intro.$$.fragment, local);
    			transition_in(experience.$$.fragment, local);
    			transition_in(projects.$$.fragment, local);
    			transition_in(education.$$.fragment, local);
    			transition_in(skills.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menubar.$$.fragment, local);
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(intro.$$.fragment, local);
    			transition_out(experience.$$.fragment, local);
    			transition_out(projects.$$.fragment, local);
    			transition_out(education.$$.fragment, local);
    			transition_out(skills.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(menubar, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			destroy_component(sidebar);
    			destroy_component(intro);
    			destroy_component(experience);
    			destroy_component(projects);
    			destroy_component(education);
    			destroy_component(skills);
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$8.name,
    		type: "slot",
    		source: "(13:0) <Modal>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$l(ctx) {
    	let modal;
    	let current;

    	modal = new Modal({
    			props: {
    				$$slots: { default: [create_default_slot$8] },
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

    			if (dirty & /*$$scope*/ 1) {
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
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props, $$invalidate) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		MenuBar,
    		Sidebar,
    		Intro,
    		Experience,
    		Projects,
    		Education,
    		Skills,
    		Footer,
    		Modal
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$l, create_fragment$l, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$l.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
