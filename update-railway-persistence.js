const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const RAILWAY_API_URL = 'https://pitzel.up.railway.app';

async function updateRailwayWithPersistenceData() {
    console.log('🚂 Updating Railway API with persistent data...\n');
    
    // Test data that should persist
    const persistentData = {
        entities: [
            {
                id: 'persistent_rectangle_1',
                type: 'rectangle',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                color: '#00ff88',
                metadata: {
                    source: 'persistence_test',
                    created: new Date().toISOString()
                }
            },
            {
                id: 'persistent_circle_1',
                type: 'circle',
                center: { x: 300, y: 200 },
                radius: 50,
                color: '#ff6b6b',
                metadata: {
                    source: 'persistence_test',
                    created: new Date().toISOString()
                }
            },
            {
                id: 'persistent_line_1',
                type: 'line',
                start: { x: 50, y: 50 },
                end: { x: 250, y: 250 },
                color: '#4ecdc4',
                metadata: {
                    source: 'persistence_test',
                    created: new Date().toISOString()
                }
            }
        ],
        constraints: [
            {
                id: 'constraint_1',
                type: 'distance',
                entities: ['persistent_rectangle_1', 'persistent_circle_1'],
                value: 100,
                metadata: {
                    source: 'persistence_test'
                }
            }
        ],
        metadata: {
            source: 'persistence_test',
            description: 'Test data for persistence system',
            created: new Date().toISOString(),
            version: '1.0'
        }
    };
    
    try {
        // Update the Railway API with persistent data
        const response = await fetch(`${RAILWAY_API_URL}/api/editor/data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(persistentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Successfully updated Railway API with persistent data');
            console.log('📊 Data summary:', {
                entities: result.data.entities.length,
                constraints: result.data.constraints.length,
                timestamp: result.data.timestamp
            });
            
            // Verify the data was saved
            console.log('\n🔍 Verifying data persistence...');
            const verifyResponse = await fetch(`${RAILWAY_API_URL}/api/editor/data`);
            const verifyResult = await verifyResponse.json();
            
            if (verifyResult.success) {
                console.log('✅ Data verified on Railway API');
                console.log('📊 Verified data:', {
                    entities: verifyResult.data.entities.length,
                    constraints: verifyResult.data.constraints.length,
                    timestamp: verifyResult.data.timestamp
                });
            }
            
        } else {
            console.error('❌ Failed to update Railway API:', result);
        }
        
    } catch (error) {
        console.error('❌ Error updating Railway API:', error.message);
    }
    
    console.log('\n🎯 Railway persistence update completed!');
    console.log('💡 This data should now persist across server restarts');
}

updateRailwayWithPersistenceData().catch(console.error); 