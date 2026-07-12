import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, Loader2, X } from "lucide-react";
import type { DocumentTypeSummary } from "@docmax/shared";
import { documentTypesApi, organizationsApi, filesApi, ApiRequestError } from "@/lib/api";

export interface AdminTheme {
  isDark: boolean;
  lime: string;
  panel: string;
  panelBorder: string;
  txt: string;
  txt2: string;
  txt3: string;
}

const TYPE_COLORS = ["#C6F24E", "#6BB4F5", "#B39CF5", "#F0C24B", "#F07A6B", "#5EEAD4"];

export default function AdminPanel({ theme, toast, onTypesChanged, logoUrl, onLogoChanged }: {
  theme: AdminTheme;
  toast: (msg: string) => void;
  onTypesChanged?: () => void;
  logoUrl: string | null;
  onLogoChanged: (url: string | null) => void;
}) {
  const { t } = useTranslation();
  const { lime, panel, panelBorder, txt, txt2, txt3, isDark } = theme;

  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoFile(file: File) {
    setLogoUploading(true);
    try {
      const summary = await filesApi.upload(file);
      const result = await organizationsApi.setLogo(summary.id);
      onLogoChanged(result.logoUrl);
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : "Logotipni yuklashda xato yuz berdi");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleLogoRemove() {
    try {
      await organizationsApi.removeLogo();
      onLogoChanged(null);
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : "Xato yuz berdi");
    }
  }

  const [types, setTypes] = useState<DocumentTypeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    documentTypesApi
      .list()
      .then(setTypes)
      .catch((err) => setError(err instanceof ApiRequestError ? err.body.message : "Xato yuz berdi"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const glass: React.CSSProperties = {
    background: panel,
    border: `1px solid ${panelBorder}`,
    backdropFilter: "blur(16px)",
    borderRadius: 20,
  };

  function openCreateForm() {
    setEditingId(null);
    setName("");
    setColor(null);
    setFormOpen(true);
  }

  function openEditForm(type: DocumentTypeSummary) {
    setEditingId(type.id);
    setName(type.name);
    setColor(type.color);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await documentTypesApi.update(editingId, { name: name.trim(), color });
        setTypes((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      } else {
        const created = await documentTypesApi.create({ name: name.trim(), color });
        setTypes((prev) => [...prev, created]);
      }
      setFormOpen(false);
      onTypesChanged?.();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : "Xato yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("admin.deleteConfirm"))) return;
    try {
      await documentTypesApi.remove(id);
      setTypes((prev) => prev.filter((t) => t.id !== id));
      onTypesChanged?.();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.body.message : "Xato yuz berdi");
    }
  }

  const inputStyle: React.CSSProperties = {
    background: isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)",
    border: `1px solid ${panelBorder}`,
    color: txt,
    fontFamily: "Manrope",
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-['Sora'] text-2xl font-semibold tracking-tight" style={{ color: txt }}>
          {t("admin.title")}
        </h1>
      </div>

      <div style={{ ...glass, padding: 22, marginBottom: 20 }}>
        <h2 className="font-['Sora'] text-[15px] font-semibold mb-1.5" style={{ color: txt }}>
          {t("admin.branding")}
        </h2>
        <p className="text-[12px] font-semibold mb-4" style={{ color: txt3 }}>{t("admin.brandingHint")}</p>

        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />

        {logoUrl ? (
          <div className="flex items-center gap-4">
            <div className="rounded-[14px] flex items-center justify-center overflow-hidden"
              style={{ width: 220, height: 90, background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}` }}>
              <img src={logoUrl} alt="Logo" style={{ maxWidth: "90%", maxHeight: "80%", objectFit: "contain" }} />
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
                {logoUploading && <Loader2 size={13} className="animate-spin" />}
                {t("admin.replaceLogo")}
              </button>
              <button onClick={handleLogoRemove}
                className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-xl cursor-pointer"
                style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: "#F07A6B" }}>
                <X size={13} /> {t("admin.removeLogo")}
              </button>
            </div>
          </div>
        ) : (
          <div onClick={() => !logoUploading && logoInputRef.current?.click()}
            className="rounded-[14px] flex items-center justify-center cursor-pointer"
            style={{ width: 220, height: 90, background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1.5px dashed ${panelBorder}` }}>
            {logoUploading
              ? <Loader2 size={18} className="animate-spin" style={{ color: txt3 }} />
              : <span className="text-[12.5px] font-bold" style={{ color: txt3 }}>{t("admin.companyLogo")}</span>}
          </div>
        )}
      </div>

      <div style={{ ...glass, padding: 22 }}>
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-3">
          <h2 className="font-['Sora'] text-[15px] font-semibold" style={{ color: txt }}>
            {t("admin.documentTypes")}
          </h2>
          <button onClick={openCreateForm}
            className="flex items-center gap-1.5 text-[12.5px] font-bold px-3.5 py-2 rounded-[13px] cursor-pointer"
            style={{ background: lime, color: "#0A1600", border: "none" }}>
            <Plus size={14} /> {t("admin.newType")}
          </button>
        </div>
        <p className="text-[12px] font-semibold mb-4" style={{ color: txt3 }}>{t("admin.documentTypesHint")}</p>

        {formOpen && (
          <div className="mb-4 rounded-[14px] p-4" style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${panelBorder}` }}>
            <label className="block text-[11px] font-extrabold uppercase tracking-wide mb-1.5" style={{ color: txt3 }}>
              {t("admin.typeName")}
            </label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t("admin.typeNamePlaceholder")}
              className="w-full outline-none rounded-xl text-[13px] font-semibold px-3.5 py-3 mb-3"
              style={inputStyle} />
            <div className="flex gap-1.5 mb-4">
              {TYPE_COLORS.map((c) => (
                <span key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full cursor-pointer inline-block"
                  style={{ background: c, border: color === c ? `2px solid ${txt}` : "2px solid transparent" }} />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFormOpen(false)}
                className="text-[12.5px] font-bold px-3.5 py-2 rounded-xl cursor-pointer"
                style={{ background: "transparent", border: `1px solid ${panelBorder}`, color: txt2 }}>
                {t("admin.cancel")}
              </button>
              <button onClick={handleSave} disabled={!name.trim() || saving}
                className="flex items-center gap-2 text-[12.5px] font-bold px-3.5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                style={{ background: lime, color: "#0A1600", border: "none" }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                {t("admin.save")}
              </button>
            </div>
          </div>
        )}

        {error ? (
          <p className="text-[13px] font-semibold" style={{ color: "#F07A6B" }}>{error}</p>
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} style={{ height: 44, borderRadius: 12, background: panel }} />)}
          </div>
        ) : types.length === 0 ? (
          <p className="text-[12.5px] font-semibold" style={{ color: txt3 }}>{t("admin.noTypesYet")}</p>
        ) : (
          <div>
            {types.map((type) => (
              <div key={type.id} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: `1px solid ${panelBorder}` }}>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: type.color ?? txt3 }} />
                <span className="flex-1 text-[13.5px] font-bold" style={{ color: txt }}>{type.name}</span>
                <button onClick={() => openEditForm(type)} title={t("admin.edit")}
                  className="w-8 h-8 rounded-lg inline-grid place-items-center cursor-pointer"
                  style={{ background: "transparent", border: "none", color: txt2 }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(type.id)} title={t("admin.delete")}
                  className="w-8 h-8 rounded-lg inline-grid place-items-center cursor-pointer"
                  style={{ background: "transparent", border: "none", color: "#F07A6B" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
