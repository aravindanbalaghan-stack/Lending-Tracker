import NavBar from "@/components/NavBar";
import SettingsClient from "@/components/SettingsClient";

export default function SettingsPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 md:py-8">
        <SettingsClient />
      </main>
    </>
  );
}
