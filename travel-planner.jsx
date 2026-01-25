import React, { useState } from 'react';
import { Calendar, MapPin, DollarSign, Cloud, Plus, Trash2, Save, Menu } from 'lucide-react';

export default function TravelPlanner() {
  const [selectedDestination, setSelectedDestination] = useState('');
  const [tripDates, setTripDates] = useState({ start: '', end: '' });
  const [budget, setBudget] = useState('');
  const [itinerary, setItinerary] = useState([]);
  const [activeTab, setActiveTab] = useState('destination');

  // 熱門旅遊目的地選項
  const destinations = [
    { id: 'hk-macau', name: '香港・澳門', emoji: '🇭🇰', tags: ['購物', '美食', '城市'] },
    { id: 'japan', name: '日本', emoji: '🇯🇵', tags: ['文化', '美食', '自然'] },
    { id: 'korea', name: '韓國', emoji: '🇰🇷', tags: ['購物', 'K-pop', '美食'] },
    { id: 'thailand', name: '泰國', emoji: '🇹🇭', tags: ['海灘', '美食', '寺廟'] },
    { id: 'singapore', name: '新加坡', emoji: '🇸🇬', tags: ['城市', '美食', '家庭'] },
    { id: 'vietnam', name: '越南', emoji: '🇻🇳', tags: ['歷史', '美食', '自然'] },
    { id: 'malaysia', name: '馬來西亞', emoji: '🇲🇾', tags: ['海灘', '美食', '文化'] },
    { id: 'europe', name: '歐洲', emoji: '🇪🇺', tags: ['歷史', '藝術', '文化'] },
  ];

  // 新增行程項目
  const addItineraryItem = () => {
    setItinerary([...itinerary, {
      id: Date.now(),
      day: itinerary.length + 1,
      title: '',
      time: '',
      location: '',
      notes: '',
      cost: ''
    }]);
  };

  // 刪除行程項目
  const removeItineraryItem = (id) => {
    setItinerary(itinerary.filter(item => item.id !== id));
    // 重新編號
    setItinerary(prev => prev.map((item, index) => ({ ...item, day: index + 1 })));
  };

  // 更新行程項目
  const updateItineraryItem = (id, field, value) => {
    setItinerary(itinerary.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // 計算總預算
  const calculateTotalBudget = () => {
    const itineraryCost = itinerary.reduce((sum, item) => 
      sum + (parseFloat(item.cost) || 0), 0
    );
    return itineraryCost;
  };

  // 計算旅行天數
  const calculateDays = () => {
    if (tripDates.start && tripDates.end) {
      const start = new Date(tripDates.start);
      const end = new Date(tripDates.end);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                旅行規劃師
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              {selectedDestination && `目的地: ${destinations.find(d => d.id === selectedDestination)?.name || ''}`}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-2 flex gap-2 overflow-x-auto">
          {[
            { id: 'destination', name: '選擇目的地', icon: MapPin },
            { id: 'dates', name: '日期與預算', icon: Calendar },
            { id: 'itinerary', name: '行程規劃', icon: Menu },
            { id: 'summary', name: '總覽', icon: Save }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {/* Tab: 選擇目的地 */}
        {activeTab === 'destination' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">選擇你的旅行目的地</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {destinations.map(dest => (
                  <button
                    key={dest.id}
                    onClick={() => setSelectedDestination(dest.id)}
                    className={`p-6 rounded-xl border-2 transition-all hover:shadow-lg ${
                      selectedDestination === dest.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-4xl mb-3">{dest.emoji}</div>
                    <h3 className="font-bold text-lg mb-2">{dest.name}</h3>
                    <div className="flex flex-wrap gap-1">
                      {dest.tags.map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {selectedDestination && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800">
                    ✓ 已選擇: <strong>{destinations.find(d => d.id === selectedDestination)?.name}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: 日期與預算 */}
        {activeTab === 'dates' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">設定旅行日期與預算</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    出發日期
                  </label>
                  <input
                    type="date"
                    value={tripDates.start}
                    onChange={(e) => setTripDates({...tripDates, start: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    返回日期
                  </label>
                  <input
                    type="date"
                    value={tripDates.end}
                    onChange={(e) => setTripDates({...tripDates, end: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {calculateDays() > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800">
                    旅行天數: <strong>{calculateDays()} 天</strong>
                  </p>
                </div>
              )}

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  預計總預算 (TWD)
                </label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="例如: 30000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab: 行程規劃 */}
        {activeTab === 'itinerary' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">規劃每日行程</h2>
                <button
                  onClick={addItineraryItem}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  新增行程
                </button>
              </div>

              {itinerary.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Menu className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>還沒有任何行程，點擊上方按鈕開始規劃吧！</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {itinerary.map(item => (
                    <div key={item.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                            Day {item.day}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItineraryItem(item.id)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">活動名稱</label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItineraryItem(item.id, 'title', e.target.value)}
                            placeholder="例如: 參觀太平山頂"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">時間</label>
                          <input
                            type="time"
                            value={item.time}
                            onChange={(e) => updateItineraryItem(item.id, 'time', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">地點</label>
                          <input
                            type="text"
                            value={item.location}
                            onChange={(e) => updateItineraryItem(item.id, 'location', e.target.value)}
                            placeholder="例如: 香港島"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">預估花費 (TWD)</label>
                          <input
                            type="number"
                            value={item.cost}
                            onChange={(e) => updateItineraryItem(item.id, 'cost', e.target.value)}
                            placeholder="例如: 500"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-600 mb-1">備註</label>
                          <textarea
                            value={item.notes}
                            onChange={(e) => updateItineraryItem(item.id, 'notes', e.target.value)}
                            placeholder="例如: 記得帶相機、提前預約..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows="2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: 總覽 */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">旅行計畫總覽</h2>

              {/* 基本資訊 */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <MapPin className="w-5 h-5" />
                    <span className="font-semibold">目的地</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {selectedDestination 
                      ? destinations.find(d => d.id === selectedDestination)?.name 
                      : '未選擇'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-purple-700 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="font-semibold">旅行天數</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {calculateDays() > 0 ? `${calculateDays()} 天` : '未設定'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <DollarSign className="w-5 h-5" />
                    <span className="font-semibold">預算狀況</span>
                  </div>
                  <p className="text-lg font-bold text-green-900">
                    已用: {calculateTotalBudget().toLocaleString()} TWD
                  </p>
                  {budget && (
                    <p className="text-sm text-green-700">
                      預算: {parseFloat(budget).toLocaleString()} TWD
                    </p>
                  )}
                </div>
              </div>

              {/* 日期資訊 */}
              {tripDates.start && tripDates.end && (
                <div className="bg-gray-50 rounded-xl p-6 mb-8">
                  <h3 className="font-semibold text-gray-800 mb-3">旅行日期</h3>
                  <p className="text-gray-700">
                    {tripDates.start} 至 {tripDates.end}
                  </p>
                </div>
              )}

              {/* 行程列表 */}
              {itinerary.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">行程明細</h3>
                  <div className="space-y-3">
                    {itinerary.map(item => (
                      <div key={item.id} className="border-l-4 border-blue-500 bg-gray-50 rounded-r-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                                Day {item.day}
                              </span>
                              {item.time && (
                                <span className="text-sm text-gray-600">{item.time}</span>
                              )}
                            </div>
                            <h4 className="font-semibold text-gray-900 mb-1">
                              {item.title || '未命名活動'}
                            </h4>
                            {item.location && (
                              <p className="text-sm text-gray-600 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {item.location}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-sm text-gray-500 mt-2">{item.notes}</p>
                            )}
                          </div>
                          {item.cost && (
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                ${parseFloat(item.cost).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-green-800">行程總花費</span>
                      <span className="text-xl font-bold text-green-900">
                        {calculateTotalBudget().toLocaleString()} TWD
                      </span>
                    </div>
                    {budget && (
                      <div className="mt-2 text-sm text-green-700">
                        剩餘預算: {(parseFloat(budget) - calculateTotalBudget()).toLocaleString()} TWD
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!selectedDestination && itinerary.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>開始規劃你的旅行吧！</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>旅行規劃師 - 讓你的旅程更有規劃 ✈️</p>
        </div>
      </footer>
    </div>
  );
}
