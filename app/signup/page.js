"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create account.");
      window.localStorage.setItem("userId", result.user.id);
      router.push("/overview");
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return <main className="signup-page"><form className="signup-card" onSubmit={submit}><a className="landing-brand" href="/">✦ northstar</a><p className="landing-eyebrow">START YOUR JOURNEY</p><h1>Create your account</h1><p className="signup-subtitle">Track every investment in one clear place.</p><label>Name<input name="name" required autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>{error && <p className="form-error">{error}</p>}<button className="add-button" disabled={saving}>{saving ? "Creating account…" : "Create account"}</button><button className="signup-back" type="button" onClick={() => router.push("/")}>Back to home</button></form></main>;
}
