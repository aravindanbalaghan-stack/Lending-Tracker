import NavBar from "@/components/NavBar";
import ReportsClient from "@/components/ReportsClient";

export default function ReportsPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 md:py-8">
        <ReportsClient />
      </main>
    </>
  );
}
