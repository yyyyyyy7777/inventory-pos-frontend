import { NextRequest, NextResponse } from 'next/server';
import { getProductById, updateProduct, findOrCreateCategory, deleteProduct, getAllProducts, createProduct } from '@/lib/pg-direct';

// GET /api/products/manage?id=2
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT /api/products/manage?id=2
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, sku, price, stock, category, location, cabinet, description, updatedBy } = body;

    // Validate required fields
    if (!name || price === undefined || stock === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price, stock, category' },
        { status: 400 }
      );
    }

    // Ensure price is a number
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    const numStock = typeof stock === 'string' ? parseInt(stock) : stock;

    if (isNaN(numPrice) || isNaN(numStock)) {
      return NextResponse.json(
        { error: 'Price and stock must be valid numbers' },
        { status: 400 }
      );
    }

    // Find or create category
    const categoryRecord = await findOrCreateCategory(category);

    // Update product using the updateProduct function (which includes SKU validation)
    const updatedProduct = await updateProduct(id, {
      name,
      sku, // SKU will be validated for uniqueness
      price: numPrice,
      stock: numStock,
      cabinet: cabinet || 'main',
      categoryId: categoryRecord.id,
      description,
      updatedBy:
        typeof updatedBy === 'string' && updatedBy.trim()
          ? updatedBy.trim().slice(0, 120)
          : undefined,
    });

    return NextResponse.json(updatedProduct);
    
  } catch (error: any) {
    console.error('Error updating product:', error);
    
    // Check if it's a SKU validation error
    if (error.message && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 } // Conflict status code for duplicate SKU
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/products/manage?id=2
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Use the deleteProduct function from mysql-direct
    await deleteProduct(id);
    
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
