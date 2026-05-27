// Genera los iconos PWA de Valle OS desde el orbe de la marca.
// Uso: node scripts/gen-icons.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

// orb(scale): orbe centrado en lienzo 1024. scale = radio del anillo exterior.
function orb(ring) {
  const glow = Math.round(ring * 0.82);
  const core = Math.round(ring * 0.42);
  const tickIn = Math.round(ring * 1.13);
  const tickOut = Math.round(ring * 1.3);
  const sw = Math.max(8, Math.round(ring * 0.028));
  const C = 512;
  return `
    <circle cx="${C}" cy="${C}" r="${glow}" fill="url(#glow)"/>
    <circle cx="${C}" cy="${C}" r="${ring}" fill="none" stroke="#C9A35F" stroke-width="${sw}"/>
    <circle cx="${C}" cy="${C}" r="${core}" fill="url(#core)"/>
    <g stroke="#C9A35F" stroke-width="${sw}" stroke-linecap="round">
      <line x1="${C}" y1="${C - tickIn}" x2="${C}" y2="${C - tickOut}"/>
      <line x1="${C}" y1="${C + tickIn}" x2="${C}" y2="${C + tickOut}"/>
      <line x1="${C - tickIn}" y1="${C}" x2="${C - tickOut}" y2="${C}"/>
      <line x1="${C + tickIn}" y1="${C}" x2="${C + tickOut}" y2="${C}"/>
    </g>`;
}

function svg(ring, radius) {
  // radius: radio de esquinas redondeadas del fondo (0 = cuadrado).
  const bg = radius
    ? `<rect width="1024" height="1024" rx="${radius}" ry="${radius}" fill="#0B0B0E"/>`
    : `<rect width="1024" height="1024" fill="#0B0B0E"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <defs>
      <radialGradient id="glow" cx="50%" cy="42%" r="60%">
        <stop offset="0%" stop-color="#C9A35F" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="#C9A35F" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="core" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stop-color="#F5E6C4"/>
        <stop offset="45%" stop-color="#C9A35F"/>
        <stop offset="100%" stop-color="#8A6E3A"/>
      </radialGradient>
    </defs>
    ${bg}
    ${orb(ring)}
  </svg>`;
}

// "any" / apple: orbe a ~70% con esquinas redondeadas suaves
const standard = Buffer.from(svg(360, 180));
// maskable: orbe más chico (dentro de la zona segura del 80%), fondo a sangre
const maskable = Buffer.from(svg(270, 0));

async function run() {
  await sharp(standard).resize(192, 192).png().toFile(path.join(OUT, "icon-192.png"));
  await sharp(standard).resize(512, 512).png().toFile(path.join(OUT, "icon-512.png"));
  await sharp(maskable).resize(192, 192).png().toFile(path.join(OUT, "icon-maskable-192.png"));
  await sharp(maskable).resize(512, 512).png().toFile(path.join(OUT, "icon-maskable-512.png"));
  await sharp(standard).resize(180, 180).png().toFile(path.join(OUT, "apple-touch-icon.png"));
  console.log("Iconos generados en public/icons/");
}

run();
