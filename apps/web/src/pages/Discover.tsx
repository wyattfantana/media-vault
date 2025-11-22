import { useState } from 'react';
import { Browse } from './Browse';
import { YouTube } from './YouTube';
import { AllPlatforms } from './AllPlatforms';
import { SoundCloud } from './SoundCloud';
import { Rumble } from './Rumble';
import { TikTok } from './TikTok';
import { Twitch } from './Twitch';
import { Reddit } from './Reddit';
import { Vimeo } from './Vimeo';

type Tab = 'all' | 'youtube' | 'bbc' | 'soundcloud' | 'rumble' | 'tiktok' | 'twitch' | 'reddit' | 'vimeo';

export function Discover() {
  // Restore last active tab from sessionStorage, default to 'all'
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem('discover-active-tab');
    return (saved as Tab) || 'all';
  });

  const tabs = [
    { id: 'all' as const, label: 'All Platforms', icon: '🌐', description: 'Trending' },
    { id: 'youtube' as const, label: 'YouTube', icon: '▶️', description: 'Channels' },
    { id: 'bbc' as const, label: 'BBC iPlayer', icon: '📺', description: 'Programmes' },
    { id: 'soundcloud' as const, label: 'SoundCloud', icon: '🎧', description: 'Tracks' },
    { id: 'rumble' as const, label: 'Rumble', icon: '📹', description: 'Videos' },
    { id: 'tiktok' as const, label: 'TikTok', icon: '🎵', description: 'Clips' },
    { id: 'twitch' as const, label: 'Twitch', icon: '🎮', description: 'VODs' },
    { id: 'reddit' as const, label: 'Reddit', icon: '🔴', description: 'Video Posts' },
    { id: 'vimeo' as const, label: 'Vimeo', icon: '🎬', description: 'Videos' },
  ];

  // Save active tab to sessionStorage whenever it changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('discover-active-tab', tab);
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tab.icon}</span>
                  <div className="text-left">
                    <div>{tab.label}</div>
                    <div className="text-xs text-gray-400">{tab.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {/* Keep all tabs mounted but hidden to preserve state during background operations */}
      <div className="transition-opacity duration-200 ease-in-out">
        <div className={activeTab === 'all' ? 'block animate-fadeIn' : 'hidden'}>
          <AllPlatforms />
        </div>
        <div className={activeTab === 'youtube' ? 'block animate-fadeIn' : 'hidden'}>
          <YouTube />
        </div>
        <div className={activeTab === 'bbc' ? 'block animate-fadeIn' : 'hidden'}>
          <Browse />
        </div>
        <div className={activeTab === 'soundcloud' ? 'block animate-fadeIn' : 'hidden'}>
          <SoundCloud />
        </div>
        <div className={activeTab === 'rumble' ? 'block animate-fadeIn' : 'hidden'}>
          <Rumble />
        </div>
        <div className={activeTab === 'tiktok' ? 'block animate-fadeIn' : 'hidden'}>
          <TikTok />
        </div>
        <div className={activeTab === 'twitch' ? 'block animate-fadeIn' : 'hidden'}>
          <Twitch />
        </div>
        <div className={activeTab === 'reddit' ? 'block animate-fadeIn' : 'hidden'}>
          <Reddit />
        </div>
        <div className={activeTab === 'vimeo' ? 'block animate-fadeIn' : 'hidden'}>
          <Vimeo />
        </div>
      </div>
    </div>
  );
}
