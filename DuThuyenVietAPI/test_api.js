const fs = require('fs');

async function test() {
    try {
        const res = await fetch('http://localhost:5224/api/Cruises', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + fs.readFileSync('.env.token', 'utf-8').trim()
            },
            body: JSON.stringify({
                destinationId: 1,
                name: "Test Cruise",
                totalCabins: 20,
                shortDescription: "short",
                description: "long",
                thumbnailUrl: "url"
            })
        });
        
        console.log("Status:", res.status);
        console.log("Body:", await res.text());
    } catch (e) {
        console.error(e);
    }
}
test();
