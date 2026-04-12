import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts, getAllProductsAllCabinets, findOrCreateCategory, createProduct } from '@/lib/pg-direct';
import { validateProductForm } from '@/utils/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinet = searchParams.get('cabinet') || 'main';

    // Validate cabinet parameter
    if (cabinet.length > 50) {
      return NextResponse.json(
        { error: 'Cabinet name must not exceed 50 characters' },
        { status: 400 }
      );
    }

    // Validate cabinet doesn't contain special characters
    if (/[<>"'&]/.test(cabinet)) {
      return NextResponse.json(
        { error: 'Cabinet name contains invalid characters' },
        { status: 400 }
      );
    }

    // Fetch products filtered by cabinet (or all cabinets)
    const products = cabinet === 'all'
      ? await getAllProductsAllCabinets()
      : await getAllProducts(cabinet);

    return NextResponse.json(products, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch products';
    
    // Check for database connection errors
    if (errorMessage.includes('connect') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body. Must be a JSON object.' },
        { status: 400 }
      );
    }

    const validation = validateProductForm(body, true, true);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.errors.map(err => `${err.field}: ${err.message}`).join('; ')
        },
        { status: 400 }
      );
    }

    const {
      name,
      price,
      category,
      stock,
      cabinet,
      sku,
      description,
      costPrice,
      purchaseDate,
      purchasePlace,
      supplierName,
      dimLengthCm,
      dimWidthCm,
      dimHeightCm,
      weightKg,
      imageUrl,
      createdBy,
    } = body;
    
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

    if (description && description.length > 2000) {
      return NextResponse.json(
        { error: 'Product details must not exceed 2000 characters' },
        { status: 400 }
      );
    }

    if (!sku || !String(sku).trim()) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
    }
    if (!purchaseDate || !String(purchaseDate).trim()) {
      return NextResponse.json({ error: 'Date of purchase is required' }, { status: 400 });
    }
    if (!purchasePlace || !String(purchasePlace).trim()) {
      return NextResponse.json({ error: 'Place of purchase is required' }, { status: 400 });
    }
    const costNum =
      costPrice !== undefined && costPrice !== '' && costPrice !== null
        ? parseFloat(String(costPrice))
        : NaN;
    if (!Number.isFinite(costNum) || costNum <= 0) {
      return NextResponse.json(
        { error: 'Acquired price is required and must be greater than zero' },
        { status: 400 }
      );
    }
    
    // Check if database is available by testing connection
    try {
      // Find or create category
      const categoryRecord = await findOrCreateCategory(category);
      
      // Create product
      const product = await createProduct({
        name: name.trim(),
        sku: String(sku).trim().toUpperCase(),
        price: price ? parseFloat(price) : 0,
        stock: stock ? parseInt(stock) : 0,
        cabinet: cabinet || 'main',
        categoryId: categoryRecord.id,
        description: description ? description.trim() : undefined,
        costPrice: costNum,
        purchaseDate: purchaseDate || null,
        purchasePlace: String(purchasePlace).trim() || null,
        supplierName: supplierName?.trim() || null,
        dimLengthCm:
          dimLengthCm !== undefined && dimLengthCm !== '' ? parseFloat(dimLengthCm) : null,
        dimWidthCm:
          dimWidthCm !== undefined && dimWidthCm !== '' ? parseFloat(dimWidthCm) : null,
        dimHeightCm:
          dimHeightCm !== undefined && dimHeightCm !== '' ? parseFloat(dimHeightCm) : null,
        weightKg: weightKg !== undefined && weightKg !== '' ? parseFloat(weightKg) : null,
        imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null,
        createdBy:
          typeof createdBy === 'string' && createdBy.trim()
            ? createdBy.trim().slice(0, 120)
            : null,
      });

      const productWithCategory = {
        ...product,
        category: categoryRecord.name,
      };

      return NextResponse.json(productWithCategory, { status: 201 });
    } catch (dbError: any) {
      console.error('Database operation failed:', dbError);
      
      // Check if it's a database connection error
      if (dbError.message && (
        dbError.message.includes('connect') ||
        dbError.message.includes('database') ||
        dbError.message.includes('ENOTFOUND') ||
        dbError.message.includes('ECONNREFUSED')
      )) {
        return NextResponse.json(
          { error: 'Failed to connect to database' },
          { status: 503 } // Service Unavailable
        );
      }
      
      // Check if it's a SKU validation error
      if (dbError.message && dbError.message.includes('already exists')) {
        return NextResponse.json(
          { error: dbError.message },
          { status: 409 } // Conflict status code for duplicate SKU
        );
      }

      // Check for foreign key constraint violation
      if (dbError.message && dbError.message.includes('foreign key constraint')) {
        return NextResponse.json(
          { error: 'Invalid category or cabinet reference' },
          { status: 400 }
        );
      }
      
      // Check for database constraint violations
      if (dbError.message && dbError.message.includes('CHECK constraint')) {
        return NextResponse.json(
          { error: 'Invalid data: Values violate database constraints' },
          { status: 400 }
        );
      }
      
      // Re-throw other database errors to be caught by outer catch
      throw dbError;
    }
    
  } catch (error: any) {
    console.error('Error creating product:', error);
    
    // Check for JSON parsing errors
    if (error.message && error.message.includes('Unexpected token')) {
      return NextResponse.json(
        { error: 'Invalid JSON format in request body' },
        { status: 400 }
      );
    }
    
    // Ensure we always return a proper error response
    const errorMessage = error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
