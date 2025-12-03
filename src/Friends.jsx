import { useEffect, useState } from 'react';
import {
  Search,
  UserPlus,
  UserCheck,
  Trophy,
  Flame,
  Star,
  MessageCircle,
} from 'lucide-react';
import AppHeader from './AppHeader'; // your existing header component

const API_BASE = 'https://haylinguav2.onrender.com';

export default function Friends({ user, onUpdateUser }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');
  const [loading, setLoading] = useState(true);

  // Fetch friends + suggested users from backend
  useEffect(() => {
    async function fetchFriends() {
      try {
        const res = await fetch(`${API_BASE}/friends?user_id=${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error('Error fetching friends:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFriends();
  }, [user.id]);

  const handleToggleFriend = async (friendId) => {
    const updated = users.map((u) =>
      u.id === friendId ? { ...u, isFriend: !u.isFriend } : u
    );
    setUsers(updated);

    // optimistic UI; backend update next
    try {
      await fetch(`${API_BASE}/friends/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          friend_id: friendId,
        }),
      });
    } catch (err) {
      console.error('Error updating friend relationship', err);
    }
  };

  const friends = users.filter((u) => u.isFriend);
  const suggested = users.filter((u) => !u.isFriend);

  const filteredUsers =
    activeTab === 'friends'
      ? friends.filter((u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : suggested.filter((u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader /> {/* Top header navigation */}

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-24">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-gray-900 font-semibold text-xl mb-2">
            Friends
          </h1>
          <p className="text-gray-600">
            Learn together and compete with friends
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for friends..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab('friends')}
              className={`py-3 rounded-xl transition-all ${
                activeTab === 'friends'
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              My Friends ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('suggested')}
              className={`py-3 rounded-xl transition-all ${
                activeTab === 'suggested'
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Suggested ({suggested.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading friends…</div>
        ) : (
          <>
            {/* Friends Stats */}
            {activeTab === 'friends' && friends.length > 0 && (
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl p-6">
                  <Trophy className="w-8 h-8 mb-2" />
                  <div className="text-2xl mb-1">{friends.length}</div>
                  <div className="text-orange-100 text-sm">Total Friends</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-xl p-6">
                  <Star className="w-8 h-8 mb-2" />
                  <div className="text-2xl mb-1">
                    {Math.max(...friends.map((f) => f.level))}
                  </div>
                  <div className="text-purple-100 text-sm">Highest Level</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-xl p-6">
                  <Flame className="w-8 h-8 mb-2" />
                  <div className="text-2xl mb-1">
                    {Math.max(...friends.map((f) => f.streak))}
                  </div>
                  <div className="text-blue-100 text-sm">Longest Streak</div>
                </div>
              </div>
            )}

            {/* Friends/Suggested List */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-gray-600">
                  No users found.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredUsers.map((friend) => (
                    <div
                      key={friend.id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {friend.name[0].toUpperCase()}
                        </div>

                        <div className="flex-1">
                          <div className="text-gray-900 font-medium mb-1">
                            {friend.name}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Trophy className="w-4 h-4" /> Level{' '}
                              {friend.level}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-4 h-4" /> {friend.xp} XP
                            </span>
                            <span className="flex items-center gap-1 text-orange-600">
                              <Flame className="w-4 h-4" /> {friend.streak} day
                              streak
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {friend.isFriend && (
                            <button
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Send message"
                            >
                              <MessageCircle className="w-5 h-5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleFriend(friend.id)}
                            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                              friend.isFriend
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                          >
                            {friend.isFriend ? (
                              <>
                                <UserCheck className="w-4 h-4" />
                                <span>Friends</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invite Friends CTA */}
            {activeTab === 'friends' && friends.length > 0 && (
              <div className="mt-6 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-2xl p-8 text-center">
                <h3 className="mb-2 font-semibold">
                  Invite Friends to Haylingua
                </h3>
                <p className="text-orange-100 mb-6 text-sm">
                  Learning is better with friends! Invite them to join your
                  journey.
                </p>
                <button className="px-6 py-3 bg-white text-orange-600 rounded-xl hover:bg-gray-100 transition-colors font-medium">
                  Share Invite Link
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
