import fs from "node:fs";
import path from "node:path";

const siteDir = path.resolve(process.cwd());
const htmlFiles = fs
  .readdirSync(siteDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => entry.name)
  .sort();

const analyticsScript = '<script src="analytics.js"></script>';
const noscriptMarker = 'https://mc.yandex.ru/watch/110061757';

const problems = [];

for (const file of htmlFiles) {
  const fullPath = path.join(siteDir, file);
  const content = fs.readFileSync(fullPath, "utf8");

  if (!content.includes(analyticsScript)) {
    problems.push(`${file}: missing ${analyticsScript}`);
  }

  if (!content.includes(noscriptMarker)) {
    problems.push(`${file}: missing Yandex Metrika noscript image`);
  }
}

if (problems.length) {
  console.error("Yandex Metrika check failed:\n");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Yandex Metrika check passed for ${htmlFiles.length} HTML files.`);
