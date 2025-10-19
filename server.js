const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const mysql = require("mysql2");

const app = express();
const PORT = 3000;

//  Connexion MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "contenu"
});

db.connect((err) => {
  if (err) {
    console.error("Erreur de connexion MySQL:", err);
    return;
  }
  console.log(" Connecté à MySQL (contenu)");

  // Créer la table si elle n'existe pas
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS contenu (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      sujet TEXT,
      message TEXT,
      date_envoi VARCHAR(100)
    )
  `;
  db.query(createTableQuery, (err) => {
    if (err) console.error("Erreur création table:", err);
  });
});

//  Compte admin
const ADMIN_EMAIL = "adjalamar85@gmail.com";
const ADMIN_PASSWORD = "Karim0549";

//  Nodemailer config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: ADMIN_EMAIL,
    pass: "dlmq dlxx cdlo nwws"
  }
});

//  Upload fichier Excel
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers Excel sont autorisés"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

//  Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
);
app.use("/public", express.static(path.join(__dirname, "public")));

//  Auth
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/?error=" + encodeURIComponent("Connectez-vous d'abord"));
  }
  next();
};

//  Login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.redirect("/?error=" + encodeURIComponent("Email et mot de passe requis"));
  }
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.user = email;
    res.redirect("/send");
  } else {
    res.redirect("/?error=" + encodeURIComponent("Identifiants incorrects"));
  }
});

//  Page send
app.get("/send", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "send.html"));
});

//  Envoi email + enregistrement
app.post("/send", requireAuth, upload.single("file"), async (req, res) => {
  let emails = [];

  try {
    if (!req.body.sujet || !req.body.message) {
      return res.redirect("/send?error=" + encodeURIComponent("Sujet et message requis"));
    }

    const { sujet, message } = req.body;

    // Lecture du fichier Excel
    if (req.file) {
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      emails = data.flat().map(e => String(e).trim()).filter(e => e && e.includes("@"));
      fs.unlinkSync(req.file.path);
    } else if (req.body.to) {
      emails = req.body.to.split(",").map(e => e.trim()).filter(e => e.includes("@"));
    } else {
      return res.redirect("/send?error=" + encodeURIComponent("Aucun email trouvé"));
    }

    for (let email of emails) {
      try {
        await transporter.sendMail({
          from: ADMIN_EMAIL,
          to: email,
          subject: sujet,
          text: message,
          html: message.replace(/\n/g, "<br>")
        });

        // Temps actuel (français)
        const date_envoi = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

        //  Enregistrement MySQL
        const sql = "INSERT INTO contenu (email, sujet, message, date_envoi) VALUES (?, ?, ?, ?)";
        db.query(sql, [email, sujet, message, date_envoi], (err) => {
          if (err) console.error("Erreur insertion:", err);
        });

      } catch (err) {
        console.error(`Erreur envoi à ${email}:`, err);
      }
    }

    res.redirect("/send?success=" + encodeURIComponent("Emails envoyés et enregistrés avec succès "));
  } catch (err) {
    console.error("Erreur:", err);
    res.redirect("/send?error=" + encodeURIComponent("Erreur: " + err.message));
  }
});

//  Historique avec ID + Date_envoi
app.get("/history", requireAuth, (req, res) => {
  db.query("SELECT * FROM contenu ORDER BY id DESC", (err, rows) => {
    if (err) return res.send("Erreur base de données: " + err.message);

    let html = `
      <h2> Historique des emails envoyés</h2>
      <table border="1" cellpadding="5" cellspacing="0">
        <tr><th>ID</th><th>Email</th><th>Sujet</th><th>Message</th><th>Date d'envoi</th></tr>
        ${rows.map(r => `
          <tr>
            <td>${r.id}</td>
            <td>${r.email}</td>
            <td>${r.sujet}</td>
            <td>${r.message}</td>
            <td>${r.date_envoi}</td>
          </tr>
        `).join("")}
      </table>
      <br><a href="/send">⬅ Retour</a>
    `;
    res.send(html);
  });
});

//  Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Dossier uploads
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.listen(PORT, () =>
  console.log(` Serveur démarré sur: http://localhost:${PORT}`)
);
