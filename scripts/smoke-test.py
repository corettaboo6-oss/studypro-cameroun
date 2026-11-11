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
required = {"programme", "cours", "videos", "evaluation", "sources", "courseGrid", "lessonReader", "quiz", "abonnements", "billingStatus", "revenuePanel"}
missing = required - page.ids
assert not missing, f"Sections/éléments manquants : {sorted(missing)}"

for src in page.scripts:
    # Les scripts hébergés sur un CDN sont externes; seuls les scripts locaux
    # doivent exister dans le dépôt. Les chemins /... sont relatifs au site.
    if src.startswith(("https://", "http://")):
        continue
    local_src = src.split("?", 1)[0].split("#", 1)[0].lstrip("/")
    assert local_src and (ROOT / local_src).is_file(), f"Script référencé introuvable : {src}"

for required_file in ("collective.js", "api/config.js", "api/leaderboard.js", "api/payments.js", "api/payment-webhook.js", "api/premium-content.js", "api/cinetpay-verification.js", "supabase/schema.sql", "supabase/monetization.sql", "README-CLASSEMENT.md", "README-MONETISATION.md", "package.json"):
    assert (ROOT / required_file).is_file(), f"Fichier du classement collectif absent : {required_file}"

for filename in ("api/config.js", "courses.js", "premium-content-client.js", "lessons-year1.js", "lessons-year2.js", "lessons-year3.js", "dashboard-v2.js", "billing-auth.js", "collective.js", "api/chat.js", "api/leaderboard.js", "api/payments.js", "api/payment-webhook.js", "api/premium-content.js", "api/cinetpay-verification.js", "scripts/import-private-content.mjs"):
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
assert "premium-content-client.js" in html, "Client de contenus privés non chargé"
assert "data-buy-plan" in html and "premium_plus" in html, "Offres Premium absentes"
assert "fetch('/api/config'" in (ROOT / "billing-auth.js").read_text(encoding="utf-8"), "Configuration Supabase runtime absente"
assert "getAccessToken" in (ROOT / "billing-auth.js").read_text(encoding="utf-8"), "Session Supabase non partagée avec le paiement"
assert "studypro_subscriptions" in (ROOT / "api/payments.js").read_text(encoding="utf-8"), "Lecture serveur des abonnements absente"
assert "1 500 FCFA" in html and "3 000 FCFA" in html, "Tarifs Premium attendus absents"
assert "2 000 FCFA" not in html and "3 500 FCFA" not in html, "Anciens tarifs encore présents"
assert "CINETPAY_API_KEY_CM" in (ROOT / "api/payments.js").read_text(encoding="utf-8"), "Configuration CinetPay côté serveur absente"
assert "verifyCinetPayPayment" in (ROOT / "api/payments.js").read_text(encoding="utf-8"), "Vérification CinetPay stricte absente"
assert "verifyCinetPayPayment" in (ROOT / "api/payment-webhook.js").read_text(encoding="utf-8"), "Vérification stricte du webhook absente"
assert "status.amount" in (ROOT / "api/cinetpay-verification.js").read_text(encoding="utf-8"), "Contrôle du montant brut CinetPay absent"
assert "status.currency" in (ROOT / "api/cinetpay-verification.js").read_text(encoding="utf-8"), "Contrôle de la devise brute CinetPay absent"
assert "verifyNotification" in (ROOT / "api/payment-webhook.js").read_text(encoding="utf-8"), "Vérification du webhook CinetPay absente"
assert "studypro_activate_subscription" in (ROOT / "supabase/monetization.sql").read_text(encoding="utf-8"), "Activation idempotente des abonnements absente"
assert "SUPABASE_SERVICE_ROLE_KEY" in (ROOT / "api/payments.js").read_text(encoding="utf-8"), "Clé serveur Supabase absente du backend"
assert "STUDYPRO_ADMIN_EMAILS" in (ROOT / "api/payments.js").read_text(encoding="utf-8"), "Protection du tableau de bord administrateur absente"
assert "function siteOrigin()" in (ROOT / "api/payments.js").read_text(encoding="utf-8"), "Origine HTTPS autorisée non configurée côté serveur"
assert 'if (activated.status === "SUCCESS")' in (ROOT / "api/payments.js").read_text(encoding="utf-8"), "Un paiement SUCCESS incohérent doit être refusé"
assert 'Provider amount, currency or transaction verification mismatch' in (ROOT / "api/payment-webhook.js").read_text(encoding="utf-8"), "Un webhook avec montant/devise incohérents doit être refusé"


lesson2 = (ROOT / "lessons-year2.js").read_text(encoding="utf-8")
assert 'course:"Anesthésiologie et surveillance"' in lesson2, "Module détaillé d'anesthésiologie absent"
assert lesson2.count('{title:"') >= 22, "Leçons de deuxième année incomplètes"
course_source = (ROOT / "courses.js").read_text(encoding="utf-8")
course_lines = [line for line in course_source.splitlines() if line.startswith("{year:")]
course_titles = [re.search(r'title:"([^"]+)"', line).group(1) for line in course_lines]
quiz_titles = [re.search(r'title:"([^"]+)"', line).group(1) for line in course_lines if "quiz:[" in line]
assert len(course_titles) == 19, f"Nombre de matières inattendu : {len(course_titles)}"
assert len(quiz_titles) == 19, f"Chaque matière doit disposer d'un QCM, trouvé : {len(quiz_titles)}"
assert set(course_titles) == set(quiz_titles), "Chaque matière doit disposer d'un QCM"
assert "Offre de formation BTS" in (ROOT / "SOURCES-PEDAGOGIQUES.md").read_text(encoding="utf-8"), "Référence MINESUP absente"

print("STUDYPRO smoke tests: OK")
