import { PKPass } from "passkit-generator";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const functionDir = path.dirname(fileURLToPath(import.meta.url));

const PASS_BG_COLOR = "#363636";
const PASS_FG_COLOR = "#FFFFFF";
const PASS_LABEL_COLOR = "#B0B0B0";

/** SVG for a rounded-rectangle mask (opaque inside, transparent outside). Used with composite blend dest-in. */
function roundedRectSvg(width, height, radius) {
	const r = Math.min(radius, width / 2, height / 2);
	return Buffer.from(
		`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" ry="${r}" fill="white"/></svg>`
	);
}

/** Build background image: dark gray with QR composited at bottom. Returns { bg1x, bg2x } buffers. */
async function buildPassBackground() {
	const qrPath = path.join(functionDir, "assets", "qr-code.png");
	if (!fs.existsSync(qrPath)) {
		throw new Error("QR asset not found at " + qrPath);
	}
	const qrBuffer = await sharp(qrPath)
		.resize(120, 120, { fit: "contain" })
		.toBuffer();
	const qr2xBuffer = await sharp(qrPath)
		.resize(240, 240, { fit: "contain" })
		.toBuffer();

	// Apple pass background sizes: 180x220 @1x, 360x440 @2x (points → pixels)
	const w1 = 180,
		h1 = 220;
	const w2 = 360,
		h2 = 440;
	const padding = 12;
	const qrW1 = 120,
		qrH1 = 120;
	const qrW2 = 240,
		qrH2 = 240;
	const left1 = Math.round((w1 - qrW1) / 2);
	const top1 = h1 - qrH1 - padding;
	const left2 = Math.round((w2 - qrW2) / 2);
	const top2 = h2 - qrH2 - padding;

	const bg1x = await sharp({
		create: {
			width: w1,
			height: h1,
			channels: 3,
			background: PASS_BG_COLOR,
		},
	})
		.composite([{ input: qrBuffer, left: left1, top: top1 }])
		.png()
		.toBuffer();

	const bg2x = await sharp({
		create: {
			width: w2,
			height: h2,
			channels: 3,
			background: PASS_BG_COLOR,
		},
	})
		.composite([{ input: qr2xBuffer, left: left2, top: top2 }])
		.png()
		.toBuffer();

	return { bg1x, bg2x };
}

/** Load Wealthsimple logo as square with rounded corners (50×50 @1x, 100×100 @2x, 150×150 @3x). */
async function buildLogoBuffers() {
	const logoPath = path.join(functionDir, "assets", "wealthsimple-logo.png");
	if (!fs.existsSync(logoPath)) {
		throw new Error("Logo asset not found at " + logoPath);
	}
	const roundedLogo = (size, radius) =>
		sharp(logoPath)
			.resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
			.composite([{ input: roundedRectSvg(size, size, radius), blend: "dest-in" }])
			.flatten({ background: { r: 255, g: 255, b: 255 } })
			.png()
			.toBuffer();
	const logoPng = await roundedLogo(50, 8);
	const logo2xPng = await roundedLogo(100, 14);
	const logo3xPng = await roundedLogo(150, 20);
	return { logoPng, logo2xPng, logo3xPng };
}

