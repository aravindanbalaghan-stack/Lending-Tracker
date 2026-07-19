import NavBar from "@/components/NavBar";
import DashboardClient from "@/components/DashboardClient";

export default function DashboardPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <DashboardClient />
      </main>
    </>
  );
}
