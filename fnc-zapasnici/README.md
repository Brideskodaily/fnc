# FNC Zápasníci

Webová appka na záznamy zápasníkov Fight Night Challenge: roster so skóre V-P-R, detail zápasníka, prehľad podľa turnajov. Statická stránka a jedna serverless funkcia pre Vercel.

## Štruktúra

```
index.html            celá appka (HTML + CSS + JS)
api/fighters.js       API: čítanie a ukladanie dát (Vercel Function)
data/fighters.json    úvodné dáta (17 + 1 zápasník, FNC 1–11), záloha
fonts/                United Sans (woff2, 5 rezov)
assets/               logá FNC (biele a čierne)
package.json          závislosť @upstash/redis
vercel.json           cache hlavičky pre fonty a logá
```

## Nasadenie na Vercel

1. **Nahraj priečinok na GitHub** (nový repozitár) a vo Verceli daj *Add New → Project → Import*.
   Framework Preset: **Other**. Build Command a Output Directory nechaj prázdne.
   (Alternatíva bez GitHubu: `npm i -g vercel` a v tomto priečinku spusti `vercel`.)
2. **Pripoj úložisko:** v projekte na Verceli *Storage → Create / Connect Database → Upstash for Redis*
   (free plán stačí) a pripoj ho k projektu. Vercel sám doplní premenné `KV_REST_API_URL` a `KV_REST_API_TOKEN`.
3. **Nastav heslo na úpravy:** *Settings → Environment Variables* → pridaj `ADMIN_PASSWORD` s heslom pre tím.
4. **Redeploy** (*Deployments → … → Redeploy*), aby sa premenné načítali.

Pri prvom otvorení stránky sa prázdne úložisko automaticky naplní dátami z `data/fighters.json`. Stane sa to len raz.

## Používanie

- Stránku vidí každý s odkazom, len na čítanie.
- Na úpravy klikni hore na **Prihlásiť** a zadaj `ADMIN_PASSWORD`. Prehliadač si heslo zapamätá, kým sa neodhlásiš.
- Prihlásený člen tímu môže pridávať zápasníkov, zápasy (FNC číslo, súper, výsledok, poznámka), upravovať a mazať.
- Stránka sa každých 30 sekúnd obnoví, takže zmeny od ostatných sa ukážu samé.
- **Iné mená** v detaile zápasníka prepoja zápasy, keď sa ten istý človek objavuje pod iným menom (napr. Kiry = Király).

## Ak niečo chýba

- **Bez úložiska** (krok 2) stránka funguje len na čítanie z `data/fighters.json` a zobrazí upozornenie.
- **Bez `ADMIN_PASSWORD`** sa úpravy vypnú úplne.
- **Reset na úvodné dáta:** v Upstash konzole zmaž kľúče `fnc:fighters` a `fnc:seeded`, potom stránku obnov.
- **Záloha aktuálnych dát:** otvor `https://<tvoja-domena>/api/fighters` a ulož si JSON.

## Dátový model

Každý zápasník je jeden záznam:

```json
{
  "id": "flexking",
  "name": "Flexking",
  "order": 4,
  "aliases": [],
  "fights": [
    { "id": "s01", "event": 1, "opponent": "Čis T", "result": "W", "note": "" }
  ]
}
```

`result`: `W` výhra, `L` prehra, `D` remíza, `P` bez výsledku. Skóre V-P-R, rebríček a série sa počítajú automaticky zo zápasov.

## Licencia fontu

United Sans (House Industries) je v `fonts/` a stránka ho servíruje verejne. Over, že vaša licencia pokrýva webové použitie (na fnc.live ho už používate).
