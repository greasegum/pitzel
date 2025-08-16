const fs = require('fs').promises;
const path = require('path');

const PERSISTENCE_FILE = 'persistent_data.json';

async function testPersistence() {
    console.log('🧪 Testing Pitzel Persistence System\n');
    
    // Test 1: Check if persistence file exists
    try {
        const data = await fs.readFile(PERSISTENCE_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        console.log('✅ Persistence file found:', PERSISTENCE_FILE);
        console.log('📊 Current data:', {
            entities: parsedData.entities?.length || 0,
            constraints: parsedData.constraints?.length || 0,
            lastModified: parsedData.timestamp
        });
    } catch (error) {
        console.log('❌ No persistence file found - this is normal for first run');
    }
    
    // Test 2: Create test data
    const testData = {
        entities: [
            {
                id: 'test_persistence_entity',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                color: '#00ff88',
                metadata: {
                    test: true,
                    created: new Date().toISOString()
                }
            }
        ],
        constraints: [],
        metadata: {
            test: true,
            description: 'Persistence test data'
        },
        timestamp: new Date().toISOString()
    };
    
    try {
        await fs.writeFile(PERSISTENCE_FILE, JSON.stringify(testData, null, 2));
        console.log('✅ Test data written to persistence file');
        
        // Test 3: Read back the data
        const readData = await fs.readFile(PERSISTENCE_FILE, 'utf8');
        const parsedReadData = JSON.parse(readData);
        console.log('✅ Data successfully read back from persistence file');
        console.log('📊 Read data:', {
            entities: parsedReadData.entities?.length || 0,
            constraints: parsedReadData.constraints?.length || 0,
            lastModified: parsedReadData.timestamp
        });
        
    } catch (error) {
        console.error('❌ Failed to write test data:', error.message);
    }
    
    console.log('\n🎯 Persistence test completed!');
    console.log('💡 The server will now load this data on startup');
}

testPersistence().catch(console.error); 