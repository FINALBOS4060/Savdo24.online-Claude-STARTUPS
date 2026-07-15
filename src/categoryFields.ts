export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  placeholder?: string;
  options?: string[];
}

export const CATEGORY_FIELDS: Record<string, FieldDefinition[]> = {
  startups: [
    {
      key: 'teamSize',
      label: 'Jamoa hajmi (kishi)',
      type: 'number',
      placeholder: 'Masalan: 5'
    },
    {
      key: 'stage',
      label: 'Loyiha bosqichi',
      type: 'select',
      options: ["G'oya", 'Prototip', 'Ishlab chiqarilgan', 'Foydalanuvchilari bor']
    },
    {
      key: 'pitchDeckUrl',
      label: 'Asoslash hujjati havolasi (Pitch deck)',
      type: 'text',
      placeholder: 'Masalan: https://drive.google.com/...'
    }
  ],
  'ai-prompts': [
    {
      key: 'targetAi',
      label: 'Qaysi AI tizimi uchun',
      type: 'select',
      options: ['ChatGPT', 'Midjourney', 'Claude', 'Boshqa']
    },
    {
      key: 'promptsCount',
      label: 'Promptlar soni',
      type: 'number',
      placeholder: 'Masalan: 50'
    },
    {
      key: 'language',
      label: 'Muloqot tili',
      type: 'select',
      options: ["o'zbek", "ingliz", "rus"]
    }
  ],
  'ai-models': [
    {
      key: 'framework',
      label: 'Kutubxona / Framework',
      type: 'select',
      options: ['PyTorch', 'TensorFlow', 'Boshqa']
    },
    {
      key: 'modelSize',
      label: 'Model hajmi',
      type: 'text',
      placeholder: 'Masalan: 7B parametr'
    },
    {
      key: 'datasetSource',
      label: 'O\'qitilgan ma\'lumotlar manbai',
      type: 'text',
      placeholder: 'Masalan: Common Crawl, Custom dataset'
    }
  ],
  'sites-apps': [
    {
      key: 'hasDomain',
      label: 'Domen qo\'shiladimi (beriladimi)',
      type: 'checkbox'
    },
    {
      key: 'hasHosting',
      label: 'Hosting qo\'shiladimi',
      type: 'checkbox'
    },
    {
      key: 'mau',
      label: 'Oylik faol foydalanuvchi soni',
      type: 'number',
      placeholder: 'Masalan: 1200'
    },
    {
      key: 'platformType',
      label: 'Platforma turi',
      type: 'select',
      options: ['Web', 'iOS', 'Android']
    }
  ],
  'other-digital': [
    {
      key: 'additionalNotes',
      label: 'Erkin qo\'shimcha izoh maydoni',
      type: 'text',
      placeholder: 'Mahsulot haqida qo\'shimcha ma\'lumotlar...'
    }
  ]
};

export const FIELD_LABELS: Record<string, string> = {
  teamSize: 'Jamoa hajmi',
  stage: 'Loyiha bosqichi',
  pitchDeckUrl: 'Pitch deck havolasi',
  targetAi: 'Mo\'ljallangan AI',
  promptsCount: 'Promptlar soni',
  language: 'Tili',
  framework: 'Texnik Stack',
  modelSize: 'Model o\'lchami',
  datasetSource: 'O\'qitilgan manba',
  hasDomain: 'Domen qo\'shiladimi',
  hasHosting: 'Hosting qo\'shiladimi',
  mau: 'Faol foydalanuvchilar soni',
  platformType: 'Platforma turi',
  additionalNotes: 'Qo\'shimcha izoh'
};
