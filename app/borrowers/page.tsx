import NavBar from "@/components/NavBar";
import BorrowersClient from "@/components/BorrowersClient";

export default function BorrowersPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <BorrowersClient />
      </main>
    </>
  );
}
