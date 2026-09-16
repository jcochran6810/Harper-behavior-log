import Nav from "@/components/Nav";
import UploadFlow from "@/components/UploadFlow";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-8 pt-6">
        <h1 className="text-xl font-semibold">Add a log</h1>
        <p className="mb-5 mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Photograph the page. You&apos;ll get to check every number before anything is saved.
        </p>
        <UploadFlow />
      </main>
      <Nav />
    </>
  );
}
