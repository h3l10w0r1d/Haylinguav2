// src/lib/friendState.js — cross-references a person's user_id against the
// caller's friends/incoming/sent-request lists to decide which action
// button to show (Add / Accept+Decline / Requested / Friends). Mirrors the
// per-row state logic src/Friends.jsx computes inline for its Discover tab
// and PublicUserPage.jsx computes for a single profile — factored out here
// since FriendsScreen's Discover tab and PublicProfileScreen both need it.
export function getFriendshipState(personUserId, { friends = [], incoming = [], sent = [] } = {}) {
  if (friends.some((f) => f.user_id === personUserId)) {
    return { state: 'friends' };
  }
  const inc = incoming.find((r) => r.requester_id === personUserId);
  if (inc) {
    return { state: 'incoming_pending', requestId: inc.id };
  }
  const out = sent.find((r) => r.addressee_id === personUserId);
  if (out) {
    return { state: 'outgoing_pending', requestId: out.id };
  }
  return { state: 'none' };
}
