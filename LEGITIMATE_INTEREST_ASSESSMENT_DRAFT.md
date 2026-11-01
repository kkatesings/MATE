# MATE – érdekmérlegelési teszt (belső tervezet)

**Állapot:** 0.2 - előzetes munkaváltozat, nem végleges jogi állásfoglalás és nem publikálható tájékoztató.  
**Készült:** 2026. november 1.  
**Adatkezelőként megadott személy:** Kálmán Kata  
**Kapcsolat:** kate.kalman@gmail.com  
**Vizsgált jogalap:** GDPR 6. cikk (1) bekezdés f) pont – jogos érdek  
**Hatókör:** a MATE-ban helyben, az adott böngésző `localStorage` tárában megőrzött appadatok, kizárólag helyi módban. Nem terjed ki a Firebase-fiókra és felhőszinkronra, a GitHub Pages szervernaplóira, illetve külső szolgáltatók saját adatkezelésére.

> Ezt a tesztet az adatkezelés megkezdése előtt véglegesíteni, a tényleges működéssel összevetni és dokumentáltan jóváhagyni kell. A jogos érdek csak akkor megfelelő jogalap, ha mindhárom feltétel teljesül: valós jogos cél, szükségesség, majd az érintetti jogokkal és várakozásokkal szembeni mérlegelés. Az adatkezelő viseli ennek igazolási felelősségét.

## 1. Tényállás és feltételezések

Az alkalmazás helyi módjában a felhasználó saját feladatokat, kategóriákat, határidőket, projekteket, megjegyzéseket, szokásokat, napi teljesítéseket és fókuszidőket rögzíthet. Az app ezeket a böngésző `localStorage` tárában tartja meg, hogy oldalváltás, frissítés vagy a böngésző bezárása után se vesszenek el. Az üres telepítés alapértelmezett állapota az első felhasználói módosításig csak a lap memóriájában van; az első mentett appművelettől kezdve az állapot a `mate.accountability.data` kulcs alatt található. Ha egy mentett állapot hibás, a helyreállítási ág egy másolatot külön kulcs alatt őrizhet meg. Több felhőfiók közti váltáskor az app korábbi fiókadatok helyi másolatát is készítheti a böngészőben. A Matt-üzenetek előzménye csak a lap memóriájában él, nem kerül külön mentésre. A helyi mód beállításai között van helyi JSON-export és adattörlés, valamint rövid tájékoztató a böngészőprofilhoz való hozzáférésről.

Az alábbi előzetes következtetés ezekre a működési feltételezésekre épül. A kiadás előtt igazolni kell, hogy:

- helyi módban az appadat nem kerül a MATE üzemeltetőjéhez, Firebase-be vagy analitikai/hirdetési szolgáltatóhoz; a Firebase SDK kódja csak korábbi felhőfiók kezelésekor vagy érvényes felhő-hozzájárulás után töltődik le a Google CDN-jéről;
- nincs rejtett használati mérés, profilalkotás vagy másodlagos cél;
- a felhasználó által beírt szabad szövegben szerepelhet személyes vagy akár különleges adat, de az app ilyen adatot nem kér és nem elemez;
- a felhasználó a saját eszközén/böngészőprofiljában használja az appot; közös eszközön a helyi példányhoz más eszközhasználók is hozzáférhetnek;
- a helyi adatok megőrzése a felhasználó törléséig vagy a böngészőadatok eltávolításáig tart. Automatikus lejárat jelenleg nincs igazolva.

## 2. A jogos érdek azonosítása – első feltétel

**Javasolt érdek:** a MATE üzemeltetőjének érdeke abban, hogy a felhasználó által kifejezetten kért feladat- és szokáskövető alkalmazás alapvető, tartós működését biztosítsa: a felhasználó saját bejegyzései megmaradjanak az általa használt böngészőben, és az előzményekből vissza tudja nézni a teljesítéseit.

Ez konkrét, jelenlegi és jogszerű szolgáltatási cél lehet. Nem üzleti profilalkotásra, hirdetésre vagy az adatok értékesítésére irányul. A cél kizárólag a helyi tracker működéséhez szükséges adatok megőrzése.

