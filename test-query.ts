import { getAllProductsAllCabinets } from './lib/pg-direct.ts';

async function test() {
  try {
    const productsAll = await getAllProductsAllCabinets();
    console.log('getAllProductsAllCabinets success, count:', productsAll.length);
  } catch(e) {
    console.error('getAllProductsAllCabinets failed:', e);
  }
}

test();
