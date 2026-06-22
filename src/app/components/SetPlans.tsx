import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Archive,
  CheckCircle,
  ImageIcon,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deletePlanAdmin,
  fetchAllPlansAdmin,
  type AdminPlan,
  upsertPlanAdmin,
} from "../../services/planService";
import {
  fetchPaymentSettingsAdmin,
  type PaymentSettings,
  updatePaymentSettingsAdmin,
  uploadQrCode,
} from "../../services/paymentSettingsService";
import {
  fetchBannerSettingsAdmin,
  type BannerSettings,
  updateBannerSettingsAdmin,
  uploadBannerImage,
} from "../../services/bannerService";
import { fetchEnrollmentsAdmin } from "../../services/enrollmentService";

interface Props {
  onClose: () => void;
}

interface PlanDraft {
  id?: string;
  slug: string;
  name: string;
  price: string;
  tag: string;
  displayOrder: string;
  durationWeeks: string;
  sessionLimit: string;
  gmeetLink: string;
  isActive: boolean;
}

const EMPTY_PLAN: PlanDraft = {
  slug: "",
  name: "",
  price: "",
  tag: "",
  displayOrder: "0",
  durationWeeks: "",
  sessionLimit: "",
  gmeetLink: "",
  isActive: true,
};

function toDraft(plan?: AdminPlan | null): PlanDraft {
  if (!plan) return EMPTY_PLAN;
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    price: String(plan.price_paise / 100),
    tag: plan.tag ?? "",
    displayOrder: String(plan.display_order),
    durationWeeks: plan.duration_weeks ?? "",
    sessionLimit: plan.session_limit ?? "",
    gmeetLink: plan.gmeet_link ?? "",
    isActive: plan.is_active,
  };
}

function linkedCountBySlug(enrollmentSlugs: string[]) {
  return enrollmentSlugs.reduce<Record<string, number>>((acc, slug) => {
    if (!slug) return acc;
    acc[slug] = (acc[slug] ?? 0) + 1;
    return acc;
  }, {});
}

