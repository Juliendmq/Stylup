// Branchement du service de rendu (fonction Supabase « render » → Nano Banana 2).
// enabled : passer à true une fois la fonction déployée et GEMINI_API_KEY ajoutée dans les secrets Supabase
// anonKey : clé publique du projet (anon ou publishable) ; elle peut être publique, ce n'est PAS la clé Gemini
// Pour tester l'interface sans service : ajouter ?render=mock à l'adresse de l'app.
export const RENDER = {
  enabled: false,
  url: 'https://xooznnvpycmvcjbowjpf.supabase.co/functions/v1/render',
  anonKey: '',
};
