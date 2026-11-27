# Saç modeli görselleri

Bu klasördeki saç katmanları, [Unsplash Lisansı](https://unsplash.com/license) ile yayımlanmış portrelerden
yalnızca saç bölgesi ayrılarak (MediaPipe saç segmentasyonu) üretilmiştir. Yüzler kaldırılmıştır.
Her görselin kaynak fotoğrafı `anchors.json` içindeki `unsplashId` alanındadır
(`https://images.unsplash.com/<unsplashId>`).

`anchors` alanı: kırpılmış görsel üzerinde iki göz merkezi ve çene noktası (piksel). Canlı denemede bu üç nokta
kullanıcının yüzündeki karşılıklarına afin dönüşümle eşlenir.