export function SetPlans({ onClose }: Props) {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    upi_id: "",
    upi_name: "",
    support_phone: "",
    support_display: "",
  });
  const [enrollmentSlugs, setEnrollmentSlugs] = useState<string[]>([]);
  const [bannerSettings, setBannerSettings] = useState<BannerSettings | null>(null);
  const [bannerForm, setBannerForm] = useState({
    badge_text: "IIT Preparation Program",
    headline: "Get Into Your Dream IIT",
    subtitle: "Expert-led coaching · Personalized mentoring · Proven results",
    pills: ["500+ Students", "Top IITs", "Expert Mentors"] as string[],
  });
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploadingBannerImg, setUploadingBannerImg] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);
  const bannerImgRef = useRef<HTMLInputElement>(null);

  const planCounts = useMemo(
    () => linkedCountBySlug(enrollmentSlugs),
    [enrollmentSlugs],
  );

  const activePlans = plans.filter(plan => plan.is_active);
  const archivedPlans = plans.filter(plan => !plan.is_active);

  useEffect(() => {
    load().catch(() => {
      // errors are already surfaced through component state
    });
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [loadedPlans, loadedPayment, enrollments, loadedBanner] = await Promise.all([
        fetchAllPlansAdmin(),
        fetchPaymentSettingsAdmin(),
        fetchEnrollmentsAdmin(),
        fetchBannerSettingsAdmin(),
      ]);

      setPlans(loadedPlans);
      setPaymentSettings(loadedPayment);
      setEnrollmentSlugs(enrollments.map(item => item.planSlug).filter(Boolean));

      if (loadedPayment) {
        setPaymentForm({
          upi_id: loadedPayment.upi_id,
          upi_name: loadedPayment.upi_name,
          support_phone: loadedPayment.support_phone,
          support_display: loadedPayment.support_display,
        });
      }

      if (loadedBanner) {
        setBannerSettings(loadedBanner);
        setBannerForm({
          badge_text: loadedBanner.badge_text,
          headline:   loadedBanner.headline,
          subtitle:   loadedBanner.subtitle,
          pills:      loadedBanner.pills,
        });
        setBannerImageUrl(loadedBanner.image_url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard settings.");
    } finally {
      setLoading(false);
    }
  }

  function resetDraft() {
    setDraft(EMPTY_PLAN);
    setPlanMessage(null);
  }

  function editPlan(plan: AdminPlan) {
    setDraft(toDraft(plan));
    setPlanMessage(null);
  }

  async function savePlan() {
    setSavingPlan(true);
    setPlanMessage(null);
    setError(null);

    try {
      const priceNumber = Number.parseFloat(draft.price);
      if (!draft.slug.trim() || !draft.name.trim() || Number.isNaN(priceNumber)) {
        throw new Error("Slug, name, and price are required.");
      }

      await upsertPlanAdmin({
        id: draft.id,
        slug: draft.slug.trim(),
        name: draft.name.trim(),
        price_paise: Math.round(priceNumber * 100),
        tag: draft.tag.trim() || null,
        display_order: Number.parseInt(draft.displayOrder, 10) || 0,
        duration_weeks: draft.durationWeeks.trim() || null,
        session_limit: draft.sessionLimit.trim() || null,
        gmeet_link: draft.gmeetLink.trim() || null,
        is_active: draft.isActive,
      });

      setPlanMessage(draft.id ? "Plan updated." : "Plan created.");
      resetDraft();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function toggleArchive(plan: AdminPlan) {
    setSavingPlan(true);
    setPlanMessage(null);
    setError(null);

    try {
      await upsertPlanAdmin({
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        price_paise: plan.price_paise,
        tag: plan.tag,
        display_order: plan.display_order,
        is_active: !plan.is_active,
      });

      setPlanMessage(plan.is_active ? "Plan archived." : "Plan restored.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update plan status.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function deletePlan(plan: AdminPlan) {
    const linkedCount = planCounts[plan.slug] ?? 0;
    if (linkedCount > 0) {
      setError(`"${plan.name}" has ${linkedCount} linked enrollment(s). Archive it instead of deleting.`);
      return;
    }

    setSavingPlan(true);
    setPlanMessage(null);
    setError(null);

    try {
      await deletePlanAdmin(plan.id);
      if (draft.id === plan.id) resetDraft();
      setPlanMessage("Plan deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function savePaymentSettings() {
    if (!paymentSettings) {
      setError("Payment settings record was not found.");
      return;
    }

    setSavingPayment(true);
    setPaymentMessage(null);
    setError(null);

    try {
      await updatePaymentSettingsAdmin(paymentSettings.id, paymentForm);
      setPaymentMessage("Payment settings saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payment settings.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function saveBannerSettings() {
    if (!bannerSettings) {
      setError("Banner settings record not found. Run migration 003 in Supabase first.");
      return;
    }
    setSavingBanner(true);
    setBannerMessage(null);
    setError(null);
    try {
      await updateBannerSettingsAdmin(bannerSettings.id, {
        badge_text: bannerForm.badge_text.trim(),
        headline:   bannerForm.headline.trim(),
        subtitle:   bannerForm.subtitle.trim(),
        pills:      bannerForm.pills.map(p => p.trim()).filter(Boolean),
      });
      setBannerMessage("Banner saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save banner.");
    } finally {
      setSavingBanner(false);
    }
  }

  async function onBannerImgUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !bannerSettings) return;
    setUploadingBannerImg(true);
    setBannerMessage(null);
    setError(null);
    try {
      const url = await uploadBannerImage(file);
      await updateBannerSettingsAdmin(bannerSettings.id, { image_url: url });
      setBannerMessage("Banner image updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setUploadingBannerImg(false);
      if (bannerImgRef.current) bannerImgRef.current.value = "";
    }
  }

  async function removeBannerImage() {
    if (!bannerSettings) return;
    setSavingBanner(true);
    setBannerMessage(null);
    try {
      await updateBannerSettingsAdmin(bannerSettings.id, { image_url: null });
      setBannerMessage("Image removed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove image.");
    } finally {
      setSavingBanner(false);
    }
  }

  async function onQrUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !paymentSettings) return;

    setUploadingQr(true);
    setPaymentMessage(null);
    setError(null);

    try {
      const qrCodeUrl = await uploadQrCode(file);
      await updatePaymentSettingsAdmin(paymentSettings.id, { qr_code_url: qrCodeUrl });
      setPaymentMessage("QR code updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload QR code.");
    } finally {
      setUploadingQr(false);
      if (qrRef.current) qrRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-card"
        style={{ boxShadow: "-4px 0 48px rgba(0,0,0,0.18)" }}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10">
              <Settings2 size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-foreground">Set Plans</h2>
              <p className="mt-0.5 text-muted-foreground" style={{ fontSize: 12 }}>
                {activePlans.length} active · {archivedPlans.length} archived · {enrollmentSlugs.length} live enrollments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-2xl hover:bg-muted transition-colors"
          >
            <X size={17} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Loading plans and payment settings...
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}

              <section className="rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <p className="font-semibold text-foreground" style={{ fontSize: 14 }}>
                      Plan Editor
                    </p>
                    <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                      Changes here are reflected in the enrollment form plan selection.
                    </p>
                  </div>
                  <button
                    onClick={resetDraft}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    <Plus size={13} />
                    New Plan
                  </button>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <Field label="Slug">
                    <input
                      value={draft.slug}
                      onChange={event => setDraft(current => ({ ...current, slug: event.target.value }))}
                      placeholder="Enter slug… e.g. pro"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Name">
                    <input
                      value={draft.name}
                      onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                      placeholder="Enter plan name… e.g. Pro Bundle"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Price (INR)">
                    <input
                      value={draft.price}
                      onChange={event => setDraft(current => ({ ...current, price: event.target.value }))}
                      placeholder="Enter price in INR… e.g. 7999"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Tag">
                    <input
                      value={draft.tag}
                      onChange={event => setDraft(current => ({ ...current, tag: event.target.value }))}
                      placeholder="Enter tag… e.g. Best Value"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Display Order">
                    <input
                      value={draft.displayOrder}
                      onChange={event => setDraft(current => ({ ...current, displayOrder: event.target.value }))}
                      placeholder="0"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Duration (weeks)">
                    <input
                      type="text"
                      value={draft.durationWeeks}
                      onChange={event => setDraft(current => ({ ...current, durationWeeks: event.target.value }))}
                      placeholder="e.g. 12 or Unlimited"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Sessions included">
                    <input
                      type="text"
                      value={draft.sessionLimit}
                      onChange={event => setDraft(current => ({ ...current, sessionLimit: event.target.value }))}
                      placeholder="e.g. 8 or Unlimited"
                      className="field-input"
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Google Meet Link (admin only — not shown to students)">
                      <input
                        type="url"
                        value={draft.gmeetLink}
                        onChange={event => setDraft(current => ({ ...current, gmeetLink: event.target.value }))}
                        placeholder="https://meet.google.com/xxx-yyyy-zzz"
                        className="field-input"
                      />
                    </Field>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={event => setDraft(current => ({ ...current, isActive: event.target.checked }))}
                      />
                      Active plan
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-border px-5 py-4">
                  <button
                    onClick={() => {
                      savePlan().catch(() => {
                        // handled inside savePlan
                      });
                    }}
                    disabled={savingPlan}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {savingPlan ? "Saving..." : draft.id ? "Save Changes" : "Create Plan"}
                  </button>
                  {draft.id && (
                    <button
                      onClick={resetDraft}
                      className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                  )}
                  {planMessage && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={14} />
                      {planMessage}
                    </span>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <p className="font-semibold text-foreground" style={{ fontSize: 14 }}>
                    Active Plans
                  </p>
                </div>
                <PlanList
                  plans={activePlans}
                  planCounts={planCounts}
                  editingId={draft.id}
                  onEdit={editPlan}
                  onArchive={toggleArchive}
                  onDelete={deletePlan}
                  showDelete={false}
                />
              </section>

              <section className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <p className="font-semibold text-foreground" style={{ fontSize: 14 }}>
                    Archived Plans
                  </p>
                </div>
                <PlanList
                  plans={archivedPlans}
                  planCounts={planCounts}
                  editingId={draft.id}
                  onEdit={editPlan}
                  onArchive={toggleArchive}
                  onDelete={deletePlan}
                  showDelete={true}
                />
              </section>

              <section className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <p className="font-semibold text-foreground" style={{ fontSize: 14 }}>
                    Payment Settings
                  </p>
                  <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                    Shared with the enrollment form payment step.
                  </p>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <Field label="UPI ID">
                    <input
                      value={paymentForm.upi_id}
                      onChange={event => setPaymentForm(current => ({ ...current, upi_id: event.target.value }))}
                      className="field-input"
                    />
                  </Field>

                  <Field label="Account Name">
                    <input
                      value={paymentForm.upi_name}
                      onChange={event => setPaymentForm(current => ({ ...current, upi_name: event.target.value }))}
                      className="field-input"
                    />
                  </Field>

                  <Field label="Support Phone">
                    <input
                      value={paymentForm.support_phone}
                      onChange={event => setPaymentForm(current => ({ ...current, support_phone: event.target.value }))}
                      className="field-input"
                    />
                  </Field>

                  <Field label="Support Display">
                    <input
                      value={paymentForm.support_display}
                      onChange={event => setPaymentForm(current => ({ ...current, support_display: event.target.value }))}
                      className="field-input"
                    />
                  </Field>
                </div>

                <div className="px-5 pb-5">
                  <div className="rounded-2xl border border-dashed border-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground" style={{ fontSize: 13 }}>
                          Payment QR Code
                        </p>
                        <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                          Upload once here and the enrollment form will show the latest image.
                        </p>
                      </div>
                      <input
                        ref={qrRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={event => {
                          onQrUpload(event).catch(() => {
                            // handled inside onQrUpload
                          });
                        }}
                      />
                      <button
                        onClick={() => qrRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        {uploadingQr ? <Upload size={13} /> : <ImageIcon size={13} />}
                        {uploadingQr ? "Uploading..." : "Upload QR"}
                      </button>
                    </div>

                    {paymentSettings?.qr_code_url ? (
                      <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white">
                        <img
                          src={paymentSettings.qr_code_url}
                          alt="Payment QR"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-border bg-muted/30 text-muted-foreground">
                        <ImageIcon size={28} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-border px-5 py-4">
                  <button
                    onClick={() => {
                      savePaymentSettings().catch(() => {
                        // handled inside savePaymentSettings
                      });
                    }}
                    disabled={savingPayment}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {savingPayment ? "Saving..." : "Save Payment Settings"}
                  </button>
                  {paymentMessage && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={14} />
                      {paymentMessage}
                    </span>
                  )}
                </div>
              </section>

              {/* ── Banner Settings ── */}
              <section className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <p className="font-semibold text-foreground" style={{ fontSize: 14 }}>Enrollment Banner</p>
                  <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                    Edits appear on the first step of the enrollment form.
                  </p>
                </div>

                {/* Live preview */}
                <div className="px-5 pt-5">
                  <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{ minHeight: 110, background: "linear-gradient(135deg,#0a1adc 0%,#132BFC 55%,#4f46e5 100%)" }}
                  >
                    <div style={{ position:"absolute", top:-20, right:-10, width:90, height:90, borderRadius:"50%", background:"rgba(255,255,255,0.07)" }} />
                    <div style={{ position:"absolute", bottom:-15, right:30, width:60, height:60, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />
                    {bannerImageUrl && (
                      <img src={bannerImageUrl} alt="Banner"
                        style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", width:90, height:90, borderRadius:16, objectFit:"cover", boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}
                      />
                    )}
                    <div className="relative px-5 py-4" style={{ paddingRight: bannerImageUrl ? 118 : undefined }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize:16 }}>🎓</span>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.8)", fontWeight:500 }}>{bannerForm.badge_text || "Badge text"}</span>
                      </div>
                      <p style={{ fontSize:15, color:"white", fontWeight:700, lineHeight:1.25 }}>{bannerForm.headline || "Headline"}</p>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:3 }}>{bannerForm.subtitle || "Subtitle"}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {bannerForm.pills.filter(p => p.trim()).map((p, i) => (
                          <span key={i} style={{ fontSize:10, padding:"3px 10px", borderRadius:999, background:"rgba(255,255,255,0.18)", color:"white", fontWeight:500 }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text fields */}
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <Field label="Badge Text">
                    <input value={bannerForm.badge_text}
                      onChange={e => setBannerForm(b => ({ ...b, badge_text: e.target.value }))}
                      placeholder="IIT Preparation Program" className="field-input" />
                  </Field>
                  <Field label="Headline">
                    <input value={bannerForm.headline}
                      onChange={e => setBannerForm(b => ({ ...b, headline: e.target.value }))}
                      placeholder="Get Into Your Dream IIT" className="field-input" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Subtitle">
                      <input value={bannerForm.subtitle}
                        onChange={e => setBannerForm(b => ({ ...b, subtitle: e.target.value }))}
                        placeholder="Expert-led coaching · Personalized mentoring · Proven results"
                        className="field-input" />
                    </Field>
                  </div>

                  {/* Pills editor */}
                  <div className="sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stat Pills</span>
                    <div className="flex flex-col gap-2">
                      {bannerForm.pills.map((pill, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={pill}
                            onChange={e => setBannerForm(b => { const pills = [...b.pills]; pills[i] = e.target.value; return { ...b, pills }; })}
                            placeholder={`Pill ${i + 1}`}
                            className="field-input flex-1"
                            style={{ padding:"0.5rem 0.85rem" }}
                          />
                          <button
                            onClick={() => setBannerForm(b => ({ ...b, pills: b.pills.filter((_, j) => j !== i) }))}
                            className="flex size-8 items-center justify-center rounded-xl border border-red-200 text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      {bannerForm.pills.length < 5 && (
                        <button
                          onClick={() => setBannerForm(b => ({ ...b, pills: [...b.pills, ""] }))}
                          className="inline-flex items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Plus size={11} /> Add pill
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Image upload */}
                <div className="px-5 pb-5">
                  <div className="rounded-2xl border border-dashed border-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground" style={{ fontSize: 13 }}>Banner Image (right side)</p>
                        <p className="text-muted-foreground" style={{ fontSize: 12 }}>Shown as a thumbnail on the right of the banner.</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input ref={bannerImgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                          onChange={e => { onBannerImgUpload(e).catch(() => {}); }} />
                        <button onClick={() => bannerImgRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                          {uploadingBannerImg ? <Upload size={13} /> : <ImageIcon size={13} />}
                          {uploadingBannerImg ? "Uploading…" : "Upload Image"}
                        </button>
                        {bannerImageUrl && (
                          <button onClick={() => { removeBannerImage().catch(() => {}); }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                    {bannerImageUrl ? (
                      <img src={bannerImageUrl} alt="Banner" className="h-28 w-28 rounded-2xl border border-border object-cover" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-border bg-muted/30 text-muted-foreground">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-border px-5 py-4">
                  <button onClick={() => { saveBannerSettings().catch(() => {}); }} disabled={savingBanner}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {savingBanner ? "Saving…" : "Save Banner"}
                  </button>
                  {bannerMessage && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={14} />{bannerMessage}
                    </span>
                  )}
                </div>
              </section>

            </div>
          )}
        </div>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 1rem;
          background: var(--card);
          color: var(--foreground);
          padding: 0.7rem 0.95rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input::placeholder {
          color: var(--muted-foreground);
          opacity: 0.5;
          font-style: italic;
        }
        .field-input:focus {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function PlanList({
  plans,
  planCounts,
  editingId,
  onEdit,
  onArchive,
  onDelete,
  showDelete = true,
}: {
  plans: AdminPlan[];
  planCounts: Record<string, number>;
  editingId?: string;
  onEdit: (plan: AdminPlan) => void;
  onArchive: (plan: AdminPlan) => void | Promise<void>;
  onDelete: (plan: AdminPlan) => void | Promise<void>;
  showDelete?: boolean;
}) {
  if (plans.length === 0) {
    return (
      <div className="px-5 py-6 text-sm text-muted-foreground">
        No plans in this section.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {plans.map(plan => {
        const linkedCount = planCounts[plan.slug] ?? 0;
        const archived = !plan.is_active;
        const isEditing = plan.id === editingId;

        return (
          <div key={plan.id} className="flex items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-foreground" style={{ fontSize: 14 }}>
                  {plan.name}
                </p>
                {plan.tag && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {plan.tag}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                {plan.slug} · INR {(plan.price_paise / 100).toLocaleString("en-IN")} · order {plan.display_order}
              </p>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                {plan.duration_weeks || "—"} duration · {plan.session_limit || "—"} sessions · {linkedCount} linked
              </p>
              {plan.gmeet_link && (
                <a href={plan.gmeet_link} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-0.5"
                  style={{ fontSize: 11 }}>
                  Meet link ↗
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(plan)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 active:opacity-70 ${
                  isEditing
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/20 hover:text-primary"
                }`}
              >
                <Pencil size={12} />
                {isEditing ? "Editing…" : "Edit"}
              </button>

              <button
                onClick={() => {
                  const result = onArchive(plan);
                  if (result instanceof Promise) void result;
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 active:opacity-70 ${
                  archived
                    ? "border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                    : "border-amber-300 text-amber-600 hover:bg-amber-100 hover:border-amber-400 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/50"
                }`}
              >
                {archived ? <RotateCcw size={12} /> : <Archive size={12} />}
                {archived ? "Restore" : "Archive"}
              </button>

              {showDelete && (
                <button
                  onClick={() => {
                    const result = onDelete(plan);
                    if (result instanceof Promise) void result;
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-100 hover:border-red-400 hover:text-red-600 active:scale-95 active:opacity-70 dark:border-red-800 dark:hover:bg-red-900/50"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
