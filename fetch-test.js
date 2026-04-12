const http = require('http');

http.get('http://localhost:3000/api/products?cabinet=main', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const products = JSON.parse(data);
      console.log(`Total DB products for main: ${products.length}`);
      if (products.length > 0) {
        console.log('Top 3 newest:', JSON.stringify(products.slice(0, 3).map(p => ({
          id: p.id, 
          name: p.name, 
          cabinet: p.cabinet,
          dateCreated: p.dateCreated
        })), null, 2));
      }
    } catch (e) {
      console.error('Failed to parse response');
    }
  });
});
