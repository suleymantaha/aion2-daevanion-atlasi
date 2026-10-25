# AION 2 Daevanion Atlası

Ücretsiz, açık kaynak Daevanion kutu ve rota planlayıcı.

**Site:** https://aion2-daevanion-atlasi.pages.dev/

**Katkı / pull request:** [CONTRIBUTING.md](CONTRIBUTING.md)

## Kapsam

Global sürümdeki Gladiator, Templar, Assassin, Ranger, Sorcerer, Spiritmaster, Cleric ve Chanter sınıfları. Her sınıfın 6 tahtası, kutu etkileri, skill adları, numaralı rotası ve ek kristal hesabı bulunur. Manuel işaretlemeler sınıfa göre ayrılır ve yalnızca ziyaretçinin tarayıcısında saklanır.

Brawler, kaynak Global sürümde karakter oluşturulamadığı için desteklenmez. Veri sürümü `2026.10.21`; istemci güncellemeleri ve bölgesel farklılıklar olabilir.

**Doğrulama ne anlama geliyor?** Kutuların skill ID/adları ilgili sınıfın ayrı kaynak sayfasıyla karşılaştırıldı. Bu, aynı resmî olmayan kaynağın tutarlılık kontrolüdür; NCSOFT onayı veya bütün kutuların canlı oyunda denenmesi değildir. [Kaynak yöntemi ve sınırlamalar](docs/data-provenance.md).

En düşük ek kristal maliyetini hesaplar. Yatay/dikey komşuluk ve eşit maliyetli yol seçimi varsayımları içerir; “en iyi build” önermez. Harcamadan önce oyundaki önizlemeyi kontrol edin.

## Yerelde çalıştırma

Node.js 20+ ve Python 3 kullanın. Paket kurulumu gerekmez.

```sh
npm run validate
npm test
npm run check
npm run build
python -m http.server 8080 --directory dist
```

Ardından http://localhost:8080 adresini açın. JSON dosyaları `fetch` ile okunduğu için HTML dosyasını doğrudan `file://` ile açmayın.

## Veri güncelleme

```sh
node scripts/import-data.mjs
npm run validate
npm test
```

Kaynak erişimi değişirse importer güvenli biçimde hata vermelidir. Eksik skill adlarını, ID'leri veya sınıfları tahmin ederek tamamlamayın. Yeni veri için kaynağı, sürümü ve kontrol kanıtını PR'a ekleyin.

## Lisans ve veri

Uygulama kodu **MIT** lisanslıdır. Oyun verileri, skill adları ve diğer üçüncü taraf içerikleri bu lisansa dahil değildir. [DATA_NOTICE.md](DATA_NOTICE.md) ve [Aion2Data kaynak koşulları](https://aion2data.com/creators) geçerlidir. Oyun görselleri bu depoda dağıtılmaz. Bu proje NCSOFT ile bağlantılı değildir.