function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export default async function handler(req) {
	if (req.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}

	const passwordHeader = req.headers.get("X-Pass-Generator-Password");
	const expectedPassword = getEnv("PASS_GENERATOR_PASSWORD");
	if (!expectedPassword) {
		console.error("PASS_GENERATOR_PASSWORD env var is not set");
		return jsonResponse({ error: "Unauthorized" }, 401);
	}
	if (passwordHeader !== expectedPassword) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	let body;
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	const { name, title, email, photoUrl } = body;
	const trimmedName = typeof name === "string" ? name.trim() : "";
	const trimmedTitle = typeof title === "string" ? title.trim() : "";
	const trimmedEmail = typeof email === "string" ? email.trim() : "";
	const trimmedPhotoUrl = typeof photoUrl === "string" ? photoUrl.trim() : "";

	if (!trimmedName) {
		return jsonResponse({ error: "Name is required." }, 400);
	}
	if (!trimmedTitle) {
		return jsonResponse({ error: "Title is required." }, 400);
	}
	if (!trimmedPhotoUrl) {
		return jsonResponse({ error: "Photo URL is required." }, 400);
	}

	let thumbnailPng;
	let thumbnail2xPng;
	let thumbnail3xPng;
	let iconPng;
	let icon2xPng;
	let icon3xPng;
	try {
		const imageRes = await fetch(trimmedPhotoUrl, { redirect: "follow" });
		if (!imageRes.ok) {
			return jsonResponse({ error: "Couldn't load photo from that URL." }, 400);
		}
		const arrayBuffer = await imageRes.arrayBuffer();
		const inputBuffer = Buffer.from(arrayBuffer);
		// Thumbnail/icon: center-crop, rounded corners, opaque PNG
		const radiusPx = (w) => Math.max(4, Math.floor(w * 0.14)); // ~14% radius
		const toRoundedOpaquePng = (w, h) => {
			const r = radiusPx(w);
			return sharp(inputBuffer)
				.resize(w, h, { fit: "cover", position: "center" })
				.flatten({ background: { r: 255, g: 255, b: 255 } })
				.composite([{ input: roundedRectSvg(w, h, r), blend: "dest-in" }])
				.flatten({ background: { r: 54, g: 54, b: 54 } })
				.png({ compressionLevel: 6, palette: false })
				.toBuffer();
		};
		thumbnailPng = await toRoundedOpaquePng(90, 90);
		thumbnail2xPng = await toRoundedOpaquePng(180, 180);
		thumbnail3xPng = await toRoundedOpaquePng(270, 270);
		iconPng = await toRoundedOpaquePng(29, 29);
		icon2xPng = await toRoundedOpaquePng(58, 58);
		icon3xPng = await toRoundedOpaquePng(87, 87);
		// passkit-generator skips empty buffers; ensure we have valid data
		if (!thumbnailPng?.length || !iconPng?.length) {
			return jsonResponse({ error: "Couldn't process photo from that URL." }, 400);
		}
	} catch (err) {
		console.error("Photo fetch/process error:", err);
		return jsonResponse({ error: "Couldn't load photo from that URL." }, 400);
	}

	const passTypeId = getEnv("PASSKIT_PASS_TYPE_ID");
	const teamId = getEnv("PASSKIT_TEAM_ID");
	const orgName = getEnv("PASSKIT_ORGANIZATION_NAME");
	let signerCert = getEnv("PASSKIT_SIGNER_CERT");
	let signerKey = getEnv("PASSKIT_SIGNER_KEY");
	const signerKeyPassphrase = getEnv("PASSKIT_SIGNER_KEY_PASSPHRASE") || undefined;
	let wwdrCert = getEnv("PASSKIT_WWDR_CERT");

	if (!passTypeId || !teamId || !orgName || !signerCert || !signerKey || !wwdrCert) {
		console.error("Missing passkit env: passTypeId, teamId, orgName, signerCert, signerKey, or wwdrCert");
		return jsonResponse({ error: "Something went wrong." }, 500);
	}

	// Normalize PEM from env: strip quotes, base64 decode if needed, fix literal \n, line endings
	function ensurePem(value) {
		if (!value || typeof value !== "string") return value;
		let s = value.trim();
		// Strip surrounding double quotes if env loader included them
		if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
		// Replace literal \n (e.g. from .env single-line paste) with real newlines
		s = s.replace(/\\n/g, "\n");
		s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		s = s.trim();
		if (s.startsWith("-----BEGIN")) return s;
		try {
			const decoded = Buffer.from(s, "base64").toString("utf8");
			if (decoded.startsWith("-----BEGIN")) return decoded.replace(/\\n/g, "\n").trim();
		} catch (_) {}
		return s;
	}
	signerCert = ensurePem(signerCert);
	signerKey = ensurePem(signerKey);
	wwdrCert = ensurePem(wwdrCert);

	const validKeyHeaders = ["-----BEGIN PRIVATE KEY-----", "-----BEGIN RSA PRIVATE KEY-----", "-----BEGIN ENCRYPTED PRIVATE KEY-----"];
	if (!validKeyHeaders.some((h) => signerKey.startsWith(h))) {
		const firstLine = signerKey.slice(0, 80);
		console.error("PASSKIT_SIGNER_KEY invalid header. Got:", firstLine);
		if (signerKey.includes("BEGIN CERTIFICATE")) {
			return jsonResponse({ error: "PASSKIT_SIGNER_KEY contains a certificate, not a private key. Put the private key (-----BEGIN ENCRYPTED PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----) in PASSKIT_SIGNER_KEY and the certificate (-----BEGIN CERTIFICATE-----) in PASSKIT_SIGNER_CERT. If your .env has multi-line values, check that each variable ends with its closing quote so values do not get mixed." }, 500);
		}
		if (signerKey.includes("EC PRIVATE KEY")) {
			return jsonResponse({ error: "Signer key is an EC key. Apple Pass signing needs an RSA private key. Re-export your Pass Type ID certificate as RSA (e.g. from Keychain: export as .p12, then: openssl pkcs12 -in file.p12 -nocerts -nodes -out key.pem)." }, 500);
		}
		return jsonResponse({ error: "Invalid signer key. Use PEM starting with -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----. In .env use real newlines or \\n for line breaks. See docs/plans/2025-02-24-pass-generator-design.md." }, 500);
	}

	try {
		const { logoPng, logo2xPng, logo3xPng } = await buildLogoBuffers();

		// Include thumbnail and icon in initial buffers so they're in the bundle from creation
		const initialBuffers = {
			"thumbnail.png": thumbnailPng,
			"thumbnail@2x.png": thumbnail2xPng,
			"thumbnail@3x.png": thumbnail3xPng,
			"icon.png": iconPng,
			"icon@2x.png": icon2xPng,
			"icon@3x.png": icon3xPng,
		};

		const pass = new PKPass(
			initialBuffers,
			{
				wwdr: wwdrCert,
				signerCert,
				signerKey,
				signerKeyPassphrase,
			},
			{
				passTypeIdentifier: passTypeId,
				teamIdentifier: teamId,
				organizationName: orgName,
				description: "Business card",
				serialNumber: crypto.randomUUID(),
				backgroundColor: PASS_BG_COLOR,
				foregroundColor: PASS_FG_COLOR,
				labelColor: PASS_LABEL_COLOR,
			}
		);

		// generic type often displays thumbnail more reliably than storeCard
		pass.type = "generic";
		pass.headerFields.push({
			key: "header1",
			label: "",
			value: "Digital Business Card",
			textAlignment: "PKTextAlignmentRight",
		});
		pass.primaryFields.push({
			key: "name",
			label: "NAME",
			value: trimmedName,
		});
		pass.secondaryFields.push({
			key: "title",
			label: "TITLE",
			value: trimmedTitle,
		});
		if (trimmedEmail) {
			pass.auxiliaryFields.push({
				key: "email",
				label: "EMAIL",
				value: trimmedEmail,
			});
		}

		// QR barcode (Wallet renders this sharply)
		pass.setBarcodes({
			format: "PKBarcodeFormatQR",
			message: "https://wealthsimple.com",
			altText: "wealthsimple.com",
		});

		// Logo at Apple's required dimensions (no custom background; Wallet often hides thumbnail when background.png is present)
		pass.addBuffer("logo.png", logoPng);
		pass.addBuffer("logo@2x.png", logo2xPng);
		pass.addBuffer("logo@3x.png", logo3xPng);

		const buffer = pass.getAsBuffer();

		return new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": "application/vnd.apple.pkpass",
				"Content-Disposition": 'attachment; filename="pass.pkpass"',
			},
		});
	} catch (err) {
		console.error("Pass generation error:", err);
		const msg = String(err?.message || err);
		if (msg.includes("private key") || msg.includes("PEM") || msg.includes("PRIVATE KEY")) {
			return jsonResponse({
				error: "Signer key invalid. Ensure PASSKIT_SIGNER_KEY is the full PEM (-----BEGIN ... / -----END ...). Use RSA format; in .env use real newlines or \\n. See docs/plans/2025-02-24-pass-generator-design.md.",
			}, 500);
		}
		return jsonResponse({ error: "Something went wrong." }, 500);
	}
}