**Előzetes eredmény:** a cél megfelelően pontosítható és valósnak tűnik, ha az adatkezelő tényleges érdeke valóban a helyi, tartós appműködés biztosítása. Az adatkezelőnek ezt saját céljaként kell megerősítenie; a felhasználók kényelme önmagában nem helyettesíti az adatkezelő valós, dokumentált érdekét.

## 3. Szükségesség – második feltétel

**Miért lehet szükséges?** A MATE fő funkciója több napon át követni feladatokat, szokásokat és fókuszidőt. Pusztán memóriában tartott adatok elvesznének a lap/böngésző bezárásakor; a `sessionStorage` is csak a lap munkamenetéig tart. A felhasználó által kézzel végzett export–import kevésbé kényelmes és nem biztosít folyamatos előzményt. A böngésző helyi tárában történő mentés ezért alkalmas és a jelenlegi felépítés mellett aránylag kevés adatot továbbító megoldás.

**Kevésbé korlátozó alternatívák:**

1. Csak memóriában tartás: kevesebb tartós tárolás, de nem ad használható, többnapos nyilvántartást.
2. Kizárólag felhasználói export–import: a felhasználó kezében marad az adat, de rendszeres kézi műveletet és fájlkezelést igényel.
3. Felhőalapú mentés: több eszközön elérhető, ugyanakkor nagyobb adatmozgással, szolgáltatói hozzáféréssel és külön hozzájárulási folyamattal jár. A helyi tárolás céljához nem szükséges.

**Adattakarékossági korlát:** csak a működéshez ténylegesen szükséges mezők maradjanak meg. Ne gyűljön használati analitika, hirdetési azonosító vagy háttérben küldött eseménynapló. A felhasználó szabad szövegű jegyzeteire legyen világos figyelmeztetés, hogy ne írjon be különösen érzékeny vagy más személyre vonatkozó adatot, ha arra nincs szükség.

**Előzetes eredmény:** az app tartós, helyi tracker funkciójához a mentés ésszerűen szükségesnek látszik, de csak akkor, ha az adatkezelő igazolja, hogy az app a bejegyzéseket valóban helyben használja, és nincs ugyanolyan hatékony, kevésbé beavatkozó megoldás.

## 4. Érdekmérlegelés – harmadik feltétel

| Tényező | Előzetes értékelés |
|---|---|
| Az érintett és az adatkezelő kapcsolata | A felhasználó önként megnyitja a trackert, és saját maga rögzíti az adatokat. A tartós feladat-/szokáskövetés és a helyi mentés ésszerűen elvárható az app használatakor. |
| Az adatok jellege | A mezők többnyire hétköznapi feladat- és szokásadatok. A megjegyzés és a feladat-/habit-név szabad szövege viszont érzékeny vagy különleges adatot is felfedhet; az app nem kér ilyen adatokat, de ezt a kockázatot nem zárja ki. |
| Hozzáférés és továbbítás | Helyi módban az adatok az eszköz böngészőprofiljában maradnak, így a MATE üzemeltetője nem kapja meg őket. A böngészőprofilhoz vagy az eszközhöz hozzáférő más személyek, illetve azonos eredetű rosszindulatú kód kockázata fennmarad. A `localStorage` nem titkosított jelszótár. |
| Lehetséges hatás | Más eszközhasználó megláthatja a helyi bejegyzéseket; a böngészőadatok törlése adatvesztést okozhat. Az app szokáskövetése önmagában nem hoz joghatással vagy hasonlóan jelentős hatással járó döntést. |
| Felhasználói várakozás és választás | A felhasználó maga viszi be a saját nyilvántartását egy trackerbe. A helyben maradás kevésbé meglepő, mint a háttérben történő szerverre küldés; felhőszinkron csak külön, kifejezett hozzájárulással történhet. |
| Előnyök és kockázatcsökkentés | A tartós előzmények lehetővé teszik a kért szolgáltatást, miközben nem kell helyi adatot szerverre küldeni. A kockázat csökkenthető adattakarékossággal, HTTPS-es kiszolgálással, biztonságos kódkezeléssel, törlési/exportlehetőséggel és világos tájékoztatóval. |

