const fs = require("fs");
const path = require("path");

const directory = "./"; // Proje kökü
const validExtensions = [".js", ".ts", ".jsx", ".tsx"];

function fixCatchBlocksInFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const fixedContent = content.replace(/catch\s*{/g, "catch (e) {");

  if (content !== fixedContent) {
    fs.writeFileSync(filePath, fixedContent, "utf8");
    console.log(`✔️ Düzenlendi: ${filePath}`);
  }
}

function walk(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath); // klasörse içine gir
    } else if (validExtensions.includes(path.extname(fullPath))) {
      fixCatchBlocksInFile(fullPath);
    }
  });
}

walk(directory);
console.log("🔧 Tüm catch blokları kontrol edildi ve düzeltildi.");
