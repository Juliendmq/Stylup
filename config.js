// Branchement du service de rendu (fonction Supabase « render » → Nano Banana 2).
// url     : https://<id-du-projet>.supabase.co/functions/v1/render  (vide = pas de rendu de coupe)
// anonKey : clé publique « anon » du projet Supabase (elle peut être publique, ce n'est PAS la clé Gemini)
// Pour tester l'interface sans clé : ajouter ?render=mock à l'adresse de l'app.
export const RENDER = {
  url: '',
  anonKey: '',
};
