const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const supportEndpoints = `
// POST /api/support
app.post("/api/support", supportLimiter, async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    if (!email || !subject || !message) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
    }
    
    const ticket = await prisma.supportTicket.create({
      data: { email, subject, message }
    });

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      await transporter.sendMail({
        from: '"Savdo24 Support" <noreply@savdo24.uz>',
        to: process.env.EMAIL_USER || "admin@savdo24.uz",
        subject: \`Yangi murojaat: \${subject}\`,
        html: \`
          <h3>Yangi murojaat kelib tushdi</h3>
          <p><strong>Email:</strong> \${email}</p>
          <p><strong>Mavzu:</strong> \${subject}</p>
          <p><strong>Xabar:</strong> \${message}</p>
        \`
      });
    } catch (emailErr) {
      console.error("Support email sending failed:", emailErr);
    }

    res.status(201).json({ success: true, message: "Murojaatingiz yuborildi." });
  } catch (err) {
    console.error("Support POST error:", err);
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// GET /api/admin/support-tickets
app.get("/api/admin/support-tickets", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (err) {
    console.error("Get support tickets error:", err);
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// PATCH /api/admin/support-tickets/:id/status
app.patch("/api/admin/support-tickets/:id/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(ticket);
  } catch (err) {
    console.error("Update ticket error:", err);
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});
`;

code = code.replace('app.post("/api/reports",', supportEndpoints + '\napp.post("/api/reports",');
fs.writeFileSync('server.ts', code);
