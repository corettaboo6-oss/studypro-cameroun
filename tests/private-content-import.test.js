import test from "node:test";
import assert from "node:assert/strict";
import { parseLessonLibrary, parseMockExams, slugify } from "../scripts/import-private-content.mjs";

test("slugify produit une clé stable sans accents", () => {
  assert.equal(slugify("Anatomie et physiologie générales"), "anatomie-et-physiologie-generales");
});

test("les leçons IDE sont transformées en contenus Premium", () => {
  const rows = parseLessonLibrary(
    'window.LESSONS_Y1 = [{course:"Anatomie",lessons:[{title:"Cellule"}]}];', 1
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].required_plan, "premium");
  assert.equal(rows[0].body.year, 1);
  assert.equal(rows[0].body.lessons[0].title, "Cellule");
  assert.equal(rows[0].published, true);
});

test("refuse une bibliothèque vide ou une année invalide", () => {
  assert.throws(() => parseLessonLibrary("window.LESSONS_Y1=[];", 1), /absente/);
  assert.throws(() => parseLessonLibrary("window.LESSONS_Y4=[];", 4), /invalide/);
});

test("les examens blancs sont classés Premium Plus", () => {
  const rows = parseMockExams(JSON.stringify([{id:"blanc-1",title:"Examen blanc",questions:[{q:"Q"}]}]));
  assert.equal(rows[0].content_key, "exam:blanc-1");
  assert.equal(rows[0].required_plan, "premium_plus");
  assert.equal(rows[0].body.kind, "exam");
});

test("refuse les examens blancs sans questions", () => {
  assert.throws(() => parseMockExams('[{"title":"Vide","questions":[]}]'), /invalide/);
});
