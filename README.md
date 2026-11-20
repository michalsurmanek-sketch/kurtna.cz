# Kurtna.cz

Katalog běží na GitHub Pages z větve `main`. Veřejná nabídka, odkazy na detaily a košík používají stejný soubor `catalog.json`. Nové obrázky patří do `assets/`. Košík připravuje textové podklady poptávky a nedělá objednávku ani platbu.

## Správa katalogu

1. Otevřete [kurtna.cz/admin.html](https://kurtna.cz/admin.html).
2. Vyberte produkt nebo založte nový. Po editaci klikněte na „Uložit produkt do změn“. Stejně lze produkt skrýt z nabídky nebo označit za nedostupný.
3. K publikaci použijte omezený token GitHubu pro tento repozitář s oprávněním **Contents: Read and write**. Publikace zapíše katalog do `main` a GitHub Pages jej nasadí. Při konfliktu si před obnovením stránky uschovejte rozpracované údaje a znovu načtěte aktuální katalog.

Pro výměnu fotografie nahrajte soubor na GitHub do `assets/` a do produktu vložte jeho cestu, například `assets/kurtna-5t-8m.webp`. Aktivní interval a oprávnění tokenu nastavuje majitel repozitáře na GitHubu. Údaje skrytých produktů zůstávají ve veřejném repozitáři.

Lokální náhled lze otevřít přes HTTP server, například `python3 -m http.server 8000`.

## SEO

Při publikaci v administraci se společně uloží katalog, dotčené stránky v `produkt/` a `sitemap.xml`. Administrace vytvoří stránky pro nové položky a odstraní stránky položek skrytých v nabídce. Každý detail obsahuje vlastní adresu, titulek, popis, strukturovaná data a produktový náhled pro sdílení přímo v HTML. Staré odkazy s parametrem `?produkt=` fungují dál.

Při přímé editaci katalogu na GitHubu je nutné aktualizovat také výstupy, které jinak vytváří administrace. Při úpravě společné šablony lze regenerovat všechny detaily příkazem `node regenerate-products.mjs`.
