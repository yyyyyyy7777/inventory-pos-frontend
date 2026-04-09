import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts, updateProduct, deleteProduct, getProductById, findOrCreateCategory, updateProductStock } from '@/lib/pg-direct';
import { validateProductForm } from '@/utils/validation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate product ID parameter
    const productId = params.id;
    if (!productId || isNaN(parseInt(productId)) || parseInt(productId) <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID. Must be a positive integer.' },
        { status: 400 }
      );
    }

    const product = await getProductById(productId);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error fetching product:', error);
    
    // Check for database connection errors
    if (error.message && error.message.includes('connect')) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate product ID parameter
    const productId = params.id;
    if (!productId || isNaN(parseInt(productId)) || parseInt(productId) <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID. Must be a positive integer.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validate request body structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Must be a JSON object.' },
        { status: 400 }
      );
    }

    // Use comprehensive validation
    const validation = validateProductForm(body, true, true); // Require quantity/price for updates
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.errors.map(err => `${err.field}: ${err.message}`).join('; ')
        },
        { status: 400 }
      );
    }

    const { name, sku, price, stock, category, location, cabinet, description, lastRestockDate } = body;

    // Additional business logic validation
    if (name && name.length > 100) {
      return NextResponse.json(
        { error: 'Product name must not exceed 100 characters' },
        { status: 400 }
      );
    }

    if (price && parseFloat(price) > 999999.99) {
      return NextResponse.json(
        { error: 'Price must not exceed $999,999.99' },
        { status: 400 }
      );
    }

    if (stock && parseInt(stock) > 999999) {
      return NextResponse.json(
        { error: 'Stock quantity must not exceed 999,999' },
        { status: 400 }
      );
    }

    if (cabinet && cabinet.length > 50) {
      return NextResponse.json(
        { error: 'Cabinet name must not exceed 50 characters' },
        { status: 400 }
      );
    }

    if (description && description.length > 500) {
      return NextResponse.json(
        { error: 'Description must not exceed 500 characters' },
        { status: 400 }
      );
    }

    // Check if product exists before updating
    const existingProduct = await getProductById(productId);
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Find or create category
    const categoryRecord = await findOrCreateCategory(category);

    // Update product using the updateProduct function (which includes SKU validation)
    const updatedProduct = await updateProduct(productId, {
      name: name.trim(),
      sku: sku ? sku.trim().toUpperCase() : undefined, // Normalize SKU to uppercase
      price: parseFloat(price),
      stock: parseInt(stock),
      cabinet: cabinet || 'main',
      categoryId: categoryRecord.id,
      description: description ? description.trim() : undefined
    });

    return NextResponse.json(updatedProduct);
    
  } catch (error: any) {
    console.error('Error updating product:', error);
    
    // Check for JSON parsing errors
    if (error.message && error.message.includes('Unexpected token')) {
      return NextResponse.json(
        { error: 'Invalid JSON format in request body' },
        { status: 400 }
      );
    }
    
    // Check if it's a SKU validation error
    if (error.message && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 } // Conflict status code for duplicate SKU
      );
    }

    // Check for foreign key constraint violation
    if (error.message && error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { error: 'Invalid category or cabinet reference' },
        { status: 400 }
      );
    }
    
    // Check for database constraint violations
    if (error.message && error.message.includes('CHECK constraint')) {
      return NextResponse.json(
        { error: 'Invalid data: Values violate database constraints' },
        { status: 400 }
      );
    }
    
    // Check for database connection errors
    if (error.message && error.message.includes('connect')) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate product ID parameter
    const productId = params.id;
    if (!productId || isNaN(parseInt(productId)) || parseInt(productId) <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID. Must be a positive integer.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validate request body structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Must be a JSON object.' },
        { status: 400 }
      );
    }

    // Check if product exists before updating
    const existingProduct = await getProductById(productId);
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Handle stock update (for offline sync)
    if (body.hasOwnProperty('stock') && typeof body.stock === 'number') {
      if (body.stock < 0) {
        return NextResponse.json(
          { error: 'Stock cannot be negative' },
          { status: 400 }
        );
      }

      const updatedProduct = await updateProductStock(productId, Math.floor(body.stock));

      return NextResponse.json(updatedProduct);
    }

    // Handle partial updates for other fields
    const { name, sku, price, stock, category, location, cabinet, description } = body;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim();
    if (sku !== undefined) updateData.sku = sku.trim().toUpperCase();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (cabinet !== undefined) updateData.cabinet = cabinet || 'main';
    if (description !== undefined) updateData.description = description.trim();

    // Handle category if provided
    if (category !== undefined) {
      const categoryRecord = await findOrCreateCategory(category);
      updateData.categoryId = categoryRecord.id;
    }

    const updatedProduct = await updateProduct(productId, updateData);
    return NextResponse.json(updatedProduct);
    
  } catch (error: any) {
    console.error('Error updating product (PATCH):', error);
    
    // Check for database connection errors
    if (error.message && error.message.includes('connect')) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      );
    }
    
    // Check for foreign key constraint violation
    if (error.message && error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { error: 'Invalid category or cabinet reference' },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate product ID parameter
    const productId = params.id;
    if (!productId || isNaN(parseInt(productId)) || parseInt(productId) <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID. Must be a positive integer.' },
        { status: 400 }
      );
    }

    // Check if product exists before deleting
    const existingProduct = await getProductById(productId);
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    await deleteProduct(productId);
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    
    // Check for foreign key constraint violations (product referenced in other tables)
    if (error.message && error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { error: 'Cannot delete product: It is referenced by other records (e.g., sales, stock batches)' },
        { status: 400 }
      );
    }
    
    // Check for database connection errors
    if (error.message && error.message.includes('connect')) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
