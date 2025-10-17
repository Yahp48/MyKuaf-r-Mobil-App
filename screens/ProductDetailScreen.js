import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Dimensions,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/AntDesign';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
// import { LinearGradient } from 'expo-linear-gradient'; // Temporarily disabled due to version conflict
import apiService from '../services/apiService';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');

function ProductDetailScreen({ navigation, route }) {
  const { state } = useApp();
  const cartCount = state.cartItems.length;
  const { product } = route.params;
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [isFavorite, setIsFavorite] = useState(false);
  
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const productImages = product.images && product.images.length > 0 
    ? product.images 
    : [
        product.image || 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
      ];

  const productSpecs = [
    { label: 'Marka', value: product.brand || 'Professional Hair Care' },
    { label: 'Kategori', value: product.category || 'Genel' },
    { label: 'Stok', value: product.stock ? `${product.stock} adet` : 'Sınırlı' },
    { label: 'Durum', value: product.inStock ? 'Stokta var' : 'Stokta yok' },
    { label: 'Ürün Kodu', value: product._id || product.id },
    { label: 'Güncellenme', value: product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('tr-TR') : 'Bilinmiyor' },
  ];

  const userReviews = [
    {
      id: 1,
      userName: 'Ayşe K.',
      rating: 5,
      date: '2 gün önce',
      comment: 'Harika bir ürün! Saçlarım çok yumuşak oldu. Kesinlikle tavsiye ederim.',
      helpful: 12,
    },
    {
      id: 2,
      userName: 'Mehmet S.',
      rating: 4,
      date: '1 hafta önce',
      comment: 'Kaliteli bir ürün. Fiyat performans açısından iyi. Hızlı teslimat.',
      helpful: 8,
    },
    {
      id: 3,
      userName: 'Zeynep M.',
      rating: 5,
      date: '2 hafta önce',
      comment: 'Uzun süredir kullanıyorum. Saçlarımda harika bir değişim oldu. Parlak ve sağlıklı görünüyor.',
      helpful: 15,
    },
  ];

  useEffect(() => {
    if (product && (product._id || product.id)) {
      loadRelatedProducts();
    }
  }, [product]);

  const loadRelatedProducts = async () => {
    try {
      setRelatedLoading(true);
      const productId = product._id || product.id;
      console.log('🔍 İlgili ürünler yükleniyor:', productId);
      
      const result = await apiService.getRelatedProducts(productId);
      
      if (result.success && result.data && result.data.products) {
        const suggestions = result.data.products;
        
        const filteredSuggestions = suggestions.filter(item => 
          item && 
          item.isActive !== false && 
          (item._id !== productId && item.id !== productId)
        );
        
        console.log('✅ İlgili ürünler yüklendi:', filteredSuggestions.length);
        setRelatedProducts(filteredSuggestions.slice(0, 6)); 
      } else {
        console.log('⚠️ İlgili ürün bulunamadı');
        setRelatedProducts([]);
      }
      
    } catch (error) {
      console.error('❌ İlgili ürünler yükleme hatası:', error);
      setRelatedProducts([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const increaseQuantity = () => {
    if (product.stock && quantity >= product.stock) {
      Alert.alert('Stok Sınırı', `Bu üründen en fazla ${product.stock} adet satın alabilirsiniz.`);
      return;
    }
    setQuantity(quantity + 1);
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const addToCart = async () => {
    if (!product.inStock) {
      Alert.alert('Stok Yok', 'Bu ürün şu anda stokta bulunmuyor.');
      return;
    }

    if (product.stock && quantity > product.stock) {
      Alert.alert('Stok Yetersiz', `Bu üründen sadece ${product.stock} adet mevcut.`);
      return;
    }

    try {
      setAddingToCart(true);
      
      const result = await apiService.addToServerCart(
        product._id || product.id,
        quantity,
        {
          name: product.name,
          price: product.price,
          image: product.images?.[0] || product.image
        }
      );

      if (result.success) {
        console.log('✅ Ürün sepete eklendi:', product.name);
        
        Alert.alert(
          'Sepete Eklendi! 🛒',
          `${product.name} (${quantity} adet) sepetinize eklendi.`,
          [
            { text: 'Alışverişe Devam', style: 'cancel' },
            { text: 'Sepete Git', onPress: () => navigation.navigate('ShoppingCart') }
          ]
        );
      } else {
        throw new Error(result.error || 'Sepete ekleme başarısız');
      }
      
    } catch (error) {
      console.error('❌ Sepete ekleme hatası:', error);
      Alert.alert('Hata', 'Ürün sepete eklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setAddingToCart(false);
    }
  };

  const buyNow = () => {
    if (!product.inStock) {
      Alert.alert('Stok Yok', 'Bu ürün şu anda stokta bulunmuyor.');
      return;
    }

    if (product.stock && quantity > product.stock) {
      Alert.alert('Stok Yetersiz', `Bu üründen sadece ${product.stock} adet mevcut.`);
      return;
    }

    const orderData = {
      orderType: 'product', 
      productInfo: {
        ...product,
        quantity: quantity
      },
      totalPrice: (product.price * quantity).toFixed(2),
    };

    console.log('ProductDetail buyNow - Sending to PaymentScreen:', orderData); 
    navigation.navigate('PaymentScreen', orderData);
  };

  const totalPrice = ((product.price || 0) * (quantity || 1)).toFixed(2);

  const renderImageItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[styles.imageThumb, selectedImageIndex === index && styles.activeImageThumb]}
      onPress={() => setSelectedImageIndex(index)}
    >
      <Image source={{ uri: item }} style={styles.thumbImage} />
    </TouchableOpacity>
  );

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <FontAwesome5
        key={index}
        name="star"
        size={14}
        color={index < rating ? "#FFD700" : "#E0E0E0"}
        solid={index < rating}
      />
    ));
  };

  const renderRelatedProducts = () => {
    if (relatedLoading) {
      return (
        <View style={styles.relatedLoadingContainer}>
          <ActivityIndicator size="small" color="#FF4896" />
          <Text style={styles.relatedLoadingText}>İlgili ürünler yükleniyor...</Text>
        </View>
      );
    }

    if (!relatedProducts || relatedProducts.length === 0) {
      return null; 
    }

    return (
      <View style={styles.relatedProductsSection}>
        <Text style={styles.relatedProductsTitle}>İlgili Ürünler</Text>
        <FlatList
          horizontal
          data={relatedProducts}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `related_product_${item._id || item.id || index}`}
          renderItem={({ item, index }) => {
            if (!item) return null;
            
            const productImage = item.images?.[0] || item.image || 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=200&h=200&fit=crop';
            const hasDiscount = item.originalPrice && item.originalPrice > item.price;
            const itemId = item._id || item.id || `temp_${index}`;
            const itemName = String(item.name || 'Ürün Adı');
            const itemPrice = Number(item.price || 0);
            const originalPrice = Number(item.originalPrice || 0);
            const itemRating = Number(item.rating || 0);
            
            return (
              <View style={styles.relatedProductCard}>
                <TouchableOpacity
                  onPress={() => navigation.push('ProductDetail', { 
                    product: item
                  })}
                  activeOpacity={0.7}
                >
                  <View style={styles.relatedImageContainer}>
                    <Image
                      source={{ uri: productImage }}
                      style={styles.relatedProductImage}
                      onError={() => console.log('Related product image error:', productImage)}
                    />
                    {hasDiscount && (
                      <View style={styles.relatedDiscountBadge}>
                        <Text style={styles.relatedDiscountText}>
                          {`%${Math.round((1 - itemPrice / originalPrice) * 100)}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.relatedProductInfo}>
                    <Text style={styles.relatedProductName} numberOfLines={2}>
                      {itemName}
                    </Text>
                    
                    <View style={styles.relatedPriceContainer}>
                      <Text style={styles.relatedProductPrice}>{`₺${itemPrice}`}</Text>
                      {hasDiscount && (
                        <Text style={styles.relatedOriginalPrice}>{`₺${originalPrice}`}</Text>
                      )}
                    </View>
                    
                    {itemRating > 0 && (
                      <View style={styles.relatedRatingContainer}>
                        <FontAwesome5 name="star" size={12} color="#FFD700" solid />
                        <Text style={styles.relatedRatingText}>{String(itemRating)}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.relatedAddButton,
                    !item.inStock && styles.relatedAddButtonDisabled
                  ]}
                  onPress={() => {
                    if (item.inStock) {
                      Alert.alert(
                        'Sepete Ekle',
                        `${itemName} sepetinize eklensin mi?`,
                        [
                          { text: 'İptal', style: 'cancel' },
                          { 
                            text: 'Ekle', 
                            onPress: async () => {
                              try {
                                const result = await apiService.addToServerCart(
                                  itemId,
                                  1,
                                  {
                                    name: itemName,
                                    price: itemPrice,
                                    image: productImage
                                  }
                                );
                                
                                if (result.success) {
                                  Alert.alert('Eklendi! 🛒', `${itemName} sepetinize eklendi.`);
                                }
                              } catch (error) {
                                Alert.alert('Hata', 'Ürün sepete eklenirken hata oluştu.');
                              }
                            }
                          }
                        ]
                      );
                    } else {
                      Alert.alert('Stok Yok', 'Bu ürün şu anda stokta bulunmuyor.');
                    }
                  }}
                  disabled={!item.inStock}
                  activeOpacity={0.7}
                >
                  <Icon 
                    name="plus" 
                    size={14} 
                    color={item.inStock ? "#fff" : "#999"} 
                  />
                </TouchableOpacity>
              </View>
            );
          }}
          contentContainerStyle={styles.relatedProductsList}
        />
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'description':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.descriptionText}>
              {product.description || `Bu premium kalitedeki ${product.name.toLowerCase()}, profesyonel kuaförlerin tercih ettiği 
              özel formülü ile hazırlanmıştır. Saçlarınızı beslerken aynı zamanda koruma sağlar. 
              Doğal içerikleri sayesinde her saç tipine uygun olarak geliştirilmiştir.`}
              {'\n\n'}
              Ürünümüz, saçlarınızın doğal parlaklığını artırırken, hasarlı saç tellerini onarır ve 
              güçlendirir. Düzenli kullanımda saçlarınızın daha sağlıklı, yumuşak ve parlak olduğunu 
              fark edeceksiniz.
            </Text>
            
            <View style={styles.benefitsList}>
              <Text style={styles.benefitsTitle}>Faydaları:</Text>
              <View style={styles.benefitItem}>
                <MaterialIcon name="check-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>Saç tellerini güçlendirir</Text>
              </View>
              <View style={styles.benefitItem}>
                <MaterialIcon name="check-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>Doğal parlaklık verir</Text>
              </View>
              <View style={styles.benefitItem}>
                <MaterialIcon name="check-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>Nemlendirici etki</Text>
              </View>
              <View style={styles.benefitItem}>
                <MaterialIcon name="check-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>Kimyasal hasarları onarır</Text>
              </View>
            </View>
          </View>
        );
      
      case 'features':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Teknik Özellikler</Text>
            {productSpecs.map((spec, index) => (
              <View key={index} style={styles.specRow}>
                <Text style={styles.specLabel}>{spec.label}:</Text>
                <Text style={styles.specValue}>{spec.value}</Text>
              </View>
            ))}
          </View>
        );
      
      case 'reviews':
        return (
          <View style={styles.tabContent}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>Müşteri Yorumları</Text>
              <View style={styles.overallRating}>
                <Text style={styles.overallRatingNumber}>{product.rating || 4.5}</Text>
                <View style={styles.overallStars}>
                  {renderStars(Math.floor(product.rating || 4.5))}
                </View>
                <Text style={styles.reviewCount}>({userReviews.length} yorum)</Text>
              </View>
            </View>
            
            {userReviews.map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewUserInfo}>
                    <Text style={styles.reviewUserName}>{review.userName}</Text>
                    <View style={styles.reviewStars}>
                      {renderStars(review.rating)}
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>{review.date}</Text>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
                <TouchableOpacity style={styles.helpfulButton}>
                  <MaterialIcon name="thumb-up" size={16} color="#666" />
                  <Text style={styles.helpfulText}>Faydalı ({review.helpful})</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with solid background (LinearGradient temporarily disabled) */}
      <View style={styles.header}>
        <StatusBar backgroundColor="#FF4896" barStyle="light-content" />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ürün Detayı</Text>
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={() => setIsFavorite(!isFavorite)}
        >
          <FontAwesome5 
            name="heart" 
            size={24} 
            color={isFavorite ? "#ff6b6b" : "#fff"}
            solid={isFavorite}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Images */}
        <View style={styles.imageContainer}>
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width);
              setSelectedImageIndex(index);
            }}
          >
            {productImages.map((image, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri: image }} style={styles.productImage} />
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.imageIndicators}>
            {productImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  selectedImageIndex === index && styles.activeIndicator
                ]}
              />
            ))}
          </View>

          {!product.inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Stokta Yok</Text>
            </View>
          )}
        </View>

        {/* Thumbnail Images */}
        <View style={styles.thumbnailContainer}>
          <FlatList
            horizontal
            data={productImages}
            renderItem={renderImageItem}
            keyExtractor={(item, index) => index.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
          />
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{product.category || 'Genel'}</Text>
          </View>
          
          <Text style={styles.productName}>{product.name || 'Ürün Adı'}</Text>
          
          <View style={styles.ratingPriceContainer}>
            <View style={styles.ratingContainer}>
              <FontAwesome5 name="star" size={16} color="#FFD700" solid />
              <Text style={styles.rating}>{product.rating || 4.5}</Text>
              <Text style={styles.reviewCount}>(127 değerlendirme)</Text>
            </View>
            <Text style={styles.price}>₺{product.price || 0}</Text>
          </View>

          <View style={styles.stockStatus}>
            <MaterialIcon 
              name={product.inStock ? "check-circle" : "cancel"} 
              size={20} 
              color={product.inStock ? "#4CAF50" : "#f44336"} 
            />
            <Text style={[styles.stockText, { color: product.inStock ? "#4CAF50" : "#f44336" }]}>
              {product.inStock ? "Stokta var" : "Stokta yok"}
            </Text>
            {product.stock && product.inStock && (
              <Text style={styles.stockCount}>({product.stock} adet)</Text>
            )}
          </View>

          <View style={styles.quickFeatures}>
            <View style={styles.quickFeature}>
              <MaterialIcon name="local-shipping" size={20} color="#FF4896" />
              <Text style={styles.quickFeatureText}>Ücretsiz Kargo</Text>
            </View>
            <View style={styles.quickFeature}>
              <MaterialIcon name="cached" size={20} color="#FF4896" />
              <Text style={styles.quickFeatureText}>Kolay İade</Text>
            </View>
            <View style={styles.quickFeature}>
              <MaterialIcon name="verified-user" size={20} color="#FF4896" />
              <Text style={styles.quickFeatureText}>Güvenli Ödeme</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'description' && styles.activeTab]}
            onPress={() => setActiveTab('description')}
          >
            <Text style={[styles.tabText, activeTab === 'description' && styles.activeTabText]}>
              Açıklama
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'features' && styles.activeTab]}
            onPress={() => setActiveTab('features')}
          >
            <Text style={[styles.tabText, activeTab === 'features' && styles.activeTabText]}>
              Özellikler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
              Yorumlar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Related Products */}
        {renderRelatedProducts()}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.quantityContainer}>
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={decreaseQuantity}
            disabled={quantity <= 1}
          >
            <Icon name="minus" size={16} color={quantity <= 1 ? "#ccc" : "#333"} />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity || 1}</Text>
          <TouchableOpacity style={styles.quantityButton} onPress={increaseQuantity}>
            <Icon name="plus" size={16} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[
              styles.addToCartButton, 
              (!product.inStock || addingToCart) && styles.disabledButton
            ]}
            onPress={addToCart}
            disabled={!product.inStock || addingToCart}
          >
            {addingToCart ? (
              <ActivityIndicator size="small" color="#FF4896" />
            ) : (
              <FontAwesome5 name="shopping-cart" size={16} color="#FF4896" />
            )}
            <Text style={styles.addToCartText}>
              {addingToCart ? 'Ekleniyor...' : 'Sepete Ekle'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.buyNowButton, !product.inStock && styles.disabledButton]}
            onPress={buyNow}
            disabled={!product.inStock}
          >
            <Text style={styles.buyNowText}>
              {product.inStock ? `₺${totalPrice} - Satın Al` : 'Stokta Yok'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          onPress={() => navigation.navigate("Appointments")}
          style={styles.navButton}
        >
          <FontAwesome5 name="calendar-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Randevular</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Home")}
          style={styles.navButton}
        >
          <FontAwesome5 name="map-marked-alt" size={24} color="#fff" />
          <Text style={styles.navText}>Harita</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Shop")}
          style={styles.navButton}
        >
          <FontAwesome5 name="shopping-bag" size={28} color="#fff" />
          {cartCount > 0 && (
            <View style={styles.navCartBadge}>
              <Text style={styles.navCartBadgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
          <Text style={styles.navText}>Mağaza</Text>
        </TouchableOpacity>
      
        <TouchableOpacity 
          onPress={() => navigation.navigate("Profile")}
          style={styles.navButton}
        >
          <FontAwesome6 name="user" size={24} color="#fff" />
          <Text style={styles.navText}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#FF4896', // Solid color instead of gradient
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  favoriteButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 350,
    backgroundColor: 'white',
  },
  imageWrapper: {
    width: width,
    height: 350,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  productImage: {
    width: width * 0.9,
    height: 320,
    resizeMode: 'cover',
    borderRadius: 15,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: 'white',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  outOfStockText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  thumbnailContainer: {
    backgroundColor: 'white',
    paddingVertical: 15,
  },
  thumbnailList: {
    paddingHorizontal: 20,
  },
  imageThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeImageThumb: {
    borderColor: '#FF4896',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    resizeMode: 'cover',
  },
  productInfo: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 5,
  },
  categoryBadge: {
    backgroundColor: '#f0f0f0',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 10,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    lineHeight: 30,
  },
  ratingPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 5,
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  stockStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  stockCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  quickFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickFeature: {
    alignItems: 'center',
  },
  quickFeatureText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginTop: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#FF4896',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF4896',
    fontWeight: 'bold',
  },
  tabContent: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  descriptionText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 20,
  },
  benefitsList: {
    marginTop: 10,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 10,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  specLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  specValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  overallRating: {
    alignItems: 'center',
  },
  overallRatingNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  overallStars: {
    flexDirection: 'row',
    marginVertical: 5,
  },
  reviewItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewUserInfo: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
  },
  reviewComment: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpfulText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  // Related Products Styles
  relatedProductsSection: {
    backgroundColor: 'white',
    marginTop: 5,
    paddingVertical: 20,
    paddingLeft: 20,
    marginBottom: 120, // Bottom bar için yer
  },
  relatedProductsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  relatedProductsList: {
    paddingRight: 20,
  },
  relatedLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  relatedLoadingText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  relatedProductCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    position: 'relative',
  },
  relatedImageContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
  },
  relatedProductImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  relatedDiscountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,87,34,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  relatedDiscountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  relatedProductInfo: {
    padding: 10,
  },
  relatedProductName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    height: 32,
  },
  relatedPriceContainer: {
    marginBottom: 4,
  },
  relatedProductPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  relatedOriginalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  relatedRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  relatedRatingText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 3,
  },
  relatedAddButton: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF4896',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  relatedAddButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bottomBar: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 90, // Bottom nav için yer
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  quantityButton: {
    backgroundColor: '#f0f0f0',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 25,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#FF4896',
    borderRadius: 25,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartText: {
    color: '#FF4896',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buyNowButton: {
    flex: 2,
    backgroundColor: '#FF4896',
    borderRadius: 25,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyNowText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FF4896',
    height: 70,
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  navText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  navCartBadge: {
    position: 'absolute',
    top: -4,
    right: 8,
    backgroundColor: '#e00061',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF4896',
  },
  navCartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default ProductDetailScreen;