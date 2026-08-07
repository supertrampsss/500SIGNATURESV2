"""Client HTTP des connecteurs : retries avec backoff exponentiel et jitter.

4 tentatives maximum, jamais de contournement de quota (docs/03 §1).

Deux fonctions, et le choix entre elles n'est pas cosmétique. `fetch` sert une
réponse d'API — quelques kilo-octets de JSON. `telecharger` sert un fichier, et
sait reprendre là où la connexion a lâché.
"""

import random
import time

import httpx

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 4

# Un téléchargement qui reprend ne recommence pas : chaque tentative avance de
# ce qu'elle a reçu. Huit essais sur un fichier de cent mégaoctets coûtent donc
# huit reprises, pas huit fichiers. Mesuré le 5 août sur l'API de l'INSEE : le
# fichier des créations d'entreprises (43 Mo) demande deux passes, celui des
# logements (98 Mo) en demande cinq.
REPRISES = 8

# Délai maximal entre deux morceaux d'un même fichier. Aucune source publique ne
# reste muette une minute au milieu d'un corps qu'elle a commencé à servir :
# passé ce délai, la connexion est morte et il vaut mieux reprendre.
LECTURE = 60.0

# Et pour l'établir, cette connexion. Un serveur qui n'a pas décroché en trente
# secondes ne décrochera pas : laisser le délai du fichier — parfois un quart
# d'heure — s'appliquer aussi à la connexion transformerait huit reprises en
# deux heures d'attente.
CONNEXION = 30.0

# Durée maximale d'une tentative, tous morceaux confondus. Le délai de lecture
# ne voit que le silence : un serveur qui envoie un octet toutes les
# cinquante-neuf secondes ne le déclenche jamais. Rien n'échoue, rien n'avance,
# et le run tient la file d'ingestion des heures — c'est la seule façon dont ce
# téléchargement puisse pendre au lieu d'échouer. Passé ce budget la tentative
# est abandonnée, et la suivante reprend par `Range` : ce qui est reçu est gardé.
TENTATIVE = 600.0


def _delais(timeout: float) -> "httpx.Timeout":
    """Délais par opération, jamais par fichier.

    Le budget que passe un connecteur décrit le téléchargement entier ; httpx,
    lui, ne connaît que des délais par opération. Les confondre fait attendre
    une connexion morte aussi longtemps qu'un fichier de cent mégaoctets.
    """
    return httpx.Timeout(
        connect=CONNEXION,
        read=min(timeout, LECTURE),
        write=min(timeout, LECTURE),
        pool=min(timeout, LECTURE),
    )


class TropLente(RuntimeError):
    """La tentative n'a pas fini dans son budget de temps.

    Ce n'est ni une erreur réseau ni un corps court : c'est un flux qui avance
    trop lentement pour aboutir. La reprise garde ce qui est arrivé.
    """


class Tronque(RuntimeError):
    """Le serveur a rendu moins d'octets qu'il n'en avait annoncé.

    Ce n'est pas une erreur réseau : la requête a réussi, le corps est court.
    Sans ce contrôle, un zip amputé arrive jusqu'au connecteur, qui meurt sur
    « File is not a zip file » — ou pire, un CSV amputé se charge en silence.
    """


def _annoncee(reponse: httpx.Response) -> int | None:
    """Taille totale du fichier telle que le serveur l'annonce, si elle l'est.

    Sur une réponse partielle (206), c'est le total de `Content-Range` qu'il
    faut lire, pas le `Content-Length` — qui ne décrit que le morceau servi.
    """
    plage = reponse.headers.get("content-range")
    if plage and "/" in plage:
        total = plage.rsplit("/", 1)[1].strip()
        if total.isdigit():
            return int(total)
    longueur = reponse.headers.get("content-length")
    if not longueur or not longueur.isdigit():
        return None
    # `Content-Length: 0` sur une réponse qui porte un corps n'est pas une
    # taille : c'est un serveur qui ne la connaît pas encore parce qu'il
    # diffuse en flux. Eurostat répond ainsi sur son API de diffusion, et le
    # prendre au mot faisait déclarer tronquées 80 Ko parfaitement reçus.
    # Une réponse réellement vide est attrapée plus loin, sur le tampon.
    taille = int(longueur)
    return taille if taille > 0 else None


def fetch(url: str, headers: dict | None = None, timeout: float = 60.0) -> httpx.Response:
    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
            if response.status_code in RETRYABLE_STATUS:
                last_error = httpx.HTTPStatusError(
                    f"HTTP {response.status_code}", request=response.request, response=response
                )
            else:
                response.raise_for_status()
                attendu = _annoncee(response)
                if attendu is not None and len(response.content) < attendu:
                    # Même défaut que dans `telecharger`, sans la reprise :
                    # sur une réponse d'API, redemander tout ne coûte rien.
                    last_error = Tronque(
                        f"{url} : {len(response.content)} octets reçus sur {attendu}"
                    )
                else:
                    return response
        except (httpx.TransportError, httpx.HTTPStatusError) as error:
            last_error = error
        if attempt < MAX_ATTEMPTS - 1:
            time.sleep((2**attempt) + random.uniform(0, 1))
    raise last_error


