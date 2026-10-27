/* Configuration publique : aucun mot de passe, jeton ou secret ici.
   Après enregistrement Microsoft Entra, renseigner uniquement clientId.
   Voir CONFIGURATION_ONEDRIVE.md. */
window.CAVE_CONFIG = Object.freeze({
  clientId: "",
  authority: "https://login.microsoftonline.com/consumers",
  redirectUri: new URL("./index.html", window.location.href).href,
  maxReferences: 100,
});
