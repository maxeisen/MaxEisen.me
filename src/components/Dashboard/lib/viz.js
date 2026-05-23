// Aurora-style WebGL visualizer driven by track features + album palette.
//
// makeViz(canvas) compiles the program for a single canvas and returns a
// renderer + resize closure. paletteForVibe + extractAlbumPalette compute
// colours; vibeFromTrack maps genre/track-id to motion params.

export const VIZ_VERTEX = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;
export const VIZ_FRAGMENT = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_energy;
    uniform float u_valence;
    uniform float u_tempo;
    uniform float u_dance;
    uniform vec3 u_c1;
    uniform vec3 u_c2;
    uniform vec3 u_c3;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = p * 2.05 + vec2(0.7, 1.3);
            a *= 0.55;
        }
        return v;
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / u_res.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_res.x / u_res.y;

        float t = u_time * (0.07 + u_tempo * 0.0008);

        float n1 = fbm(p * (1.1 + u_energy * 0.3) + vec2(t * 0.35, t * 0.22));
        float n2 = fbm(p * (1.7 + u_dance * 0.3) + vec2(-t * 0.20, t * 0.40));
        float n3 = fbm(p * 0.6 - vec2(t * 0.12, t * 0.08));

        float blend = smoothstep(0.25, 0.85, n1);
        vec3 col = mix(u_c1, u_c2, blend);
        col = mix(col, u_c3, smoothstep(0.3, 0.9, n2 * (0.5 + u_energy * 0.4)));
        col *= 0.72 + n3 * 0.4;
        col *= 0.97 + 0.03 * sin(u_time * 0.18);

        gl_FragColor = vec4(col, 1.0);
    }
