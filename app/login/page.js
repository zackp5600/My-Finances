"use client";

import { useEffect, useState } from "react";
import Link from "../components/NavigationLink";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch("/overview");
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not log in.");

      window.localStorage.setItem("userId", result.user.id);
      router.replace("/overview");
    } catch (loginError) {
      setError(loginError instanceof TypeError ? "Cannot reach the login server. Start it with npm run dev, then try again." : loginError.message || "Could not log in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="signup-page">
      <form className="signup-card" onSubmit={submit}>
        <Link className="landing-brand" href="/">northstar</Link>
        <p className="landing-eyebrow">WELCOME BACK</p>
        <h1>Log in to your account</h1>
        <p className="signup-subtitle">Pick up where you left off.</p>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="add-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging inâ€¦" : "Log in"}
        </button>
        <Link className="signup-back" href="/signup">Create an account</Link>
      </form>
    </main>
  );
}
