export function SetupSupabasePage() {
  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <section className="card">
        <div className="cardHeader">
          <h1 className="h1">Supabase not configured</h1>
        </div>
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Put your Supabase project URL and anon key in the .env.local file.
          </p>
          <ol className="muted" style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              Copy <code>.env.local.example</code> to <code>.env.local</code> in the project root.
            </li>
            <li>
              Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from your
              Supabase project: Settings → API.
            </li>
            <li>
              Stop the dev server and run <code>npm run dev</code> again so Vite picks up the new
              variables.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