**Előzetes mérleg:** a fenti feltételek teljesülése mellett az adatkezelő működtetési érdeke valószínűleg nem írja felül a felhasználók jogait, mert az adatok saját bevitelűek, helyben maradnak, nincs profilalkotás vagy reklámcél, és a felhasználó megtarthatja a helyi módot felhőfiók nélkül. Az eredmény azonban érzékeny szabad szöveg, közös eszközök, rejtett hálózati küldés, hiányzó törlési lehetőség vagy túlzott megőrzés esetén megváltozhat.

## 5. Szükséges biztosítékok és nyitott teendők

Az előzetes pozitív eredmény csak akkor tartható fenn, ha az adatkezelő a közzététel előtt mindegyiket ellenőrzi:

- [ ] Ellenőrzi a hálózati működést: helyi módban sem task/habit tartalom, sem használati esemény nem hagyja el az eszközt. A Firebase-felhő külön funkcióként, külön célra és külön hozzájárulással működik.
- [x] Beépült egy rövid, érthető helyi tárolási tájékoztatás, adatletöltés és adattörlés a Beállítások képernyőre. A nyilvános tájékoztatóban szerepel a jogos érdek konkrét célja és a tiltakozás módja; ezek tartalmát és jogi megfelelőségét a kiadás előtt az adatkezelőnek ellenőriznie kell.
- [x] Beépült egy felismerhető helyi adattörlési lehetőség, amely a fő MATE-adatot, a helyi fiókmásolatokat, a régi Matt-idézet-előzmény kulcsát és a helyreállítási másolatokat kezeli. A felület újraindítja az appot; a törlés tényleges működését kiadás előtt kézzel ellenőrizni kell.
- [ ] Meghatároz egy felhasználóbarát tiltakozási folyamatot a helyi adatkezelésre. A GDPR 21. cikke szerinti tiltakozást egyedileg kell elbírálni; amíg az adatkezelő nem igazolja az érintett érdekeit felülíró kényszerítő erejű jogos okot, az érintett adat helyi további kezelését le kell állítani. A megvalósítható út lehet a helyi mentés leállítása és a felhasználó által kért adatok törlése, az ügy körülményei szerint.
- [ ] Tájékoztatja a felhasználót a böngészőprofil-hozzáférés, közös eszközök és böngészőadat-törlés kockázatáról; javasolja az eszköz zárolását és a mások számára nem hozzáférhető böngészőprofilt.
- [ ] Ellenőrzi a beviteli mezőket és a renderelést (XSS-védelem), HTTPS-t, függőségeket és külső scripteket. A helyi tárolás önmagában nem jelent titkosítást.
- [ ] A jegyzetekben és elnevezésekben nem kér különleges adatot; ha a szolgáltatás később ilyen adatot szándékosan gyűjt vagy abból következtetést készít, külön GDPR 9. cikk szerinti feltétel és új értékelés szükséges.
- [ ] Külön megvizsgálja, hogy a GDPR szerinti adatkezelői szerep pontosan hogyan oszlik meg az app üzemeltetője és a helyben futtató felhasználó között, továbbá ellenőrzi a magyar ePrivacy-szabályokat. A helyi technikai tárolásnál a GDPR jogalapja és az eszközön történő tárolás ePrivacy-szabálya két külön kérdés.

**Aktuális appállapot alapján:** a fő MATE-állapot `localStorage`-ban van; az app hibás adat esetén helyreállítási másolatot készíthet. Az új telepítés alapállapota az első felhasználói mentésig nem íródik ki a tárba. A beállítások képernyőn van helyi JSON-letöltés és helyi adattörlési vezérlő. A törlés csak helyi módban érhető el; a felhőadat külön törlési folyamatához nem nyúl. Új, csak helyi felhasználónál a Firebase klienskód nem töltődik le; korábban összekapcsolt fiók kezeléséhez viszont betöltődik a Google CDN-jéről, és ennek kérési metaadatait a Google feldolgozhatja. A GitHub Pages kiszolgálási naplói külön adatkezelés, ez a teszt nem rendezi. A tételes hálózati viselkedést kiadás előtt kézzel is ellenőrizni kell.

