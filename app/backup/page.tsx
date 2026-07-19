import NavBar from "@/components/NavBar";
import BackupClient from "@/components/BackupClient";

export default function BackupPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <BackupClient />
      </main>
    </>
  );
}
