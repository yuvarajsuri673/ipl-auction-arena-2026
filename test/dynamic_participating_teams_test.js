// Test: Dynamic Participating Teams & Dropped Unclaimed Teams
const assert = require('assert');
const {
  rooms,
  createRoom,
  startAuctionFromLobby,
  advanceToNextPlayer,
  placeBid,
  resolveCurrentLot,
  canFranchiseBid
} = require('../server');

async function testDynamicParticipatingTeams() {
  console.log('🧪 Testing Dynamic Participating Teams (e.g. 5 claimed teams, 5 dropped)...');

  const roomId = 'DYN-TEST-ROOM';
  const room = createRoom(roomId, {
    hostName: 'Admin_User',
    teamCount: 10,
    initialPurse: 120.0,
    timerDuration: 10
  });

  // Exactly 5 teams claim a franchise
  const claimedTeams = ['MI', 'CSK', 'RCB', 'KKR', 'DC'];
  const droppedTeams = ['PBKS', 'RR', 'SRH', 'GT', 'LSG'];

  claimedTeams.forEach((code, idx) => {
    room.franchises[code].user = `Manager_${code}`;
  });

  assert.strictEqual(Object.values(room.franchises).filter(f => f.user !== null).length, 5);
  assert.strictEqual(Object.values(room.franchises).filter(f => f.user === null).length, 5);

  // Host starts the auction
  startAuctionFromLobby(room);

  assert.strictEqual(room.stage, 'active');

  // Verify participating status
  claimedTeams.forEach(code => {
    assert.strictEqual(room.franchises[code].isParticipating, true, `${code} must be participating`);
  });

  droppedTeams.forEach(code => {
    assert.strictEqual(room.franchises[code].isParticipating, false, `${code} must be dropped/non-participating`);
  });

  // Advance to first player
  advanceToNextPlayer(room);
  assert.ok(room.auction.currentPlayer);

  // Test 1: Claimed team (MI) can bid
  const bid1 = placeBid(room, 'MI');
  assert.strictEqual(bid1.success, true, 'Claimed franchise MI can bid');
  assert.strictEqual(room.auction.currentBidder, 'MI');

  // Test 2: Another claimed team (CSK) can bid higher
  const bid2 = placeBid(room, 'CSK');
  assert.strictEqual(bid2.success, true, 'Claimed franchise CSK can bid higher');
  assert.strictEqual(room.auction.currentBidder, 'CSK');

  // Test 3: Dropped team (PBKS) is STRICTLY REJECTED from bidding
  const checkDropped = canFranchiseBid(room, 'PBKS', 10.0);
  assert.strictEqual(checkDropped.canBid, false, 'PBKS cannot bid because it was dropped');
  const bidDropped = placeBid(room, 'PBKS');
  assert.strictEqual(bidDropped.success, false, 'PBKS bid rejected by placeBid');
  assert.ok(bidDropped.message.includes('not participating') || bidDropped.message.includes('no manager'));

  console.log('✅ Dynamic participating teams verified: 5 active teams bid, 5 dropped teams rejected.');
}

testDynamicParticipatingTeams().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
