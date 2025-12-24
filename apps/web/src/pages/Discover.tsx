import React, { useState } from 'react';
import { Browse } from './Browse';
import { YouTube } from './YouTube';
import { SoundCloud } from './SoundCloud';
import { TikTok } from './TikTok';
import { Twitch } from './Twitch';
import { Reddit } from './Reddit';
import Movies from './Movies';
import TVShows from './TVShows';
import Documentaries from './Documentaries';

type Tab = 'youtube' | 'bbc' | 'soundcloud' | 'tiktok' | 'twitch' | 'reddit' | 'movies' | 'tvshows' | 'documentaries';

export function Discover() {
  // Restore last active tab from localStorage or URL parameter, default to 'movies'
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      return tabParam as Tab;
    }
    // Fall back to localStorage
    const saved = localStorage.getItem('discover-active-tab');
    return (saved as Tab) || 'movies';
  });

  const tabs = [
    { id: 'movies' as const, label: 'Movies', icon: '🎬', description: 'Browse' },
    { id: 'tvshows' as const, label: 'TV Shows', icon: '📺', description: 'Series' },
    { id: 'documentaries' as const, label: 'Documentaries', icon: '🎞️', description: 'Films' },
    { id: 'youtube' as const, label: 'YouTube', logo: '/images/youtube.svg' },
    { id: 'bbc' as const, label: 'BBC iPlayer', logo: '/images/bbc-iplayer.svg' },
    { id: 'soundcloud' as const, label: 'SoundCloud', logo: '/images/soundcloud.svg' },
    { id: 'tiktok' as const, label: 'TikTok', logo: '/images/tiktok.png' },
    { id: 'twitch' as const, label: 'Twitch', logo: '/images/twitch.svg' },
    { id: 'reddit' as const, label: 'Reddit', logo: '/images/reddit.svg' },
  ];

  // Save active tab to localStorage whenever it changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    localStorage.setItem('discover-active-tab', tab);
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-700">
          <nav className="flex justify-between" aria-label="Tabs">
            {tabs.map((tab, index) => (
              <React.Fragment key={tab.id}>
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    py-4 px-3 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-gray-300 hover:text-gray-100 hover:border-gray-500'
                    }
                  `}
                  title={tab.label}
                >
                  {'logo' in tab ? (
                    <img src={tab.logo} alt={tab.label} className="h-8 w-8 object-contain" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tab.icon}</span>
                      <div className="text-left">
                        <div>{tab.label}</div>
                        <div className="text-xs text-gray-400">{tab.description}</div>
                      </div>
                    </div>
                  )}
                </button>
                {/* Separator after Documentaries (index 2) and SoundCloud (index 5) */}
                {(index === 2 || index === 5) && (
                  <div className="w-px bg-gray-700 self-stretch my-2" />
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {/* Keep all tabs mounted but hidden to preserve state during background operations */}
      <div className="transition-opacity duration-200 ease-in-out">
        <div className={activeTab === 'movies' ? 'block animate-fadeIn' : 'hidden'}>
          <Movies />
        </div>
        <div className={activeTab === 'tvshows' ? 'block animate-fadeIn' : 'hidden'}>
          <TVShows />
        </div>
        <div className={activeTab === 'documentaries' ? 'block animate-fadeIn' : 'hidden'}>
          <Documentaries />
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
        <div className={activeTab === 'tiktok' ? 'block animate-fadeIn' : 'hidden'}>
          <TikTok />
        </div>
        <div className={activeTab === 'twitch' ? 'block animate-fadeIn' : 'hidden'}>
          <Twitch />
        </div>
        <div className={activeTab === 'reddit' ? 'block animate-fadeIn' : 'hidden'}>
          <Reddit />
        </div>
      </div>
    </div>
  );
}
