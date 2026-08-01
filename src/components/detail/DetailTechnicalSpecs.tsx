import React from 'react';
import { 
  Cpu, 
  Settings, 
  Users, 
  TrendingUp, 
  Link, 
  Bot, 
  Hash, 
  Globe, 
  Layers, 
  FolderOpen, 
  Cloud, 
  BarChart3, 
  Laptop, 
  FileText, 
  Info,
  Code2,
  Lock,
  Zap,
  Terminal,
  Database,
  ShieldCheck,
  Server
} from 'lucide-react';
import { FIELD_LABELS } from '../../categoryFields';

interface DetailTechnicalSpecsProps {
  parsedAttrs: Record<string, string>;
  attributeLabels: Record<string, string>;
  techStack: { name: string; icon: string; desc: string }[];
}

const getLucideIcon = (name: string, className?: string) => {
  const normalized = name.toLowerCase().trim();
  const props = { className: className || "w-5 h-5" };

  switch (normalized) {
    case 'settings_suggest':
    case 'settings':
      return <Settings {...props} />;
    case 'groups':
    case 'users':
    case 'group':
      return <Users {...props} />;
    case 'trending_up':
    case 'trendingup':
      return <TrendingUp {...props} />;
    case 'link':
      return <Link {...props} />;
    case 'smart_toy':
    case 'bot':
      return <Bot {...props} />;
    case 'format_list_numbered':
    case 'hash':
      return <Hash {...props} />;
    case 'language':
    case 'languages':
    case 'globe':
      return <Globe {...props} />;
    case 'architecture':
    case 'layers':
      return <Layers {...props} />;
    case 'memory':
    case 'cpu':
      return <Cpu {...props} />;
    case 'folder_open':
    case 'folderopen':
      return <FolderOpen {...props} />;
    case 'cloud':
      return <Cloud {...props} />;
    case 'show_chart':
    case 'barchart':
      return <BarChart3 {...props} />;
    case 'devices':
    case 'laptop':
      return <Laptop {...props} />;
    case 'description':
    case 'filetext':
      return <FileText {...props} />;
    
    // Common technical stack symbols
    case 'code':
    case 'code2':
    case 'developer_mode':
      return <Code2 {...props} />;
    case 'lock':
    case 'security':
      return <Lock {...props} />;
    case 'zap':
    case 'bolt':
    case 'speed':
      return <Zap {...props} />;
    case 'terminal':
    case 'adb':
      return <Terminal {...props} />;
    case 'database':
    case 'storage':
      return <Database {...props} />;
    case 'shield':
    case 'verified':
      return <ShieldCheck {...props} />;
    case 'server':
    case 'dns':
      return <Server {...props} />;
      
    default:
      return <Info {...props} />;
  }
};

export const DetailTechnicalSpecs: React.FC<DetailTechnicalSpecsProps> = ({
  parsedAttrs,
  attributeLabels,
  techStack,
}) => {
  return (
    <>
      {Object.keys(parsedAttrs).length > 0 && (
        <section className="bg-white/5 dark:bg-primary-container/20 border border-outline-variant/10 rounded-2xl p-6 md:p-8 space-y-6">
          <h3 className="text-secondary-container font-extrabold text-xl md:text-2xl flex items-center gap-2">
            <Cpu className="text-secondary w-6 h-6" />
            Texnik xususiyatlar
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(parsedAttrs).map(([key, value]) => {
              const label = FIELD_LABELS[key] || attributeLabels[key] || key;

              let icon = "info";
              if (key === 'teamSize') icon = "groups";
              else if (key === 'stage') icon = "trending_up";
              else if (key === 'pitchDeckUrl') icon = "link";
              else if (key === 'targetAi') icon = "smart_toy";
              else if (key === 'promptsCount') icon = "format_list_numbered";
              else if (key === 'language') icon = "language";
              else if (key === 'framework') icon = "architecture";
              else if (key === 'modelSize') icon = "memory";
              else if (key === 'datasetSource') icon = "folder_open";
              else if (key === 'hasDomain') icon = "language";
              else if (key === 'hasHosting') icon = "cloud";
              else if (key === 'mau') icon = "show_chart";
              else if (key === 'platformType') icon = "devices";
              else if (key === 'additionalNotes') icon = "description";

              let displayValue = String(value);
              if (typeof value === 'boolean') {
                displayValue = value ? "Bor (Kiritilgan) ✅" : "Yo'q (Mavjud emas) ❌";
              }

              return (
                <div
                  key={key}
                  className="flex items-center gap-4 p-4 bg-background/50 border border-white/5 rounded-xl hover:border-secondary-container/20 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 text-secondary">
                    {getLucideIcon(icon, "w-5 h-5")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-on-primary-container uppercase font-extrabold tracking-wider block">
                      {label}
                    </span>
                    {key === 'pitchDeckUrl' && value && value !== "Ko'rsatilmagan" ? (
                      <a
                        href={String(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary hover:underline text-xs md:text-sm font-semibold truncate block"
                      >
                        Taqdimot hujjati (Pitch deck) ↗
                      </a>
                    ) : (
                      <span className="text-white font-semibold text-xs md:text-sm break-words block">
                        {displayValue}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Proprietary Technology Stack */}
      <section>
        <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-6">
          Xususiy texnologiyalar to'plami
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {techStack.map((tech) => (
            <div
              key={tech.name}
              className="p-5 bg-white/5 dark:bg-primary-container/20 border border-outline-variant/20 rounded-xl hover:border-secondary-container/50 transition-colors"
            >
              <div className="text-secondary-container mb-3">
                {getLucideIcon(tech.icon, "w-8 h-8")}
              </div>
              <h4 className="text-white font-bold text-sm mb-1">{tech.name}</h4>
              <p className="text-on-primary-container text-xs leading-relaxed">{tech.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};
