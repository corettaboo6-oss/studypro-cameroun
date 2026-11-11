import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function slugify(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function parseLessonLibrary(source, year) {
  if (![1, 2, 3].includes(Number(year))) throw new Error("Année IDE invalide.");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { timeout: 1000 });
  const lessons = sandbox.window["LESSONS_Y" + year];
  if (!Array.isArray(lessons) || lessons.length === 0) throw new Error("Bibliothèque de leçons absente pour l'année " + year + ".");
  return lessons.map(course => {
    if (!course || typeof course.course !== "string" || !course.course.trim() ||
        !Array.isArray(course.lessons) || course.lessons.length === 0) {
      throw new Error("Entrée de cours invalide pour l'année " + year + ".");
    }
    return {
      content_key: "lesson:" + year + ":" + slugify(course.course),
      title: course.course.trim(),
      required_plan: "premium",
      body: { kind: "lesson_course", year: Number(year), course: course.course.trim(), lessons: course.lessons },
      published: true
    };
  });
}

export function parseMockExams(source) {
  const parsed = JSON.parse(source);
  if (!Array.isArray(parsed)) throw new Error("Le fichier des examens blancs doit contenir un tableau JSON.");
  return parsed.map((exam, index) => {
    if (!exam || typeof exam !== "object" || !Array.isArray(exam.questions) || exam.questions.length === 0) {
      throw new Error("Examen blanc invalide à la position " + index + ".");
    }
    const id = slugify(exam.id || exam.title || "examen-" + (index + 1));
    return {
      content_key: "exam:" + id,
      title: String(exam.title || "Examen blanc " + (index + 1)),
      required_plan: "premium_plus",
      body: { ...exam, kind: "exam" },
      published: true
    };
  });
}

async function upsertRows(rows) {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Définis SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement local.");
  const response = await fetch(url + "/rest/v1/studypro_premium_content?on_conflict=content_key", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error("Import Supabase impossible (" + response.status + "): " + (await response.text()).slice(0, 500));
}

async function main() {
  if (!process.argv.includes("--apply")) {
    throw new Error("Aucune donnée envoyée. Relance avec --apply après avoir exécuté supabase/monetization.sql.");
  }
  const rows = [];
  for (const year of [1, 2, 3]) {
    const source = await readFile(path.join(ROOT, "lessons-year" + year + ".js"), "utf8");
    rows.push(...parseLessonLibrary(source, year));
  }
  const examPath = path.join(ROOT, "private-content-source", "mock-exams.json");
  try { rows.push(...parseMockExams(await readFile(examPath, "utf8"))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!rows.length) throw new Error("Aucun contenu à importer.");
  await upsertRows(rows);
  console.log("Import terminé :", rows.length, "contenus privés publiés.");
  console.log("Les fichiers sources de leçons doivent rester hors du répertoire public après vérification de l'import.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
