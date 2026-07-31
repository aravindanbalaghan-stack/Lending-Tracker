"use client";

import NavBarClient from "@/components/NavBarClient";

// Pages that render this NavBar are all behind the auth middleware, so the
// user is always signed in here. We therefore skip the per-navigation
// server-side auth round-trip that used to make every tab switch wait ~2s,
// and render the bar immediately.
export default function NavBar() {
  return <NavBarClient hasUser />;
}