`;

function compileShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error("shader compile error:", gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

export function makeViz(canvas) {
	const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: true });
	if (!gl) return null;
	const vs = compileShader(gl, gl.VERTEX_SHADER, VIZ_VERTEX);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, VIZ_FRAGMENT);
	const prog = gl.createProgram();
	gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		console.error("shader link error:", gl.getProgramInfoLog(prog));
		return null;
	}
	gl.useProgram(prog);

	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
	const aPos = gl.getAttribLocation(prog, "a_pos");
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

	const uniforms = {
		res: gl.getUniformLocation(prog, "u_res"),
		time: gl.getUniformLocation(prog, "u_time"),
		energy: gl.getUniformLocation(prog, "u_energy"),
		valence: gl.getUniformLocation(prog, "u_valence"),
		tempo: gl.getUniformLocation(prog, "u_tempo"),
		dance: gl.getUniformLocation(prog, "u_dance"),
		c1: gl.getUniformLocation(prog, "u_c1"),
		c2: gl.getUniformLocation(prog, "u_c2"),
		c3: gl.getUniformLocation(prog, "u_c3"),
	};

	const resize = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = canvas.clientWidth * dpr;
		const h = canvas.clientHeight * dpr;
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w; canvas.height = h;
			gl.viewport(0, 0, w, h);
		}
	};

	return { gl, uniforms, resize };
}

export function drawViz(viz, params, startTime) {
	if (!viz || !params) return;
	viz.resize();
	const { gl, uniforms } = viz;
	const time = (performance.now() - startTime) / 1000;
	gl.uniform2f(uniforms.res, gl.canvas.width, gl.canvas.height);
	gl.uniform1f(uniforms.time, time);
	gl.uniform1f(uniforms.energy, params.energy);
	gl.uniform1f(uniforms.valence, params.valence);
	gl.uniform1f(uniforms.tempo, params.tempo);
	gl.uniform1f(uniforms.dance, params.dance);
	gl.uniform3fv(uniforms.c1, params.c1);
	gl.uniform3fv(uniforms.c2, params.c2);
	gl.uniform3fv(uniforms.c3, params.c3);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// HSL → RGB for shader uniforms (returns [r,g,b] in 0..1)
export function hsl(h, s, l) {
	h = ((h % 360) + 360) % 360 / 360;
	s = Math.max(0, Math.min(1, s));
	l = Math.max(0, Math.min(1, l));
	const a = s * Math.min(l, 1 - l);
	const f = (n) => {
		const k = (n + h * 12) % 12;
		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [f(0), f(8), f(4)];
}

function strHash01(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return ((h >>> 0) % 10000) / 10000;
}

const GENRE_VIBE = [
	[/\b(metal|hardcore|punk|industrial)\b/, { valence: 0.25, energy: 0.95, tempo: 165, dance: 0.45 }],
	[/\b(rock|grunge|alt)\b/, { valence: 0.5, energy: 0.7, tempo: 120, dance: 0.5 }],
	[/\b(pop|indie pop)\b/, { valence: 0.7, energy: 0.65, tempo: 118, dance: 0.65 }],
	[/\b(hip hop|rap|trap|drill)\b/, { valence: 0.55, energy: 0.7, tempo: 95, dance: 0.85 }],
	[/\b(electronic|house|techno|edm|trance)\b/, { valence: 0.6, energy: 0.85, tempo: 128, dance: 0.9 }],
	[/\b(jazz|blues|soul)\b/, { valence: 0.55, energy: 0.4, tempo: 100, dance: 0.5 }],
	[/\b(classical|baroque|orchestra|piano)\b/, { valence: 0.45, energy: 0.3, tempo: 90, dance: 0.2 }],
	[/\b(ambient|drone|chill|lofi)\b/, { valence: 0.5, energy: 0.25, tempo: 80, dance: 0.3 }],
	[/\b(country|folk|americana)\b/, { valence: 0.6, energy: 0.45, tempo: 110, dance: 0.45 }],
	[/\b(latin|reggaeton|salsa|samba)\b/, { valence: 0.8, energy: 0.75, tempo: 96, dance: 0.85 }],
	[/\b(r&b|funk|disco)\b/, { valence: 0.7, energy: 0.65, tempo: 110, dance: 0.8 }],
];

export function vibeFromTrack(data) {
	if (data?.genre) {
		const g = data.genre.toLowerCase();
		for (const [pattern, vibe] of GENRE_VIBE) {
			if (pattern.test(g)) return { ...vibe, source: "genre" };
		}
	}
	const seed = strHash01((data?.id || data?.track || "default") + (data?.artist || ""));
	return {
		valence: seed,
		energy: ((seed * 7) % 1),
		tempo: 80 + Math.floor(((seed * 11) % 1) * 80),
		dance: ((seed * 13) % 1),
		source: "hash",
	};
}

export function paletteForVibe(vibe) {
	const baseHue = 240 - vibe.valence * 200;
	const sat = 0.45 + vibe.energy * 0.45;
	const lt = 0.35 + vibe.energy * 0.25;
	return {
		c1: hsl(baseHue, sat, lt),
		c2: hsl(baseHue + 35, sat * 0.9, lt + 0.1),
		c3: hsl(baseHue - 50, sat, lt + 0.18),
	};
}

function rgbToHsl(r, g, b) {
	r /= 255; g /= 255; b /= 255;
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
	let h = 0, s = 0;
	const l = (mx + mn) / 2;
	if (mx !== mn) {
		const d = mx - mn;
		s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
		if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
		else if (mx === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h /= 6;
	}
	return [h, s, l];
}

function loadCorsImage(url) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = url;
	});
}

function sampleAlbumPalette(img) {
	const SIZE = 64;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE; canvas.height = SIZE;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.drawImage(img, 0, 0, SIZE, SIZE);
	let data;
	try {
		data = ctx.getImageData(0, 0, SIZE, SIZE).data;
	} catch {
		return null;
	}

	const bins = new Map();
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i], g = data[i + 1], b = data[i + 2];
		const [h, s, l] = rgbToHsl(r, g, b);
		if (l < 0.08 || l > 0.92) continue;
		if (s < 0.12) continue;
		const hueBin = Math.floor(h * 18);
		const lBin = Math.floor(l * 4);
		const key = `${hueBin}_${lBin}`;
		const slot = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
		slot.count++; slot.r += r; slot.g += g; slot.b += b;
		bins.set(key, slot);
	}

	if (bins.size === 0) return null;
	const sorted = [...bins.values()].sort((a, b) => b.count - a.count);
	const palette = sorted.slice(0, 3).map((b) => [
		(b.r / b.count) / 255,
		(b.g / b.count) / 255,
		(b.b / b.count) / 255,
	]);

	while (palette.length < 3) {
		const [r, g, b] = palette[0] || [0.5, 0.45, 0.4];
		const [h, s, l] = rgbToHsl(r * 255, g * 255, b * 255);
		const newH = ((h * 360 + 35 * palette.length) % 360);
		palette.push(hsl(newH, Math.max(0.45, s), Math.min(0.7, l + 0.05)));
	}
	return palette;
}

const albumPaletteCache = new Map();

export async function extractAlbumPalette(imageUrl, trackId) {
	const cacheKey = trackId || imageUrl;
	if (albumPaletteCache.has(cacheKey)) return albumPaletteCache.get(cacheKey);
	try {
		const img = await loadCorsImage(imageUrl);
		const palette = sampleAlbumPalette(img);
		if (palette) albumPaletteCache.set(cacheKey, palette);
		return palette;
	} catch {
		return null;
	}
}