def _taille_declaree(url: str, headers: dict | None, timeout: float) -> int | None:
    """Taille du fichier d'après le serveur, demandée avant de le lire.

    Le corps, lui, peut arriver compressé et découpé — c'est le cas derrière un
    proxy qui ré-encode : la réponse perd son `Content-Length` et plus rien ne
    dit qu'elle est complète. Un `HEAD` répond sur le fichier, pas sur son
    transport, et c'est ce qui rend le contrôle possible dans les deux cas.

    -> None si le serveur ne répond pas au `HEAD` ou n'annonce rien : il n'y a
    alors rien à vérifier, et refuser par principe casserait des sources qui
    marchent.
    """
    try:
        reponse = httpx.head(
            url, headers=headers, timeout=_delais(timeout), follow_redirects=True
        )
    except httpx.TransportError:
        return None
    return None if reponse.status_code >= 400 else _annoncee(reponse)


def telecharger(
    url: str, headers: dict | None = None, timeout: float = 300.0, essais: int = REPRISES
) -> bytes:
    """Télécharge un fichier entier, en reprenant là où la connexion a lâché.

    Sur les gros fichiers de l'API de l'INSEE, le flux se coupe en cours de
    route. Le corps rendu est court, sans erreur : le zip qui en sort n'est plus
    un zip, et le connecteur meurt sur `BadZipFile` — quatre minutes de CI et un
    entrepôt de un gigaoctet rapatrié pour rien. Le 5 août, c'est ce qui a tué le
    premier chargement des créations d'entreprises.

    La taille annoncée fait donc foi, et elle est demandée par `HEAD` avant de
    lire quoi que ce soit — la réponse au `GET` peut n'en porter aucune. Tant
    que le corps est plus court, la suite est redemandée par `Range` ; l'API de
    l'INSEE répond bien en 206. Un serveur qui ignore la reprise renvoie un
    200 : le tampon est alors vidé et la tentative repart du début, plutôt que
    de coller deux fois le même préfixe.

    Ce qui est déjà reçu n'est jamais jeté sur une erreur : `iter_bytes` ne rend
    que des morceaux entiers, donc le tampon est toujours un préfixe valide du
    corps, et la tentative suivante repart de là. Une tentative qui n'aboutit pas
    dans son budget de temps est abandonnée pour la même raison — c'est la seule
    façon dont ce téléchargement puisse pendre au lieu d'échouer.

    Le corps est demandé sans compression de transport (`identity`). Sans cela,
    un proxy qui gzippe à la volée rendrait des octets décompressés dont le
    nombre ne se compare plus à la taille annoncée, et le contrôle mesurerait
    une autre grandeur que celle qu'il croit mesurer.
    """
    entetes_base = {"Accept-Encoding": "identity", **(headers or {})}
    tampon = bytearray()
    attendu = _taille_declaree(url, entetes_base, timeout)
    # Le délai porte sur *une* opération, pas sur le fichier : une source qui
    # s'arrête de parler doit être constatée en une minute, pas au bout du
    # budget entier. Sans ce plafond, un flux coupé à mi-parcours immobilise le
    # run cinq minutes avant que la reprise ne démarre — deux tentatives et le
    # téléchargement dépasse le quart d'heure pour quarante mégaoctets.
    delais = _delais(timeout)
    dernier: Exception | None = None
    for essai in range(essais):
        entetes = dict(entetes_base)
        if tampon:
            entetes["Range"] = f"bytes={len(tampon)}-"
        try:
            with httpx.stream(
                "GET", url, headers=entetes, timeout=delais, follow_redirects=True
            ) as reponse:
                if reponse.status_code in RETRYABLE_STATUS:
                    raise httpx.HTTPStatusError(
                        f"HTTP {reponse.status_code}",
                        request=reponse.request,
                        response=reponse,
                    )
                reponse.raise_for_status()
                if tampon and reponse.status_code != 206:
                    tampon.clear()
                if attendu is None:
                    # Seulement en secours : une réponse tronquée peut porter
                    # un `Content-Length` égal à ce qu'elle sert. L'écraser
                    # avec ça reviendrait à demander au coupable sa taille.
                    attendu = _annoncee(reponse)
                debut = time.monotonic()
                for bloc in reponse.iter_bytes():
                    tampon.extend(bloc)
                    if time.monotonic() - debut > TENTATIVE:
                        raise TropLente(
                            f"{url} : {len(tampon)} octets en {TENTATIVE:.0f} s"
                        )
        except (httpx.TransportError, httpx.HTTPStatusError, TropLente) as erreur:
            dernier = erreur
        else:
            if attendu is None or len(tampon) >= attendu:
                break
            dernier = Tronque(f"{url} : {len(tampon)} octets reçus sur {attendu}")
        if essai < essais - 1:
            time.sleep((2 ** min(essai, 4)) + random.uniform(0, 1))
    # `<` et non `!=`, comme la condition de sortie de la boucle : les deux se
    # contredisaient, si bien qu'un téléchargement déclaré réussi à la sortie
    # pouvait être refusé juste après.
    if attendu is not None and len(tampon) < attendu:
        raise Tronque(
            f"{url} : {len(tampon)} octets reçus sur {attendu} après {essais} tentatives"
        )
    if not tampon:
        raise dernier or Tronque(f"{url} : réponse vide")
    return bytes(tampon)
