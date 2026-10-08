# Kelime Avı (Word Hunter) 🎯
**Telefon İçin Kişisel İngilizce Kelime Çalışma ve Aralıklı Tekrar (SRS) Uygulaması (PWA)**

Bu uygulama, Reword uygulamasından çıkarılan 6.120 kelimelik veri setini ve kullanıcının kendi eklediği özel kelimeleri kullanarak, aralıklı tekrar yöntemiyle İngilizce kelimeleri kalıcı hafızaya kazımak için geliştirilmiş, **%100 çevrimdışı (offline)** çalışan modern bir PWA (Progressive Web App) uygulamasıdır.

---

## 🌟 Öne Çıkan Özellikler

### 1. 🥇 Kullanıcı Kelimelerine En Yüksek Öncelik
- Kullanıcının doğrudan eklediği özel kelimeler (`custom`) ve Reword'den aktarılan kelimeler (`stage > 0`), çalışma ve öğrenme kuyruklarında **her zaman ilk sıraya** yerleşir.
- Ayarlar menüsünden *"Kendi Kelimelerime Öncelik Ver"* anahtarı ile bu davranış özelleştirilebilir (varsayılan: Aktif).

### 2. 🧠 Gelişmiş Aralıklı Tekrar (SRS) Motoru
- **Aralık Merdiveni**: `1 → 2 → 4 → 7 → 14 → 21 gün`.
- **Mastered (Öğrenildi) Kuralı**: 21 günlük aralıktan sonra tekrar doğru bilinirse VEYA 21 gün üst üste seri yapılırsa kelime `mastered` durumuna geçer.
- **Hata Toleransı**: Yanlış bilinen kelime 1 gün aralığa sıfırlanır, `streak` sıfırlanır ve aynı turun sonunda tekrar sorulur.
- **Gece Baykuşu Desteği**: Gün değişimi **gece 04:00**'te gerçekleşir (gece 02:00'deki çalışma bir önceki günün serisine sayılır).
- **Yığılma Önleyici Günlük Limit**: Günlük maksimum tekrar limiti (varsayılan 40) gecikmiş kelimelerin birikmesini önler; en eski gecikmiş kelimeler öncelikli akar.
- **Reword Öncelik Dağıtımı**: Reword'de daha önce çalışılmış ~666 kelime, ilk açılışta ilk 14 güne kademeli dağıtılarak tekrar havuzuna eklenir.

### 3. 🎮 Eğlenceli ve Çeşitli Alıştırmalar
- Oturum içinde dinamik olarak değişen 5 farklı alıştırma türü (aynı tür üst üste en fazla 2 kez gelir):
  1. **Yazarak Cevapla**: Klavyeden Türkçe karşılığa göre İngilizce yazma.
  2. **4 Şıklı Test**: Hızlı tanıma ve pekiştirme.
  3. **Harf Karıştırma (Scramble)**: Dokunmatik harf kutucuklarını sıraya dizme.
  4. **Boşluk Doldurma (Cloze)**: Örnek cümledeki gizli kelimeyi bulma.
  5. **Dinle ve Yaz**: Cihazın kendi sesiyle telaffuzu duyup yazma.
- **60 Saniye Hızlı Tur**: Zamana karşı refleks mini oyunu (SRS tekrar aralıklarını etkilemez).
- **Combo & Haptik Efekt**: Üst üste doğrularda artan çarpan, Web Audio chime sesleri, titreşim ve konfeti animasyonları.
- **Seviye, XP ve Rozetler**: 10 farklı başarı rozeti (İlk Adım, Sözlük Fatihi, Alışkanlık Canavarı vb.).

### 4. 🔊 %100 Çevrimdışı Telaffuz (Web Speech API)
- Harici ses dosyası ve internet bağlantısı gerektirmez; cihazın yerel `speechSynthesis` (en-US) motorunu kullanır.

