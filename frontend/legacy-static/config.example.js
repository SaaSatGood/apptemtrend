// TemTrend runtime config (produção).
// Copie para config.js e preencha no deploy. config.js está no .gitignore.
// NUNCA commite valores reais: anon key vai para o browser por design,
// mas deve ser injetada no deploy, não no git.
// Prioridade: window.TEMTREND_CONFIG > localStorage temtrend_api_url > meta tag > localhost.
window.TEMTREND_CONFIG = {
  API_URL: '',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
