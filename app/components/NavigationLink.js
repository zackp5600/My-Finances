"use client";

import Link, { useLinkStatus } from "next/link";

function NavigationStatus() {
  const { pending } = useLinkStatus();
  return pending ? <span className="navigation-pending" role="status" aria-label="Loading page" /> : null;
}

export default function NavigationLink({ children, className = "", ...props }) {
  return (
    <Link {...props} prefetch className={`navigation-link ${className}`}>
      {children}
      <NavigationStatus />
    </Link>
  );
}
