import NavBar from "@/components/NavBar";
import BorrowerDetailClient from "@/components/BorrowerDetailClient";

export default function BorrowerDetailPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <BorrowerDetailClient />
      </main>
    </>
  );
}
