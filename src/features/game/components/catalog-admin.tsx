"use client";
import { useState } from "react";
import { Button, Notice, TextField, Toggle } from "@/components/ui/primitives";
import type { CatalogItem, ImportPreview, ImportSummary } from "../server/onza-service";
import { catalogCsvTemplate, MAX_CSV_BYTES } from "../csv/catalog-csv";
import { RARITIES, SLOTS } from "../types";
import { useOnza } from "./use-onza";
import styles from "./game.module.css";

const ACTION_LABELS: Record<string, string> = { created: "Crear", updated: "Actualizar", unchanged: "Sin cambios" };

export function CatalogAdmin({ items, imports }: { items: CatalogItem[]; imports: ImportSummary[] }) {
  const { run, busy, message } = useOnza();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [localError, setLocalError] = useState("");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ sku: "", name: "", category: "hat", price_coins: "0", rarity: "common", status: "draft", min_level: "1", exclusive: false, asset_ref: "", preview_ref: "" });

  async function readFile(f: File | null) {
    setPreview(null);
    setLocalError("");
    if (!f) return setFile(null);
    if (f.size > MAX_CSV_BYTES) {
      setFile(null);
      return setLocalError("El archivo supera los 2 MB.");
    }
    setFile({ name: f.name, text: await f.text() });
  }
  async function stage() {
    if (!file) return;
    const result = await run<ImportPreview>("stage", { command: "import_stage", filename: file.name, csv: file.text }, "Vista previa lista. Todavía no se escribió nada.");
    if (result) setPreview(result);
  }
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([catalogCsvTemplate()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-catalogo-avatares.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const visible = items.filter((i) => !filter || `${i.sku} ${i.name} ${i.category}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="stack">
      <div aria-live="polite">
        {(message || localError) && (
          <Notice tone={localError || message?.tone === "danger" ? "danger" : "success"} title={localError || message?.tone === "danger" ? "No se pudo" : "Listo"}>
            {localError || message?.text}
          </Notice>
        )}
      </div>

      <section aria-labelledby="import-title" className="stack tight">
        <h2 id="import-title">Importar diseños (CSV)</h2>
        <p className={styles.muted}>
          El CSV trae metadatos y referencias a los archivos gráficos (ruta o URL https); los archivos se suben aparte. Se crea o actualiza por <code>sku</code>:
          las compras, los inventarios y lo equipado se conservan. Una columna que no incluís no se toca.
        </p>
        <div className={styles.row}>
          <Button variant="secondary" onClick={downloadTemplate}>Descargar plantilla</Button>
          <label className="field grow"><span>Archivo CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0] ?? null)} />
          </label>
          <Button loading={busy === "stage"} disabled={!file} onClick={stage}>Validar y ver vista previa</Button>
        </div>

        {preview && (
          <div className="stack tight" aria-live="polite">
            <p>
              <strong>{preview.created}</strong> por crear · <strong>{preview.updated}</strong> por actualizar · <strong>{preview.unchanged}</strong> sin cambios ·{" "}
              <strong>{preview.errors.length}</strong> con error (se omiten)
            </p>
            {preview.errors.length > 0 && (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <caption className={styles.muted}>Errores</caption>
                  <thead><tr><th className={styles.num}>Línea</th><th>sku</th><th>Problema</th></tr></thead>
                  <tbody>{preview.errors.map((e, i) => <tr key={i}><td className={styles.num}>{e.line ?? "—"}</td><td>{e.sku ?? "—"}</td><td>{e.message}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <div className={styles.scroll}>
              <table className={styles.table}>
                <caption className={styles.muted}>Filas válidas</caption>
                <thead><tr><th className={styles.num}>Línea</th><th>sku</th><th>Acción</th><th>Campos que cambian</th></tr></thead>
                <tbody>{preview.preview.slice(0, 200).map((p) => <tr key={`${p.line}-${p.sku}`}><td className={styles.num}>{p.line}</td><td>{p.sku}</td><td>{ACTION_LABELS[p.action] ?? p.action}</td><td>{p.changes.join(", ") || "—"}</td></tr>)}</tbody>
              </table>
            </div>
            {preview.preview.length > 200 && <p className={styles.muted}>Se muestran las primeras 200 filas.</p>}
            <div className={styles.row}>
              <Button loading={busy === "apply"} disabled={preview.preview.length === 0 || !preview.id}
                onClick={async () => { if (await run("apply", { command: "import_apply", importId: preview.id }, "Importación aplicada.")) { setPreview(null); setFile(null); } }}>
                Aplicar {preview.created + preview.updated} cambios
              </Button>
              <Button variant="secondary" loading={busy === "discard"} disabled={!preview.id}
                onClick={async () => { if (await run("discard", { command: "import_discard", importId: preview.id }, "Importación descartada.")) setPreview(null); }}>
                Descartar
              </Button>
            </div>
          </div>
        )}

        <h3>Historial de importaciones</h3>
        {imports.length === 0 ? <p className={styles.muted}>Todavía no hay importaciones.</p> : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead><tr><th>Archivo</th><th>Estado</th><th className={styles.num}>Filas</th><th className={styles.num}>Creados</th><th className={styles.num}>Actualizados</th><th className={styles.num}>Errores</th><th>Fecha</th></tr></thead>
              <tbody>{imports.map((i) => (
                <tr key={i.id}><td>{i.filename}</td><td>{i.status === "applied" ? "Aplicada" : i.status === "discarded" ? "Descartada" : "Con vista previa"}</td>
                  <td className={styles.num}>{i.total_rows}</td><td className={styles.num}>{i.created}</td><td className={styles.num}>{i.updated}</td><td className={styles.num}>{i.errors}</td>
                  <td>{new Date(i.created_at).toLocaleString("es-CR")}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="item-title" className="stack tight">
        <h2 id="item-title">Agregar o editar un artículo</h2>
        <div className={styles.form}>
          <TextField label="sku (identificador único)" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <TextField label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="field"><span>Categoría</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{SLOTS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <TextField label="Precio (monedas)" type="number" min={0} value={form.price_coins} onChange={(e) => setForm({ ...form, price_coins: e.target.value })} />
          <label className="field"><span>Rareza</span><select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>{RARITIES.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="field"><span>Estado</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">draft</option><option value="active">active</option><option value="retired">retired</option></select></label>
          <TextField label="Nivel mínimo" type="number" min={1} value={form.min_level} onChange={(e) => setForm({ ...form, min_level: e.target.value })} />
          <TextField label="Archivo del diseño (ruta o https)" value={form.asset_ref} onChange={(e) => setForm({ ...form, asset_ref: e.target.value })} />
          <TextField label="Vista previa (ruta o https)" value={form.preview_ref} onChange={(e) => setForm({ ...form, preview_ref: e.target.value })} />
        </div>
        <Toggle label="Exclusivo (no se vende: solo se otorga)" checked={form.exclusive} onChange={(v) => setForm({ ...form, exclusive: v })} />
        <Button loading={busy === "item"} disabled={!form.sku}
          onClick={() => run("item", { command: "item_save", values: { sku: form.sku, name: form.name || undefined, category: form.category, price_coins: Number(form.price_coins), rarity: form.rarity, status: form.status, min_level: Number(form.min_level), exclusive: form.exclusive, asset_ref: form.asset_ref, preview_ref: form.preview_ref } }, "Artículo guardado.")}>
          Guardar artículo
        </Button>
      </section>

      <section aria-labelledby="catalog-title" className="stack tight">
        <h2 id="catalog-title">Catálogo ({items.length})</h2>
        <TextField label="Buscar" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th>sku</th><th>Nombre</th><th>Categoría</th><th>Estado</th><th className={styles.num}>Precio</th><th className={styles.num}>Dueños</th><th className={styles.num}>Monedas</th><th>Diseño</th></tr></thead>
            <tbody>{visible.map((i) => (
              <tr key={i.id}><td>{i.sku}</td><td>{i.name}{i.exclusive && " (exclusivo)"}</td><td>{i.category}</td><td>{i.status}</td>
                <td className={styles.num}>{i.price_coins}</td><td className={styles.num}>{i.owners}</td><td className={styles.num}>{i.coins_collected}</td>
                <td>{i.asset_ref ? "Cargado" : "Provisional"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
