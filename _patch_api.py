from pathlib import Path
import re

p = Path(r"d:\Software Development\Sakil bhai project\frontend\src\api.ts")
text = p.read_text(encoding="utf-8")

# Replace API_BASE / apiUrl block with re-export + apiFetch import
text2 = re.sub(
    r"/\*\*.*?Set VITE_API_BASE_URL.*?\*/\s*"
    r"const API_BASE = String\(import\.meta\.env\.VITE_API_BASE_URL \|\| ''\)\.replace\(/\\\/\$/, ''\);\s*"
    r"export function apiUrl\(path: string\): string \{.*?\n\}\n",
    "import { apiFetch, apiUrl } from './apiClient';\nexport { apiUrl } from './apiClient';\n\n",
    text,
    count=1,
    flags=re.S,
)

if text2 == text:
    # fallback: simpler line-based
    lines = text.splitlines(True)
    out = []
    i = 0
    skipped = False
    while i < len(lines):
        line = lines[i]
        if (not skipped) and ("VITE_API_BASE_URL" in line or line.startswith("const API_BASE")):
            # skip until end of apiUrl function
            while i < len(lines) and not (
                lines[i].startswith("export function apiUrl") or "export function apiUrl" in lines[i]
            ):
                i += 1
            # skip function body
            if i < len(lines) and "export function apiUrl" in lines[i]:
                i += 1
                while i < len(lines) and lines[i].strip() != "}":
                    i += 1
                if i < len(lines):
                    i += 1  # closing brace
                if i < len(lines) and lines[i].strip() == "":
                    i += 1
            out.append("import { apiFetch, apiUrl } from './apiClient';\n")
            out.append("export { apiUrl } from './apiClient';\n\n")
            skipped = True
            continue
        out.append(line)
        i += 1
    text2 = "".join(out)

# Replace fetch(apiUrl(...)) with apiFetch(...)
text2 = re.sub(r"fetch\(apiUrl\(([^)]+)\)\)", r"apiFetch(\1)", text2)
text2 = re.sub(
    r"fetch\(apiUrl\(([^)]+)\),\s*\{",
    r"apiFetch(\1, {",
    text2,
)

p.write_text(text2, encoding="utf-8")
print("done", "apiFetch count", text2.count("apiFetch("), "fetch left", text2.count("fetch("))
