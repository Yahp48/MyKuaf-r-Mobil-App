import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  Platform,
  Dimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { AntDesign as Icon } from '@expo/vector-icons';
import { MaterialIcons as MaterialIcon } from '@expo/vector-icons';
import { FontAwesome5 as FontAwesome5 } from '@expo/vector-icons';
import { FontAwesome6 as FontAwesome6 } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import apiService from '../services/apiService';

const { width } = Dimensions.get('window');

function ShopScreen({ navigation }) {
  const { state, actions } = useApp();
  const { cartItems, cartCount } = state;
  

  const [searchText, setSearchText] = useState('');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState(['Tümü']);
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  


  useEffect(() => {
    initializeScreen();
  }, []);

 
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedCategory, products]);

  
  useEffect(() => {
    checkNetworkStatus();
  }, []);

  const initializeScreen = async () => {
    await Promise.all([
      loadProducts(true),
      loadCategories(),
      checkNetworkStatus()
    ]);
  };

  const checkNetworkStatus = async () => {
    try {
      const isOnline = await apiService.checkNetworkStatus();
      setNetworkStatus(isOnline);
    } catch (error) {
      setNetworkStatus(false);
    }
  };

 
  const loadProducts = async (isInitialLoad = false, page = 1) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      
      const params = {
        page,
        limit: 20,
        isActive: true,
        ...(selectedCategory !== 'Tümü' && { category: selectedCategory }),
        ...(searchText && { search: searchText })
      };

      const result = await apiService.requestWithRetry('/products', {
        method: 'GET',
        params
      }, 3);
      
      if (result.success) {
        const newProducts = result.data.products || result.data || [];
        const pagination = result.data.pagination || {};
        
        if (isInitialLoad || page === 1) {
          setProducts(newProducts);
          setCurrentPage(1);
        } else {
          setProducts(prev => [...prev, ...newProducts]);
          setCurrentPage(page);
        }
        
        setHasMoreProducts(pagination.hasNextPage || false);
        
        console.log(`📦 ${newProducts.length} ürün yüklendi (Sayfa: ${page})`);
      } else {
        
        if (isInitialLoad) {
          const mockProducts = await getMockProducts();
          setProducts(mockProducts);
          console.log('📦 Mock ürünler yüklendi');
        }
        
        if (!result.offline) {
          Alert.alert('Bilgi', 'Veriler yerel modda gösteriliyor.');
        }
      }
    } catch (error) {
      console.error('❌ Ürün yükleme hatası:', error);
      
      if (isInitialLoad) {
        const mockProducts = await getMockProducts();
        setProducts(mockProducts);
        Alert.alert('Hata', 'Ürünler yüklenirken hata oluştu. Yerel veriler gösteriliyor.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  
  const loadCategories = async () => {
    try {
      const result = await apiService.requestWithCache('/products/categories', {}, { maxAge: 600000 });
      
      if (result.success) {
        const categoryList = result.data.categories || result.data || [];
        setCategories(['Tümü', ...categoryList.map(cat => cat.name || cat)]);
      } else {
        
        setCategories(['Tümü', 'Saç Bakımı', 'Serum', 'Maskeler', 'Araçlar', 'Styling']);
      }
    } catch (error) {
      console.error('❌ Kategori yükleme hatası:', error);
      setCategories(['Tümü', 'Saç Bakımı', 'Serum', 'Maskeler', 'Araçlar']);
    }
  };

 
  const getMockProducts = async () => {
    return [
      {
        _id: 'mock_prod_1',
        id: 1,
        name: 'Profesyonel Saç Bakım Seti',
        description: 'Profesyonel kalitede saç bakım seti',
        price: 299.99,
        originalPrice: 399.99,
        images: ['https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=300&h=300&fit=crop'],
        category: 'Saç Bakımı',
        rating: 4.5,
        reviewCount: 127,
        inStock: true,
        stock: 25,
        brand: 'ProfessionalCare',
        tags: ['saç bakımı', 'profesyonel'],
        isFeatured: true,
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'mock_prod_2',
        id: 2,
        name: 'Argan Yağı Serumu',
        description: 'Doğal argan yağı serumu',
        price: 149.99,
        originalPrice: 199.99,
        images: ['https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=300&h=300&fit=crop'],
        category: 'Serum',
        rating: 4.8,
        reviewCount: 89,
        inStock: true,
        stock: 15,
        brand: 'NaturalCare',
        tags: ['serum', 'doğal'],
        isFeatured: false,
        createdAt: new Date().toISOString(),
      },
      {
        _id: 'mock_prod_3',
        id: 3,
        name: 'Saç Düzleştirici',
        description: 'Profesyonel saç düzleştirici',
        price: 899.99,
        originalPrice: 999.99,
        images: ['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=300&fit=crop'],
        category: 'Araçlar',
        rating: 4.3,
        reviewCount: 56,
        inStock: false,
        stock: 0,
        brand: 'TechStyle',
        tags: ['araç', 'düzleştirici'],
        isFeatured: false,
        createdAt: new Date().toISOString(),
      }
    ];
  };

 
  const applyFilters = useCallback(() => {
    let filtered = [...products];

    
    if (selectedCategory !== 'Tümü') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.brand?.toLowerCase().includes(searchLower) ||
        product.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchText]);

 
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    setProducts([]);
    loadProducts(true, 1);
  };

  
  const clearSearch = () => {
    setSearchText('');
  };

  
  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await Promise.all([
      loadProducts(true, 1),
      loadCategories(),
      checkNetworkStatus()
    ]);
  };

  
  const loadMoreProducts = async () => {
    if (!loadingMore && hasMoreProducts) {
      const nextPage = currentPage + 1;
      await loadProducts(false, nextPage);
    }
  };


  const addToCart = async (product) => {
    try {
      
      if (!product.inStock || product.stock <= 0) {
        Alert.alert('Stok Yetersiz', 'Bu ürün şu anda stokta bulunmuyor.');
        return;
      }

     
      const existingItem = cartItems.find(item => 
        item._id === product._id || item.id === product.id
      );
      
      const currentQuantity = existingItem ? existingItem.quantity : 0;
      
      if (currentQuantity >= product.stock) {
        Alert.alert('Stok Sınırı', `Bu üründen en fazla ${product.stock} adet ekleyebilirsiniz.`);
        return;
      }

     
      const cartItem = {
        ...product,
        quantity: 1,
        addedAt: new Date().toISOString(),
     
        productId: product._id || product.id,
        image: product.images?.[0] || product.image,
        subtotal: product.price
      };

      actions.addToCart(cartItem);

      
      try {
        await apiService.addToServerCart(product._id || product.id, 1);
      } catch (syncError) {
        console.log('Server senkronizasyon hatası (offline olabilir):', syncError.message);
      }

      
      Alert.alert(
        'Sepete Eklendi! 🛒',
        `${product.name} sepetinize eklendi.`,
        [
          { text: 'Alışverişe Devam', style: 'cancel' },
          { 
            text: 'Sepete Git', 
            onPress: () => navigation.navigate('ShoppingCart')
          }
        ]
      );

      console.log(`✅ Ürün sepete eklendi: ${product.name}`);
      
    } catch (error) {
      console.error('❌ Sepete ekleme hatası:', error);
      Alert.alert('Hata', 'Ürün sepete eklenirken bir hata oluştu.');
    }
  };

  
  const PlaceholderImage = ({ style }) => (
    <View style={[style, styles.placeholderContainer]}>
      <MaterialIcon name="image" size={40} color="#ccc" />
    </View>
  );


  const renderProductCard = (product) => {
  const productId = product._id || product.id;

  
  product.inStock = product.stock && product.stock > 0;

  const existingItem = cartItems.find(item => 
    item._id === productId || item.id === productId
  );


    const inCart = !!existingItem;
    const productImage = product.images?.[0] || product.image;
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    const discountPercentage = hasDiscount ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
    
    return (
      <TouchableOpacity
        key={productId}
        style={[
          styles.productCard,
          !product.inStock && styles.outOfStockCard
        ]}
        onPress={() => navigation.navigate('ProductDetail', { 
          product,
          productId: productId
        })}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          {productImage ? (
            <Image 
              source={{ uri: productImage }} 
              style={styles.productImage}
              onError={() => console.log('Image load error for:', productImage)}
            />
          ) : (
            <PlaceholderImage style={styles.productImage} />
          )}
          
          
          {!product.inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Tükendi</Text>
            </View>
          )}
          
        
          {inCart && (
            <View style={styles.inCartBadge}>
              <MaterialIcon name="shopping-cart" size={14} color="#fff" />
              <Text style={styles.inCartText}>{existingItem.quantity}</Text>
            </View>
          )}
          
          
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>%{discountPercentage}</Text>
            </View>
          )}
          
          
          {product.stock && product.stock <= 5 && product.inStock && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockText}>Son {product.stock}!</Text>
            </View>
          )}

         
          {product.isFeatured && (
            <View style={styles.featuredBadge}>
              <FontAwesome5 name="star" size={10} color="#FFD700" solid />
            </View>
          )}
        </View>
        
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          
          <Text style={styles.productCategory}>
            {product.category}
          </Text>

          {product.brand && (
            <Text style={styles.productBrand}>
              {product.brand}
            </Text>
          )}
          
        
          <View style={styles.ratingContainer}>
            <FontAwesome5 name="star" size={12} color="#FFD700" solid />
            <Text style={styles.rating}>
              {product.rating || '4.5'}
            </Text>
            {product.reviewCount && (
              <Text style={styles.reviewCount}>
                ({product.reviewCount})
              </Text>
            )}
          </View>
          
          
          <View style={styles.priceContainer}>
            <View style={styles.priceInfo}>
              <Text style={styles.price}>₺{product.price}</Text>
              {hasDiscount && (
                <Text style={styles.originalPrice}>
                  ₺{product.originalPrice}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={[
                styles.addButton, 
                !product.inStock && styles.disabledButton,
                inCart && styles.inCartButton
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (product.inStock) {
                  addToCart(product);
                }
              }}
              disabled={!product.inStock}
            >
              {inCart ? (
                <MaterialIcon name="check" size={16} color="#fff" />
              ) : (
                <FontAwesome5 
                  name="plus" 
                  size={14} 
                  color={product.inStock ? "#fff" : "#999"} 
                />
              )}
            </TouchableOpacity>
          </View>
          
          
          {product.stock !== undefined && (
            <Text style={[
              styles.stockInfo,
              product.stock <= 5 && product.stock > 0 && styles.lowStockInfo,
              product.stock === 0 && styles.outOfStockInfo
            ]}>
              {product.stock > 0 ? `Stok: ${product.stock}` : 'Stokta yok'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  
  if (loading && products.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar backgroundColor="#FF4896" barStyle="light-content" />
        <ActivityIndicator size="large" color="#FF4896" />
        <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <StatusBar backgroundColor="#FF4896" barStyle="light-content" />
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Icon name="left" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Mağaza</Text>
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('ShoppingCart')}
          style={styles.headerButton}
        >
          <View style={styles.cartContainer}>
            <FontAwesome5 name="shopping-bag" size={24} color="#fff" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

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
        onScrollEndDrag={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            loadMoreProducts();
          }
        }}
      >
        
        <View style={styles.searchContainer}>
          <MaterialIcon name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün, marka veya kategori ara..."
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#999"
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
              <MaterialIcon name="clear" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.activeCategoryButton
              ]}
              onPress={() => handleCategoryChange(category)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.activeCategoryText
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        
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
            {networkStatus ? 'Online - Canlı veriler' : 'Offline - Yerel veriler'}
          </Text>
          {!networkStatus && (
            <TouchableOpacity 
              onPress={checkNetworkStatus}
              style={styles.retryNetworkButton}
            >
              <MaterialIcon name="refresh" size={14} color="#f44336" />
            </TouchableOpacity>
          )}
        </View>

      
        {(searchText.length > 0 || selectedCategory !== 'Tümü') && (
          <View style={styles.filterInfo}>
            <Text style={styles.filterText}>
              {searchText.length > 0 && `"${searchText}" için `}
              {selectedCategory !== 'Tümü' && `${selectedCategory} kategorisinde `}
              {filteredProducts.length} sonuç bulundu
            </Text>
            {(searchText.length > 0 || selectedCategory !== 'Tümü') && (
              <TouchableOpacity 
                onPress={() => {
                  setSearchText('');
                  setSelectedCategory('Tümü');
                }}
                style={styles.clearFiltersButton}
              >
                <Text style={styles.clearFiltersText}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

       
        <View style={styles.productsContainer}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'Tümü' ? 'Tüm Ürünler' : selectedCategory}
            <Text style={styles.productCount}> ({filteredProducts.length})</Text>
          </Text>
          
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyProducts}>
              <FontAwesome5 name="search" size={50} color="#ccc" />
              <Text style={styles.emptyProductsText}>
                {searchText.length > 0 
                  ? 'Aradığınız kriterlerde ürün bulunamadı' 
                  : selectedCategory !== 'Tümü'
                    ? 'Bu kategoride ürün bulunmuyor'
                    : 'Henüz ürün eklenmemiş'
                }
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => onRefresh()}
              >
                <MaterialIcon name="refresh" size={16} color="#fff" />
                <Text style={styles.retryButtonText}>Yenile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.productsGrid}>
              {filteredProducts.map(renderProductCard)}
              
              
              {loadingMore && (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color="#FF4896" />
                  <Text style={styles.loadMoreText}>Daha fazla ürün yükleniyor...</Text>
                </View>
              )}
              
              
              {!hasMoreProducts && filteredProducts.length > 0 && (
                <View style={styles.endOfProductsContainer}>
                  <Text style={styles.endOfProductsText}>Tüm ürünler gösteriliyor</Text>
                </View>
              )}
            </View>
          )}
        </View>

       
        {cartCount > 0 && (
          <TouchableOpacity 
            style={styles.cartSummary}
            onPress={() => navigation.navigate('ShoppingCart')}
          >
            <View style={styles.cartSummaryContent}>
              <View style={styles.cartSummaryInfo}>
                <Text style={styles.cartSummaryText}>
                  Sepetinizde {cartCount} ürün var
                </Text>
                <Text style={styles.cartSummaryPrice}>
                  Toplam: ₺{cartItems.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)}
                </Text>
              </View>
              <MaterialIcon name="arrow-forward" size={20} color="#FF4896" />
            </View>
          </TouchableOpacity>
        )}

       
        <View style={styles.bottomSpacer} />
      </ScrollView>

      
      {cartCount > 0 && (
        <TouchableOpacity 
          style={styles.floatingCartButton}
          onPress={() => navigation.navigate('ShoppingCart')}
        >
          <FontAwesome5 name="shopping-cart" size={20} color="#fff" />
          <View style={styles.floatingCartBadge}>
            <Text style={styles.floatingCartText}>
              {cartCount > 99 ? '99+' : cartCount}
            </Text>
          </View>
        </TouchableOpacity>
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
            {cartCount > 0 && (
              <View style={styles.navCartBadge}>
                <Text style={styles.navCartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
            <Text style={[styles.navText, styles.activeNavText]}>Mağaza</Text>
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF4896',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingHorizontal: 20,
    paddingBottom: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerButton: {
    padding: 5,
    borderRadius: 20,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  cartContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#e00061',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF4896',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginTop: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 5,
  },
  categoriesContainer: {
    marginBottom: 20,
  },
  categoriesContent: {
    paddingRight: 20,
  },
  categoryButton: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activeCategoryButton: {
    backgroundColor: '#FF4896',
    elevation: 4,
  },
  categoryText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 14,
  },
  activeCategoryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 15,
    alignSelf: 'flex-start',
    elevation: 1,
  },
  networkText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 5,
  },
  retryNetworkButton: {
    marginLeft: 8,
    padding: 2,
  },
  filterInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 15,
  },
  filterText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  clearFiltersButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearFiltersText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  productCount: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#666',
  },
  emptyProducts: {
    alignItems: 'center',
    paddingVertical: 50,
    backgroundColor: 'white',
    borderRadius: 15,
    margin: 10,
  },
  emptyProductsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#FF4896',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: 'white',
    width: (width - 50) / 2,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  outOfStockCard: {
    opacity: 0.7,
    backgroundColor: '#f5f5f5',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  // Placeholder image styles
  placeholderContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,0,0,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inCartBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(76,175,80,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inCartText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
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
  lowStockBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255,152,0,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  lowStockText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,215,0,0.9)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    height: 36,
    lineHeight: 18,
  },
  productCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceInfo: {
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4896',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#FF4896',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  inCartButton: {
    backgroundColor: '#4CAF50',
  },
  stockInfo: {
    fontSize: 11,
    color: '#999',
  },
  lowStockInfo: {
    color: '#ff9800',
    fontWeight: '500',
  },
  outOfStockInfo: {
    color: '#f44336',
    fontWeight: '500',
  },
  loadMoreContainer: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  endOfProductsContainer: {
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
  },
  endOfProductsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  cartSummary: {
    backgroundColor: 'white',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
    elevation: 2,
  },
  cartSummaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartSummaryInfo: {
    flex: 1,
  },
  cartSummaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cartSummaryPrice: {
    fontSize: 14,
    color: '#FF4896',
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 100,
  },
  floatingCartButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#FF4896',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingCartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#e00061',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF4896',
  },
  floatingCartText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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

export default ShopScreen;