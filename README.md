# Kurtna.cz

Responzivní katalog podle přiloženého vizuálu. Bez závislostí a sestavování: publikujte index.html a app.js ze stejného adresáře přes statický hosting (GitHub Pages / Cloudflare Pages).

## Hotové funkce
- Vyhledávání bez ohledu na diakritiku, filtr provedení a délky, řazení podle ceny.
- Detail produktu, mobilní navigace, přístupné dialogy.
- Košík: přidávání, odebírání, mazání, limit 99 ks, uchování v localStorage.
- Formulář a lokální textový export podkladů poptávky. Osobní údaje se nikam neodesílají.

## Před ostrým prodejem
Toto je katalog s ilustračními produkty a orientačními cenami, nikoliv aktivovaný e-shop. Je nutné dodat skutečné údaje provozovatele a kontakt, potvrzené produkty a parametry LC/STF, sklad, ceny a daňový režim, dopravu, obchodní podmínky a ochranu osobních údajů. Pro příjem objednávek je potřeba serverové úložiště, validace cen na serveru, e-mailové doručování a případně platební brána. Není zde předstírané přihlášení ani nezabezpečená administrace.

## Kontroly
node --check app.js

Ověřena syntaxe JS, unikátní HTML ID, cíle interních odkazů a konzistence katalogu. Kompletní průchod ve skutečném prohlížeči nebyl proveden. Doména ani hosting nejsou tímto commitem automaticky aktivované.
