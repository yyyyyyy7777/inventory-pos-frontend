import { query } from './mysql-direct';

export interface StockBatch {
  id: string;
  productId: string;
  quantity: number;
  costPerUnit: number | null;
  batchDate: string;
  cabinet: string;
}

export interface PricingStrategy {
  // FIFO (First In, First Out) - sells oldest stock first
  fifo: (batches: StockBatch[]) => StockBatch[];
  // LIFO (Last In, First Out) - sells newest stock first  
  lifo: (batches: StockBatch[]) => StockBatch[];
  // Weighted Average - averages cost across all batches
  weightedAverage: (batches: StockBatch[]) => number;
}

export class PricingService {
  // Get stock batches for a product
  static async getStockBatches(productId: string, cabinet: string): Promise<StockBatch[]> {
    const rows = await query(
      `SELECT id, productId, quantity, costPerUnit, batchDate, cabinet 
       FROM stockbatch 
       WHERE productId = ? AND cabinet = ? AND quantity > 0
       ORDER BY batchDate ASC`,
      [productId, cabinet]
    ) as any[];
    
    return rows.map(row => ({
      id: row.id.toString(),
      productId: row.productId.toString(),
      quantity: row.quantity,
      costPerUnit: row.costPerUnit,
      batchDate: new Date(row.batchDate).toISOString(),
      cabinet: row.cabinet
    }));
  }

  // FIFO strategy - sell oldest stock first
  static fifo(batches: StockBatch[]): StockBatch[] {
    return batches.sort((a, b) => new Date(a.batchDate).getTime() - new Date(b.batchDate).getTime());
  }

  // LIFO strategy - sell newest stock first
  static lifo(batches: StockBatch[]): StockBatch[] {
    return batches.sort((a, b) => new Date(b.batchDate).getTime() - new Date(a.batchDate).getTime());
  }

  // Calculate weighted average cost
  static weightedAverage(batches: StockBatch[]): number {
    if (batches.length === 0) return 0;
    
    const totalCost = batches.reduce((sum, batch) => {
      return sum + (batch.costPerUnit || 0) * batch.quantity;
    }, 0);
    
    const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
    
    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  }

  // Get the cost of goods sold for a sale using FIFO
  static async getCOGS(productId: string, quantity: number, cabinet: string): Promise<{
    cost: number;
    batchesUsed: Array<{ batchId: string; quantity: number; costPerUnit: number }>;
  }> {
    const batches = await this.getStockBatches(productId, cabinet);
    const sortedBatches = this.fifo(batches);
    
    let remainingQuantity = quantity;
    let totalCost = 0;
    const batchesUsed: Array<{ batchId: string; quantity: number; costPerUnit: number }> = [];
    
    for (const batch of sortedBatches) {
      if (remainingQuantity <= 0) break;
      
      const quantityFromBatch = Math.min(remainingQuantity, batch.quantity);
      const batchCost = (batch.costPerUnit || 0) * quantityFromBatch;
      
      totalCost += batchCost;
      batchesUsed.push({
        batchId: batch.id,
        quantity: quantityFromBatch,
        costPerUnit: batch.costPerUnit || 0
      });
      
      remainingQuantity -= quantityFromBatch;
    }
    
    if (remainingQuantity > 0) {
      throw new Error(`Insufficient stock. Need ${quantity}, only ${quantity - remainingQuantity} available`);
    }
    
    return { cost: totalCost, batchesUsed };
  }

  // Update stock batches after a sale
  static async updateStockBatches(batchesUsed: Array<{ batchId: string; quantity: number }>): Promise<void> {
    for (const usage of batchesUsed) {
      await query(
        'UPDATE stockbatch SET quantity = quantity - ? WHERE id = ?',
        [usage.quantity, usage.batchId]
      );
    }
  }

  // Get current product price (can be enhanced with pricing rules)
  static async getCurrentPrice(productId: string, cabinet: string): Promise<number> {
    const rows = await query(
      'SELECT price FROM product WHERE id = ? AND cabinet = ?',
      [productId, cabinet]
    ) as any[];
    
    return rows.length > 0 ? rows[0].price : 0;
  }

  // Calculate profit margin for a sale
  static async calculateProfitMargin(productId: string, sellingPrice: number, quantity: number, cabinet: string): Promise<{
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
  }> {
    const { cost } = await this.getCOGS(productId, quantity, cabinet);
    const revenue = sellingPrice * quantity;
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    return { revenue, cogs: cost, profit, margin };
  }
}