## 6. Előzetes döntés

**Javasolt jogalap a helyi appadatok tárolásához:** GDPR 6. cikk (1) bekezdés f) pont szerinti jogos érdek lehet, feltételesen. Ez nem szerződéses jogalap, és nem jelent beleegyezési checkboxot a helyi mentéshez. A felhőbe történő Google-belépés/szinkron külön cél marad, amelyhez a projekt döntése szerint kifejezett hozzájárulás kell; a helyi érdekmérlegelés ezt nem váltja ki.

**A teszt előzetes kimenetele:** „valószínűleg elfogadható, ha a fenti tényállás igaz, a szükséges biztosítékok elkészülnek, és az adatkezelő jóváhagyja”. Ez nem automatikus felhatalmazás és nem jogi garancia. Ha a helyi tárolás nem tekinthető a kifejezetten kért szolgáltatás szükséges részének, az érintettek érdekei felülmúlják az adatkezelő érdekét, vagy a valós működés eltér a feltételezésektől, más jogalapot kell választani vagy a funkciót módosítani.

## 7. Külön eszköztárolási (ePrivacy) kérdés

A GDPR 6. cikk szerinti jogos érdek csak a személyesadat-kezelés jogalapjáról szól. Nem ad automatikusan engedélyt arra, hogy a weboldal információt tároljon vagy olvasson ki a felhasználó eszközén. Az ePrivacy irányelv 5. cikk (3) bekezdése külön hozzájárulást ír elő, kivéve többek között azt a technikai tárolást, amely szigorúan szükséges a felhasználó által kifejezetten kért információs társadalmi szolgáltatás nyújtásához. Az EDPB technológiasemleges iránymutatása a böngészőtárat és az egyedi szoftveres tárolást is tárgyalja.

A MATE helyi trackerének mentése **lehet** ilyen szigorúan szükséges tárolás, mert a felhasználó éppen egy több napon át megőrző feladat-/habitkövetőt használ. Ezt nem szabad kész tényként kezelni: a szolgáltatás pontos leírását, a tárolt kulcsokat, a helyi törlést és a magyar átültető szabályokat adatvédelmi szakértővel kell ellenőrizni. A MATE nem tárolhat nem szükséges azonosítókat vagy analitikát erre a kivételre hivatkozva.

## 8. Tájékoztatás és érintetti jogok

Ha a helyi feldolgozás jogalapja jogos érdek, a tájékoztatóban konkrétan közölni kell ezt a jogos érdeket, nem elég csak a GDPR cikkét felsorolni. Az érintettet külön tájékoztatni kell a GDPR 21. cikke szerinti tiltakozási jogról. A MATE-nak meg kell adnia az adatkezelő nevét, e-mail-címét, adatfajtákat, célt, jogalapot, tárolási időt, címzetteket/hozzáférést, érintetti jogokat és a panasz lehetőségét is. A hozzájárulás visszavonási folyamata a felhőszinkronra vonatkozik; a jogos érdeken alapuló helyi mentésre a tiltakozás folyamata vonatkozik.

## Hivatalos források

- [GDPR – különösen 5., 6., 13. és 21. cikk (EUR-Lex)](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)
- [EDPB Guidelines 1/2024 – a jogos érdek három feltétele (konzultációs verzió és kapcsolódó anyagok)](https://www.edpb.europa.eu/documents/guideline/guidelines-12024-on-processing-of-personal-data-based-on-article-61f-gdpr_en)
- [ePrivacy irányelv 5. cikk (3) bekezdés – eszköztárolás és kivétel (EUR-Lex)](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A02002L0058-20091219)
- [EDPB Guidelines 2/2023 – az ePrivacy 5. cikk (3) technológiai hatálya](https://www.edpb.europa.eu/system/files/2023-11/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_en.pdf)
- [NAIH – esettanulmányok a GDPR 6. cikk (1) f) pontján alapuló adatkezelésről](https://naih.hu/hirek/822-esettanulmany-a-gdpr-6-cikk-1-bekezdes-f-pontjan-alapulo-adatkezelesekrol)

