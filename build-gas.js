import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distAssetsDir = path.join(__dirname, 'dist', 'assets');
const targetHtmlPath = path.join(__dirname, '..', 'Turniej.html');

if (!fs.existsSync(distAssetsDir)) {
  console.error('Błąd: Katalog dist/assets nie istnieje. Uruchom najpierw vite build.');
  process.exit(1);
}

const files = fs.readdirSync(distAssetsDir);
const cssFile = files.find(f => f.endsWith('.css'));
const jsFile = files.find(f => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('Błąd: Nie znaleziono plików .css lub .js w dist/assets.');
  process.exit(1);
}

const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8');
let jsContent = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf8');

// Bezpieczne zabezpieczenie przed tagami script w kodzie JS wstrzykiwanym do HTML
jsContent = jsContent.replace(/<\/script/gi, '<\\/script').replace(/<script/gi, '<\\script');

const htmlOutput = `<!-- ======================================================== -->
<!-- MODUŁ TURNIEJ 2.0 (AUTOMATYCZNIE WYGENEROWANY Z turniej-app) -->
<!-- ======================================================== -->
<div id="turniej-root" class="max-w-5xl mx-auto w-full flex-grow flex flex-col">
  <div id="root"></div>
</div>

<style>
/* TURNIEJ 2.0 STYLES */
${cssContent}
</style>

<script type="module">
/* TURNIEJ 2.0 APPLICATION BUNDLE */
${jsContent}
</script>
`;

fs.writeFileSync(targetHtmlPath, htmlOutput, 'utf8');
console.log(`Pomyślnie wygenerowano plik: ${targetHtmlPath} (${(Buffer.byteLength(htmlOutput, 'utf8') / 1024).toFixed(1)} KB)`);

