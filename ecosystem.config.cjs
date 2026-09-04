module.exports = {
  apps: [
    {
      name: 'savdo24',
      script: 'dist/server.cjs',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'telegram-bot',
      script: 'telegram-bot/index.ts',
      cwd: __dirname,
      interpreter: './node_modules/.bin/tsx',
      env: {
        NODE_ENV: 'production'
      },
      // MUHIM: rate-limit endi bazada (telegram_rate_limit jadvali,
      // barcha instance'lar uchun umumiy) saqlanadi — shuning uchun
      // `instances`ni 1'dan oshirish (cluster rejimi) endi rate-limit
      // nuqtai nazaridan XAVFSIZ (ilgari har bir instance o'z alohida
      // xotira-hisobini yuritardi va limit chetlab o'tilardi). Grammy
      // long-polling (getUpdates) rejimida ishlagani sababli, baribir
      // 1'dan ortiq instance ishga tushirish tavsiya etilmaydi — Telegram
      // bitta botdan bir vaqtning o'zida faqat bitta long-polling
      // ulanishga ruxsat beradi, qolganlari 409 xatosi bilan yiqiladi.
      instances: 1,
      autorestart: true,
      watch: false
    },
    {
      // 🆕 "Obunachi yig'ish" (majburiy obuna/sponsor-gate) uchun ALOHIDA,
      // mustaqil Telegram bot — o'z tokeni (TELEGRAM_SUBSCRIBER_BOT_TOKEN,
      // .env yoki admin panel) bilan ishlaydi. Yuqoridagi 'telegram-bot'
      // bilan bir xil sabablarga ko'ra (long-polling) instances 1'da
      // qoldirilishi kerak.
      name: 'telegram-subscriber-bot',
      script: 'telegram-bot/subscriber-bot/index.ts',
      cwd: __dirname,
      interpreter: './node_modules/.bin/tsx',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
