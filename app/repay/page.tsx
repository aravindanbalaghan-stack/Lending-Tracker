import NavBar from "@/components/NavBar";
import RepayClient from "@/components/RepayClient";

export default function RepayPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <RepayClient />
      </main>
    </>
  );
}
