// Branchement du service de rendu (fonction Supabase « render » → Nano Banana 2).
// anonKey : clé publique « anon » du projet Supabase. Elle est faite pour être publique (ce n'est PAS la clé Gemini).
// Au démarrage, l'app demande à la fonction si la clé Gemini est en place ; sinon elle garde le rendu local.
// Pour tester l'interface sans service : ajouter ?render=mock à l'adresse de l'app.
export const RENDER = {
  enabled: true,
  url: 'https://xooznnvpycmvcjbowjpf.supabase.co/functions/v1/render',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb3pubnZweWNtdmNqYm93anBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NDYzNTIsImV4cCI6MjExMDMyMjM1Mn0.gHR0l4pmd2FaNCg4bptNuRrY_0m4l39nw0JrvZLdf9w',
};
