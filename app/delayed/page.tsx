import NavBar from "@/components/NavBar";
import DelayedClient from "@/components/DelayedClient";

export default function DelayedPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <DelayedClient />
      </main>
    </>
  );
}
