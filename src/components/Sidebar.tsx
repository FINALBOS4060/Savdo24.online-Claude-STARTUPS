import { UserProfileData, ProfileTab } from '../types';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  user: UserProfileData;
  onActionToast: (message: string) => void;
  setProfileTab?: (tab: ProfileTab) => void;
  profileTab?: ProfileTab;
}

export default function Sidebar({
  currentView,
  setView,
  user,
  onActionToast,
  setProfileTab,
  profileTab,
}: SidebarProps) {
  const menuItems: Array<{ id: string; label: string; icon: string; view?: string; toast?: string }> = [
    { id: 'profile', label: 'Boshqaruv paneli', icon: 'dashboard', view: 'profile' },
    { id: 'browse', label: 'Faol e\'lonlar', icon: 'list_alt', view: 'browse' },
    { id: 'ideas-rating', label: '🏆 G\'oyalar reytingi', icon: 'emoji_events', view: 'ideas-rating' },
    { id: 'settings', label: 'Sozlamalar', icon: 'settings' },
    { id: 'support', label: 'Qo\'llab-quvvatlash', icon: 'help', view: 'support' },
  ];

  const isAdmin = user && user.role === 'Admin';
  if (isAdmin) {
    menuItems.splice(1, 0, { id: 'admin', label: 'Admin paneli', icon: 'admin_panel_settings', view: 'admin' });
  }

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-64px)] p-4 bg-surface-container-lowest dark:bg-primary-container border-r border-outline-variant/30 w-64 transition-colors duration-300 z-40">
      <div className="flex flex-col items-center mb-8 pt-4">
        <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-secondary-container relative group cursor-pointer" onClick={() => { if (setProfileTab) setProfileTab('startups'); setView('profile'); }}>
          <img
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            src={user.avatarUrl}
            alt="Savdo24 foydalanuvchi avatarlari"
            loading="lazy"
            width={64}
            height={64}
          />
        </div>
        <h3 className="font-bold text-sm text-on-surface dark:text-white">{user.name}</h3>
        {user.name !== 'Mehmon' && user.emailVerified && (
          <p className="text-xs text-secondary-fixed-dim font-medium flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-xs text-secondary-container">verified</span>
            Tasdiqlangan foydalanuvchi
          </p>
        )}
      </div>

      <nav className="space-y-1 flex-grow">
        {menuItems.map((item) => {
          const isActive = item.id === 'settings'
            ? (currentView === 'profile' && profileTab === 'settings')
            : (item.view ? (currentView === item.view && (item.view !== 'profile' || profileTab !== 'settings')) : false);
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'settings') {
                  if (setProfileTab) setProfileTab('settings');
                  setView('profile');
                } else if (item.view) {
                  if (item.view === 'profile' && setProfileTab) {
                    setProfileTab('startups');
                  }
                  setView(item.view);
                } else if (item.toast) {
                  onActionToast(item.toast);
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-secondary-container text-on-secondary-container shadow-md shadow-secondary-container/10'
                  : 'text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

    </aside>
  );
}
