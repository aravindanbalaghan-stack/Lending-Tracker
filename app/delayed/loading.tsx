import { SkeletonList } from "@/components/Skeletons";

export default function Loading() {
  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 md:py-8">
      <SkeletonList rows={6} />
    </main>
  );
}
