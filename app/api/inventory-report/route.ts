import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/pg-direct';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinet = searchParams.get('cabinet') || 'main';

    // Get products first
    const products = await query(`
      SELECT 
        p.id as productId,
        p.name as productName,
        p.sku,
        p.price as currentPrice,
        p.stock as totalStock,
        c.name as category
      FROM product p
      LEFT JOIN category c ON p.categoryId = c.id
      WHERE p.cabinet = ?
      ORDER BY p.name
    `, [cabinet]) as any[];

    // Get batch information separately
    const batches = await query(`
      SELECT 
        productId,
        COUNT(*) as batchCount,
        SUM(quantity) as batchStockTotal,
        AVG(CASE WHEN costPerUnit IS NOT NULL THEN costPerUnit ELSE 0 END) as averageCost,
        MIN(CASE WHEN costPerUnit IS NOT NULL THEN costPerUnit ELSE 0 END) as lowestCost,
        MAX(CASE WHEN costPerUnit IS NOT NULL THEN costPerUnit ELSE 0 END) as highestCost,
        MIN(batchDate) as oldestBatchDate,
        MAX(batchDate) as newestBatchDate
      FROM stockbatch
      WHERE cabinet = ?
      GROUP BY productId
    `, [cabinet]) as any[];

    // Combine the data
    const inventoryReport = products.map(product => {
      const batchInfo = batches.find(b => b.productId === product.productId) || {
        batchCount: 0,
        batchStockTotal: 0,
        averageCost: 0,
        lowestCost: 0,
        highestCost: 0,
        oldestBatchDate: null,
        newestBatchDate: null
      };
      
      return { ...product, ...batchInfo };
    });

    // Get detailed batch information for products with multiple batches
    const detailedBatches = await query(`
      SELECT 
        p.id as productId,
        p.name as productName,
        sa.id as batchId,
        sa.quantity as batchQuantity,
        sa.costPerUnit,
        sa.batchDate,
        sa.cabinet
      FROM product p
      INNER JOIN stockbatch sa ON p.id = sa.productId
      WHERE p.cabinet = ? AND sa.quantity > 0
      ORDER BY p.name, sa.batchDate ASC
    `, [cabinet]) as any[];

    // Calculate potential profit margins
    const profitAnalysis = inventoryReport.map(item => {
      const currentPrice = item.currentPrice || 0;
      const avgCost = item.averageCost || 0;
      const lowestCost = item.lowestCost || 0;
      const highestCost = item.highestCost || 0;
      
      return {
        ...item,
        currentMargin: currentPrice > 0 ? ((currentPrice - avgCost) / currentPrice * 100) : 0,
        bestCaseMargin: currentPrice > 0 ? ((currentPrice - lowestCost) / currentPrice * 100) : 0,
        worstCaseMargin: currentPrice > 0 ? ((currentPrice - highestCost) / currentPrice * 100) : 0,
        totalValue: item.totalStock * currentPrice,
        totalCost: item.batchStockTotal * avgCost,
        potentialProfit: (item.totalStock * currentPrice) - (item.batchStockTotal * avgCost)
      };
    });

    // Group batches by product for easier display
    const batchesByProduct = detailedBatches.reduce((acc: any, batch: any) => {
      if (!acc[batch.productId]) {
        acc[batch.productId] = {
          productName: batch.productName,
          batches: []
        };
      }
      acc[batch.productId].batches.push({
        batchId: batch.batchId,
        quantity: batch.batchQuantity,
        costPerUnit: batch.costPerUnit,
        addedDate: batch.addedDate
      });
      return acc;
    }, {});

    return NextResponse.json({
      summary: {
        totalProducts: inventoryReport.length,
        productsWithMultipleBatches: inventoryReport.filter(item => item.batchCount > 1).length,
        totalStockValue: profitAnalysis.reduce((sum, item) => sum + item.totalValue, 0),
        totalCost: profitAnalysis.reduce((sum, item) => sum + item.totalCost, 0),
        totalPotentialProfit: profitAnalysis.reduce((sum, item) => sum + item.potentialProfit, 0)
      },
      products: profitAnalysis,
      detailedBatches: batchesByProduct
    });
  } catch (error) {
    console.error('Error generating inventory report:', error);
    return NextResponse.json(
      { error: 'Failed to generate inventory report' },
      { status: 500 }
    );
  }
}
