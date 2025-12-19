
const { MongoClient, ObjectId } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not found');
        return;
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(); // Default DB

        console.log('--- Checking Warehouse ---');
        const whId = '69448778352795f7918eaa3f'; // The ID from user logs (it looks like a valid 24 char hex? No, verify length)
        // 69448778352795f7918eaa3f is 24 chars? 
        // 69448778352795f7918eaa3f -> Count: 24.

        // Check specific warehouse
        try {
            const wh = await db.collection('warehouses').findOne({ _id: new ObjectId(whId) });
            console.log('Target Warehouse:', wh);
        } catch (e) {
            console.log('Invalid Warehouse ID format or not found:', whId);
        }

        // List all warehouses
        const allWh = await db.collection('warehouses').find({}).toArray();
        console.log('All Warehouses:', allWh.map(w => ({ id: w._id, name: w.name, isDefault: w.isDefault })));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

check();
