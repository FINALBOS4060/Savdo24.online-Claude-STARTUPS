import React from 'react';
import { 
  Rocket, 
  ShoppingCart, 
  Coins, 
  Globe, 
  Code, 
  HeartPulse, 
  GraduationCap, 
  Activity, 
  Briefcase, 
  Gamepad2, 
  Heart, 
  Server, 
  Wrench, 
  Laptop, 
  Smartphone, 
  Megaphone,
  HelpCircle,
  Database,
  Store,
  BookOpen,
  Sprout,
  Video,
  Music,
  User,
  Zap,
  Bot
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
}

export function CategoryIcon({ name, className = "w-5 h-5" }: CategoryIconProps) {
  const norm = (name || '').toLowerCase().trim().replace(/_/g, '');
  switch (norm) {
    case 'rocket':
    case 'rocketlaunch':
      return <Rocket className={className} />;
    case 'shoppingcart':
    case 'cart':
    case 'shop':
      return <ShoppingCart className={className} />;
    case 'payments':
    case 'payment':
    case 'coins':
    case 'attachmoney':
    case 'money':
      return <Coins className={className} />;
    case 'globe':
    case 'language':
    case 'public':
      return <Globe className={className} />;
    case 'code':
    case 'developer':
    case 'source':
      return <Code className={className} />;
    case 'heartpulse':
    case 'health':
    case 'medical':
    case 'healing':
      return <HeartPulse className={className} />;
    case 'graduationcap':
    case 'school':
    case 'education':
      return <GraduationCap className={className} />;
    case 'activity':
    case 'trendingup':
    case 'analytics':
      return <Activity className={className} />;
    case 'briefcase':
    case 'business':
    case 'businesscenter':
      return <Briefcase className={className} />;
    case 'gamepad':
    case 'game':
    case 'games':
    case 'gamepad2':
      return <Gamepad2 className={className} />;
    case 'favorite':
    case 'heart':
      return <Heart className={className} />;
    case 'server':
    case 'dns':
      return <Server className={className} />;
    case 'build':
    case 'wrench':
    case 'construction':
      return <Wrench className={className} />;
    case 'computer':
    case 'laptop':
      return <Laptop className={className} />;
    case 'phone':
    case 'smartphone':
    case 'iphone':
    case 'mobile':
      return <Smartphone className={className} />;
    case 'campaign':
    case 'megaphone':
    case 'announcement':
      return <Megaphone className={className} />;
    case 'database':
    case 'storage':
      return <Database className={className} />;
    case 'store':
    case 'storefront':
      return <Store className={className} />;
    case 'book':
    case 'bookopen':
      return <BookOpen className={className} />;
    case 'agriculture':
    case 'sprout':
    case 'leaf':
      return <Sprout className={className} />;
    case 'video':
    case 'videocam':
    case 'movie':
      return <Video className={className} />;
    case 'music':
    case 'audiotrack':
      return <Music className={className} />;
    case 'user':
    case 'person':
    case 'group':
      return <User className={className} />;
    case 'bolt':
    case 'zap':
      return <Zap className={className} />;
    case 'bot':
    case 'android':
    case 'smart':
      return <Bot className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
}
