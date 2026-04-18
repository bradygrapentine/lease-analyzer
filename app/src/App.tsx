export function App(): JSX.Element {
  return (
    <main>
      <h1>LeaseGuard</h1>
      <p>Private, local-first lease analyzer.</p>
      <section aria-label="upload">
        <p>Upload a lease PDF to analyze. Nothing leaves your device.</p>
        <input type="file" accept="application/pdf" aria-label="upload lease" />
      </section>
    </main>
  );
}
