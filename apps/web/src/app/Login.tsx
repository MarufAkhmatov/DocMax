import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Loader2 } from "lucide-react";
import { authApi, ApiRequestError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { SUPPORTED_LOCALES } from "@/i18n";

export default function Login() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.login({ email, password });
      useAuthStore.getState().setSession(user, accessToken);
      if ((SUPPORTED_LOCALES as readonly string[]).includes(user.locale)) {
        i18n.changeLanguage(user.locale);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.body.message : t("login.genericError"));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 12,
    padding: "11px 14px",
    color: "#EDF3F0",
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: "Manrope",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: ".4px",
    color: "#5B6B74",
    marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "grid", placeItems: "center", padding: 20 }}>
      <div
        style={{
          width: "min(380px, 100%)",
          background: "rgba(255,255,255,.055)",
          border: "1px solid rgba(255,255,255,.09)",
          borderRadius: 24,
          backdropFilter: "blur(16px)",
          padding: 32,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: "#C6F24E",
            display: "grid",
            placeItems: "center",
            marginBottom: 20,
            boxShadow: "0 8px 22px rgba(198,242,78,.35)",
          }}
        >
          <FolderOpen size={20} color="#0A1600" />
        </div>
        <h1 className="font-['Sora']" style={{ fontSize: 22, fontWeight: 600, color: "#EDF3F0", marginBottom: 4 }}>
          DocMax
        </h1>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#8FA0A8", marginBottom: 26 }}>{t("login.subtitle")}</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>{t("login.emailLabel")}</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>{t("login.passwordLabel")}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#F07A6B",
                background: "rgba(240,122,107,.12)",
                borderRadius: 10,
                padding: "9px 12px",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2"
            style={{
              background: "#C6F24E",
              color: "#0A1600",
              border: "none",
              borderRadius: 13,
              padding: "11px 14px",
              fontSize: 13.5,
              fontWeight: 800,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 8px 22px rgba(198,242,78,.3)",
              marginTop: 4,
            }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
