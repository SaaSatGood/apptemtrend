/**
 * Espera curta dentro da casca autenticada. Nunca cobre a tela inteira:
 * topo e sidebar continuam vivos enquanto o conteúdo da rota chega.
 */
export default function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="sr-only">Carregando conteúdo…</span>
      <div className="skeleton page-loading-kicker" aria-hidden="true" />
      <div className="skeleton page-loading-title" aria-hidden="true" />
      <div className="page-loading-grid" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div key={item} className="skeleton-card">
            <div className="skeleton skeleton-image" />
            <div className="skeleton-lines">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
