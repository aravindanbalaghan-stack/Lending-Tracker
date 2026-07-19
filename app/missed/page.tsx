import NavBar from "@/components/NavBar";
import MissedClient from "@/components/MissedClient";

export default function MissedPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <MissedClient />
      </main>
    </>
  );
}
