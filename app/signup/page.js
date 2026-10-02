"use client";

import { useEffect, useRef, useState } from "react";
import Link from "../components/NavigationLink";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    router.prefetch("/overview");
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create account.");
      window.localStorage.setItem("userId", result.user.id);
      // A completed sign-up should not leave a form in the browser history.
      router.replace("/overview");
    } catch (e) {
      setError(e instanceof TypeError ? "Cannot reach the signup server. Start it with npm run dev, then try again." : e.message);
      submitting.current = false;
      setSaving(false);
    }
  }

  return <main className="signup-page"><form className="signup-card" onSubmit={submit}><Link className="landing-brand" href="/">✦ northstar</Link><p className="landing-eyebrow">START YOUR JOURNEY</p><h1>Create your account</h1><p className="signup-subtitle">Track every investment in one clear place.</p><label>Name<input name="name" required autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="add-button signup-submit" type="submit" disabled={saving}><span role="status" aria-live="polite">{saving && <span className="signup-spinner" aria-hidden="true" />} {saving ? "Creating account…" : "Create account"}</span></button><Link className="signup-back" href="/">Back to home</Link></form></main>;
}
