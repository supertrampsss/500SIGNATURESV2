/** Retired simulator entry points now lead to Mandats; saved browser data is untouched. */
export const onRequest = ({ request }: { request: Request }) => {
  const target = new URL("/mandats/", request.url);
  return Response.redirect(target.toString(), 301);
};
