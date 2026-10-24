"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarCheck, Check, Clock, Heart, MapPin, Phone } from "lucide-react";
import { api, ApiError, type Case, type CaseOut } from "@/lib/api";
import { Button, Card, Eyebrow, Logo, Spinner, TextArea, TextField, buttonClass, cx } from "@/components/ui";

type Day = { date: string; weekday: string; label: string; relative: string; slots: string[] };
type Availability = {
  timezone: string; timezone_label: string; policy: string; tenant_phone: string;
  customer_types: Record<string, string>; tips: { amount: number; label: string }[]; days: Day[];
};
type Contact = { name: string; phone: string; email: string; address: string; city: string; postal_code: string };
const EMPTY: Contact = { name: "", phone: "", email: "", address: "", city: "", postal_code: "" };

function gmtOffset(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function validate(c: Contact): Partial<Record<keyof Contact, string>> {
  const e: Partial<Record<keyof Contact, string>> = {};
  if (c.name.trim().length < 2) e.name = "Enter your full name.";
  if (c.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit phone number.";
  if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e.email = "Enter a valid email, or leave it blank.";
  if (c.address.trim().length < 3) e.address = "Enter the street address of the property.";
  if (c.city.trim().length < 2) e.city = "Enter the city.";
  if (c.postal_code.trim().length < 3) e.postal_code = "Enter the postal code.";
  return e;
}

export default function Book() {
  const { caseId } = useParams<{ caseId: string }>();
  const [c, setC] = useState<Case | null>(null);
  const [av, setAv] = useState<Availability | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [tip, setTip] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get<CaseOut>(`/cases/${caseId}`), api.get<Availability>("/booking/availability")])
      .then(([out, a]) => {
        setC(out.case);
        setAv(a);
        const t = out.case.customer.type;
        if (t in a.customer_types) setWho(t);
        setDay(a.days[0]?.date ?? null);
      })
      .catch((e: Error) => setErr(e.message));
  }, [caseId]);

  const errors = useMemo(() => validate(contact), [contact]);
  const selectedDay = av?.days.find((d) => d.date === day);
  const tenant = who === "tenant";
  const service = c?.pre_assessment?.recommended_service ?? c?.recommended_service ?? "onsite";
  const booked = c?.booking?.slot_date ? c.booking : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    setErr(null);
    if (!who || tenant || !day || !time || Object.keys(errors).length) {
      setErr(!who ? "Tell us who is booking." : !time ? "Pick a date and time." : "Please fix the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      const out = await api.post<CaseOut>(`/cases/${caseId}/book`, {
        service, customer_type: who, slot_date: day, slot_time: time, tip, notes, marketing_consent: consent,
        contact: Object.fromEntries(Object.entries(contact).map(([k, v]) => [k, v.trim()])),
      });
      setC(out.case);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr((e as Error).message);
      if (e instanceof ApiError && e.status === 409) {
        setAv(await api.get<Availability>("/booking/availability"));
        setTime(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setContact((s) => ({ ...s, [k]: e.target.value }));
  const fieldState = (k: keyof Contact) => (tried && errors[k] ? "error" as const : undefined);

  if (!c || !av) {
    return <div className="grid min-h-dvh place-items-center">{err ? <p role="alert" className="text-subtitle text-kit-red">{err}</p> : <Spinner label="Loading times…" />}</div>;
  }

  const header = (
    <div className="flex items-center justify-between">
      <Logo small />
      <Link href={`/assess/${caseId}`} className={buttonClass({ variant: "text", size: "sm" })}><ArrowLeft size={14} aria-hidden />Back</Link>
    </div>
  );

  if (booked) {
    return (
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-4">
        {header}
        <Card className="rise mt-6 overflow-hidden">
          <div className="bg-brand px-5 py-4 text-white">
            <Eyebrow color="text-white/90">Booking requested</Eyebrow>
            <p className="mt-1 flex items-center gap-2 text-h6 font-semibold"><CalendarCheck size={22} aria-hidden />{booked.slot_text}</p>
          </div>
          <dl className="space-y-3 p-5 text-subtitle">
            <Row label="Service" value={c.pre_assessment?.service_price_text || service} />
            {booked.contact && <Row label="Where" value={`${booked.contact.address}, ${booked.contact.city} ${booked.contact.postal_code}`} />}
            {booked.contact && <Row label="Contact" value={`${booked.contact.name} · ${booked.contact.phone}${booked.contact.email ? ` · ${booked.contact.email}` : ""}`} />}
            {booked.tip && <Row label="Tip jar" value={av.tips.find((t) => t.amount === booked.tip)?.label ?? `$${booked.tip}`} />}
          </dl>
          <p className="border-t border-kit-gray-soft px-5 py-4 text-caption font-light text-ink-muted">
            Simulated: in production this writes to the Mold Busters calendar and our team confirms by phone within one business day.
            A technician visits at the time you picked ({av.timezone_label}).
          </p>
        </Card>
        <Link href={`/assess/${caseId}`} className={cx(buttonClass({ variant: "outline", size: "lg", fullWidth: true }), "mt-4")}>Back to my pre-assessment</Link>
      </main>
    );
  }

  if (service === "remote_report") {
    return (
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-4">
        {header}
        <Card className="mt-6 p-5">
          <h1 className="text-h6 font-semibold text-ink">On-site visits aren&apos;t available here</h1>
          <p className="mt-2 text-subtitle font-light text-ink-body">This property is outside our on-site service area. The remote AI report is available from your pre-assessment.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-4">
      {header}
      <section className="rise mt-6">
        <Eyebrow color="text-brand" className="mb-1">Book an on-site visit</Eyebrow>
        <h1 className="text-h5 font-bold tracking-tight text-ink">Pick a time for a technician to come to you</h1>
        {c.pre_assessment && <p className="mt-2 text-subtitle font-medium text-ink">{c.pre_assessment.service_price_text}</p>}
      </section>

      <p className="mt-4 rounded-ds-sm border border-brand/25 bg-brand-tint p-3 text-subtitle text-ink">{av.policy}</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-6">
        <fieldset>
          <legend className="mb-2 text-subheading font-semibold text-ink">Who&apos;s booking?</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(av.customer_types).map(([id, label]) => (
              <Choice key={id} name="who" checked={who === id} onChange={() => setWho(id)} label={label} />
            ))}
          </div>
        </fieldset>

        {tenant ? (
          <Card tone="warning" role="alert" className="space-y-3 p-5">
            <p className="text-body font-semibold text-ink">Tenants book by phone</p>
            <p className="text-subtitle text-ink-body">Tenants must call us at {av.tenant_phone} to schedule. Additional fees may apply.</p>
            <a href={`tel:+1${av.tenant_phone.replace(/\D/g, "").slice(1)}`} className={buttonClass({ size: "lg", fullWidth: true })}>
              <Phone size={18} aria-hidden />Call {av.tenant_phone}
            </a>
          </Card>
        ) : (
          <>
            <fieldset>
              <legend className="text-subheading font-semibold text-ink">Date and time</legend>
              <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-muted">
                <Clock size={13} aria-hidden />Time Zone: {av.timezone_label} ({gmtOffset(av.timezone)})
              </p>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Date">
                {av.days.map((d) => {
                  const on = d.date === day;
                  return (
                    <button key={d.date} type="button" role="radio" aria-checked={on} onClick={() => { setDay(d.date); setTime(null); }}
                      className={cx("min-w-[92px] shrink-0 rounded-ds-xsm border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        on ? "border-brand bg-brand-tint" : "border-kit-gray-soft bg-white hover:border-kit-gray")}>
                      <span className={cx("block text-[11px] font-medium", on ? "text-brand-strong" : "text-ink-muted")}>{d.relative}</span>
                      <span className="block text-subtitle font-semibold text-ink">{d.weekday}</span>
                      <span className="block text-caption text-ink-body">{d.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Times on ${selectedDay.weekday} ${selectedDay.label}`}>
                  {selectedDay.slots.map((t) => (
                    <Button key={t} variant={time === t ? "primary" : "outline"} role="radio" aria-checked={time === t} onClick={() => setTime(t)}>{t}</Button>
                  ))}
                </div>
              )}
              {tried && !time && <p className="mt-2 text-caption text-kit-red">Pick a time.</p>}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-1 text-subheading font-semibold text-ink">Your details</legend>
              <TextField label="Full name" autoComplete="name" value={contact.name} onChange={set("name")} state={fieldState("name")} message={tried ? errors.name : undefined} />
              <TextField label="Phone" type="tel" autoComplete="tel" inputMode="tel" value={contact.phone} onChange={set("phone")} state={fieldState("phone")} message={tried ? errors.phone : undefined} />
              <TextField label="Email (optional)" type="email" autoComplete="email" value={contact.email} onChange={set("email")} state={fieldState("email")} message={tried ? errors.email : undefined} />
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-1 flex items-center gap-1.5 text-subheading font-semibold text-ink"><MapPin size={16} aria-hidden />Property address</legend>
              <TextField label="Street address" autoComplete="street-address" value={contact.address} onChange={set("address")} state={fieldState("address")} message={tried ? errors.address : undefined} />
              <TextField label="City" autoComplete="address-level2" value={contact.city} onChange={set("city")} state={fieldState("city")} message={tried ? errors.city : undefined} />
              <TextField label="Postal code" autoComplete="postal-code" value={contact.postal_code} onChange={set("postal_code")} state={fieldState("postal_code")} message={tried ? errors.postal_code : undefined} />
              <TextArea label="Access notes (optional)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Parking, gate code, pets, best entrance…" />
            </fieldset>

            <fieldset>
              <legend className="mb-1 flex items-center gap-1.5 text-subheading font-semibold text-ink"><Heart size={16} aria-hidden />Tip Jar - Support Us</legend>
              <p className="mb-2 text-caption font-light text-ink-muted">Optional. Tips go to the technician team.</p>
              <div className="grid gap-2">
                <Choice name="tip" checked={tip === null} onChange={() => setTip(null)} label="No tip" />
                {av.tips.map((t) => <Choice key={t.amount} name="tip" checked={tip === t.amount} onChange={() => setTip(t.amount)} label={t.label} />)}
              </div>
            </fieldset>

            <Card className="p-4">
              <p className="text-subtitle font-semibold text-ink">Summary</p>
              <dl className="mt-2 space-y-1.5 text-subtitle">
                <Row label="Visit" value={selectedDay && time ? `${selectedDay.weekday}, ${selectedDay.label} · ${time} ET` : "Pick a time"} />
                <Row label="Service" value={c.pre_assessment?.service_price_text || service} />
                <Row label="Tip" value={tip ? `$${tip}.00` : "None"} />
              </dl>
            </Card>

            <div className="space-y-3 rounded-ds-sm bg-kit-gray-faint p-4">
              <label className="flex items-start gap-3 text-subtitle text-ink">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-brand)]" />
                <span>Yes, send me helpful check-ins, seasonal reminders and offers from Mold Busters by text and email. I can unsubscribe anytime.
                  <span className="block text-caption text-ink-muted">Optional. Mold Busters · 1-877-566-6653 · moldbusters.ca</span></span>
              </label>
              <p className="text-caption text-ink-muted">
                To help us serve you, Mold Busters keeps notes from your calls, texts, emails and forms (including what you tell us about your home and household)
                in a customer profile created with automated tools. You can see, correct or delete what we keep at any time. <a href="/privacy" className="font-medium text-brand underline">Privacy</a>
              </p>
            </div>

            {err && <p role="alert" className="rounded-ds-sm bg-alert-danger-bg p-3 text-subtitle text-kit-red">{err}</p>}
            <Button type="submit" size="lg" fullWidth state={busy ? "loading" : undefined} leading={<Check size={18} aria-hidden />}>Confirm booking</Button>
            <p className="text-center text-caption font-light text-ink-muted">Simulated booking for this prototype. No payment is taken.</p>
          </>
        )}
      </form>
    </main>
  );
}

function Choice({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-ds-xsm border px-3 py-2.5 text-subtitle transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
      checked ? "border-brand bg-brand-tint font-medium text-ink" : "border-kit-gray-soft bg-white text-ink-body hover:border-kit-gray")}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className={cx("grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border", checked ? "border-brand" : "border-kit-gray")} aria-hidden>
        {checked && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      {label}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{value}</dd>
    </div>
  );
}
