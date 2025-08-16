const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const RAILWAY_API_URL = 'https://pitzel.up.railway.app';

async function testRealtimeUpdates() {
    console.log('🔄 Testing Real-time API Updates\n');
    
    // Test sequence of changes
    const testChanges = [
        {
            name: 'Add a red circle',
            data: {
                entities: [
                    {
                        id: 'realtime_circle_1',
                        type: 'circle',
                        center: { x: 200, y: 150 },
                        radius: 60,
                        color: '#ff0000',
                        metadata: {
                            source: 'realtime_test',
                            change: 1
                        }
                    }
                ],
                constraints: [],
                metadata: {
                    source: 'realtime_test',
                    change: 1,
                    timestamp: new Date().toISOString()
                }
            }
        },
        {
            name: 'Add a blue rectangle',
            data: {
                entities: [
                    {
                        id: 'realtime_circle_1',
                        type: 'circle',
                        center: { x: 200, y: 150 },
                        radius: 60,
                        color: '#ff0000',
                        metadata: { source: 'realtime_test', change: 1 }
                    },
                    {
                        id: 'realtime_rect_1',
                        type: 'rectangle',
                        x: 300,
                        y: 100,
                        width: 120,
                        height: 80,
                        color: '#0066ff',
                        metadata: {
                            source: 'realtime_test',
                            change: 2
                        }
                    }
                ],
                constraints: [],
                metadata: {
                    source: 'realtime_test',
                    change: 2,
                    timestamp: new Date().toISOString()
                }
            }
        },
        {
            name: 'Add a green line',
            data: {
                entities: [
                    {
                        id: 'realtime_circle_1',
                        type: 'circle',
                        center: { x: 200, y: 150 },
                        radius: 60,
                        color: '#ff0000',
                        metadata: { source: 'realtime_test', change: 1 }
                    },
                    {
                        id: 'realtime_rect_1',
                        type: 'rectangle',
                        x: 300,
                        y: 100,
                        width: 120,
                        height: 80,
                        color: '#0066ff',
                        metadata: { source: 'realtime_test', change: 2 }
                    },
                    {
                        id: 'realtime_line_1',
                        type: 'line',
                        start: { x: 100, y: 100 },
                        end: { x: 400, y: 200 },
                        color: '#00ff00',
                        metadata: {
                            source: 'realtime_test',
                            change: 3
                        }
                    }
                ],
                constraints: [],
                metadata: {
                    source: 'realtime_test',
                    change: 3,
                    timestamp: new Date().toISOString()
                }
            }
        }
    ];
    
    for (let i = 0; i < testChanges.length; i++) {
        const change = testChanges[i];
        console.log(`📝 Change ${i + 1}: ${change.name}`);
        
        try {
            const response = await fetch(`${RAILWAY_API_URL}/api/editor/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(change.data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ ${change.name} - Applied successfully`);
                console.log(`   Entities: ${result.data.entities.length}`);
                console.log(`   Timestamp: ${result.data.timestamp}`);
            } else {
                console.log(`❌ ${change.name} - Failed:`, result.error);
            }
            
            // Wait 3 seconds between changes to see them in real-time
            if (i < testChanges.length - 1) {
                console.log('⏳ Waiting 3 seconds for next change...\n');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
        } catch (error) {
            console.error(`❌ Error applying ${change.name}:`, error.message);
        }
    }
    
    console.log('\n🎯 Real-time update test completed!');
    console.log('💡 Check the web interface to see the changes appear automatically');
    console.log('🔄 You can undo these changes using Ctrl+Shift+Z');
}

testRealtimeUpdates().catch(console.error); 