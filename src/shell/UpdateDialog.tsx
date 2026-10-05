import { useEffect, useRef, useState } from "react";
import type { UpdateApi } from "../data/source";
import type { UpdateApiStatus } from "../core/update-types";
import { BRAND } from "../brand";

export function UpdateDialog({ api }: { api?: UpdateApi }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [offer, setOffer] = useState<UpdateApiStatus | null>(null);
  const [busy, setBusy] = useState<"install" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!api) return;
    let active = true;
    void api.status().then(status => {
      if (active && status.available) setOffer(status);
    }).catch(() => {                                                });
    return () => { active = false; };
  }, [api]);
  useEffect(() => {
    if (offer && !dismissed && !dialog.current?.open) dialog.current?.showModal();
  }, [offer, dismissed]);

  const act = async (action: "install" | "skip") => {
    if (!api || !offer?.latestVersion || busy) return;
    setBusy(action);
    setError(null);
    try {
      await api[action](offer.latestVersion, offer.token);
      if (action === "skip") { setDismissed(true); dialog.current?.close(); }
      else setOffer(await api.status());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };
  if (!offer || dismissed) return null;
  const installed = offer.state === "installed";
  return (
    <dialog ref={dialog} className="ft-update-dialog" aria-labelledby="update-title"
      aria-describedby="update-description" onCancel={e => { if (busy) e.preventDefault(); }}
      onClose={() => setDismissed(true)}>
      <div className="ft-update-eyebrow">{BRAND.display}</div>
      <h2 id="update-title">{installed ? "Update installed" : "A new version is available"}</h2>
      <p id="update-description">{installed
        ? `Restart ${BRAND.display} to load version ${offer.installedVersion}.`
        : `Version ${offer.latestVersion} is ready. You are using ${offer.currentVersion}.`}</p>
      {busy === "install" ? <p role="status">Installing the update…</p> : null}
      {error ? <p className="ft-update-error" role="alert">{error}</p> : null}
      <div className="ft-update-actions">
        {installed ? <button className="ft-update-primary" onClick={() => dialog.current?.close()}>Close</button> : <>
          <button className="ft-update-close" disabled={!!busy} onClick={() => dialog.current?.close()}>Close</button>
          <button disabled={!!busy} onClick={() => void act("skip")}>{busy === "skip" ? "Skipping…" : "Skip this version"}</button>
          <button autoFocus className="ft-update-primary" disabled={!!busy} onClick={() => void act("install")}>{busy === "install" ? "Updating…" : "Update"}</button>
        </>}
      </div>
    </dialog>
  );
}
