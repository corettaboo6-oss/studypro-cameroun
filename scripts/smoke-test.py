from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "index.html").read_text(encoding="utf-8")

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])

page = Page()
page.feed(html)
required = {"programme", "cours", "videos", "evaluation", "sources", "courseGrid", "lessonReader", "quiz"}
missing = required - page.ids
assert not missing, f"Sections/éléments manquants : {sorted(missing)}"

for src in page.scripts:
    assert (ROOT / src).is_file(), f"Script référencé introuvable : {src}"

for filename in ("courses.js", "lessons-year1.js", "dashboard-v2.js"):
    subprocess.run(["node", "--check", str(ROOT / filename)], check=True)

# Vérifie aussi la syntaxe du JavaScript embarqué dans la page.
inline_scripts = re.findall(r"<script(?:\\s[^>]*)?>(.*?)</script>", html, flags=re.I | re.S)
assert inline_scripts, "Aucun script JavaScript embarqué trouvé"
for script in inline_scripts:
    if not script.strip():
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as tmp:
        tmp.write(script)
        tmp.flush()
        subprocess.run(["node", "--check", tmp.name], check=True)

years = {int(y) for y in re.findall(r"\\{year:(\\d+),", (ROOT / "courses.js").read_text(encoding="utf-8"))}
assert years == {1, 2, 3}, f"Années IDE attendues 1, 2 et 3, trouvées : {years}"
assert "studypro:rewards-updated" in html, "Événement de mise à jour des récompenses absent"
assert "dashboard-v2-title" in (ROOT / "dashboard-v2.js").read_text(encoding="utf-8")

print("STUDYPRO smoke tests: OK")
