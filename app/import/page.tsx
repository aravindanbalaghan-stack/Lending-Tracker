import NavBar from "@/components/NavBar";
import ImportWizard from "@/components/ImportWizard";

export default function ImportPage() {
  return (
    <>
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <ImportWizard />
      </main>
    </>
  );
}
