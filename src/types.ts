export interface TeamMember {
  name: string;
  role: string;
  imgUrl: string;
}

export interface LoyihaMilestone {
  date: string;
  title: string;
  desc: string;
}

export interface Startup {
  id: string;
  name: string;
  slogan: string;
  description: string;
  longDescription: string;
  category: string;
  price: number;
  listingType: string; // "To'liq loyiha (manba kodi bilan)" or "Faqat litsenziya (foydalanish huquqi)"
  techStack: string[];
  demoUrl?: string;
  repoIncluded: boolean;
  soldStatus: 'sotuvda' | 'sotildi';
  status: 'active' | 'pending';
  proposalsCount?: number;
  team: TeamMember[];
  milestones: LoyihaMilestone[];
  image: string;
  gallery?: string[];
  contactEmail?: string;
  contactPhone?: string;
  contactTelegram?: string;
  dateCreated?: string;
  deliveryUrl?: string;
  attributes?: string; // JSON string for category specific attributes
  userId?: number;
  isTop?: boolean;
  topExpiresAt?: string;
  user?: {
    name: string;
    isVip: boolean;
    avatarUrl: string;
  };
}

export interface UserProfileData {
  id?: number;
  email?: string;
  name: string;
  role: string; // e.g. "Sotuvchi" or "Xaridor"
  verified: boolean;
  emailVerified?: boolean;
  isBanned?: boolean;
  isVip?: boolean;
  vipExpiresAt?: string;
  joinDate: string;
  avatarUrl: string;
  coverUrl?: string;
  telegramLinkCode?: string;
  averageRating?: number;
  totalReviews?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  fields: any[];
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export type ProfileTab = 'startups' | 'saved' | 'purchases' | 'earnings' | 'reviews' | 'settings' | 'security' | 'vip' | 'referral' | 'b2b';

export interface Idea {
  id: number;
  content: string;
  startupId: string;
  userId?: number;
  authorName: string;
  upvotes: number;
  createdAt: string;
}

declare global {
  interface Window {
    google: any;
  }
  interface ImportMeta {
    env: {
      VITE_GOOGLE_CLIENT_ID: string;
    };
  }
}

