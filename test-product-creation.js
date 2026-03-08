const testProductCreation = async () => {
  try {
    console.log('Testing product creation API...');
    
    const testData = {
      name: 'Test Product',
      sku: 'TEST-001',
      price: 99.99,
      quantity: 0,
      stock: 0,
      category: 'Others',
      location: 'physical',
      cabinet: 'main',
      description: 'Test product description'
    };

    console.log('Sending test data:', testData);

    const response = await fetch('http://localhost:3001/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    const result = await response.json();
    console.log('Response data:', result);

    if (response.ok) {
      console.log('✅ Product creation test PASSED');
    } else {
      console.log('❌ Product creation test FAILED');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
};

// Run the test
testProductCreation();
