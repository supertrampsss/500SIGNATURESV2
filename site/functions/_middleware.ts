/** Une seule origine publique, avant les pages statiques et les fonctions locales. */
export const onRequest = (context: {
  request: Request;
  next: () => Promise<Response>;
}) => {
  const address = new URL(context.request.url);
  if (address.hostname !== "www.500signatures.fr") return context.next();
  address.protocol = "https:";
  address.hostname = "500signatures.fr";
  address.port = "";
  return Response.redirect(address.href, 301);
};