### 5. 💾 Güvenli Yedekleme ve Geri Yükleme
- Ayarlar > **Yedek Al**: İlerleme, ayarlar, özel kelimeler ve istatistikleri `kelime-avi-yedek-YYYY-MM-DD.json` olarak dışa aktarır (Web Share API ile WhatsApp veya Google Drive'a tek tıkla gönderme).
- **Yedekten Geri Yükle**: Önizleme modalı ile kontrol ederek geri yükleme.
- **Birleştirerek Yükle**: Mevcut veriyi silmeden, iki kayıttan en son çalışılanı koruyarak akıllı birleştirme.
- 7 günde bir otomatik yedek alma hatırlatma şeridi.

---

## 🚀 Yerel Olarak Çalıştırma

Projeyi bilgisayarınızda çalıştırmak ve test etmek için:

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Birim testlerini çalıştırın
npm test

# Üretim (PWA) derlemesini alın
npm run build
```

---

## 🌐 Ücretsiz Yayınlama Rehberi (GitHub Pages & Netlify)

Uygulamanızı telefonunuzdan kullanabilmek için internete ücretsiz olarak yükleyebilirsiniz:

### Seçenek 1: Netlify (En Kolay & En Hızlı - 2 Dakika)

1. [netlify.com](https://www.netlify.com) adresine gidin ve ücretsiz hesap açın.
2. Terminalinizde üretim derlemesini alın:
   ```bash
   npm run build
   ```
3. Proje klasörünüzde oluşan `dist` klasörünü Netlify paneline girip **"Sites" > "Drag & Drop your site folder"** alanına sürükleyip bırakın.
4. Netlify size anında çalışan bir HTTPS linki (`https://sizin-uygulama.netlify.app`) verecektir!
5. Telefonunuzun tarayıcısından (Chrome veya Safari) bu linki açın.

---

### Seçenek 2: GitHub Pages

1. GitHub'da yeni bir repository oluşturun (örneğin `kelime-avi`).
2. Eğer projenizi bir alt yolda yayınlayacaksanız (ör: `username.github.io/kelime-avi/`), `vite.config.ts` dosyasına `base: './'` satırını ekleyin.
3. Projenizi GitHub'a yükleyin:
   ```bash
   git init
   git add .
   git commit -m "Kelime Avı PWA ilk sürüm"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADINIZ/kelime-avi.git
   git push -u origin main
   ```
4. GitHub'da deponuzun **Settings > Pages** sekmesine gidin.
5. **Source** kısmını "GitHub Actions" olarak seçin veya `dist` klasörünü `gh-pages` dalına gönderin.

---

## 📱 Telefona Yükleme (PWA Olarak Kurulum)

1. Telefonunuzun tarayıcısında (Safari veya Chrome) yayınladığınız site adresini açın.
2. **iPhone (Safari)**:
   - Alttaki **Paylaş** (kare içinden yukarı ok) simgesine dokunun.
   - **"Ana Ekrana Ekle"** (Add to Home Screen) seçeneğini seçin.
3. **Android (Chrome)**:
   - Sağ üstteki üç nokta menüsüne dokunun.
   - **"Uygulamayı Yükle"** veya **"Ana Ekrana Ekle"** seçeneğini seçin.
4. Artık Kelime Avı, telefonunuzda internet olmadan dahi açılan, bildirim alanını dolduran tam ekran yerel bir uygulama gibi çalışacaktır!

---

## ⚙️ Tasarım ve Mimari Notları

- **Veri Mimarisi**: Statik kelimeler (`words`) ile kullanıcının ilerleme kayıtları (`progress`) Dexie IndexedDB üzerinde iki ayrı tabloda ayrıştırılmıştır.
- **Performans**: 6.120 kelimelik ilk içe aktarım 1.000'lik yığınlar (chunks) halinde asenkron yapılır; UI donmaz.
- **Çevrimdışı Dayanıklılık**: `navigator.storage.persist()` ile tarayıcının IndexedDB verilerini temizlemesi engellenir.
- **Ses Dosyası Bağımlılığı Sıfır**: Telaffuz için Web Speech API, oyunlaştırma sesleri için tarayıcının yerel Web Audio API osilatörleri kullanılır; harici hiçbir MP3 yüklenmez.
