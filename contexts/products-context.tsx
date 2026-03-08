"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

export type ProductLocation = 'online' | 'physical' | 'both';

export interface StockBatch {
  id: string;
  productId: string;
  quantity: number;
  costPerUnit?: number;
  batchDate: string;
  expiryDate?: string;
  cabinet: string;
  status: 'on-shelf' | 'in-storage' | 'depleted' | 'reserved' | 'damaged';
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  costPrice?: number;
  category: string;
  stock: number;
  location: ProductLocation;
  lastUpdated: string;
  lastRestockDate?: string; // Added last restock date
  cabinet: string; // Added cabinet property
  description?: string; // Added optional description field
  stockBatches?: StockBatch[]; // Added stock batches for tracking
}

interface ProductsContextType {
  products: Product[];
  getProductsByCabinet: (cabinet: string) => Product[];
  addProduct: (product: Omit<Product, 'id'>, cabinet: string) => Promise<Product | { error: string; isSkuConflict: true } | undefined>;
  updateProduct: (id: string, updates: Partial<Product>, cabinet: string) => Promise<{success: boolean, data?: Product, error?: string}>;
  deleteProduct: (id: string, cabinet: string) => void;
  addStockBatch: (productId: string, quantity: number, costPerUnit?: number, expiryDate?: string, cabinet?: string) => void;
  getStockBatches: (productId: string, cabinet: string) => Promise<StockBatch[]>;
  getOnShelfStock: (productId: string, cabinet: string) => Promise<number>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Record<string, Product[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch products from database
  const fetchProducts = async (cabinet: string = 'main') => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/products?cabinet=${cabinet}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const data = await response.json();
      setProducts(prev => ({
        ...prev,
        [cabinet]: data,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize products on mount and when cabinet changes
  useEffect(() => {
    // Fetch products for all cabinets
    const fetchAllProducts = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Fetch all products first
        const response = await fetch('/api/products');
        console.log('API Response status:', response.status);
        console.log('API Response ok:', response.ok);
        if (!response.ok) {
          const errorText = await response.text();
          console.log('API Response error text:', errorText);
          throw new Error('Failed to fetch products');
        }
        
        const allProducts = await response.json();
        
        // Group products by cabinet
        const productsByCabinet: Record<string, Product[]> = {};
        allProducts.forEach((product: any) => { // Using any here to handle potential API response format
          const cabinet = product.cabinet || 'main'; // Default to 'main' if cabinet is not specified
          if (!productsByCabinet[cabinet]) {
            productsByCabinet[cabinet] = [];
          }
          productsByCabinet[cabinet].push({
            ...product,
            cabinet // Ensure cabinet is set
          });
        });
        
        setProducts(productsByCabinet);
      } catch (err) {
        // Only set error state for non-SKU related errors
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products';
        if (!errorMessage.includes('SKU') && !errorMessage.includes('already exists')) {
          setError(errorMessage);
        }
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllProducts();
  }, []);

  // Smart refresh: only update when data actually changes
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const allProducts = await response.json();
          
          // Group products by cabinet
          const productsByCabinet: Record<string, Product[]> = {};
          allProducts.forEach((product: Product) => {
            const cabinet = product.cabinet || 'main';
            if (!productsByCabinet[cabinet]) {
              productsByCabinet[cabinet] = [];
            }
            productsByCabinet[cabinet].push(product);
          });
          
          // Only update if data has actually changed
          if (JSON.stringify(productsByCabinet) !== JSON.stringify(products)) {
            setProducts(productsByCabinet);
          }
        }
      } catch (err) {
        // Silent fail for background updates
        console.log('Background products update check failed:', err);
      }
    };

    // Check for updates every 15 seconds (faster but without loading states)
    const intervalId = setInterval(checkForUpdates, 15000);
    
    return () => clearInterval(intervalId);
  }, [products]);

  const getProductsByCabinet = (cabinet: string) => {
    return products[cabinet] || [];
  };

  const addProduct = async (product: Omit<Product, 'id'>, cabinet: string): Promise<Product | { error: string; isSkuConflict: true } | undefined> => {
    try {
      setError(null);
      console.log('Adding product:', product); // Debug log
      
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      });

      console.log('Response status:', response.status); // Debug log
      console.log('Response ok:', response.ok); // Debug log

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { error: 'Server error occurred' };
        }
        
        // Handle empty error objects or missing error messages
        const errorMessage = errorData?.error || 
                           (response.status >= 500 ? 'Server error occurred' : 
                            response.status === 400 ? 'Bad request' : 
                            'Failed to add product');
        
        // Handle SKU conflicts specially - don't set error state, return error info
        if (errorMessage.includes('SKU') && errorMessage.includes('already exists')) {
          console.warn('SKU conflict detected:', errorMessage);
          // Return a special object to indicate SKU conflict
          return { error: errorMessage, isSkuConflict: true };
        }
        
        // Handle database connection errors gracefully
        if (errorMessage === 'Failed to connect to database' || 
            errorMessage?.includes('database') ||
            errorMessage?.includes('connection') ||
            response.status === 503) {
          console.warn('Database not available, using fallback mode');
          // Create a temporary product with generated ID
          const tempProduct = {
            ...product,
            id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            lastUpdated: new Date().toLocaleDateString('en-CA'),
          };
          
          setProducts((prev) => ({
            ...prev,
            [cabinet]: [tempProduct, ...(prev[cabinet] || [])],
          }));
          
          // Still log the activity even in fallback mode
          return tempProduct;
        }
        
        // Set error state for other errors but don't throw - let UI handle the error display
        setError(errorMessage);
        return; // Don't throw error - let calling component handle it
      }

      const newProduct = await response.json();
      console.log('New product created:', newProduct); // Debug log
      
      setProducts((prev) => ({
        ...prev,
        [cabinet]: [newProduct, ...(prev[cabinet] || [])],
      }));
      
      return newProduct; // Return the created product
    } catch (err) {
      console.error('Add product error:', err); // Debug log
      
      // Handle network errors gracefully
      if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('Network'))) {
        console.warn('Network error, using fallback mode');
        // Create a temporary product with generated ID
        const tempProduct = {
          ...product,
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          lastUpdated: new Date().toLocaleDateString('en-CA'),
        };
        
        setProducts((prev) => ({
          ...prev,
          [cabinet]: [tempProduct, ...(prev[cabinet] || [])],
        }));
        
        return tempProduct;
      }
      
      // Handle other errors - set error state but don't throw to prevent console errors
      const errorMessage = err instanceof Error ? err.message : 'Failed to add product';
      
      // Don't set error for SKU conflicts (already handled above)
      if (!errorMessage.includes('SKU')) {
        setError(errorMessage);
      }
      
      // Don't throw the error to prevent console.error from showing
      // The error state is set for UI display
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>, cabinet: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/products/manage?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // Try to get the actual error message from the response
        let errorMessage = 'Failed to update product';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse the error response, use the default message
        }
        
        // Don't throw error for SKU conflicts, just return error result
        if (errorMessage.includes('already exists')) {
          console.warn('SKU conflict detected during update:', errorMessage);
          return { success: false, error: errorMessage };
        }
        
        // Set error state and return error result for other errors
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const updatedProduct = await response.json();
      
      setProducts((prev) => ({
        ...prev,
        [cabinet]: (prev[cabinet] || []).map((product) =>
          product.id === id ? updatedProduct : product
        ),
      }));
      
      return { success: true, data: updatedProduct };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update product';
      
      // Only set error state for non-SKU errors
      if (!errorMessage.includes('SKU')) {
        setError(errorMessage);
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const addStockBatch = async (productId: string, quantity: number, costPerUnit?: number, expiryDate?: string, cabinet?: string) => {
    try {
      setError(null);
      const response = await fetch('/api/stock-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity,
          costPerUnit,
          expiryDate,
          cabinet: cabinet || 'main'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add stock batch');
      }

      // Refresh products to get updated stock
      const fetchAllProducts = async () => {
        try {
          setLoading(true);
          // Fetch all products first
          const response = await fetch('/api/products');
          if (!response.ok) {
            throw new Error('Failed to fetch products');
          }
          
          const allProducts = await response.json();
          
          // Group products by cabinet
          const productsByCabinet: Record<string, Product[]> = {};
          allProducts.forEach((product: any) => { // Using any here to handle potential API response format
            const cabinet = product.cabinet || 'main'; // Default to 'main' if cabinet is not specified
            if (!productsByCabinet[cabinet]) {
              productsByCabinet[cabinet] = [];
            }
            productsByCabinet[cabinet].push({
              ...product,
              cabinet // Ensure cabinet is set
            });
          });
          
          setProducts(productsByCabinet);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch products');
          console.error('Error fetching products:', err);
        } finally {
          setLoading(false);
        }
      };
      
      await fetchAllProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add stock batch');
      throw err;
    }
  };

  const getStockBatches = async (productId: string, cabinet: string): Promise<StockBatch[]> => {
    try {
      const response = await fetch(`/api/stock-batches?productId=${productId}&cabinet=${cabinet}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stock batches');
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock batches');
      return [];
    }
  };

  const getOnShelfStock = async (productId: string, cabinet: string): Promise<number> => {
    try {
      const batches = await getStockBatches(productId, cabinet);
      const onShelfBatches = batches.filter(batch => batch.status === 'on-shelf');
      return onShelfBatches.reduce((total, batch) => total + batch.quantity, 0);
    } catch (err) {
      console.error('Error getting on-shelf stock:', err);
      return 0;
    }
  };

  const deleteProduct = async (id: string, cabinet: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/products/manage?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      setProducts((prev) => ({
        ...prev,
        [cabinet]: (prev[cabinet] || []).filter((product) => product.id !== id),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      throw err;
    }
  };

  // Helper function to get all products across all cabinets
  const getAllProducts = () => {
    return Object.values(products).flat();
  };

  // Refetch function to refresh all products
  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all products
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const allProducts = await response.json();
      
      // Group products by cabinet
      const productsByCabinet: Record<string, Product[]> = {};
      allProducts.forEach((product: any) => {
        const cabinet = product.cabinet || 'main';
        if (!productsByCabinet[cabinet]) {
          productsByCabinet[cabinet] = [];
        }
        productsByCabinet[cabinet].push({
          ...product,
          cabinet
        });
      });
      
      setProducts(productsByCabinet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
      console.error('Error refetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProductsContext.Provider
      value={{ 
        products: getAllProducts(), 
        getProductsByCabinet, 
        addProduct, 
        updateProduct, 
        deleteProduct,
        addStockBatch,
        getStockBatches,
        getOnShelfStock,
        loading,
        error,
        refetch
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}
