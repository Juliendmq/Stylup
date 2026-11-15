// Backend Supabase de Stylup (projet « Stylup », région Paris).
// anonKey : clé publique « anon » du projet. Elle est faite pour être publique : l'accès aux données est
// protégé par les règles RLS de la base (chaque compte ne voit que son salon). Ce n'est PAS la clé Gemini.
export const SUPABASE = {
  url: 'https://xooznnvpycmvcjbowjpf.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb3pubnZweWNtdmNqYm93anBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NDYzNTIsImV4cCI6MjExMDMyMjM1Mn0.gHR0l4pmd2FaNCg4bptNuRrY_0m4l39nw0JrvZLdf9w',
};

// Service de rendu (fonction Supabase « render » → Nano Banana 2).
// Au démarrage, l'app demande à la fonction si la clé Gemini est en place ; sinon elle garde le rendu local.
// Pour tester l'interface sans service : ajouter ?render=mock à l'adresse de l'app.
export const RENDER = {
  enabled: true,
  url: SUPABASE.url + '/functions/v1/render',
  anonKey: SUPABASE.anonKey,
};
