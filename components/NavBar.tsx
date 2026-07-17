import { createClient } from "@/lib/supabase/server";
import NavBarClient from "@/components/NavBarClient";

export default async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <NavBarClient hasUser={Boolean(user)} />;
}
