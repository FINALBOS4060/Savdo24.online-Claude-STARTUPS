import { ProfileTab } from '../types';
import { Home, Trophy, Plus, Bookmark, User } from 'lucide-react';

interface MobileNavProps {
  currentView: string;
  setView: (view: string) => void;
  onActionToast: (message: string) => void;
  setProfileTab?: (tab: ProfileTab) => void;
  profileTab?: ProfileTab;
  setInitialProfileTab?: (tab: ProfileTab | null) => void;
}

export default function MobileNav({
  currentView,
  setView,
  onActionToast,
  setProfileTab,
  profileTab,
  setInitialProfileTab,
}: MobileNavProps) {
  const tabs: Array<{ id: string; label: string; icon: string; view?: string; isCenter?: boolean; fillIcon?: boolean; toast?: string }> = [
    { id: 'browse', label: 'Asosiy', icon: 'home', view: 'browse' },
    { id: 'ideas-rating', label: 'Loyihalar', icon: 'emoji_events', view: 'ideas-rating' },
    { id: 'post', label: 'E\'lon', icon: 'add_box', view: 'sell', isCenter: true },
    { id: 'portfolio', label: 'Saqlanganlar', icon: 'bookmark' },
    { id: 'profile', label: 'Profil', icon: 'person', view: 'profile', fillIcon: true }
  ];

  const renderIcon = (iconName: string, isActive: boolean) => {
    const props = { className: "w-5 h-5 select-none" };
    switch (iconName) {
      case 'home':
        return <Home {...props} className={`w-5 h-5 select-none ${isActive ? 'fill-current' : ''}`} />;
      case 'emoji_events':
        return <Trophy {...props} className={`w-5 h-5 select-none ${isActive ? 'fill-current' : ''}`} />;
      case 'bookmark':
        return <Bookmark {...props} className={`w-5 h-5 select-none ${isActive ? 'fill-current' : ''}`} />;
      case 'person':
        return <User {...props} className={`w-5 h-5 select-none ${isActive ? 'fill-current' : ''}`} />;
      default:
        return null;
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center py-2 bg-primary-container border-t border-outline-variant/30 shadow-lg rounded-t-xl transition-colors duration-300">
      {tabs.map((tab) => {
        const isActive = tab.id === 'portfolio'
          ? (currentView === 'profile' && profileTab === 'saved')
          : tab.id === 'profile'
          ? (currentView === 'profile' && profileTab !== 'saved')
          : (tab.view ? currentView === tab.view : false);

        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              onClick={() => setView('sell')}
              className="flex flex-col items-center justify-center text-secondary-container font-bold scale-90 transition-transform active:scale-75"
            >
              <div className="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center -mt-6 border-4 border-primary-container text-on-secondary-fixed">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs mt-0.5">E'lon</span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'portfolio') {
                if (setInitialProfileTab) {
                  setInitialProfileTab('saved');
                } else if (setProfileTab) {
                  setProfileTab('saved');
                }
                setView('profile');
              } else if (tab.view) {
                if (tab.view === 'profile' && setProfileTab && profileTab === 'saved') {
                  setProfileTab('startups');
                }
                setView(tab.view);
              } else if (tab.toast) {
                onActionToast(tab.toast);
              }
            }}
            className={`flex flex-col items-center justify-center transition-all ${
              isActive
                ? 'text-secondary-container font-bold scale-105'
                : 'text-on-primary-container hover:text-on-primary-container'
            }`}
          >
            {renderIcon(tab.icon, isActive)}
            <span className="text-xs mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
