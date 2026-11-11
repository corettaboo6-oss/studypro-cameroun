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

for filename in ("courses.js", "lessons-year1.js", "lessons-year2.js", "lessons-year3.js", "dashboard-v2.js"):
    subprocess.run(["node", "--check", str(ROOT / filename)], check=True)

# Vérifie aussi la syntaxe du JavaScript embarqué dans la page.
inline_scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, flags=re.I | re.S)
assert inline_scripts, "Aucun script JavaScript embarqué trouvé"
for script in inline_scripts:
    if not script.strip():
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as tmp:
        tmp.write(script)
        tmp.flush()
        subprocess.run(["node", "--check", tmp.name], check=True)

years = {int(y) for y in re.findall(r"\{year:(\d+),", (ROOT / "courses.js").read_text(encoding="utf-8"))}
assert years == {1, 2, 3}, f"Années IDE attendues 1, 2 et 3, trouvées : {years}"
assert "studypro:rewards-updated" in html, "Événement de mise à jour des récompenses absent"
assert "Array.isArray(raw.completed)" in html and "Array.isArray(raw.quizDone)" in html, "Validation des données locales de récompenses absente"
assert "localStorage.setItem('studyproRewards'" in html, "Sauvegarde des récompenses absente"
assert "dashboard-v2-title" in (ROOT / "dashboard-v2.js").read_text(encoding="utf-8")
for year in (1, 2, 3):
    lesson_source = (ROOT / f"lessons-year{year}.js").read_text(encoding="utf-8")
    assert f"window.LESSONS_Y{year}" in lesson_source, f"Leçons de l’année {year} absentes"
assert "lessonLibrary[course.year]" in html, "Le chargement des leçons par année est absent"
assert "lessons-year2.js" in html and "lessons-year3.js" in html, "Scripts des années 2 et 3 non chargés"


lesson2 = (ROOT / "lessons-year2.js").read_text(encoding="utf-8")
assert 'course:"Anesthésiologie et surveillance"' in lesson2, "Module détaillé d'anesthésiologie absent"
assert lesson2.count('{title:"') >= 22, "Leçons de deuxième année incomplètes"
course_source = (ROOT / "courses.js").read_text(encoding="utf-8")
course_titles = re.findall(r'\{year:(\d+),domain:"[^"]+",title:"([^"]+)"', course_source)
quiz_titles = re.findall(r'\{year:\d+,domain:"[^"]+",title:"([^"]+)"[^\n]*quiz:\[', course_source)
assert len(course_titles) == 19, f"Nombre de matières inattendu : {len(course_titles)}"
assert len(quiz_titles) == 19, f"Chaque matière doit disposer d'un QCM, trouvé : {len(quiz_titles)}"
assert {title for _, title in course_titles} == set(quiz_titles), "Chaque matière doit disposer d'un QCM"
assert "Offre de formation BTS" in (ROOT / "SOURCES-PEDAGOGIQUES.md").read_text(encoding="utf-8"), "Référence MINESUP absente"

print("STUDYPRO smoke tests: OK")
