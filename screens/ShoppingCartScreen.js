import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { AntDesign as Icon } from '@expo/vector-icons';
import { MaterialIcons as MaterialIcon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import apiService from '../services/apiService';

const { width } = Dimensions.get('window');

const ShoppingCartScreen = ({ navigation }) => {
  const { state, actions } = useApp();
  const { cartItems = [], cartCount = 0 } = state;
  
  const [refreshing, setRefreshing] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(true);
  const [syncingCart, setSyncingCart] = useState(false);

  // Safe data access helpers
  const safeCartItems = Array.isArray(cartItems) ? 
    cartItems.filter(item => item && (item._id || item.id)) : [];
  const safeSuggestedProducts = Array.isArray(suggestedProducts) ? 
    suggestedProducts.filter(item => item && (item._id || item.id)) : [];

  useEffect(() => {
    initializeScreen();
  }, []);

  useEffect(() => {
    if (safeCartItems.length > 0 && networkStatus) {
      syncCartWithServer();
    }
  }, [safeCartItems, networkStatus]);

  const initializeScreen = async () => {
    try {
      const promises = [
        loadSuggestedProducts(),
        checkNetworkStatus()
      ];
      
      if (safeCartItems.length > 0) {
        promises.push(syncCartWithServer());
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Initialize error:', error);
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const isOnline = await apiService.checkNetworkStatus();
      setNetworkStatus(isOnline);
      return isOnline;
    } catch (error) {
      setNetworkStatus(false);
      return false;
    }
  };

  const syncCartWithServer = async () => {
    if (!networkStatus || safeCartItems.length === 0) return;

    try {
      setSyncingCart(true);
      const result = await apiService.syncCartWithServer(safeCartItems);
      
      if (result?.success) {
        console.log('Cart synced successfully');
      } else {
        console.log('Cart sync failed:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Cart sync error:', error.message || error);
    } finally {
      setSyncingCart(false);
    }
  };

  const loadSuggestedProducts = async () => {
    try {
      const cartCategories = [...new Set(safeCartItems.map(item => item?.category).filter(Boolean))];
      
      let result;
      if (cartCategories.length > 0 && safeCartItems[0] && (safeCartItems[0]._id || safeCartItems[0].id)) {
        result = await apiService.getRelatedProducts(safeCartItems[0]._id || safeCartItems[0].id);
      } else {
        result = await apiService.getFeaturedProducts();
      }
      
      if (result?.success) {
        const suggestions = result.data?.products || result.data || [];
        const filteredSuggestions = suggestions.filter(product => 
          product && (product._id || product.id) && !safeCartItems.some(cartItem => 
            cartItem?._id === product?._id || cartItem?.id === product?.id
          )
        );
        setSuggestedProducts(filteredSuggestions.slice(0, 6));
      } else {
        const mockSuggestions = await getMockSuggestions();
        setSuggestedProducts(mockSuggestions);
      }
    } catch (error) {
      console.error('Suggested products error:', error);
      const mockSuggestions = await getMockSuggestions();
      setSuggestedProducts(mockSuggestions);
    }
  };

  const getMockSuggestions = async () => {
    return [
      {
        _id: 'mock_1',
        id: '101',
        name: 'Örnek Ürün 1',
        price: 99.99,
        images: ['https://via.placeholder.com/200'],
        category: 'Örnek Kategori',
        inStock: true
      },
      {
        _id: 'mock_2',
        id: '102',
        name: 'Örnek Ürün 2',
        price: 149.99,
        images: ['https://via.placeholder.com/200'],
        category: 'Örnek Kategori',
        inStock: true
      }
    ];
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadSuggestedProducts(),
        checkNetworkStatus(),
        networkStatus && safeCartItems.length > 0 ? syncCartWithServer() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    }
    setRefreshing(false);
  }, [safeCartItems.length, networkStatus]);

  const updateQuantity = async (itemId, newQuantity) => {
    if (!itemId || newQuantity === undefined || newQuantity < 0) return;
    
    if (newQuantity === 0) {
      removeItem(itemId);
      return;
    }
    
    const cartItem = safeCartItems.find(item => 
      (item?._id === itemId || item?.id === itemId)
    );
    
    if (cartItem?.stock && newQuantity > cartItem.stock) {
      Alert.alert(
        'Stok Sınırı',
        `Bu üründen en fazla ${cartItem.stock} adet ekleyebilirsiniz`,
        [{ text: 'Tamam' }]
      );
      return;
    }
    
    actions.updateCartQuantity(itemId, newQuantity);
    
    try {
      if (networkStatus) {
        await apiService.updateCartItem(itemId, newQuantity);
      }
    } catch (error) {
      console.error('Update error:', error.message || error);
    }
  };

  const removeItem = async (itemId) => {
    if (!itemId) return;
    
    const cartItem = safeCartItems.find(item => 
      (item?._id === itemId || item?.id === itemId)
    ) || {};
    
    Alert.alert(
      'Ürünü Kaldır',
      `${cartItem?.name || 'Bu ürün'} sepetinizden kaldırılacak. Emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            actions.removeFromCart(itemId);
            
            try {
              if (networkStatus) {
                await apiService.removeFromServerCart(itemId);
              }
            } catch (error) {
              console.error('Remove error:', error.message || error);
            }
          }
        }
      ]
    );
  };

  const addSuggestedProduct = async (product) => {
    if (!product?.id && !product?._id) return;

    try {
      if (!product.inStock || product.stock <= 0) {
        Alert.alert('Stokta Yok', 'Bu ürün şu anda mevcut değil.');
        return;
      }

      const existingItem = safeCartItems.find(item => 
        item?._id === product?._id || item?.id === product?.id
      );
      
      if (existingItem) {
        const newQuantity = (existingItem.quantity || 0) + 1;
        if (product.stock && newQuantity > product.stock) {
          Alert.alert('Stok Sınırı', `Bu üründen en fazla ${product.stock} adet ekleyebilirsiniz`);
          return;
        }
        actions.updateCartQuantity(product._id || product.id, newQuantity);
      } else {
        const cartItem = {
          ...product,
          quantity: 1,
          addedAt: new Date().toISOString(),
          productId: product._id || product.id,
          image: product.images?.[0] || product.image || 'https://via.placeholder.com/200',
          subtotal: product.price || 0
        };
        actions.addToCart(cartItem);
      }
      
      try {
        if (networkStatus) {
          await apiService.addToServerCart(product._id || product.id, 1);
        }
      } catch (error) {
        console.error('Add to cart error:', error.message || error);
      }
      
      Alert.alert(
        'Ürün Eklendi! 🛒',
        `${product?.name || 'Ürün'} sepetinize eklendi.`,
        [{ text: 'Tamam' }]
      );

      loadSuggestedProducts();
      
    } catch (error) {
      console.error('Add product error:', error);
      Alert.alert('Hata', 'Ürün sepete eklenirken bir hata oluştu.');
    }
  };

  const calculatePricing = () => {
    const subtotal = safeCartItems.reduce((total, item) => 
      total + ((item?.price || 0) * (item?.quantity || 0)), 0);
    
    const shipping = subtotal > 500 ? 0 : 29.99;
    const tax = subtotal * 0.18;
    const total = subtotal + shipping + tax;
    
    return {
      subtotal: subtotal.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      freeShippingAmount: subtotal > 500 ? 0 : (500 - subtotal).toFixed(2)
    };
  };

  const pricing = calculatePricing();

  const proceedToCheckout = async () => {
    if (safeCartItems.length === 0) {
      Alert.alert('Boş Sepet', 'Sepetiniz boş.');
      return;
    }

    for (const item of safeCartItems) {
      if (!item?.inStock || (item?.stock && item?.quantity > item.stock)) {
        Alert.alert(
          'Stok Sorunu',
          `${item?.name || 'Ürün'} stok sorunu yaşıyor. Lütfen sepetinizi kontrol edin.`,
          [{ text: 'Tamam' }]
        );
        return;
      }
    }

    setLoading(true);
    
    try {
      if (networkStatus) {
        await syncCartWithServer();
      }

      const orderData = {
        orderType: 'product_purchase',
        items: safeCartItems.map(item => ({
          productId: item?._id || item?.id,
          name: item?.name || 'Ürün',
          price: item?.price || 0,
          quantity: item?.quantity || 0,
          image: item?.images?.[0] || item?.image || 'https://via.placeholder.com/200',
          subtotal: ((item?.price || 0) * (item?.quantity || 0)).toFixed(2)
        })),
        pricing: {
          subtotal: parseFloat(pricing.subtotal),
          shipping: parseFloat(pricing.shipping),
          tax: parseFloat(pricing.tax),
          total: parseFloat(pricing.total)
        },
        cartCount: cartCount,
        metadata: {
          source: 'mobile_app',
          platform: Platform.OS,
          timestamp: new Date().toISOString()
        }
      };

      navigation.navigate('PaymentScreen', orderData);
      
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Hata', 'Ödemeye geçerken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const clearAllItems = async () => {
    if (safeCartItems.length > 0) {
      Alert.alert(
        'Sepeti Temizle',
        `Sepetinizdeki tüm ${cartCount} ürün kaldırılsın mı?`,
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Temizle', 
            style: 'destructive', 
            onPress: async () => {
              actions.clearCart();
              
              try {
                if (networkStatus) {
                  await apiService.clearServerCart();
                }
              } catch (error) {
                console.error('Clear cart error:', error.message || error);
              }
            }
          }
        ]
      );
    }
  };

  const renderCartItem = (item) => {
    if (!item || typeof item !== 'object') return null;
    
    const itemId = item._id || item.id;
    if (!itemId) return null;
    
    const isOutOfStock = !item.inStock || (item.stock && item.stock <= 0);
    const hasStockIssue = item.stock && item.quantity > item.stock;
    const itemImage = item.images?.[0] || item.image || 'https://via.placeholder.com/200';
    const itemSubtotal = ((item.price || 0) * (item.quantity || 0)).toFixed(2);
    const itemName = item.name || 'Ürün adı mevcut değil';
    const itemCategory = item.category || 'Kategori yok';
    const itemBrand = item.brand || '';
    const itemPrice = item.price ? `₺${item.price.toFixed(2)}` : 'Fiyat mevcut değil';
    
    return (
      <View key={itemId} style={[styles.cartItem, isOutOfStock && styles.outOfStockItem]}>
        <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { 
          product: item, 
          productId: itemId 
        })}>
          <Image 
            source={{ uri: itemImage }} 
            style={styles.itemImage}
            onError={() => console.log('Image load error')}
          />
        </TouchableOpacity>
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={2}>{itemName}</Text>
          
          <Text style={styles.itemCategory}>{itemCategory}</Text>
          
          {itemBrand ? <Text style={styles.itemBrand}>{itemBrand}</Text> : null}
          
          <View style={styles.priceQuantityContainer}>
            <Text style={styles.itemPrice}>{itemPrice}</Text>
            <Text style={styles.itemSubtotal}>Toplam: ₺{itemSubtotal}</Text>
          </View>
          
          {isOutOfStock && <Text style={styles.outOfStockText}>⚠️ Stokta yok</Text>}
          
          {hasStockIssue && <Text style={styles.stockIssueText}>⚠️ Stok: {item.stock}</Text>}
          
          {item.stock && !hasStockIssue && item.stock <= 10 && (
            <Text style={styles.stockInfo}>Stok: {item.stock}</Text>
          )}
        </View>
        
        <View style={styles.quantityControls}>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(itemId, (item.quantity || 0) - 1)}
            >
              <Icon name="minus" size={16} color="#666" />
            </TouchableOpacity>
            
            <Text style={[styles.quantityText, hasStockIssue && styles.errorQuantityText]}>
              {item.quantity || 0}
            </Text>
            
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(itemId, (item.quantity || 0) + 1)}
              disabled={isOutOfStock}
            >
              <Icon name="plus" size={16} color={isOutOfStock ? "#ccc" : "#666"} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeItem(itemId)}
          >
            <MaterialIcon name="delete-outline" size={20} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSuggestedItem = (product, index) => {
    if (!product || typeof product !== 'object') return null;

    const productId = product._id || product.id || `suggested_${index}`;
    const inCart = safeCartItems.some(item => 
      (item?._id || item?.id) === productId
    );
    
    const productName = product.name ? String(product.name).trim() : 'Ürün adı mevcut değil';
    const productImage = product.images?.[0] || product.image || 'https://via.placeholder.com/200';
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    
    const productPriceNum = product.price && !isNaN(Number(product.price)) ? Number(product.price) : 0;
    const originalPriceNum = product.originalPrice && !isNaN(Number(product.originalPrice)) ? Number(product.originalPrice) : 0;
    
    const productPrice = `₺${productPriceNum.toFixed(2)}`;
    const originalPrice = originalPriceNum > 0 ? `₺${originalPriceNum.toFixed(2)}` : '';
    const discountPercentage = hasDiscount && originalPriceNum > 0 ? 
      Math.round((1 - (productPriceNum / originalPriceNum)) * 100) : 0;
    
    const ratingValue = product.rating && !isNaN(Number(product.rating)) ? Number(product.rating) : 0;
    const reviewCountValue = product.reviewCount && !isNaN(Number(product.reviewCount)) ? Number(product.reviewCount) : 0;

    return (
      <View key={productId} style={styles.suggestedItemContainer}>
        <TouchableOpacity 
          style={styles.suggestedItem}
          onPress={() => navigation.navigate('ProductDetail', { 
            product, 
            productId 
          })}
          activeOpacity={0.8}
        >
          <View style={styles.suggestedImageContainer}>
            <Image 
              source={{ uri: productImage }}
              style={styles.suggestedImage}
              resizeMode="cover"
              onError={() => console.log('Image load error')}
            />
            
            {hasDiscount && discountPercentage > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{`%${discountPercentage}`}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.suggestedInfo}>
            <Text style={styles.suggestedName} numberOfLines={2}>
              {productName}
            </Text>
            
            <View style={styles.suggestedPriceContainer}>
              <Text style={styles.suggestedPrice}>{productPrice}</Text>
              {hasDiscount && originalPrice && (
                <Text style={styles.suggestedOriginalPrice}>
                  {originalPrice}
                </Text>
              )}
            </View>
            
            {ratingValue > 0 && (
              <View style={styles.suggestedRating}>
                <FontAwesome5 name="star" size={10} color="#FFD700" solid />
                <Text style={styles.suggestedRatingText}>{ratingValue.toFixed(1)}</Text>
                {reviewCountValue > 0 && (
                  <Text style={styles.suggestedReviewCount}>{`(${reviewCountValue})`}</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.addSuggestedButton,
            inCart && styles.inCartSuggestedButton,
            !product.inStock && styles.disabledSuggestedButton
          ]}
          onPress={(e) => {
            e.stopPropagation();
            if (product.inStock) {
              addSuggestedProduct(product);
            }
          }}
          disabled={!product.inStock}
        >
          {inCart ? (
            <MaterialIcon name="check" size={14} color="#fff" />
          ) : (
            <Icon name="plus" size={14} color={product.inStock ? "#fff" : "#999"} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StatusBar backgroundColor="#FF4896" barStyle="light-content" />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="left" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Sepetim ({safeCartItems.length})</Text>
          {syncingCart && (
            <ActivityIndicator size="small" color="#fff" style={styles.syncIndicator} />
          )}
        </View>
        
        {safeCartItems.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearAllItems}>
            <MaterialIcon name="clear-all" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {safeCartItems.length === 0 ? (
        <View style={styles.emptyCart}>
          <FontAwesome5 name="shopping-bag" size={80} color="#ccc" />
          <Text style={styles.emptyCartTitle}>Sepetiniz Boş</Text>
          <Text style={styles.emptyCartSubtitle}>
            Alışverişe başlamak için mağazamızdan ürün ekleyin.
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate('Shop')}
          >
            <MaterialIcon name="shopping-bag" size={20} color="#fff" />
            <Text style={styles.shopButtonText}>Mağazaya Git</Text>
          </TouchableOpacity>
          
          <View style={styles.emptyNetworkStatus}>
            <MaterialIcon 
              name={networkStatus ? "wifi" : "wifi-off"} 
              size={16} 
              color={networkStatus ? "#4CAF50" : "#f44336"} 
            />
            <Text style={[
              styles.emptyNetworkText, 
              { color: networkStatus ? "#4CAF50" : "#f44336" }
            ]}>
              {networkStatus ? 'Çevrimiçi' : 'Çevrimdışı'}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                colors={['#FF4896']}
                tintColor="#FF4896"
              />
            }
          >
            <View style={styles.networkStatus}>
              <MaterialIcon 
                name={networkStatus ? "wifi" : "wifi-off"} 
                size={16} 
                color={networkStatus ? "#4CAF50" : "#f44336"} 
              />
              <Text style={[
                styles.networkText, 
                { color: networkStatus ? "#4CAF50" : "#f44336" }
              ]}>
                {networkStatus ? 'Senkronize' : 'Çevrimdışı mod'}
              </Text>
              {syncingCart && (
                <ActivityIndicator size="small" color="#4CAF50" style={styles.syncIndicator} />
              )}
            </View>

            <View style={styles.cartItemsContainer}>
              <Text style={styles.cartItemsTitle}>
                Sepetteki Ürünler ({safeCartItems.length})
              </Text>
              {safeCartItems.map(renderCartItem)}
            </View>

            <View style={styles.shippingInfo}>
              <View style={styles.shippingCard}>
                <MaterialIcon 
                  name="local-shipping" 
                  size={24} 
                  color={parseFloat(pricing.shipping) === 0 ? "#4CAF50" : "#FF9800"} 
                />
                <View style={styles.shippingText}>
                  <Text style={styles.shippingTitle}>
                    {parseFloat(pricing.shipping) === 0 ? 'Ücretsiz Kargo! 🎉' : 'Kargo Ücreti'}
                  </Text>
                  <Text style={styles.shippingSubtitle}>
                    {parseFloat(pricing.shipping) === 0 
                      ? 'Siparişiniz ücretsiz kargo için uygun.'
                      : `₺500 ve üzeri siparişlerde ücretsiz kargo. Kalan: ₺${pricing.freeShippingAmount}`
                    }
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.deliveryEstimate}>
              <MaterialIcon name="schedule" size={20} color="#FF4896" />
              <Text style={styles.deliveryText}>
                Tahmini teslimat: 2-3 iş günü
              </Text>
              <MaterialIcon name="verified" size={16} color="#4CAF50" />
            </View>

            <View style={styles.orderSummary}>
              <Text style={styles.orderSummaryTitle}>Sipariş Özeti</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ara toplam ({safeCartItems.length} ürün):</Text>
                <Text style={styles.summaryValue}>₺{pricing.subtotal}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>KDV (%18):</Text>
                <Text style={styles.summaryValue}>₺{pricing.tax}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Kargo:</Text>
                <Text style={[
                  styles.summaryValue, 
                  parseFloat(pricing.shipping) === 0 && styles.freeShipping
                ]}>
                  {parseFloat(pricing.shipping) === 0 ? 'Ücretsiz' : `₺${pricing.shipping}`}
                </Text>
              </View>
            </View>

            {safeSuggestedProducts.length > 0 && (
              <View style={styles.suggestedContainer}>
                <Text style={styles.suggestedTitle}>Sizin İçin Önerilen</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestedScrollContent}
                >
                  {safeSuggestedProducts
                    .filter(product => product && (product._id || product.id) && product.name)
                    .map((product, index) => renderSuggestedItem(product, index))
                  }
                </ScrollView>
              </View>
            )}

            <View style={styles.trustSignals}>
              <Text style={styles.trustTitle}>Güvenli Alışveriş</Text>
              <View style={styles.trustItem}>
                <MaterialIcon name="verified-user" size={20} color="#4CAF50" />
                <Text style={styles.trustText}>SSL Şifreli Güvenli Ödeme</Text>
              </View>
              <View style={styles.trustItem}>
                <MaterialIcon name="cached" size={20} color="#4CAF50" />
                <Text style={styles.trustText}>14 Gün İade Garantisi</Text>
              </View>
              <View style={styles.trustItem}>
                <MaterialIcon name="support-agent" size={20} color="#4CAF50" />
                <Text style={styles.trustText}>7/24 Müşteri Desteği</Text>
              </View>
              <View style={styles.trustItem}>
                <MaterialIcon name="local-shipping" size={20} color="#4CAF50" />
                <Text style={styles.trustText}>Hızlı ve Güvenilir Teslimat</Text>
              </View>
            </View>

            <View style={styles.checkoutSpacer} />
          </ScrollView>

          <View style={styles.checkoutSection}>
            <View style={styles.totalContainer}>
              <View style={styles.totalInfo}>
                <Text style={styles.totalLabel}>Toplam Tutar</Text>
                <Text style={styles.totalValue}>₺{pricing.total}</Text>
              </View>
              <Text style={styles.totalNote}>KDV ve kargo dahil</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.checkoutButton, loading && styles.loadingButton]} 
              onPress={proceedToCheckout}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcon name="payment" size={20} color="#fff" />
              )}
              <Text style={styles.checkoutButtonText}>
                {loading ? 'İşleniyor...' : 'Ödemeye Geç'}
              </Text>
              {!loading && (
                <MaterialIcon name="arrow-forward" size={20} color="#fff" />
              )}
            </TouchableOpacity>
            
            <View style={styles.securityBadges}>
              <MaterialIcon name="security" size={16} color="#666" />
              <Text style={styles.securityText}>256-bit SSL Şifreleme</Text>
              <MaterialIcon name="verified" size={16} color="#4CAF50" />
              <Text style={styles.securityText}>Güvenli Ödeme</Text>
            </View>
          </View>
        </>
      )}

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
          <View style={styles.activeNavItem}>
            <FontAwesome5 name="shopping-bag" size={28} color="#e00061" />
            {safeCartItems.length > 0 && (
              <View style={styles.navCartBadge}>
                <Text style={styles.navCartBadgeText}>
                  {safeCartItems.length > 99 ? '99+' : safeCartItems.length}
                </Text>
              </View>
            )}
            <Text style={[styles.navText, styles.activeNavText]}>Sepet</Text>
          </View>
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
};

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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    backgroundColor: '#FF4896',
  },
  backButton: {
    padding: 5,
    borderRadius: 20,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  syncIndicator: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 5,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 15,
    marginBottom: 15,
    alignSelf: 'flex-start',
    elevation: 1,
  },
  networkText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 5,
  },
  cartItemsContainer: {
    marginBottom: 20,
  },
  cartItemsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  cartItem: {
    backgroundColor: 'white',
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  outOfStockItem: {
    backgroundColor: '#f5f5f5',
    opacity: 0.8,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  placeholderContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  itemBrand: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  priceQuantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  outOfStockText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '500',
    marginTop: 2,
  },
  stockIssueText: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '500',
    marginTop: 2,
  },
  stockInfo: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  quantityControls: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 5,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 12,
    color: '#333',
    minWidth: 20,
    textAlign: 'center',
  },
  errorQuantityText: {
    color: '#ff6b6b',
  },
  removeButton: {
    padding: 8,
    marginTop: 5,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyCartTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyCartSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: '#FF4896',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyNetworkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  emptyNetworkText: {
    fontSize: 12,
    marginLeft: 5,
  },
  shippingInfo: {
    marginBottom: 15,
  },
  shippingCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  shippingText: {
    marginLeft: 15,
    flex: 1,
  },
  shippingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  shippingSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  deliveryEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  deliveryText: {
    fontSize: 14,
    color: '#FF4896',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  orderSummary: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 2,
  },
  orderSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  freeShipping: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  suggestedContainer: {
    marginBottom: 20,
  },
  suggestedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  suggestedScrollContent: {
    paddingHorizontal: 5,
  },
  suggestedItemContainer: {
    width: 160,
    marginRight: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestedItem: {
    flex: 1,
  },
  suggestedImageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  suggestedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,87,34,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  discountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  suggestedInfo: {
    padding: 12,
  },
  suggestedName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    height: 35,
  },
  suggestedPriceContainer: {
    marginBottom: 5,
  },
  suggestedPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  suggestedOriginalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  suggestedRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestedRatingText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 3,
  },
  suggestedReviewCount: {
    fontSize: 10,
    color: '#999',
    marginLeft: 3,
  },
  addSuggestedButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF4896',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  inCartSuggestedButton: {
    backgroundColor: '#4CAF50',
  },
  disabledSuggestedButton: {
    backgroundColor: '#ccc',
  },
  trustSignals: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 1,
  },
  trustTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trustText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 12,
  },
  checkoutSpacer: {
    height: 160,
  },
  checkoutSection: {
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingBottom: 90,
  },
  totalContainer: {
    marginBottom: 15,
  },
  totalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  totalNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  checkoutButton: {
    backgroundColor: '#FF4896',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 10,
  },
  loadingButton: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  securityBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  securityText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    marginRight: 10,
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
  activeNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeNavText: {
    color: '#e00061',
    fontWeight: 'bold',
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

export default ShoppingCartScreen;