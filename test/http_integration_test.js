// End-to-end HTTP integration test over real network sockets
const http = require('http');
const assert = require('assert');
const { server, rooms } = require('../server');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runHttpTests() {
  console.log('🌐 Testing Real HTTP Network Endpoints...');
  const port = 3456;
  await new Promise(r => server.listen(port, r));

  try {
    // 1. Create Room
    const createRes = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/api/room/create',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      hostName: 'TestHost',
      teamCount: 10,
      initialPurse: 100,
      roomId: 'E2E-TEST'
    });

    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.body.success, true);
    assert.strictEqual(createRes.body.roomId, 'E2E-TEST');
    console.log('  ✓ POST /api/room/create works');

    // 2. Join Room
    const joinRes = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/api/room/join',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      roomId: 'E2E-TEST',
      userName: 'Player1'
    });

    assert.strictEqual(joinRes.status, 200);
    assert.strictEqual(joinRes.body.success, true);
    console.log('  ✓ POST /api/room/join works');

    // 3. Claim Franchise
    const claimRes = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/api/room/claim-team',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      roomId: 'E2E-TEST',
      franchiseCode: 'CSK',
      userName: 'Player1'
    });

    assert.strictEqual(claimRes.status, 200);
    assert.strictEqual(claimRes.body.success, true);
    console.log('  ✓ POST /api/room/claim-team works');

    // 4. Update Config
    const configRes = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/api/room/update-config',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      roomId: 'E2E-TEST',
      initialPurse: 110,
      minSquad: 18,
      maxSquad: 25,
      timerDuration: 12
    });

    assert.strictEqual(configRes.status, 200);
    assert.strictEqual(configRes.body.config.initialPurse, 110);
    console.log('  ✓ POST /api/room/update-config works');

    // 5. Start Auction
    const startRes = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/api/room/start-auction',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      roomId: 'E2E-TEST'
    });

    assert.strictEqual(startRes.status, 200);
    assert.strictEqual(startRes.body.success, true);
    console.log('  ✓ POST /api/room/start-auction works');

    // Wait 1.2s for first player auto-call
    await new Promise(r => setTimeout(r, 1200));

    // 6. Get State
    const stateRes = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/api/state?room=E2E-TEST',
      method: 'GET'
    });

    assert.strictEqual(stateRes.status, 200);
    assert.strictEqual(stateRes.body.stage, 'active');
    assert.ok(stateRes.body.auction.currentPlayer);
    console.log('  ✓ GET /api/state returns live auction snapshot');

    // 7. Place Bid
    const bidRes = await makeRequest({
      hostname: 'localhost',
      port: port,
      path: '/api/room/bid',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      roomId: 'E2E-TEST',
      franchiseCode: 'CSK'
    });

    assert.strictEqual(bidRes.status, 200);
    assert.strictEqual(bidRes.body.success, true);
    console.log('  ✓ POST /api/room/bid processes live bids');

    console.log('\n🎉 ALL HTTP NETWORK TESTS PASSED!');
    process.exit(0);
  } finally {
    server.close();
  }
}

runHttpTests().catch(err => {
  console.error('HTTP test error:', err);
  process.exit(1);
});
